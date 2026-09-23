import { el, mount as paint } from "../../ui.js";
import { T } from "../../strings.js";

// Chặng Mini-game: KHÔNG có bảng nội dung riêng — engine thật (flashcard SRS, sentence builder, dialogue roleplay,
// phonics discrimination, unit boss quest) chạy runtime từ bb_vocab/bb_phonics_pairs của bài, làm ở Giai đoạn 4
// (xem KE_HOACH_TIENG_VIET_BAI_BAN.md). Ở Giai đoạn 3 chỉ là chỗ đứng để bài vẫn chạy hết chặng.
export function run(box) {
  return new Promise((resolve) => {
    paint(box, el("p", { class: "muted" }, T.bbMinigamePlaceholder), el("button", { class: "btn block", onclick: resolve }, T.next));
  });
}
