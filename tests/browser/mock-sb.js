// Giả lập Supabase trong trình duyệt (chỉ dùng để thử giao diện, KHÔNG deploy). Nạp qua dev-server:
//   const { installMock } = await import('/__tests/mock-sb.js'); const m = installMock(sb, { units: [...] });
// Mô phỏng vừa đủ PostgREST: select (nhúng bảng con), eq/neq/in/order/limit/range/single, insert/update/upsert/delete
// (xoá dây chuyền), rpc, storage. Trigger của CSDL thật KHÔNG được mô phỏng (đã có bài test PGlite riêng cho SQL).

const TABLES = ["units", "lessons", "content_items", "translations", "content_audio", "activities", "tuition_plans",
  "payments", "accounts", "settings", "child_profiles", "child_progress", "activity_log", "pronunciation_attempts",
  // "Tiếng Việt Bài Bản" (migration 022) — xem KE_HOACH_TIENG_VIET_BAI_BAN.md
  "bb_levels", "bb_units", "bb_lessons", "bb_lesson_steps", "bb_dialogue_lines", "bb_vocab", "bb_grammar",
  "bb_phonics_pairs", "bb_reading_passages", "bb_reading_questions", "bb_writing_tasks",
  "bb_progress", "bb_srs_state"];
const DEFAULT_STATUS = { units: "draft", lessons: "draft", content_items: "draft", activities: "draft", payments: "pending" };

export function installMock(sb, seed = {}) {
  const db = Object.fromEntries(TABLES.map((t) => [t, []]));
  db.settings = [{ id: 1, center_name: "Thử", payment_instructions: "IBAN DE00", extra_child_percent: 20, max_children: 6, trial_days: 7, currency: "EUR" }];
  Object.assign(db, seed);
  const files = new Set();
  const log = [];
  const rpcs = { admin_parent_overview: () => [] };
  const counters = {};
  const nextId = (t) => (counters[t] = Math.max(counters[t] ?? 0, ...db[t].map((r) => (typeof r.id === "number" ? r.id : 0))) + 1);

  const cascade = {
    units: [["lessons", "unit_id"]],
    lessons: [["content_items", "lesson_id"], ["activities", "lesson_id"]],
    content_items: [["translations", "item_id"], ["content_audio", "item_id"], ["child_progress", "item_id"]],
  };
  function removeRows(t, rows) {
    for (const r of rows) {
      for (const [child, fk] of cascade[t] ?? []) removeRows(child, db[child].filter((c) => c[fk] === r.id));
    }
    db[t] = db[t].filter((r) => !rows.includes(r));
  }

  function embed(t, row, sel) {
    const out = { ...row };
    for (const m of (sel ?? "").matchAll(/(\w+)(?:!\w+)?\(([^)]*)\)/g)) {
      const [, name, inner] = m;
      if (name === "content_items" && inner === "count") out.content_items = [{ count: db.content_items.filter((i) => i.lesson_id === row.id).length }];
      else if (name === "translations" || name === "content_audio") out[name] = db[name].filter((x) => x.item_id === row.id);
      else if (name === "accounts") out.accounts = db.accounts.find((a) => a.id === row.account_id) ?? null;
      else if (name === "tuition_plans") out.tuition_plans = db.tuition_plans.find((p) => p.id === row.plan_id) ?? null;
      else if (name === "bb_levels") out.bb_levels = db.bb_levels.find((l) => l.id === row.level_id) ?? null;
    }
    return out;
  }

  class Q {
    constructor(t) { Object.assign(this, { t, op: "select", filters: [], orders: [], sel: "*", wantRows: false }); }
    select(s = "*") { this.sel = s; this.wantRows = true; return this; }
    eq(c, v) { this.filters.push((r) => r[c] === v); return this; }
    neq(c, v) { this.filters.push((r) => r[c] !== v); return this; }
    in(c, vs) { this.filters.push((r) => vs.includes(r[c])); return this; }
    order(c, o = {}) { this.orders.push([c, o.ascending !== false]); return this; }
    limit(n) { this.lim = n; return this; }
    range(a, b) { this.rng = [a, b]; return this; }
    single() { this.one = true; return this; }
    insert(p) { this.op = "insert"; this.payload = p; return this; }
    update(p) { this.op = "update"; this.payload = p; return this; }
    upsert(p, o = {}) { this.op = "upsert"; this.payload = p; this.conflict = (o.onConflict ?? "id").split(","); return this; }
    delete() { this.op = "delete"; return this; }
    then(res, rej) { return Promise.resolve().then(() => this.run()).then(res, rej); }

    run() {
      const t = this.t;
      if (!db[t]) return { data: null, error: { message: `mock: bảng ${t} chưa hỗ trợ` } };
      log.push([this.op, t]);
      let rows = db[t].filter((r) => this.filters.every((f) => f(r)));
      if (this.op === "insert" || this.op === "upsert") {
        const made = [];
        for (const p of [].concat(this.payload)) {
          if (this.op === "upsert") {
            const hit = db[t].find((r) => this.conflict.every((c) => r[c] === p[c]));
            if (hit) { Object.assign(hit, p); made.push(hit); continue; }
          }
          const row = { ...(DEFAULT_STATUS[t] ? { status: DEFAULT_STATUS[t] } : {}), created_at: new Date().toISOString(), ...p };
          if (t === "payments") row.status = "pending"; // như trigger thật
          if (row.id === undefined && !["translations_none"].includes(t)) row.id = nextId(t);
          db[t].push(row);
          made.push(row);
        }
        rows = made;
      } else if (this.op === "update") {
        rows.forEach((r) => Object.assign(r, this.payload));
      } else if (this.op === "delete") {
        removeRows(t, rows);
        return { data: null, error: null };
      }
      if (this.op !== "select" && !this.wantRows) return { data: null, error: null };
      for (const [c, asc] of [...this.orders].reverse()) rows = [...rows].sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (asc ? 1 : -1));
      if (this.rng) rows = rows.slice(this.rng[0], this.rng[1] + 1);
      if (this.lim != null) rows = rows.slice(0, this.lim);
      const out = rows.map((r) => embed(t, r, this.sel));
      return this.one ? { data: out[0] ?? null, error: out[0] ? null : { message: "không có dòng nào" } } : { data: out, error: null };
    }
  }

  sb.from = (t) => new Q(t);
  sb.rpc = async (name) => ({ data: rpcs[name]?.() ?? [], error: null });
  sb.storage = {
    from: () => ({
      upload: async (path) => { files.add(path); return { error: null }; },
      remove: async (paths) => { paths.forEach((p) => files.delete(p)); return { error: null }; },
      getPublicUrl: (p) => ({ data: { publicUrl: `/blob/${p}` } }),
    }),
  };
  sb.auth.getSession = async () => ({ data: { session: { access_token: "test-token" } } });
  sb.auth.signOut = async () => { log.push(["signOut"]); };
  return { db, files, log, rpcs };
}
