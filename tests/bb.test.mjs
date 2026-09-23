// "Tiếng Việt Bài Bản" — hàm thuần: toán Leitner (srs.js) + chọn phiên ôn tập (practice-core.js). Chạy: node tests/bb.test.mjs
import { INTERVAL_DAYS, nextBox, dueAfter } from "../public/js/bb/srs.js";
import { isDue, dueCount, pickSession } from "../public/js/bb/practice-core.js";
import { SKILLS } from "../public/js/bb/skills.js";

let pass = 0, fail = 0;
const ok = (c, n, x = "") => { (c ? pass++ : fail++); console.log(`${c ? "ok  " : "FAIL"} ${n}${c ? "" : "  <-- " + x}`); };

// ---- srs.js: toán Leitner ----
ok(nextBox(1, true) === 2 && nextBox(3, true) === 4, "nextBox: nhớ thì tăng hộp");
ok(nextBox(5, true) === 5, "nextBox: hộp 5 là tối đa, không tăng thêm");
ok(nextBox(4, false) === 1 && nextBox(1, false) === 1, "nextBox: quên thì về hộp 1, bất kể hộp cũ");
ok(nextBox(undefined, true) === 2, "nextBox: box chưa có (mục mới) coi như hộp 1");

const from = new Date("2026-01-01T00:00:00.000Z");
ok(dueAfter(1, from).getTime() === from.getTime() + INTERVAL_DAYS[1] * 86_400_000, "dueAfter: hộp 1 → +1 ngày");
ok(dueAfter(5, from).getTime() === from.getTime() + INTERVAL_DAYS[5] * 86_400_000, "dueAfter: hộp 5 → +16 ngày");
ok(dueAfter(99, from).getTime() === from.getTime() + INTERVAL_DAYS[5] * 86_400_000, "dueAfter: hộp lạ rơi về khoảng xa nhất (an toàn)");
for (let b = 1; b <= 5; b++) ok(INTERVAL_DAYS[b] >= 0 && (b === 1 || INTERVAL_DAYS[b] > INTERVAL_DAYS[b - 1]), `INTERVAL_DAYS[${b}] tăng dần theo hộp`);

// ---- practice-core.js: đến hạn + chọn phiên ----
const now = new Date("2026-06-15T00:00:00.000Z");
const item = (id, daysFromNow) => ({ id, due_at: new Date(now.getTime() + daysFromNow * 86_400_000).toISOString() });
ok(isDue(item(1, -1), now) && isDue(item(2, 0), now) && !isDue(item(3, 1), now), "isDue: quá hạn/đúng hạn = due, chưa tới hạn = không");
ok(dueCount([item(1, -1), item(2, 5), item(3, -2)], now) === 2, "dueCount: đếm đúng số mục đến hạn");

{
  const items = [item("a", 5), item("b", -3), item("c", -1), item("d", 2), item("e", -10)];
  const session = pickSession(items, { limit: 3, now });
  ok(session.length === 3, "pickSession: giới hạn đúng limit");
  ok(session.every((i) => isDue(i, now)), "pickSession: ưu tiên mục đến hạn trước (limit vừa đủ số mục quá hạn)");
  ok(session[0].id === "e" && session[1].id === "b" && session[2].id === "c", "pickSession: trong số đến hạn, hạn xa nhất (lâu quá hạn nhất) lên đầu");
}
{
  // Không có mục nào đến hạn → vẫn trả về mục (chưa tới hạn), ưu tiên hạn gần nhất (ôn sớm nhất trong số chưa tới hạn).
  const items = [item("x", 10), item("y", 2), item("z", 5)];
  const session = pickSession(items, { limit: 8, now });
  ok(session.length === 3 && session[0].id === "y" && session[2].id === "x", "pickSession: không mục nào đến hạn thì vẫn trả đủ, sắp theo hạn gần nhất trước");
}
ok(pickSession([], { now }).length === 0, "pickSession: rỗng không lỗi");

// ---- skills.js ----
ok(SKILLS.length === 4, "4 kỹ năng (Từ vựng SRS + ôn Hội thoại/Ngữ pháp/Ngữ âm)", String(SKILLS.length));
ok(SKILLS.filter((s) => s.graded).length === 1 && SKILLS.find((s) => s.graded).id === "vocab", "chỉ 'vocab' có graded:true (box Leitner thật)");
ok(new Set(SKILLS.map((s) => s.itemType)).size === 4, "itemType không trùng nhau giữa các kỹ năng");
ok(SKILLS.every((s) => ["vocab", "grammar", "phonics", "dialogue"].includes(s.itemType)), "itemType khớp CHECK constraint bb_srs_state.item_type (migration 023)");

console.log(`\n${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
