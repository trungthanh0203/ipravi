import { el } from "../../ui.js";
import { T } from "../../strings.js";
import { sample } from "../util.js";
import { playItem, say, visual } from "../media.js";
import { sfx } from "../sfx.js";
import { traceTexts } from "../../viet.js";
import { scoreTrace } from "../../trace-score.js";
import { SKIP } from "./phonics.js";

// Tô chữ theo MẪU CHỮ THẢO tiểu học Việt Nam (phông Playwrite VN, tự lưu trong app). Bé dùng ngón tay/bút cảm ứng tô lên chữ mẫu mờ.
// Chấm bằng trace-score.js: độ phủ + nét thừa + TỪNG MẢNH (thân chữ, dấu thanh, dấu mũ…) — bỏ dấu thanh là chưa đạt. Không hiện "sai", được sửa lại 1 lần.
// Giai đoạn 1: KHÔNG kiểm tra thứ tự/hướng nét (cần dữ liệu nét). Ngón tay trên kính ≠ bút trên giấy → chỉ là bổ trợ, vẫn nên tập viết trên vở.
const FONT = '"Playwrite VN"';
const GRID = 0.5; // lưới chấm điểm = 1/2 kích thước hiển thị (đủ mịn, đủ nhanh)

export async function fontReady(sampleText) {
  try {
    const faces = await document.fonts.load(`400 64px ${FONT}`, sampleText);
    return faces.length > 0 && document.fonts.check(`400 64px ${FONT}`, sampleText);
  } catch {
    return false;
  }
}

// Dựng khung tô 1 chuỗi. Trả { root, undo, clear, hasInk, evaluate, showMissed, inkCtx, size }.
export function createTracer(text, availWidth) {
  const W = Math.max(240, Math.min(640, Math.round(availWidth)));
  const probe = document.createElement("canvas").getContext("2d");
  probe.font = `400 100px ${FONT}`;
  const w100 = Math.max(20, probe.measureText(text).width);
  const S = Math.max(40, Math.min(170, (0.86 * W * 100) / w100)); // cỡ chữ: vừa bề ngang, tối đa 170 px
  const H = Math.round(1.9 * S + 36);
  const baseline = Math.round(18 + 1.32 * S);
  const x0 = Math.round((W - (w100 * S) / 100) / 2);
  const brush = Math.max(9, Math.min(26, 0.13 * S));
  const dpr = Math.min(2, window.devicePixelRatio || 1);

  const mk = (cls) => {
    const c = el("canvas", { class: cls, width: Math.round(W * dpr), height: Math.round(H * dpr), style: `width:${W}px;height:${H}px` });
    const g = c.getContext("2d");
    g.scale(dpr, dpr);
    return { c, g };
  };
  const guide = mk("trace-layer");
  const hint = mk("trace-layer");
  const ink = mk("trace-layer trace-ink");
  ink.c.style.touchAction = "none"; // không cuộn/thu phóng trang khi tô

  // ---- chữ mẫu mờ + dòng kẻ ----
  const g = guide.g;
  g.fillStyle = "#fff"; g.fillRect(0, 0, W, H);
  g.lineWidth = 1;
  for (const [dy, dash, col] of [[0, [], "#e7b48f"], [-0.5 * S, [6, 5], "#f0d6c0"], [-1.0 * S, [6, 5], "#f0d6c0"]]) {
    g.strokeStyle = col; g.setLineDash(dash);
    g.beginPath(); g.moveTo(6, baseline + dy); g.lineTo(W - 6, baseline + dy); g.stroke();
  }
  g.setLineDash([]);
  g.font = `400 ${S}px ${FONT}`;
  g.textBaseline = "alphabetic";
  g.fillStyle = "#c5d0dc"; g.strokeStyle = "#c5d0dc"; g.lineWidth = 0.05 * S; g.lineJoin = "round";
  g.fillText(text, x0, baseline); g.strokeText(text, x0, baseline); // nét mờ dày hơn chữ thật để dễ nhìn

  // ---- nét bé tô ----
  const strokes = []; // mỗi nét = mảng điểm {x, y} (toạ độ hiển thị)
  let cur = null;
  let penSeen = false;
  const style = (g2, scale = 1) => { g2.strokeStyle = "#e8590c"; g2.fillStyle = "#e8590c"; g2.lineWidth = brush * scale; g2.lineCap = "round"; g2.lineJoin = "round"; };
  const drawStroke = (g2, pts, scale = 1) => {
    style(g2, scale);
    if (pts.length === 1) { g2.beginPath(); g2.arc(pts[0].x * scale, pts[0].y * scale, (brush * scale) / 2, 0, Math.PI * 2); g2.fill(); return; }
    g2.beginPath();
    g2.moveTo(pts[0].x * scale, pts[0].y * scale);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = ((pts[i].x + pts[i + 1].x) / 2) * scale, my = ((pts[i].y + pts[i + 1].y) / 2) * scale;
      g2.quadraticCurveTo(pts[i].x * scale, pts[i].y * scale, mx, my);
    }
    const last = pts[pts.length - 1];
    g2.lineTo(last.x * scale, last.y * scale);
    g2.stroke();
  };
  const redraw = () => { ink.g.clearRect(0, 0, W, H); strokes.forEach((s) => drawStroke(ink.g, s)); if (cur) drawStroke(ink.g, cur); };
  const pos = (e) => { const r = ink.c.getBoundingClientRect(); return { x: ((e.clientX - r.left) * W) / r.width, y: ((e.clientY - r.top) * H) / r.height }; };

  ink.c.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "pen") penSeen = true;
    if (penSeen && e.pointerType === "touch") return; // bút đang dùng → bỏ qua lòng bàn tay
    e.preventDefault();
    ink.c.setPointerCapture?.(e.pointerId);
    cur = [pos(e)];
    redraw();
  });
  ink.c.addEventListener("pointermove", (e) => {
    if (!cur) return;
    e.preventDefault();
    const evs = e.getCoalescedEvents?.();
    for (const ev of evs && evs.length ? evs : [e]) cur.push(pos(ev));
    redraw();
  });
  const end = () => { if (cur) { strokes.push(cur); cur = null; redraw(); } };
  ink.c.addEventListener("pointerup", end);
  ink.c.addEventListener("pointercancel", end);

  // ---- chấm điểm ----
  const gw = Math.round(W * GRID), gh = Math.round(H * GRID);
  const bits = (g2, thr) => { const d = g2.getImageData(0, 0, gw, gh).data; const b = new Uint8Array(gw * gh); for (let i = 0; i < b.length; i++) b[i] = d[i * 4 + 3] >= thr ? 1 : 0; return b; };
  function evaluate() {
    const gm = document.createElement("canvas"); gm.width = gw; gm.height = gh;
    const gg = gm.getContext("2d", { willReadFrequently: true });
    gg.font = `400 ${S * GRID}px ${FONT}`; gg.textBaseline = "alphabetic"; gg.fillStyle = "#000";
    gg.fillText(text, x0 * GRID, baseline * GRID); // chữ mẫu MẢNH (không làm dày) = nét thật để so
    const im = document.createElement("canvas"); im.width = gw; im.height = gh;
    const ig = im.getContext("2d", { willReadFrequently: true });
    strokes.forEach((s) => drawStroke(ig, s, GRID));
    return scoreTrace({
      glyph: bits(gg, 96), ink: bits(ig, 40), w: gw, h: gh,
      tolIn: Math.max(2, Math.round(0.05 * S * GRID)), tolOut: Math.max(3, Math.round(0.075 * S * GRID)),
    });
  }
  // Khoanh cam các mảnh chưa tô (thường là dấu thanh/dấu mũ) để bé biết tô thêm chỗ nào.
  function showMissed(parts) {
    hint.g.clearRect(0, 0, W, H);
    hint.g.strokeStyle = "#f59f00"; hint.g.lineWidth = 3; hint.g.setLineDash([7, 5]);
    for (const p of parts) {
      const pad = 8;
      hint.g.beginPath();
      hint.g.roundRect?.((p.x0 - 0) / GRID - pad, p.y0 / GRID - pad, (p.x1 - p.x0 + 1) / GRID + 2 * pad, (p.y1 - p.y0 + 1) / GRID + 2 * pad, 10);
      hint.g.stroke();
    }
  }

  const root = el("div", { class: "trace-wrap", style: `width:${W}px;height:${H}px` }, guide.c, hint.c, ink.c);
  return {
    root, size: S, inkCtx: ink.g, strokes, layout: { W, H, x0, baseline, S, brush },
    undo() { strokes.pop(); hint.g.clearRect(0, 0, W, H); redraw(); },
    clear() { strokes.length = 0; hint.g.clearRect(0, 0, W, H); redraw(); },
    hasInk: () => strokes.length > 0,
    evaluate, showMissed, redraw,
  };
}

export async function runTrace(ctx) {
  const pool = ctx.items.filter((i) => traceTexts(i.text_vi));
  if (pool.length < 2) return SKIP;
  if (!(await fontReady(pool.map((i) => i.text_vi).join("")))) return SKIP; // không nạp được phông mẫu → bỏ qua, không làm bé kẹt
  const targets = sample(pool, Math.min(ctx.config.rounds ?? 3, pool.length));
  let correct = 0;
  for (let i = 0; i < targets.length; i++) {
    ctx.setProgress(i, targets.length);
    const item = targets[i];
    const texts = traceTexts(item.text_vi);
    let all = true;
    for (let k = 0; k < texts.length; k++) {
      if (!ctx.box.isConnected) return { correct, total: i };
      all = (await traceOne(ctx, item, texts[k], texts.length > 1 ? k : -1, i === 0 && k === 0)) && all;
    }
    ctx.record(item.id, all);
    if (all) correct++;
  }
  return { correct, total: targets.length };
}

// 1 chuỗi cần tô: Promise<boolean> (đạt ngay hoặc sau khi sửa = true nếu đạt ở lần chấm nào đó; sai 2 lần thì false nhưng vẫn sang chữ kế).
function traceOne(ctx, item, text, pairIndex, first) {
  return new Promise((resolve) => {
    const tracer = createTracer(text, (ctx.box.clientWidth || 340) - 8);
    let tries = 0;
    const msgLine = el("p", { class: "trace-msg muted" }, "");
    const stars = el("div", { class: "stars big" }, "");
    const doneBtn = el("button", { class: "btn big", onclick: check }, T.traceDone);
    const finish = (ok, delay) => { doneBtn.disabled = true; setTimeout(() => resolve(ok), delay); };
    function check() {
      if (!tracer.hasInk()) { msgLine.textContent = T.traceTryFirst; return; }
      const r = tracer.evaluate();
      if (r.blank) { msgLine.textContent = T.traceTryFirst; return; }
      tries++;
      stars.textContent = "⭐".repeat(r.stars) + "☆".repeat(3 - r.stars);
      if (r.ok) { sfx.good(); msgLine.textContent = T.traceGood; playItem(item); return finish(true, 1500); }
      sfx.oops();
      tracer.showMissed(r.missed);
      if (tries >= 2) { msgLine.textContent = T.traceEnough; return finish(false, 1500); }
      msgLine.textContent = r.missed.length ? T.traceMissed : T.traceMore;
    }
    const label = pairIndex === 0 ? T.traceUpper : pairIndex === 1 ? T.traceLower : null;
    ctx.box.replaceChildren(
      el("p", { class: "instr" }, T.instrTrace),
      el("div", { class: "row-btns", style: "justify-content:center" }, item.emoji || item.image_path ? visual(item, "sm") : null, el("button", { class: "btn ghost small", onclick: () => playItem(item) }, "🔊 " + T.listenVi), label ? el("span", { class: "pill" }, label) : null),
      el("div", { class: "trace-center" }, tracer.root),
      stars, msgLine,
      el("div", { class: "row-btns", style: "justify-content:center" },
        el("button", { class: "btn ghost", onclick: () => tracer.undo() }, T.traceUndo),
        el("button", { class: "btn ghost", onclick: () => { tracer.clear(); msgLine.textContent = ""; stars.textContent = ""; } }, T.traceClear),
        doneBtn));
    (async () => { if (first) await say(T.instrTrace); })();
  });
}
