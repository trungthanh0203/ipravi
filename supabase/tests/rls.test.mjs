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

console.log(`\n${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
