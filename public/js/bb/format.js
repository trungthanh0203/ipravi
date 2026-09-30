import { el } from "../ui.js";

// Markdown-lite CHO chặng Ngữ pháp (công thức + câu ví dụ) — CHỈ 3 kiểu + xuống dòng, không đụng HTML thật:
// **đậm**, *nghiêng*, !!đỏ!! (yêu cầu chủ dự án 2026-10-01: "nghiêng, đậm, màu chữ đỏ và đặc biệt là xuống dòng").
// formatSegments() là hàm thuần (test ở tests/bb.test.mjs) — trả mảng DÒNG, mỗi dòng là mảng đoạn chữ
// {text, bold?, italic?, red?}; formatNodes() mới dựng DOM (KHÔNG dùng innerHTML nên không có nguy cơ XSS dù chữ
// gõ tự do) — 2 nơi gọi (bb/steps/grammar.js, admin/bb.js) dùng chung để không lặp lại cách render.
const INLINE_RE = /\*\*(.+?)\*\*|\*(.+?)\*|!!(.+?)!!/g;

function inlineSegments(line) {
  const out = [];
  let last = 0, m;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(line))) {
    if (m.index > last) out.push({ text: line.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ text: m[1], bold: true });
    else if (m[2] !== undefined) out.push({ text: m[2], italic: true });
    else if (m[3] !== undefined) out.push({ text: m[3], red: true });
    last = INLINE_RE.lastIndex;
  }
  if (last < line.length) out.push({ text: line.slice(last) });
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
      else nodes.push(s.text);
    });
  });
  return nodes;
}
