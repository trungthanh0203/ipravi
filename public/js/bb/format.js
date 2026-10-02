import { el } from "../ui.js";

// Markdown-lite CHO chặng Ngữ pháp (công thức + câu ví dụ) — CHỈ 4 kiểu + xuống dòng, không đụng HTML thật:
// **đậm**, *nghiêng*, !!đỏ!!, `code` (khối nổi/badge, yêu cầu chủ dự án 2026-10-02) — ban đầu chỉ 3 kiểu đầu
// (2026-10-01: "nghiêng, đậm, màu chữ đỏ và đặc biệt là xuống dòng").
// formatSegments() là hàm thuần (test ở tests/bb.test.mjs) — trả mảng DÒNG, mỗi dòng là mảng đoạn chữ
// {text, bold?, italic?, red?, code?}; formatNodes() mới dựng DOM (KHÔNG dùng innerHTML nên không có nguy cơ XSS
// dù chữ gõ tự do) — 2 nơi gọi (bb/steps/grammar.js, admin/bb.js) dùng chung để không lặp lại cách render.
//
// Quét bằng tay (không dùng 1 regex gộp cả 4 kiểu) vì !!đỏ!! LỒNG trong **đậm**/*nghiêng* (vd "**Táo !!giá!! bao
// nhiêu**") cần ĐỆ QUY phân tích lại phần chữ bên trong mỗi cặp — 1 regex gộp sẽ nuốt luôn cặp !!...!! bên trong
// làm chữ thường, hiện trần 2 dấu !! ra màn hình (lỗi chủ dự án báo 2026-10-02).
const MARKERS = [
  { open: "**", key: "bold" },
  { open: "*", key: "italic" },
  { open: "!!", key: "red" },
  { open: "`", key: "code" },
];
const hasStyle = (seg) => MARKERS.some(({ key }) => seg[key]);

function inlineSegments(line) {
  const out = [];
  let i = 0;
  while (i < line.length) {
    const hit = MARKERS.find(({ open }) => line.startsWith(open, i) && line.indexOf(open, i + open.length) !== -1);
    if (hit) {
      const end = line.indexOf(hit.open, i + hit.open.length);
      const content = line.slice(i + hit.open.length, end);
      // Đoạn con nào CHƯA có kiểu riêng (vd chưa phải !!đỏ!! lồng bên trong) mới nhận thêm kiểu ngoài — đoạn đỏ lồng
      // bên trong giữ nguyên là đỏ, không bị cộng dồn thành vừa đậm vừa đỏ.
      for (const seg of inlineSegments(content)) out.push(hasStyle(seg) ? seg : { ...seg, [hit.key]: true });
      i = end + hit.open.length;
    } else {
      let next = line.length;
      for (const { open } of MARKERS) {
        const idx = line.indexOf(open, i + 1);
        if (idx !== -1 && idx < next) next = idx;
      }
      out.push({ text: line.slice(i, next) });
      i = next;
    }
  }
  return out.filter((s) => s.text !== "");
}

export function formatSegments(text) {
  return String(text ?? "").split("\n").map(inlineSegments);
}

export function formatNodes(text) {
  const nodes = [];
  formatSegments(text).forEach((line, i) => {
    if (i > 0) nodes.push(el("br"));
    line.forEach((s) => {
      if (s.bold) nodes.push(el("strong", null, s.text));
      else if (s.italic) nodes.push(el("em", null, s.text));
      else if (s.red) nodes.push(el("span", { class: "bb-red" }, s.text));
      else if (s.code) nodes.push(el("code", { class: "bb-code" }, s.text));
      else nodes.push(s.text);
    });
  });
  return nodes;
}
