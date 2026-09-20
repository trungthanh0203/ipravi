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
