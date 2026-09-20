// Kiểm thử MỌI migration (theo thứ tự) + RLS chéo vai trò trên Postgres trong bộ nhớ (PGlite).
// Chạy: npm i --no-save @electric-sql/pglite && node supabase/tests/rls.test.mjs   (node_modules đã .gitignore)
// Giả lập phần Supabase: schema auth (users, uid()), role anon/authenticated, schema storage.
import { newDb } from "./_pg.mjs";
import { readFileSync } from "node:fs";

const db = await newDb();
let pass = 0, fail = 0;
const ok = (cond, name, extra = "") => { (cond ? pass++ : fail++); console.log(`${cond ? "ok  " : "FAIL"} ${name}${cond ? "" : "  <-- " + extra}`); };
ok(true, "mọi migration chạy không lỗi");

const uid = async (email, meta = {}) =>
  (await db.query("insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id", [email, JSON.stringify(meta)])).rows[0].id;

// Chạy 1 khối với vai trò authenticated + JWT sub = id (giống request của Supabase).
async function as(id, fn) {
  await db.exec(`set role authenticated`);
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [id]);
  try { return await fn(); } finally {
    await db.exec(`reset role`);
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  }
}
const q = (sql, p) => db.query(sql, p).then((r) => r.rows);
const fails = async (sql, p) => { try { await db.query(sql, p); return null; } catch (e) { return e.message; } };

// ---- 1. Đăng ký tự tạo accounts ------------------------------------------------
const A = await uid("a@x.com", { content_language: "de", role: "admin" }); // cố tình gửi role=admin
const B = await uid("b@x.com", { content_language: "zzz" });               // ngôn ngữ sai
const ADM = await uid("adm@x.com");
await db.query("update public.accounts set role='admin' where id=$1", [ADM]); // như chạy trong SQL Editor
const accA = (await q("select * from public.accounts where id=$1", [A]))[0];
const accB = (await q("select * from public.accounts where id=$1", [B]))[0];
ok(accA.role === "parent", "đăng ký: role luôn là parent (bỏ qua role=admin trong metadata)");
ok(accA.access_status === "trial" && accA.child_slots === 1, "đăng ký: dùng thử + 1 con");
const days = (new Date(accA.access_until) - Date.now()) / 864e5;
ok(days > 6.9 && days < 7.1, "đăng ký: dùng thử 7 ngày", String(days));
ok(accB.content_language === "de", "đăng ký: ngôn ngữ sai -> mặc định de");

// ---- 2. accounts: phạm vi đọc + cột đặc quyền ------------------------------------
await as(A, async () => {
  ok((await q("select id from public.accounts")).length === 1, "phụ huynh A chỉ thấy tài khoản của mình");
  for (const col of ["role='admin'", "child_slots=5", "access_until=now()+interval '1 year'", "access_status='active'"]) {
    const e = await fails(`update public.accounts set ${col} where id='${A}'`);
    ok(e && /quản trị/.test(e), `phụ huynh KHÔNG tự sửa được ${col.split("=")[0]}`, String(e));
  }
  await db.query("update public.accounts set pin_hash='h', pin_salt='s', pronunciation_enabled=true where id=$1", [A]);
  ok((await q("select pin_hash from public.accounts"))[0].pin_hash === "h", "phụ huynh sửa được PIN + bật chấm phát âm");
  const r = await db.query("update public.accounts set pin_hash='x' where id=$1", [B]);
  ok(r.affectedRows === 0, "phụ huynh A không sửa được tài khoản B");
});
await as(ADM, async () => ok((await q("select id from public.accounts")).length === 3, "admin thấy tất cả tài khoản"));

// ---- 3. hồ sơ con + trần số con ----------------------------------------------------
let child1;
await as(A, async () => {
  child1 = (await q("insert into public.child_profiles (parent_id, nickname, avatar_id) values ($1,'Bé An','dog') returning id", [A]))[0].id;
  ok(!!child1, "tạo con thứ 1 thành công");
  const e = await fails("insert into public.child_profiles (parent_id, nickname, avatar_id) values ($1,'Bé Bo','cat')", [A]);
  ok(e && /Đã đủ số con/.test(e), "con thứ 2 bị chặn khi child_slots = 1", String(e));
  const e2 = await fails("insert into public.child_profiles (parent_id, nickname, avatar_id) values ($1,'Lén','cat')", [B]);
  ok(e2 && /row-level security/.test(e2), "không tạo con dưới tài khoản người khác", String(e2));
});
await as(B, async () => ok((await q("select id from public.child_profiles")).length === 0, "phụ huynh B không thấy con của A"));

// ---- 4. học phí + giao dịch --------------------------------------------------------
let plan;
await as(ADM, async () => {
  plan = (await q("insert into public.tuition_plans (name, price, duration_days) values ('1 tháng', 30, 30) returning id"))[0].id;
});
await as(A, async () => {
  ok((await q("select id from public.tuition_plans")).length === 1, "phụ huynh xem được mức học phí đang bán");
  const e = await fails("insert into public.tuition_plans (name, price, duration_days) values ('lậu', 0, 9999)");
  ok(e && /row-level security/.test(e), "phụ huynh không tạo được mức học phí", String(e));
  // Cố tình gian: giá 0, đã confirmed, gắn vào tài khoản B
  const p = (await q("insert into public.payments (account_id, kind, plan_id, amount, status, confirmed_at) values ($1,'tuition',$2,0,'confirmed',now()) returning *", [B, plan]))[0];
  ok(p.status === "pending" && p.account_id === A && Number(p.amount) === 30 && p.duration_days === 30,
     "giao dịch của phụ huynh luôn là pending, đúng chủ, giá lấy từ mức học phí", JSON.stringify(p));
  const r = await db.query("update public.payments set status='confirmed' where account_id=$1", [A]);
  ok(r.affectedRows === 0, "phụ huynh không tự xác nhận được giao dịch");
});
await as(B, async () => ok((await q("select id from public.payments")).length === 0, "B không thấy giao dịch của A"));

// ---- 5. admin xác nhận -> gia hạn -------------------------------------------------
const before = new Date((await q("select access_until from public.accounts where id=$1", [A]))[0].access_until);
let payId;
await as(ADM, async () => {
  payId = (await q("select id from public.payments where account_id=$1", [A]))[0].id;
  await db.query("update public.payments set status='confirmed' where id=$1", [payId]);
});
const afterA = (await q("select * from public.accounts where id=$1", [A]))[0];
const diff = (new Date(afterA.access_until) - before) / 864e5;
ok(Math.abs(diff - 30) < 0.01 && afterA.access_status === "active", "xác nhận: cộng đúng 30 ngày nối tiếp hạn dùng thử + chuyển active", String(diff));
const eDup = await as(ADM, () => fails("update public.payments set note='x' where id=$1", [payId]));
ok(eDup && /đã chốt/.test(eDup), "giao dịch đã xác nhận thì không sửa được nữa", String(eDup));

// ---- 6. thêm con: phí 1 lần, admin cấp ---------------------------------------------
let extraId;
await as(A, async () => { extraId = (await q("insert into public.payments (kind, extra_children) values ('extra_child', 1) returning id"))[0].id; });
const eNoAmt = await as(ADM, () => fails("update public.payments set status='confirmed' where id=$1", [extraId]));
ok(eNoAmt && /số tiền/.test(eNoAmt), "không xác nhận được phí con khi chưa nhập số tiền", String(eNoAmt));
await as(ADM, () => db.query("update public.payments set amount=6, status='confirmed' where id=$1", [extraId]));
ok((await q("select child_slots from public.accounts where id=$1", [A]))[0].child_slots === 2, "xác nhận phí con -> child_slots = 2");
await as(A, async () => {
  const r = await q("insert into public.child_profiles (parent_id, nickname, avatar_id) values ($1,'Bé Bo','cat') returning id", [A]);
  ok(r.length === 1, "con thứ 2 tạo được sau khi admin cấp");
  const dup = await fails("insert into public.child_profiles (parent_id, nickname, avatar_id) values ($1,'Trùng','cat')", [A]);
  ok(dup !== null, "vẫn bị chặn con thứ 3 (chưa cấp thêm) / trùng avatar", String(dup));
});
let bigId;
await as(A, async () => { bigId = (await q("insert into public.payments (kind, extra_children) values ('extra_child', 10) returning id"))[0].id; });
const eCap = await as(ADM, () => fails("update public.payments set amount=1, status='confirmed' where id=$1", [bigId]));
ok(eCap && /Vượt trần/.test(eCap), "không cấp vượt trần max_children (6)", String(eCap));
ok((await q("select child_slots from public.accounts where id=$1", [A]))[0].child_slots === 2, "child_slots không đổi khi vượt trần");

// ---- 7. nội dung học + hết hạn = khoá hết ------------------------------------------
let item;
await as(ADM, async () => {
  const u = (await q("insert into public.units (title_vi, status) values ('Con vật','approved') returning id"))[0].id;
  const l = (await q("insert into public.lessons (unit_id, title_vi, status) values ($1,'Bài 1','approved') returning id", [u]))[0].id;
  item = (await q("insert into public.content_items (lesson_id, text_vi, status) values ($1,'con gà','approved') returning id", [l]))[0].id;
  await db.query("insert into public.content_items (lesson_id, text_vi, status) values ($1,'nháp','draft')", [l]);
  await db.query("insert into public.translations (item_id, lang, meaning) values ($1,'de','Hahn')", [item]);
  await db.query("insert into public.content_audio (item_id, lang, file_path) values ($1,'vi','a.mp3')", [item]);
  ok((await q("select id from public.content_items")).length === 2, "admin thấy cả mục nháp");
});
await as(A, async () => {
  ok((await q("select id from public.content_items")).length === 1, "phụ huynh còn hạn chỉ thấy mục đã duyệt");
  ok((await q("select id from public.translations")).length === 1 && (await q("select id from public.content_audio")).length === 1, "đọc được bản dịch + âm thanh của mục đã duyệt");
  const e = await fails("insert into public.units (title_vi) values ('lậu')");
  ok(e && /row-level security/.test(e), "phụ huynh không tạo được nội dung", String(e));
  await db.query("insert into public.child_progress (child_id, item_id, mastery) values ($1,$2,1)", [child1, item]);
  ok(true, "ghi tiến độ cho con mình khi còn hạn");
});
await as(B, async () => {
  const e = await fails("insert into public.child_progress (child_id, item_id) values ($1,$2)", [child1, item]);
  ok(e !== null, "B không ghi được tiến độ cho con của A", String(e));
});
// Hết hạn
await db.query("update public.accounts set access_until = now() - interval '1 day' where id=$1", [A]);
await as(A, async () => {
  ok((await q("select id from public.content_items")).length === 0, "HẾT HẠN: không đọc được nội dung học");
  ok((await q("select id from public.translations")).length === 0, "HẾT HẠN: không đọc được bản dịch");
  const e = await fails("insert into public.child_progress (child_id, item_id) values ($1,$2) on conflict do nothing", [child1, item]);
  const e2 = await fails("insert into public.pronunciation_attempts (child_id, item_id, score) values ($1,$2,50)", [child1, item]);
  ok(e2 && /row-level security/.test(e2), "HẾT HẠN: không ghi được điểm phát âm", String(e2));
  ok((await q("select id from public.child_progress")).length === 1, "HẾT HẠN: vẫn đọc được dữ liệu của con (xuất/xoá)");
  ok((await q("select id from public.child_profiles")).length === 2, "HẾT HẠN: vẫn đọc được hồ sơ con");
  ok((await q("select id from public.tuition_plans")).length === 1, "HẾT HẠN: vẫn xem được mức học phí để gia hạn");
  ok((await q("select 1 from public.settings")).length === 1, "HẾT HẠN: vẫn đọc được cài đặt (hướng dẫn thanh toán)");
});
// Gia hạn lại từ hạn cũ đã qua: tính từ hôm nay
const pay2 = (await as(A, () => q("insert into public.payments (kind, plan_id) values ('tuition', $1) returning id", [plan])))[0].id;
await as(ADM, () => db.query("update public.payments set status='confirmed' where id=$1", [pay2]));
const re = (await q("select access_until from public.accounts where id=$1", [A]))[0].access_until;
const d2 = (new Date(re) - Date.now()) / 864e5;
ok(d2 > 29.9 && d2 < 30.1, "gia hạn khi đã hết hạn: tính 30 ngày từ HÔM NAY", String(d2));
// Khoá bởi admin
await as(ADM, () => db.query("update public.accounts set access_status='suspended' where id=$1", [A]));
await as(A, async () => ok((await q("select id from public.content_items")).length === 0, "bị admin khoá: không đọc được nội dung dù còn hạn"));
await as(ADM, () => db.query("update public.accounts set access_status='active' where id=$1", [A]));
await as(ADM, () => db.query("update public.payments set status='cancelled' where id=$1", [bigId]));
ok((await q("select status from public.payments where id=$1", [bigId]))[0].status === "cancelled", "admin huỷ được giao dịch pending");

// ---- 8. xoá dữ liệu con --------------------------------------------------------------
await as(A, async () => {
  await db.query("delete from public.child_profiles where id=$1", [child1]);
  ok((await q("select id from public.child_progress")).length === 0, "xoá hồ sơ con -> tiến độ bị xoá theo (cascade)");
});

// ---- 9. RPC tổng quan phụ huynh (migration 003) ----------------------------------------
await as(A, async () => {
  const e = await fails("select * from public.admin_parent_overview()");
  ok(e && /Chỉ admin/.test(e), "RPC admin_parent_overview: phụ huynh gọi bị từ chối", String(e));
});
await as(ADM, async () => {
  const rows = await q("select * from public.admin_parent_overview()");
  ok(rows.length === 2, "RPC: admin thấy đúng 2 phụ huynh (không lẫn tài khoản admin)", String(rows.length));
  const a = rows.find((r) => r.id === A);
  ok(a && a.children === 1 && Number(a.paid_count) >= 2 && a.child_slots === 2, "RPC: số con, số giao dịch đã xác nhận, child_slots", JSON.stringify(a));
  ok(rows.find((r) => r.id === B).children === 0 && rows.find((r) => r.id === B).last_activity === null, "RPC: phụ huynh chưa học -> 0 con, chưa có hoạt động");
});
await db.query("insert into public.activity_log (child_id, kind, score) values ($1, 'lesson', 90)", [(await q("select id from public.child_profiles where parent_id=$1", [A]))[0].id]);
await as(ADM, async () => ok((await q("select last_activity from public.admin_parent_overview() where id = $1", [A]))[0].last_activity !== null, "RPC: last_activity cập nhật sau khi bé học"));
await as(ADM, async () => {
  await db.query("update public.settings set extra_child_percent = 25, payment_instructions = 'IBAN x' where id = 1");
  ok((await q("select extra_child_percent from public.settings"))[0].extra_child_percent == 25, "admin sửa được cài đặt");
});
await as(A, async () => {
  const r = await db.query("update public.settings set extra_child_percent = 0 where id = 1");
  ok(r.affectedRows === 0, "phụ huynh KHÔNG sửa được cài đặt");
  const r2 = await db.query("update public.units set status = 'draft'");
  ok(r2.affectedRows === 0, "phụ huynh KHÔNG đổi được trạng thái duyệt nội dung");
});
// Admin ghi nhận thanh toán thay phụ huynh: chèn 'pending' rồi xác nhận (chèn thẳng 'confirmed' sẽ KHÔNG gia hạn)
await as(ADM, async () => {
  const before = (await q("select access_until from public.accounts where id=$1", [B]))[0].access_until;
  const id = (await q("insert into public.payments (account_id, kind, plan_id) values ($1,'tuition',$2) returning id", [B, plan]))[0].id;
  await db.query("update public.payments set status='confirmed' where id=$1", [id]);
  const after = (await q("select access_until, access_status from public.accounts where id=$1", [B]))[0];
  ok(Math.abs((new Date(after.access_until) - new Date(before)) / 864e5 - 30) < 0.01 && after.access_status === "active", "admin ghi nhận học phí cho phụ huynh B: +30 ngày, active");
});

// Chèn thẳng status=confirmed (kể cả admin) vẫn bị ép về pending -> không thể ghi nhận tiền mà quên gia hạn
await as(ADM, async () => {
  const before = (await q("select access_until from public.accounts where id=$1", [B]))[0].access_until;
  const r = (await q("insert into public.payments (account_id, kind, plan_id, status, confirmed_at) values ($1,'tuition',$2,'confirmed',now()) returning status, confirmed_at", [B, plan]))[0];
  const after = (await q("select access_until from public.accounts where id=$1", [B]))[0].access_until;
  ok(r.status === "pending" && r.confirmed_at === null && String(before) === String(after), "admin chèn thẳng status=confirmed -> ép về pending, chưa gia hạn");
});

// ---- 10. giọng TTS do admin chọn (migration 004) ----
await as(ADM, async () => {
  await db.query("update public.settings set tts_voices = $1::jsonb where id = 1", [JSON.stringify({ vi: "vi-VN-NamMinhNeural" })]);
  ok((await q("select tts_voices from public.settings"))[0].tts_voices.vi === "vi-VN-NamMinhNeural", "admin lưu được giọng TTS");
  const e = await fails("update public.settings set tts_voices = $1::jsonb where id = 1", [JSON.stringify(["không phải object"])]);
  ok(e !== null, "tts_voices bắt buộc là object JSON", String(e));
});
await as(A, async () => {
  const r = await db.query("update public.settings set tts_voices = $1::jsonb where id = 1", [JSON.stringify({ vi: "hack" })]);
  ok(r.affectedRows === 0, "phụ huynh KHÔNG đổi được giọng TTS");
  ok((await q("select tts_voices from public.settings"))[0].tts_voices.vi === "vi-VN-NamMinhNeural", "giọng TTS vẫn nguyên sau khi phụ huynh thử sửa");
});

// ---- 11. giọng nữ/nam (migration 005) ----
const audioAs = (extra) => `insert into public.content_audio (item_id, lang, file_path, source, ${extra.cols}) values (${item}, 'vi', 'x.mp3', 'tts', ${extra.vals})`;
await as(ADM, async () => {
  ok((await fails(audioAs({ cols: "gender", vals: "'male'" }))) === null, "âm thanh: gender = male hợp lệ");
  const e = await fails(audioAs({ cols: "gender", vals: "'robot'" }));
  ok(e !== null, "âm thanh: gender lạ bị từ chối", String(e));
});
// Dữ liệu cũ (chưa có gender) được suy ra từ tên giọng khi chạy lại migration; chạy lại nhiều lần không đổi kết quả
await db.query("insert into public.content_audio (item_id, lang, file_path, source, voice_name) values ($1,'vi','a.mp3','tts','vi-VN-NamMinhNeural'), ($1,'vi','b.mp3','tts','vi-VN-HoaiMyNeural'), ($1,'vi','c.mp3','human',null)", [item]);
await db.query("update public.settings set tts_voices = $1::jsonb where id = 1", [JSON.stringify({ vi: "vi-VN-HoaiMyNeural", de: { female: "de-DE-KatjaNeural", male: "de-DE-ConradNeural" } })]);
const mig005 = readFileSync(new URL("../migrations/005_voice_gender.sql", import.meta.url), "utf8");
await db.exec(mig005);
await db.exec(mig005);
const g = Object.fromEntries((await q("select file_path, gender from public.content_audio where file_path in ('a.mp3','b.mp3','c.mp3')")).map((r) => [r.file_path, r.gender]));
ok(g["a.mp3"] === "male" && g["b.mp3"] === "female" && g["c.mp3"] === null, "migration 005: suy ra giới từ tên giọng; file người thật giữ null", JSON.stringify(g));
const tv = (await q("select tts_voices from public.settings"))[0].tts_voices;
ok(tv.vi.female === "vi-VN-HoaiMyNeural" && tv.de.male === "de-DE-ConradNeural", "migration 005: chuỗi cũ -> {female}; dạng mới giữ nguyên; chạy 2 lần không hỏng", JSON.stringify(tv));
await as(A, async () => {
  const kid = (await q("select id from public.child_profiles where parent_id = $1 limit 1", [A]))[0].id;
  await db.query("update public.child_profiles set voice_gender = 'male' where id = $1", [kid]);
  ok((await q("select voice_gender from public.child_profiles where id = $1", [kid]))[0].voice_gender === "male", "phụ huynh (phiên của bé) đổi được giọng của con mình");
  const e = await fails("update public.child_profiles set voice_gender = 'robot' where id = $1", [kid]);
  ok(e !== null, "voice_gender lạ bị từ chối", String(e));
  await db.query("update public.accounts set voice_pref = $1::jsonb where id = $2", [JSON.stringify({ gender: "female" }), A]);
  ok((await q("select voice_pref from public.accounts where id = $1", [A]))[0].voice_pref.gender === "female", "phụ huynh đặt giọng mặc định (voice_pref.gender)");
});
await as(B, async () => {
  const r = await db.query("update public.child_profiles set voice_gender = 'female' where parent_id = $1", [A]);
  ok(r.affectedRows === 0, "phụ huynh B KHÔNG đổi được giọng con của A");
});

console.log(`\n${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
