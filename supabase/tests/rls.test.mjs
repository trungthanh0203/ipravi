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
  await db.query("update public.accounts set phone='0901234567', address='123 Đường ABC' where id=$1", [A]);
  const contact = (await q("select phone, address from public.accounts"))[0];
  ok(contact.phone === "0901234567" && contact.address === "123 Đường ABC", "phụ huynh tự sửa được điện thoại/địa chỉ (không bị trigger chặn)");
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

// ---- 12. vá giọng gán sai giới + thống kê (migration 006) ----
{
  const m006 = readFileSync(new URL("../migrations/006_voice_repair_summary.sql", import.meta.url), "utf8");
  // Tái hiện lỗi thật: giọng NAM nằm ở ô nữ; file "nữ" thực ra là giọng nam; cùng 1 ô có 2 file; giọng người thật không được đụng
  await db.query("delete from public.content_audio where item_id = $1", [item]);
  await db.query("update public.settings set tts_voices = $1::jsonb where id = 1", [JSON.stringify({ vi: { female: "vi-VN-NamMinhNeural" }, de: { male: "de-DE-KatjaNeural" }, en: { female: "en-US-JennyNeural", male: "en-US-GuyNeural" } })]);
  await db.query("insert into public.content_audio (item_id, lang, speed, gender, source, voice_name, file_path) values ($1,'vi','normal','female','tts','vi-VN-NamMinhNeural','sai1.mp3'), ($1,'vi','normal','male','tts','vi-VN-NamMinhNeural','dung-cu.mp3'), ($1,'vi','slow','female','tts','vi-VN-HoaiMyNeural','nu-dung.mp3'), ($1,'vi','normal','female','human',null,'nguoi-that.mp3'), ($1,'de','normal','male','tts','de-DE-KatjaNeural','de-sai.mp3'), ($1,'xx','normal','male','tts','xx-XX-LaLam','la.mp3')", [item]);
  await db.exec(m006);
  await db.exec(m006);
  const tv = (await q("select tts_voices from public.settings"))[0].tts_voices;
  ok(tv.vi.male === "vi-VN-NamMinhNeural" && !("female" in tv.vi), "006: giọng NAM ở ô nữ được chuyển sang ô nam", JSON.stringify(tv.vi));
  ok(tv.de.female === "de-DE-KatjaNeural" && !("male" in tv.de), "006: giọng NỮ ở ô nam được chuyển sang ô nữ", JSON.stringify(tv.de));
  ok(tv.en.female === "en-US-JennyNeural" && tv.en.male === "en-US-GuyNeural", "006: cấu hình đúng giữ nguyên");
  const rows = Object.fromEntries((await q("select file_path, lang, speed, gender, source from public.content_audio where item_id = $1", [item])).map((r) => [r.file_path, r]));
  ok(!rows["sai1.mp3"] && rows["dung-cu.mp3"]?.gender === "male", "006: file 'nữ' dùng giọng NamMinh → đổi nhãn nam, bản trùng cùng ô bị xoá (giữ bản mới nhất)", Object.keys(rows).join());
  ok(rows["nu-dung.mp3"]?.gender === "female", "006: file nữ đúng (HoaiMy) giữ nguyên");
  ok(rows["nguoi-that.mp3"]?.gender === "female" && rows["nguoi-that.mp3"]?.source === "human", "006: giọng người thật không bị đụng");
  ok(rows["de-sai.mp3"]?.gender === "female", "006: file 'nam' dùng giọng Katja → đổi nhãn nữ");
  ok(rows["la.mp3"]?.gender === "male", "006: tên giọng lạ (không đoán được) giữ nguyên nhãn");
}
await as(ADM, async () => {
  const rows = await q("select * from public.admin_audio_summary()");
  ok(rows.length >= 3 && rows.every((r) => Number(r.files) >= 1), "RPC admin_audio_summary: admin thấy thống kê theo (ngôn ngữ, giới, nguồn, giọng)", String(rows.length));
});
await as(A, async () => {
  const e = await fails("select * from public.admin_audio_summary()");
  ok(e && /Chỉ admin/.test(e), "RPC admin_audio_summary: phụ huynh bị từ chối", String(e));
});

// ---- 13. cấp của chủ đề + thống kê học tập (migration 007) ----
{
  const C = await uid("c@x.com"), D = await uid("d@x.com");
  const kid = (await q("insert into public.child_profiles (parent_id, nickname, avatar_id) values ($1,'Bé Cúc','frog') returning id", [C]))[0].id;
  ok((await q("select column_name from information_schema.columns where table_name='units' and column_name='level'")).length === 1, "007: units có cột level");
  await db.query("delete from public.units"); // bỏ nội dung của các mục test trước (cascade) để đếm chính xác
  const eLevel = await fails("insert into public.units (title_vi, level) values ('X', 5)");
  ok(eLevel && /check/i.test(eLevel), "007: level chỉ nhận 1–4", String(eLevel));
  // Cấp 1: 1 chủ đề duyệt (2 bài, 3 từ) + 1 bài NHÁP; Cấp 2: 1 chủ đề duyệt (1 bài, 1 câu); 1 chủ đề NHÁP cấp 3
  const u1 = (await q("insert into public.units (title_vi, level, status) values ('S-Cấp1', 1, 'approved') returning id"))[0].id;
  const u2 = (await q("insert into public.units (title_vi, level, status) values ('S-Cấp2', 2, 'approved') returning id"))[0].id;
  const u3 = (await q("insert into public.units (title_vi, level, status) values ('S-Cấp3 nháp', 3, 'draft') returning id"))[0].id;
  const les = async (u, t, st = "approved") => (await q("insert into public.lessons (unit_id, title_vi, status) values ($1,$2,$3) returning id", [u, t, st]))[0].id;
  const l1 = await les(u1, "B1"), l2 = await les(u1, "B2"), l3 = await les(u1, "B-nháp", "draft"), l4 = await les(u2, "B3"), l5 = await les(u3, "B4");
  const itm = async (l, t, st = "approved") => (await q("insert into public.content_items (lesson_id, text_vi, status) values ($1,$2,$3) returning id", [l, t, st]))[0].id;
  const a = await itm(l1, "a"), b = await itm(l1, "b"), c = await itm(l2, "c"), d = await itm(l3, "d"), e2 = await itm(l4, "e"), f = await itm(l5, "f");
  await itm(l1, "nháp", "draft");
  // Bé: thuộc a,b (mastery 3,4), c chưa thuộc và từng sai, e thuộc; d/f nằm ở nội dung chưa duyệt (không được tính)
  for (const [it, m, w] of [[a, 3, 0], [b, 4, 0], [c, 1, 2], [e2, 5, 0], [d, 5, 0], [f, 5, 0]])
    await db.query("insert into public.child_progress (child_id, item_id, mastery, wrong_count) values ($1,$2,$3,$4)", [kid, it, m, w]);
  const log = (lesson, score, mins, ago) => db.query("insert into public.activity_log (child_id, lesson_id, kind, score, duration_seconds, created_at) values ($1,$2,'lesson',$3,$4, now() - $5::interval)", [kid, lesson, score, mins * 60, ago]);
  await log(l1, 50, 5, "0 days"); await log(l1, 90, 10, "0 days"); await log(l2, 70, 8, "1 day"); await log(l4, 100, 6, "3 days"); await log(l3, 100, 6, "0 days");
  await db.query("insert into public.pronunciation_attempts (child_id, item_id, score) values ($1,$2,80), ($1,$2,60)", [kid, a]);

  await as(C, async () => {
    const st = (await q("select public.child_stats($1, 'UTC') as s", [kid]))[0].s;
    const L = Object.fromEntries(st.levels.map((x) => [x.level, x]));
    ok(L[1].items_total === 3 && L[1].items_mastered === 2 && L[1].lessons_total === 2 && L[1].lessons_done === 2, "007 thống kê: Cấp 1 = 3 từ (2 thuộc), 2 bài (2 xong); nội dung nháp không tính", JSON.stringify(L[1]));
    ok(L[2].items_total === 1 && L[2].items_mastered === 1 && L[2].lessons_done === 1, "007 thống kê: Cấp 2", JSON.stringify(L[2]));
    ok(!L[3], "007 thống kê: chủ đề nháp (cấp 3) không hiện", JSON.stringify(st.levels));
    ok(st.stars === 3 + 2 + 3, "007 thống kê: sao = điểm CAO NHẤT mỗi bài (90→3, 70→2, 100→3)", String(st.stars));
    ok(st.streak === 2, "007 thống kê: chuỗi ngày (hôm nay + hôm qua; hôm kia trống)", String(st.streak));
    ok(st.week.minutes === 5 + 10 + 8 + 6 + 6 && st.week.lessons === 5, "007 thống kê: 7 ngày gần nhất", JSON.stringify(st.week));
    ok(st.days.length === 14 && st.days[13].minutes === 5 + 10 + 6, "007 thống kê: 14 ngày, hôm nay ở cuối", JSON.stringify(st.days[13]));
    ok(st.pron.avg === 70 && st.pron.count === 2, "007 thống kê: điểm phát âm TB", JSON.stringify(st.pron));
    ok(st.review.length === 1 && st.review[0].text_vi === "c", "007 thống kê: từ cần ôn = từng sai + chưa thuộc", JSON.stringify(st.review));
    const bad = (await q("select public.child_stats($1, 'Không/CóMúiGiờNày') as s", [kid]))[0].s;
    ok(bad.days.length === 14, "007 thống kê: múi giờ lạ → dùng UTC, không lỗi");
  });
  await as(D, async () => {
    const e = await fails("select public.child_stats($1, 'UTC')", [kid]);
    ok(e && /không có quyền/i.test(e), "007 thống kê: phụ huynh khác KHÔNG xem được thống kê của bé", String(e));
  });
  await as(ADM, async () => ok((await q("select public.child_stats($1, 'UTC') as s", [kid]))[0].s.stars === 8, "007 thống kê: admin xem được"));
  // Hết hạn: nội dung bị khoá theo RLS → thống kê trả rỗng nhưng không lỗi
  await db.query("update public.accounts set access_until = now() - interval '1 day' where id = $1", [C]);
  await as(C, async () => {
    const st = (await q("select public.child_stats($1, 'UTC') as s", [kid]))[0].s;
    ok(Array.isArray(st.levels) && st.days.length === 14, "007 thống kê: tài khoản hết hạn vẫn gọi được, không lỗi", JSON.stringify(st.levels));
  });
  // Backfill cấp 2 theo tên chủ đề: chạy lại migration không đổi cấp đã chỉnh tay
  await db.query("update public.units set level = 4 where id = $1", [u2]);
  await db.exec(readFileSync(new URL("../migrations/007_levels_stats.sql", import.meta.url), "utf8"));
  ok((await q("select level from public.units where id=$1", [u2]))[0].level === 4, "007: chạy lại migration không ghi đè cấp admin đã chỉnh");
}

// ---- 14. học vần: kiểu mục, chữ đọc riêng, hoạt động mới (migration 008) ----
{
  const m008 = readFileSync(new URL("../migrations/008_phonics.sql", import.meta.url), "utf8");
  await db.query("delete from public.units");
  const u = (await q("insert into public.units (title_vi, level, status) values ('P', 3, 'approved') returning id"))[0].id;
  const l = (await q("insert into public.lessons (unit_id, title_vi, status) values ($1, 'PL', 'approved') returning id", [u]))[0].id;
  for (const t of ["letter", "syllable", "word", "sentence"]) {
    const e = await fails("insert into public.content_items (lesson_id, item_type, text_vi) values ($1, $2, 'x')", [l, t]);
    ok(e === null, `008: item_type '${t}' hợp lệ`, String(e));
  }
  ok(/check/i.test(await fails("insert into public.content_items (lesson_id, item_type, text_vi) values ($1, 'robot', 'x')", [l]) ?? ""), "008: item_type lạ vẫn bị chặn");
  await db.query("insert into public.content_items (lesson_id, item_type, text_vi, say_vi) values ($1, 'letter', 'b', 'bờ')", [l]);
  ok((await q("select say_vi from public.content_items where text_vi = 'b'"))[0].say_vi === "bờ", "008: lưu được chữ đọc riêng (say_vi)");
  for (const k of ["listen_pick_tone", "build_syllable", "fill_letter", "read_pick", "order_words", "listen_pick", "match"]) {
    ok((await fails("insert into public.activities (lesson_id, kind) values ($1, $2)", [l, k])) === null, `008: hoạt động '${k}' hợp lệ`);
  }
  ok(/check/i.test(await fails("insert into public.activities (lesson_id, kind) values ($1, 'hack')", [l]) ?? ""), "008: hoạt động lạ bị chặn");
  await db.exec(m008);
  ok((await q("select count(*)::int as n from public.content_items where lesson_id = $1", [l]))[0].n === 5, "008: chạy lại migration không mất dữ liệu");
  // Trẻ (phụ huynh) đọc được mục letter đã duyệt qua RLS; chỉ admin ghi
  await db.query("update public.content_items set status = 'approved' where lesson_id = $1", [l]);
  const P = await uid("p8@x.com");
  await as(P, async () => {
    ok((await q("select say_vi from public.content_items where text_vi = 'b'"))[0]?.say_vi === "bờ", "008: phụ huynh còn hạn đọc được mục chữ cái đã duyệt");
    const r = await db.query("update public.content_items set say_vi = 'hack' where text_vi = 'b'");
    ok(r.affectedRows === 0, "008: phụ huynh KHÔNG sửa được nội dung");
  });
}

// ---- 15. đọc hiểu (migration 009) ----
{
  const m009 = readFileSync(new URL("../migrations/009_reading.sql", import.meta.url), "utf8");
  await db.exec(m009); // mục 14 vừa chạy lại 008 (thu hẹp ràng buộc) — chạy lại 009 đúng như admin chạy tuần tự
  await db.query("delete from public.units");
  const u = (await q("insert into public.units (title_vi, level, status) values ('R', 4, 'approved') returning id"))[0].id;
  const l = (await q("insert into public.lessons (unit_id, title_vi, status) values ($1, 'RL', 'approved') returning id", [u]))[0].id;
  const ins = (type, extra) => fails("insert into public.content_items (lesson_id, item_type, text_vi, extra, status) values ($1, $2, 'x', $3::jsonb, 'approved')", [l, type, extra == null ? null : JSON.stringify(extra)]);
  ok((await ins("question", { choices: ["a", "b", "c"], answer: 2 })) === null, "009: câu hỏi hợp lệ (3 đáp án, đúng = 2)");
  ok((await ins("sentence", null)) === null, "009: mục thường không cần extra");
  for (const [name, extra] of [["thiếu extra", null], ["chỉ 1 đáp án", { choices: ["a"], answer: 1 }], ["5 đáp án", { choices: ["a", "b", "c", "d", "e"], answer: 1 }],
    ["answer vượt số đáp án", { choices: ["a", "b"], answer: 3 }], ["answer = 0", { choices: ["a", "b"], answer: 0 }], ["thiếu answer", { choices: ["a", "b"] }]]) {
    ok(/check/i.test((await ins("question", extra)) ?? ""), `009: câu hỏi ${name} bị chặn`);
  }
  for (const k of ["read_quiz", "fill_word", "write_check", "spell_word", "order_story"]) {
    ok((await fails("insert into public.activities (lesson_id, kind) values ($1, $2)", [l, k])) === null, `009: hoạt động '${k}' hợp lệ`);
  }
  // thống kê không đếm câu hỏi: 2 mục (1 câu + 1 câu hỏi) → items_total = 1
  await db.query("delete from public.content_items where lesson_id = $1", [l]);
  const s1 = (await q("insert into public.content_items (lesson_id, item_type, text_vi, status) values ($1,'sentence','Câu 1.','approved') returning id", [l]))[0].id;
  const q1 = (await q("insert into public.content_items (lesson_id, item_type, text_vi, extra, status) values ($1,'question','Hỏi?', '{\"choices\":[\"a\",\"b\"],\"answer\":1}'::jsonb,'approved') returning id", [l]))[0].id;
  const P = await uid("p9@x.com");
  const kid = (await q("insert into public.child_profiles (parent_id, nickname, avatar_id) values ($1,'Bé R','cat') returning id", [P]))[0].id;
  await db.query("insert into public.child_progress (child_id, item_id, mastery, wrong_count) values ($1,$2,4,0), ($1,$3,4,0), ($1,$3,4,0) on conflict do nothing", [kid, s1, q1]);
  await as(P, async () => {
    const st = (await q("select public.child_stats($1, 'UTC') as s", [kid]))[0].s;
    const L4 = st.levels.find((x) => x.level === 4);
    ok(L4 && L4.items_total === 1 && L4.items_mastered === 1, "009: thống kê KHÔNG đếm câu hỏi đọc hiểu là 'từ đã thuộc'", JSON.stringify(L4));
  });
  await db.exec(m009);
  ok((await q("select count(*)::int as n from public.content_items where lesson_id = $1", [l]))[0].n === 2, "009: chạy lại migration không mất dữ liệu");
}

// ---- 16. ngân hàng âm: chủ đề ẩn (migration 010) ----
{
  const m010 = readFileSync(new URL("../migrations/010_sound_bank.sql", import.meta.url), "utf8");
  await db.exec(m010); // mục 15 vừa chạy lại 009 (thay child_stats) — chạy lại 010 đúng thứ tự
  await db.query("delete from public.units");
  const u1 = (await q("insert into public.units (title_vi, level, status) values ('Thường', 1, 'approved') returning id"))[0].id;
  const uh = (await q("insert into public.units (title_vi, level, status, hidden) values ('Ngân hàng âm', 1, 'approved', true) returning id"))[0].id;
  ok((await q("select hidden from public.units where id = $1", [u1]))[0].hidden === false, "010: chủ đề mặc định KHÔNG ẩn");
  const mk = async (u, t) => {
    const l = (await q("insert into public.lessons (unit_id, title_vi, status) values ($1,$2,'approved') returning id", [u, t]))[0].id;
    return (await q("insert into public.content_items (lesson_id, item_type, text_vi, status) values ($1,'syllable','x','approved') returning id", [l]))[0].id;
  };
  const itNormal = await mk(u1, "L1"), itHidden = await mk(uh, "LH");
  const P = await uid("p10@x.com"), kid = (await q("insert into public.child_profiles (parent_id, nickname, avatar_id) values ($1,'Bé H','owl') returning id", [P]))[0].id;
  await db.query("insert into public.child_progress (child_id, item_id, mastery) values ($1,$2,4), ($1,$3,4)", [kid, itNormal, itHidden]);
  await db.query("insert into public.content_audio (item_id, lang, speed, gender, source, voice_kind, file_path) values ($1,'vi','normal','male','human','adult','a.wav')", [itHidden]);
  await as(P, async () => {
    const st = (await q("select public.child_stats($1, 'UTC') as s", [kid]))[0].s;
    const L1 = st.levels.find((x) => x.level === 1);
    ok(L1 && L1.items_total === 1 && L1.items_mastered === 1 && L1.lessons_total === 1, "010: thống kê KHÔNG đếm chủ đề ẩn", JSON.stringify(L1));
    ok((await q("select id from public.content_items where id = $1", [itHidden])).length === 1, "010: bé/phụ huynh vẫn ĐỌC được mục trong chủ đề ẩn (để phát âm thanh)");
    ok((await q("select id from public.content_audio where item_id = $1", [itHidden])).length === 1, "010: đọc được âm thanh của chủ đề ẩn");
    const r = await db.query("update public.units set hidden = false where id = $1", [uh]);
    ok(r.affectedRows === 0, "010: phụ huynh KHÔNG đổi được cờ ẩn");
  });
  await db.exec(m010);
  ok((await q("select count(*)::int as n from public.units"))[0].n === 2, "010: chạy lại migration không mất dữ liệu");
}

// ---- 17. đánh vần theo phần (migration 011) ----
{
  const m011 = readFileSync(new URL("../migrations/011_spell_along.sql", import.meta.url), "utf8");
  await db.exec(m011);
  await db.query("delete from public.units");
  const u = (await q("insert into public.units (title_vi, level, status) values ('SA', 3, 'approved') returning id"))[0].id;
  const l = (await q("insert into public.lessons (unit_id, title_vi, status) values ($1, 'SAL', 'approved') returning id", [u]))[0].id;
  ok((await fails("insert into public.activities (lesson_id, kind) values ($1, 'spell_along')", [l])) === null, "011: hoạt động 'spell_along' hợp lệ");
  ok((await fails("insert into public.activities (lesson_id, kind) values ($1, 'order_story')", [l])) === null, "011: hoạt động cũ (order_story) vẫn hợp lệ");
  ok(/check/i.test((await fails("insert into public.activities (lesson_id, kind) values ($1, 'hack')", [l])) ?? ""), "011: hoạt động lạ vẫn bị chặn");
  await db.exec(m011);
  ok((await q("select count(*)::int as n from public.activities where lesson_id = $1", [l]))[0].n === 2, "011: chạy lại migration không mất dữ liệu");
}

// ---- 18. hoạt động chữ hoa (migration 012) ----
{
  const m012 = readFileSync(new URL("../migrations/012_case_activities.sql", import.meta.url), "utf8");
  await db.exec(m012);
  await db.query("delete from public.units");
  const u = (await q("insert into public.units (title_vi, level, status) values ('CH', 3, 'approved') returning id"))[0].id;
  const l = (await q("insert into public.lessons (unit_id, title_vi, status) values ($1, 'CHL', 'approved') returning id", [u]))[0].id;
  for (const k of ["match_case", "pick_case", "fix_capital", "spell_along", "order_story"]) {
    ok((await fails("insert into public.activities (lesson_id, kind) values ($1, $2)", [l, k])) === null, `012: hoạt động '${k}' hợp lệ`);
  }
  ok(/check/i.test((await fails("insert into public.activities (lesson_id, kind) values ($1, 'hack')", [l])) ?? ""), "012: hoạt động lạ vẫn bị chặn");
  await db.exec(m012);
  ok((await q("select count(*)::int as n from public.activities where lesson_id = $1", [l]))[0].n === 5, "012: chạy lại migration không mất dữ liệu");
}

// ---- 19. tô chữ (migration 013) ----
{
  const m013 = readFileSync(new URL("../migrations/013_trace.sql", import.meta.url), "utf8");
  await db.exec(m013);
  await db.query("delete from public.units");
  const u = (await q("insert into public.units (title_vi, level, status) values ('TR', 3, 'approved') returning id"))[0].id;
  const l = (await q("insert into public.lessons (unit_id, title_vi, status) values ($1, 'TRL', 'approved') returning id", [u]))[0].id;
  for (const k of ["trace", "match_case", "spell_along", "order_story"]) ok((await fails("insert into public.activities (lesson_id, kind) values ($1, $2)", [l, k])) === null, `013: hoạt động '${k}' hợp lệ`);
  ok(/check/i.test((await fails("insert into public.activities (lesson_id, kind) values ($1, 'hack')", [l])) ?? ""), "013: hoạt động lạ vẫn bị chặn");
  await db.exec(m013);
  ok((await q("select count(*)::int as n from public.activities where lesson_id = $1", [l]))[0].n === 4, "013: chạy lại migration không mất dữ liệu");
}

// ---- 20. vai trò hình (migration 014) ----
{
  const m014 = readFileSync(new URL("../migrations/014_pic_role.sql", import.meta.url), "utf8");
  await db.exec(m014);
  await db.query("delete from public.units");
  const u = (await q("insert into public.units (title_vi, level, status) values ('PR', 1, 'approved') returning id"))[0].id;
  const l = (await q("insert into public.lessons (unit_id, title_vi, status) values ($1, 'PRL', 'approved') returning id", [u]))[0].id;
  const ins = (pic) => fails("insert into public.content_items (lesson_id, item_type, text_vi, pic) values ($1, 'word', 'x', $2)", [l, pic]);
  ok((await ins(null)) === null && (await ins("literal")) === null && (await ins("decor")) === null, "014: pic nhận null / literal / decor");
  ok(/check/i.test((await ins("robot")) ?? ""), "014: pic lạ bị chặn");
  await db.exec(m014);
  ok((await q("select count(*)::int as n from public.content_items where lesson_id = $1", [l]))[0].n === 3, "014: chạy lại migration không mất dữ liệu");
  const P = await uid("p14@x.com");
  await db.query("update public.content_items set status = 'approved' where lesson_id = $1", [l]);
  await as(P, async () => {
    ok((await q("select pic from public.content_items where pic = 'decor'")).length === 1, "014: phụ huynh còn hạn đọc được pic");
    ok((await db.query("update public.content_items set pic = 'literal' where pic = 'decor'")).affectedRows === 0, "014: phụ huynh KHÔNG sửa được pic");
  });
}

// ---- 21. tên dịch chủ đề/bài (migration 015) ----
{
  const m015 = readFileSync(new URL("../migrations/015_title_tr.sql", import.meta.url), "utf8");
  await db.query("delete from public.units");
  const u = (await q("insert into public.units (title_vi, level, status, title_tr) values ('TT', 1, 'approved', '{\"de\":\"Gruss\"}') returning id"))[0].id;
  const l = (await q("insert into public.lessons (unit_id, title_vi, status) values ($1, 'TTL', 'approved') returning id", [u]))[0].id;
  ok(Object.keys((await q("select title_tr from public.lessons where id = $1", [l]))[0].title_tr).length === 0, "015: bài mới có title_tr rỗng");
  ok(/check/i.test((await fails("update public.lessons set title_tr = '[1]' where id = $1", [l])) ?? ""), "015: title_tr phải là object");
  await db.exec(m015);
  ok((await q("select title_tr->>'de' as de from public.units where id = $1", [u]))[0].de === "Gruss", "015: chạy lại migration không mất tên dịch");
  const P = await uid("p15@x.com");
  await as(P, async () => {
    ok((await q("select title_tr->>'de' as de from public.units where id = $1", [u]))[0].de === "Gruss", "015: phụ huynh còn hạn đọc được tên dịch");
    ok((await db.query("update public.units set title_tr = '{}' where id = $1", [u])).affectedRows === 0, "015: phụ huynh KHÔNG sửa được tên dịch");
  });
}

// ---- 22. luyện tập theo kỹ năng (migration 016) ----
{
  const m016 = readFileSync(new URL("../migrations/016_practice.sql", import.meta.url), "utf8");
  await db.exec(m016); // mục 15–16 có thể đã chạy lại 009/010 (thay child_stats) — chạy lại 016 đúng thứ tự, đồng thời kiểm chạy lại không lỗi
  const { SKILLS, skillOf } = await import("../../public/js/child/skills.js");
  const kinds = [...SKILLS.flatMap((s) => s.kinds), "order_story", "read_quiz"];
  const wrong = [];
  for (const k of kinds) { const r = (await q("select public.skill_of($1) as s", [k]))[0].s; if (r !== skillOf(k)) wrong.push(`${k}: SQL=${r} JS=${skillOf(k)}`); }
  ok(wrong.length === 0, `016: skill_of() khớp skills.js (${kinds.length} loại trò)`, wrong.join("; "));
  ok((await q("select public.skill_of('khong-co') as s"))[0].s === null, "016: skill_of(trò lạ) = null");

  const P = await uid("p22@x.com"), P2 = await uid("p22b@x.com");
  const kid = (await q("insert into public.child_profiles (parent_id, nickname, avatar_id) values ($1,'Bé Luyện','frog') returning id", [P]))[0].id;
  await db.query("delete from public.units");
  const u = (await q("insert into public.units (title_vi, level, status) values ('L-Cấp1', 1, 'approved') returning id"))[0].id;
  const l = (await q("insert into public.lessons (unit_id, title_vi, status) values ($1, 'LB', 'approved') returning id", [u]))[0].id;
  await db.query("insert into public.content_items (lesson_id, text_vi, status) values ($1, 'a', 'approved')", [l]);

  await as(P, async () => {
    // Bài học: 1 dòng cả bài (600 s) + 2 dòng từng trò (250 s mỗi dòng) — như app ghi
    await db.query("insert into public.activity_log (child_id, lesson_id, kind, skill, source, score, duration_seconds) values ($1,$2,'listen_pick','listen','lesson',90,250), ($1,$2,'match','read','lesson',90,250), ($1,$2,'lesson',null,'lesson',90,600)", [kid, l]);
    // Luyện tập: 1 dòng phiên (300 s, không lesson_id) + 1 dòng trò (280 s)
    await db.query("insert into public.activity_log (child_id, kind, skill, source, score, duration_seconds) values ($1,'trace','trace','practice',80,280), ($1,'practice','trace','practice',80,300)", [kid]);
    const st = (await q("select public.child_stats($1, 'UTC') as s", [kid]))[0].s;
    ok(st.week.minutes === 15, "016: phút học chỉ cộng dòng phiên (10 phút bài + 5 phút luyện tập = 15, không đếm đôi)", JSON.stringify(st.week));
    ok(st.stars === 3 && st.week.lessons === 1, "016: phiên luyện tập KHÔNG tính là xong bài / không thêm sao bài học", JSON.stringify({ stars: st.stars, week: st.week }));
    ok(st.streak === 1, "016: luyện tập tính vào chuỗi ngày", String(st.streak));
    // Ghi kiểu cũ (không có skill/source) vẫn chạy và mặc định là bài học
    await db.query("insert into public.activity_log (child_id, lesson_id, kind, score, duration_seconds) values ($1,$2,'lesson',50,60)", [kid, l]);
    ok((await q("select source from public.activity_log where duration_seconds = 60"))[0].source === "lesson", "016: ghi kiểu cũ (không có cột mới) mặc định source='lesson'");
    const e = await fails("insert into public.activity_log (child_id, kind, source, duration_seconds) values ($1,'practice','hack',1)", [kid]);
    ok(e && /check/i.test(e), "016: source lạ bị chặn", String(e));
  });
  await as(P2, async () => {
    const e = await fails("insert into public.activity_log (child_id, kind, skill, source, duration_seconds) values ($1,'practice','listen','practice',1)", [kid]);
    ok(e && /row-level security/i.test(e), "016: phụ huynh khác KHÔNG ghi được nhật ký luyện tập cho bé của người khác", String(e));
    ok((await q("select id from public.activity_log where child_id = $1", [kid])).length === 0, "016: phụ huynh khác không đọc được nhật ký của bé");
  });
  const before = (await q("select count(*)::int as n from public.activity_log"))[0].n;
  await db.exec(m016);
  ok((await q("select count(*)::int as n from public.activity_log"))[0].n === before, "016: chạy lại migration không mất dữ liệu");
}

// ---- 23. thống kê theo kỹ năng (migration 017) ----
{
  const m017 = readFileSync(new URL("../migrations/017_skill_stats.sql", import.meta.url), "utf8");
  await db.exec(m017);
  const P = await uid("p23@x.com"), P2 = await uid("p23b@x.com");
  const kid = (await q("insert into public.child_profiles (parent_id, nickname, avatar_id) values ($1,'Bé Kỹ năng','frog') returning id", [P]))[0].id;
  const ins = (kind, skill, source, score, secs, ago) => db.query("insert into public.activity_log (child_id, kind, skill, source, score, duration_seconds, created_at) values ($1,$2,$3,$4,$5,$6, now() - $7::interval)", [kid, kind, skill, source, score, secs, ago]);
  for (const sc of [90, 86, 70, 95]) await ins("practice", "listen", "practice", sc, 100, "1 day"); // 4 phiên luyện tập, 3 phiên đạt ≥ 85
  await ins("listen_pick", "listen", "practice", 80, 120, "1 day");
  await ins("listen_pick", "listen", "lesson", 90, 180, "2 days");      // trò của bài học cũng tính vào kỹ năng
  await ins("match", null, "lesson", 60, 60, "3 days");                  // dòng cũ trước migration 016 (chưa có skill) → suy ra 'read'
  await ins("listen_pick", "listen", "lesson", 50, 90, "40 days");       // 30–60 ngày trước → điểm kỳ trước
  await ins("listen_pick", "listen", "lesson", 10, 90, "90 days");       // quá 60 ngày → không tính
  await ins("lesson", null, "lesson", 100, 600, "1 day");                // dòng cả bài → không tính vào kỹ năng
  await as(P, async () => {
    const st = (await q("select public.child_skill_stats($1) as s", [kid]))[0].s;
    const by = Object.fromEntries(st.skills.map((x) => [x.skill, x]));
    ok(by.listen.sessions === 4 && by.listen.good === 3, "017: phiên luyện tập + số phiên đạt ≥ 85", JSON.stringify(by.listen));
    ok(by.listen.activities_30 === 2 && by.listen.avg_30 === 85 && by.listen.minutes_30 === 5, "017: 30 ngày gần đây (2 lượt, TB 85, 5 phút — không đếm dòng phiên)", JSON.stringify(by.listen));
    ok(by.listen.avg_prev === 50, "017: điểm kỳ trước (30–60 ngày); dòng > 60 ngày bị bỏ", JSON.stringify(by.listen));
    ok(by.read && by.read.activities_30 === 1 && by.read.avg_30 === 60 && by.read.sessions === 0, "017: dòng cũ chưa có skill được suy ra từ kind (match → read)", JSON.stringify(by.read));
    ok(!("lesson" in by) && !("practice" in by) && Object.keys(by).length === 2, "017: dòng cả bài/cả phiên không thành kỹ năng", Object.keys(by).join());
  });
  await as(P2, async () => {
    const e = await fails("select public.child_skill_stats($1)", [kid]);
    ok(e && /không có quyền/i.test(e), "017: phụ huynh khác KHÔNG xem được thống kê kỹ năng của bé", String(e));
  });
  await as(ADM, async () => ok((await q("select public.child_skill_stats($1) as s", [kid]))[0].s.skills.length === 2, "017: admin xem được"));
  const P3 = await uid("p23c@x.com");
  const empty = (await q("insert into public.child_profiles (parent_id, nickname, avatar_id) values ($1,'Bé mới','frog') returning id", [P3]))[0].id;
  await as(P3, async () => ok((await q("select public.child_skill_stats($1) as s", [empty]))[0].s.skills.length === 0, "017: bé chưa chơi → danh sách rỗng, không lỗi"));
  await db.exec(m017);
  ok((await q("select count(*)::int as n from public.activity_log where child_id = $1", [kid]))[0].n === 10, "017: chạy lại migration không mất dữ liệu");
}

// ---- 23. bài giao tiếp (migration 019) ----
{
  const m019 = readFileSync(new URL("../migrations/019_dialogue.sql", import.meta.url), "utf8");
  await db.exec(m019);
  await db.query("delete from public.units");
  const u = (await q("insert into public.units (title_vi, level, status) values ('DL', 2, 'approved') returning id"))[0].id;
  const l = (await q("insert into public.lessons (unit_id, title_vi, status) values ($1, 'DLL', 'approved') returning id", [u]))[0].id;
  ok((await fails("insert into public.activities (lesson_id, kind) values ($1, 'dialogue')", [l])) === null, "019: hoạt động 'dialogue' hợp lệ");
  ok(/check/i.test((await fails("insert into public.activities (lesson_id, kind) values ($1, 'hack')", [l])) ?? ""), "019: hoạt động lạ vẫn bị chặn");
  await db.exec(m019);
  ok((await q("select count(*)::int as n from public.activities where lesson_id = $1", [l]))[0].n === 1, "019: chạy lại migration không mất dữ liệu");
}

// ---- 24. "Tiếng Việt Bài Bản" — nền dữ liệu (migration 022) ----
{
  const P = await uid("p24@x.com"), P2 = await uid("p24b@x.com"), P3 = await uid("p24c@x.com");

  // profile_type: mặc định 'child', chấp nhận 'learner', vẫn tính vào child_slots (trigger cũ không đổi, mỗi
  // tài khoản mặc định chỉ 1 slot nên dùng 2 tài khoản riêng để thử "mặc định" và "learner dùng hết slot" độc lập).
  await as(P, async () => {
    const c1 = (await q("insert into public.child_profiles (parent_id, nickname, avatar_id) values ($1,'Bé An','dog') returning profile_type", [P]))[0];
    ok(c1.profile_type === "child", "022: profile_type mặc định 'child'");
    const e = await fails("insert into public.child_profiles (parent_id, nickname, avatar_id, profile_type) values ($1,'Cô Lan','cat','learner')", [P]);
    ok(e && /Đã đủ số con/.test(e), "022: hồ sơ learner cũng tính vào child_slots (trigger cũ không đổi)", String(e));
  });
  await as(P3, async () => {
    const learnerId = (await q("insert into public.child_profiles (parent_id, nickname, avatar_id, profile_type) values ($1,'Cô Lan','cat','learner') returning id", [P3]))[0].id;
    ok(!!learnerId, "022: tạo được hồ sơ 'learner'");
  });
  await as(P2, async () => {
    const bad = await fails("insert into public.child_profiles (parent_id, nickname, avatar_id, profile_type) values ($1,'X','owl','teacher')", [P2]);
    ok(bad && /check/i.test(bad), "022: profile_type lạ bị chặn bởi CHECK", String(bad));
  });

  // Dựng cây nội dung: A1 (level) > 1 unit > 1 lesson > 2 chặng (1 duyệt, 1 nháp) + nội dung từng loại chặng.
  let level, unit, lesson, stepApproved, stepDraft, passage;
  await as(ADM, async () => {
    level = (await q("insert into public.bb_levels (code, name_vi, status) values ('A1','Sơ cấp 1','approved') returning id"))[0].id;
    unit = (await q("insert into public.bb_units (level_id, title_vi, status) values ($1,'Giới thiệu bản thân','approved') returning id", [level]))[0].id;
    lesson = (await q("insert into public.bb_lessons (unit_id, title_vi, status) values ($1,'Bài 1','approved') returning id", [unit]))[0].id;
    stepApproved = (await q("insert into public.bb_lesson_steps (lesson_id, step_type, sort_order, status) values ($1,'vocab',1,'approved') returning id", [lesson]))[0].id;
    stepDraft = (await q("insert into public.bb_lesson_steps (lesson_id, step_type, sort_order, status) values ($1,'grammar',2,'draft') returning id", [lesson]))[0].id;
    await db.query("insert into public.bb_vocab (step_id, word_vi, meaning) values ($1,'chào','{\"de\":\"Hallo\"}')", [stepApproved]);
    await db.query("insert into public.bb_vocab (step_id, word_vi) values ($1,'nháp-vocab')", [stepDraft]);
    await db.query("insert into public.bb_dialogue_lines (step_id, speaker, line_vi) values ($1,'A','Chào bạn!')", [stepApproved]);
    await db.query("insert into public.bb_grammar (step_id, formula) values ($1,'Chào + đại từ')", [stepApproved]);
    await db.query("insert into public.bb_phonics_pairs (step_id, sound_a, sound_b) values ($1,'ch','tr')", [stepApproved]);
    passage = (await q("insert into public.bb_reading_passages (step_id, passage_vi) values ($1,'Đoạn văn ngắn.') returning id", [stepApproved]))[0].id;
    await db.query("insert into public.bb_reading_questions (passage_id, question_vi, choices, answer) values ($1,'Câu hỏi?','[\"A\",\"B\"]',1)", [passage]);
    await db.query("insert into public.bb_writing_tasks (step_id, task_type, prompt_vi) values ($1,'fill','Điền từ')", [stepApproved]);
  });

  await as(P, async () => {
    ok((await q("select id from public.bb_levels")).length === 1, "022: phụ huynh còn hạn thấy cấp độ đã duyệt");
    ok((await q("select id from public.bb_units")).length === 1, "022: thấy chủ đề đã duyệt");
    ok((await q("select id from public.bb_lessons")).length === 1, "022: thấy bài đã duyệt");
    ok((await q("select id from public.bb_lesson_steps")).length === 1, "022: chỉ thấy chặng ĐÃ DUYỆT (không thấy chặng nháp)");
    ok((await q("select id from public.bb_vocab")).length === 1, "022: chỉ thấy từ vựng của chặng đã duyệt (không thấy mục của chặng nháp)");
    ok((await q("select id from public.bb_dialogue_lines")).length === 1, "022: đọc được hội thoại của chặng đã duyệt");
    ok((await q("select id from public.bb_grammar")).length === 1, "022: đọc được ngữ pháp của chặng đã duyệt");
    ok((await q("select id from public.bb_phonics_pairs")).length === 1, "022: đọc được ngữ âm của chặng đã duyệt");
    ok((await q("select id from public.bb_reading_passages")).length === 1, "022: đọc được đoạn văn của chặng đã duyệt");
    ok((await q("select id from public.bb_reading_questions")).length === 1, "022: đọc được câu hỏi (đi qua bảng đoạn văn tới chặng)");
    ok((await q("select id from public.bb_writing_tasks")).length === 1, "022: đọc được bài luyện viết của chặng đã duyệt");
    for (const [t, sql] of [
      ["bb_levels", `insert into public.bb_levels (code, name_vi) values ('A2','lậu')`],
      ["bb_units", `insert into public.bb_units (level_id, title_vi) values (${level},'lậu')`],
      ["bb_vocab", `insert into public.bb_vocab (step_id, word_vi) values (${stepApproved},'lậu')`],
    ]) {
      const e = await fails(sql);
      ok(e && /row-level security/.test(e), `022: phụ huynh không ghi được vào ${t}`, String(e));
    }
  });

  // Hết hạn: không đọc được nội dung Bài Bản nữa (giống nội dung trẻ em).
  await db.query("update public.accounts set access_until = now() - interval '1 day' where id=$1", [P]);
  await as(P, async () => {
    ok((await q("select id from public.bb_levels")).length === 0, "022: HẾT HẠN không đọc được cấp độ");
    ok((await q("select id from public.bb_vocab")).length === 0, "022: HẾT HẠN không đọc được từ vựng");
    ok((await q("select id from public.bb_reading_questions")).length === 0, "022: HẾT HẠN không đọc được câu hỏi đọc hiểu");
  });

  await as(P2, async () => ok((await q("select id from public.bb_levels")).length === 1, "022: phụ huynh khác (còn hạn) vẫn thấy nội dung đã duyệt — không phải riêng theo tài khoản"));

  await as(ADM, async () => {
    ok((await q("select id from public.bb_lesson_steps")).length === 2, "022: admin thấy cả chặng nháp");
    ok((await q("select id from public.bb_vocab")).length === 2, "022: admin thấy cả mục nháp");
  });

  const m022 = readFileSync(new URL("../migrations/022_bai_ban.sql", import.meta.url), "utf8");
  await db.exec(m022);
  ok((await q("select count(*)::int as n from public.bb_vocab"))[0].n === 2, "022: chạy lại migration không mất dữ liệu");
  await as(P2, async () => ok((await q("select id from public.bb_levels")).length === 1, "022: chạy lại migration không hỏng RLS (vẫn đọc được sau khi drop+create policy)"));
}

// ---- 25. "Tiếng Việt Bài Bản" — tiến độ + ôn tập kiểu Leitner (migration 023) ----
{
  const m023 = readFileSync(new URL("../migrations/023_bb_progress.sql", import.meta.url), "utf8");
  await db.exec(m023);
  const P = await uid("p25@x.com"), P2 = await uid("p25b@x.com");
  const kid = (await as(P, () => q("insert into public.child_profiles (parent_id, nickname, avatar_id, profile_type) values ($1,'Học viên','owl','learner') returning id", [P])))[0].id;

  let step;
  await as(ADM, async () => {
    const lv = (await q("insert into public.bb_levels (code, name_vi, status) values ('A2','Sơ cấp 2','approved') returning id"))[0].id;
    const u = (await q("insert into public.bb_units (level_id, title_vi, status) values ($1,'ĐL25','approved') returning id", [lv]))[0].id;
    const l = (await q("insert into public.bb_lessons (unit_id, title_vi, status) values ($1,'BL25','approved') returning id", [u]))[0].id;
    step = (await q("insert into public.bb_lesson_steps (lesson_id, step_type, status) values ($1,'vocab','approved') returning id", [l]))[0].id;
  });

  await as(P, async () => {
    await db.query("insert into public.bb_progress (child_id, step_id) values ($1,$2)", [kid, step]);
    ok((await q("select id from public.bb_progress where child_id=$1", [kid])).length === 1, "023: phụ huynh ghi được tiến độ chặng cho con mình");
    const e = await fails("insert into public.bb_progress (child_id, step_id) values ($1,$2)", [kid, step]);
    ok(e && /duplicate|unique/i.test(e), "023: mỗi chặng chỉ 1 dòng tiến độ / con (unique child_id,step_id)", String(e));

    await db.query("insert into public.bb_srs_state (child_id, item_type, item_id, box, due_at) values ($1,'vocab',1,2, now()) on conflict (child_id,item_type,item_id) do update set box=excluded.box", [kid]);
    const s = (await q("select box from public.bb_srs_state where child_id=$1", [kid]))[0];
    ok(s.box === 2, "023: lưu được trạng thái ôn tập (box Leitner)");
    const bad = await fails("insert into public.bb_srs_state (child_id, item_type, item_id) values ($1,'hack',1)", [kid]);
    ok(bad && /check/i.test(bad), "023: item_type lạ bị chặn bởi CHECK", String(bad));
  });

  await as(P2, async () => {
    const e = await fails("insert into public.bb_progress (child_id, step_id) values ($1,$2)", [kid, step]);
    ok(e && /row-level security/i.test(e), "023: phụ huynh khác KHÔNG ghi được tiến độ cho con của người khác", String(e));
    ok((await q("select id from public.bb_progress where child_id=$1", [kid])).length === 0, "023: phụ huynh khác không đọc được tiến độ của con người khác");
  });

  // Hết hạn: đọc vẫn được (xuất/xoá), ghi thì không.
  await db.query("update public.accounts set access_until = now() - interval '1 day' where id=$1", [P]);
  await as(P, async () => {
    ok((await q("select id from public.bb_progress where child_id=$1", [kid])).length === 1, "023: HẾT HẠN vẫn đọc được tiến độ (xuất/xoá)");
    const e = await fails("insert into public.bb_srs_state (child_id, item_type, item_id) values ($1,'grammar',2)", [kid]);
    ok(e && /row-level security/i.test(e), "023: HẾT HẠN không ghi được trạng thái ôn tập mới", String(e));
  });
  await db.query("update public.accounts set access_until = now() + interval '30 days' where id=$1", [P]);

  await as(ADM, async () => ok((await q("select id from public.bb_progress")).length >= 1, "023: admin xem được tiến độ mọi người học"));

  const before = (await q("select count(*)::int as n from public.bb_srs_state"))[0].n;
  await db.exec(m023);
  ok((await q("select count(*)::int as n from public.bb_srs_state"))[0].n === before, "023: chạy lại migration không mất dữ liệu");
}

console.log(`\n${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
