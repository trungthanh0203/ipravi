import { el, mount as paint } from "../../ui.js";
import { T } from "../../strings.js";
import { playPath, nativeLang } from "../media.js";
import { micButton } from "../pron.js";

// Chặng Hội thoại: hiện cả đoạn hội thoại (mỗi dòng = vai + câu + nghĩa), nghe từng dòng, đọc thử (tái dùng
// audio.js/pronunciation.js). Tên vai (A/B) căn GIỮA đầu dòng; nút Nghe + Đọc thử đứng SÁT CẠNH nhau (`.row-btns`
// gộp gọn + căn giữa, khác `.row` vốn kéo giãn 2 đầu) — kết quả đọc thử hiện Ở DÒNG RIÊNG bên dưới.
// 1 dòng hội thoại (vai + câu + nghĩa + Nghe/Đọc thử liền kề) — dùng cả ở Luyện tập (từng thẻ có Trước/Tiếp).
export function lineCard(line, lang) {
  const [mic, feedback] = micButton(line.line_vi);
  const listenBtn = el("button", { class: "btn small ghost", type: "button", onclick: () => playPath(line.audio_path, line.line_vi) }, T.bbListen);
  return el("div", { class: "bb-line" },
    el("div", { class: "bb-line-head" }, el("span", { class: "pill" }, line.speaker)),
    el("p", { class: "bb-line-vi" }, line.line_vi),
    line.line_tr?.[lang] ? el("p", { class: "muted" }, line.line_tr[lang]) : null,
    el("div", { class: "row-btns" }, listenBtn, mic), feedback);
}

export function run(box, step) {
  return new Promise((resolve) => {
    const lines = step.content ?? [];
    if (lines.length === 0) {
      paint(box, el("p", { class: "muted" }, T.bbDialogueEmpty), el("button", { class: "btn block", onclick: resolve }, T.bbFinish));
      return;
    }
    const lang = nativeLang();
    const rows = lines.map((line) => lineCard(line, lang));
    paint(box, ...rows, el("button", { class: "btn block", onclick: resolve }, T.bbFinish));
  });
}
