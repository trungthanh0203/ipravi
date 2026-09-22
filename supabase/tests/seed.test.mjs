// Kiểm thử dữ liệu mẫu (supabase/seed/*.sql): chạy được, không trùng khi chạy lại, và phụ huynh còn hạn đọc được.
import { newDb } from "./_pg.mjs";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const db = await newDb({ seed: true });
let pass = 0, fail = 0;
const ok = (c, n, x = "") => { (c ? pass++ : fail++); console.log(`${c ? "ok  " : "FAIL"} ${n}${c ? "" : "  <-- " + x}`); };
const one = async (sql, p) => (await db.query(sql, p)).rows[0];
const count = async (t) => Number((await one(`select count(*) c from public.${t}`)).c);

ok(await count("units") === 2 && await count("lessons") === 3, "2 chủ đề, 3 bài");
ok(await count("content_items") === 21, "21 mục từ", String(await count("content_items")));
ok(await count("translations") === 42, "mỗi mục có nghĩa Đức + Anh", String(await count("translations")));
ok(await count("activities") === 12, "12 hoạt động (4 dạng × 3 bài)");
ok((await one("select count(*) c from public.content_items where status <> 'approved' or emoji is null")).c == 0, "mọi mục đã duyệt và có emoji");

const dir = fileURLToPath(new URL("../seed/", import.meta.url));
for (const f of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await db.exec(readFileSync(dir + f, "utf8"));
ok(await count("content_items") === 21 && await count("units") === 2, "chạy seed lần 2 không tạo trùng");

// Tên dịch (002_title_translations.sql): phủ MỌI chủ đề/bài của giáo trình, chỉ bổ sung, chạy lại an toàn.
{
  const { parseCsv } = await import("../../public/js/admin/csv.js");
  const csvDir = fileURLToPath(new URL("../../giao-trinh/csv/", import.meta.url));
  const units = new Set(), lessons = new Set();
  for (const f of readdirSync(csvDir).filter((n) => n.endsWith(".csv"))) {
    const { headers, rows } = parseCsv(readFileSync(csvDir + f, "utf8"));
    const u = headers.indexOf("unit"), l = headers.indexOf("lesson");
    for (const r of rows) if (r[u]) { units.add(r[u].trim()); lessons.add(r[u].trim() + "|||" + r[l].trim()); }
  }
  await db.exec("delete from public.units where title_vi not in ('Con vật', 'Màu sắc')");
  for (const t of units) await db.query("insert into public.units (title_vi, status) select $1, 'draft' where not exists (select 1 from public.units where title_vi = $1)", [t]);
  for (const k of lessons) {
    const [ut, lt] = k.split("|||");
    await db.query("insert into public.lessons (unit_id, title_vi) select u.id, $2 from public.units u where u.title_vi = $1 and not exists (select 1 from public.lessons l where l.unit_id = u.id and l.title_vi = $2)", [ut, lt]);
  }
  await db.query("update public.units set title_tr = '{\"de\": \"Meine Wahl\"}' where title_vi = 'Gia đình'"); // admin đã sửa tay
  const sql = readFileSync(dir + "002_title_translations.sql", "utf8");
  await db.exec(sql);
  const noU = (await db.query("select title_vi from public.units where not hidden and not (title_tr ? 'de' and title_tr ? 'en')")).rows;
  const noL = (await db.query("select title_vi from public.lessons where not (title_tr ? 'de' and title_tr ? 'en')")).rows;
  ok(noU.length === 0, `mọi chủ đề (${units.size}) có tên dịch de + en`, noU.map((r) => r.title_vi).join(", "));
  ok(noL.length === 0, `mọi bài (${lessons.size}) có tên dịch de + en`, noL.map((r) => r.title_vi).join(", "));
  const kept = (await one("select title_tr->>'de' as de, title_tr->>'en' as en from public.units where title_vi = 'Gia đình'"));
  ok(kept.de === "Meine Wahl" && kept.en === "Family", "tên đã sửa tay được giữ, chỉ bổ sung ngôn ngữ còn thiếu", JSON.stringify(kept));
  await db.exec(sql);
  ok((await one("select title_tr->>'de' as de from public.units where title_vi = 'Gia đình'")).de === "Meine Wahl", "chạy lại lần 2 không đổi gì (tên sửa tay vẫn còn)");
}

// Diễn giải bài học (003_lesson_descriptions.sql, cột lessons.description từ migration 020): phủ MỌI bài của giáo trình,
// chỉ bổ sung, chạy lại an toàn. Dùng lại units/lessons đã tạo đủ ở khối "Tên dịch" phía trên.
{
  await db.query("update public.lessons set description = 'Đã ghi tay' where title_vi = 'Chào hỏi'"); // admin đã sửa tay
  const sql3 = readFileSync(dir + "003_lesson_descriptions.sql", "utf8");
  await db.exec(sql3);
  const noD = (await db.query("select title_vi from public.lessons where description is null")).rows;
  const totalLessons = await count("lessons");
  ok(noD.length === 0, `mọi bài (${totalLessons}) có nội dung diễn giải`, noD.map((r) => r.title_vi).join(", "));
  ok((await one("select description from public.lessons where title_vi = 'Chào hỏi'")).description === "Đã ghi tay", "diễn giải đã sửa tay được giữ, không bị ghi đè");
  await db.exec(sql3);
  ok((await one("select description from public.lessons where title_vi = 'Chào hỏi'")).description === "Đã ghi tay", "chạy lại lần 2 không đổi gì (diễn giải sửa tay vẫn còn)");
}

// Phụ huynh còn hạn thấy đủ nội dung qua RLS; gộp được nghĩa + âm thanh như app truy vấn.
const uid = (await one("insert into auth.users (email) values ('p@x.com') returning id")).id;
await db.exec("set role authenticated");
await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid]);
ok((await db.query("select id from public.content_items")).rows.length === 21, "phụ huynh còn hạn thấy 21 mục");
const kinds = (await db.query("select kind from public.activities order by lesson_id, sort_order limit 4")).rows.map((r) => r.kind);
ok(JSON.stringify(kinds) === '["listen_pick","match","listen_pick_text","listen_repeat"]', "thứ tự hoạt động của bài", kinds.join());
const de = (await db.query("select t.meaning from public.content_items i join public.translations t on t.item_id = i.id and t.lang = 'de' where i.text_vi = 'con gà'")).rows[0];
ok(de?.meaning === "Huhn", "nghĩa tiếng Đức của 'con gà' = Huhn", JSON.stringify(de));
await db.exec("reset role");
console.log(`\n${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
