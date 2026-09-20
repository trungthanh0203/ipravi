import { el } from "../ui.js";
import { A } from "./text.js";

// Tải lại 1 vùng của khu admin MÀ KHÔNG làm nhảy trang: giữ nguyên nội dung cũ + chiều cao cũ trong lúc tải,
// chỉ hiện chữ "Đang tải…" ở lần đầu (vùng còn trống). Gọi done() sau khi vẽ xong để trả lại vị trí cuộn.
// (Lỗi cũ: mỗi thao tác đều thay vùng bằng chữ "Đang tải…" → trang ngắn lại → trình duyệt cuộn về đầu trang.)
export function beginLoad(box) {
  const y = window.scrollY;
  if (box.hasChildNodes()) box.style.minHeight = box.offsetHeight + "px";
  else box.replaceChildren(el("p", { class: "muted" }, A.loading));
  let finished = false;
  return () => {
    if (finished) return;
    finished = true;
    box.style.minHeight = "";
    window.scrollTo(0, y);
  };
}
