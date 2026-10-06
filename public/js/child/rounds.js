import { stopAudio } from "../audio.js";

// Vòng "từng lượt" dùng chung cho các trò chơi: chạy play(target, i) lần lượt từng mục tiêu, ghi kết quả (ctx.record) và trả { correct, total }.
// Ở khu Trẻ em (ctx.nav không có) chạy thẳng như vòng for cũ. Ở Luyện tập Bài Bản, runSession truyền ctx.nav = { begin(i, n), wait(), end() } để có
// nút ◀ Trước / Tiếp ▶ nhảy giữa các lượt: lượt đang chơi dở bị bỏ (không tính điểm); bấm Trước ở lượt đầu / Tiếp ở lượt cuối thì thoát
// vòng và trả thêm `nav: -1 | +1` để nơi gọi chuyển sang trò kế/trước. play có thể trả null = hộp vẽ đã bị gỡ (thoát giữa chừng) → dừng.
export async function eachRound(ctx, targets, play) {
  const nav = ctx.nav;
  const ok = new Map(); // chỉ số lượt → đúng/sai (chơi lại 1 lượt thì ghi đè)
  let i = 0;
  let exit = 0;
  while (i < targets.length) {
    ctx.setProgress(i, targets.length);
    let r;
    if (nav) {
      nav.begin(i, targets.length);
      const res = await Promise.race([play(targets[i], i), nav.wait()]);
      if (res && typeof res === "object" && res.__nav) {
        stopAudio();
        const j = i + res.__nav;
        if (j < 0 || j >= targets.length) { exit = res.__nav; break; }
        i = j;
        continue;
      }
      r = res;
    } else {
      r = await play(targets[i], i);
    }
    if (r === null) break;
    ctx.record(targets[i].id, r);
    ok.set(i, Boolean(r));
    i++;
  }
  nav?.end();
  return { correct: [...ok.values()].filter(Boolean).length, total: ok.size, ...(exit ? { nav: exit } : {}) };
}
