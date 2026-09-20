// Lập DANH SÁCH HÌNH CẦN VẼ/CHỤP cho hoạ sĩ hoặc giáo viên từ các CSV giáo trình: những mục mà emoji không thể hiện đúng
// (khái niệm đặc trưng Việt Nam, cảnh truyện/câu, từ trừu tượng). Đầu ra: giao-trinh/hinh/danh-sach-hinh-can-ve.csv
// Chạy:  node scripts/hinh-can-ve.mjs        (đọc CSV; chạy lại khi thêm nội dung)
import fs from "node:fs";
import path from "node:path";
import { parseCsv } from "../public/js/admin/csv.js";
import { slugify } from "../public/js/admin/image-util.js";
import { graphemes } from "../public/js/emoji.js";

const root = new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
// Từ/cụm có hình gần đúng nhưng KHÔNG đúng với thực tế Việt Nam (theo danh sách giáo viên nên xem lại). Khớp theo chữ (không phân biệt hoa/thường).
const VIET = ["áo dài", "nón lá", "cây tre", "bánh chưng", "bánh giầy", "bánh trung thu", "lì xì", "đèn lồng", "hoa đào", "cánh đồng lúa", "con trâu", "trâu", "tết",
  "phở", "xôi", "chè", "bánh mì", "canh", "cơm", "nón", "nghé", "mận", "thơm", "bát", "cái bát", "đôi đũa", "cái thìa", "thìa", "hà nội", "huế", "đà nẵng", "việt nam",
  "gia lai", "pleiku", "rạch giá", "yên bái", "âu cơ", "êđê", "ghềnh ráng", "bánh", "bánh ngọt", "bún", "lạc", "dừa", "xe máy", "ô tô", "tàu hoả", "cầu vồng", "chuông", "cúc"];
const ABSTRACT_LESSONS = ["Từ chỉ hoạt động", "Từ chỉ đặc điểm"];

const out = [["ưu tiên", "loại", "cấp", "chủ đề", "bài", "chữ tiếng Việt", "emoji hiện tại", "mô tả gợi ý cho người vẽ", "tên file gợi ý"]];
const seenFile = new Map();
const add = (prio, kind, r, note) => {
  let file = slugify(r.vi) || "hinh";
  const n = (seenFile.get(file) ?? 0) + 1; seenFile.set(file, n);
  if (n > 1) file += "-" + n;
  out.push([prio, kind, r.level, r.unit, r.lesson, r.vi, r.emoji, note, file + ".png"]);
};
for (const f of fs.readdirSync(path.join(root, "giao-trinh/csv")).sort()) {
  const { headers, rows } = parseCsv(fs.readFileSync(path.join(root, "giao-trinh/csv", f), "utf8"));
  const col = (n) => headers.indexOf(n);
  for (const c of rows) {
    const r = { unit: c[col("unit")], level: c[col("level")] || "1", lesson: c[col("lesson")], vi: c[col("vi")], emoji: c[col("emoji")] ?? "", type: c[col("type")] || "word", pic: c[col("pic")] ?? "" };
    if (!r.emoji || r.type === "question") continue;
    const many = graphemes(r.emoji).length > 1;
    if (r.unit === "Chữ hoa" || r.unit === "Chữ cái" && r.type === "letter") continue; // hình từ khoá chữ cái/tên riêng: giữ emoji
    if (VIET.includes(r.vi.toLowerCase())) add(1, "Đặc trưng Việt Nam", r, `Hình minh hoạ đúng thực tế Việt Nam: “${r.vi}”. Nền trong suốt, một chủ thể, phong cách chung cho cả bộ.`);
    else if ((r.type === "sentence" || many) && r.pic === "decor" || many && r.type === "sentence") add(2, "Cảnh câu/truyện", r, `Tranh minh hoạ cho câu: “${r.vi}” (thể hiện ai đang làm gì, ở đâu). Không chữ trong tranh.`);
    else if (ABSTRACT_LESSONS.includes(r.lesson)) add(3, "Từ trừu tượng", r, `Hình thể hiện rõ nghĩa của từ “${r.vi}” (có thể là cặp tương phản, vd to ↔ nhỏ).`);
  }
}
const q = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
fs.mkdirSync(path.join(root, "giao-trinh/hinh"), { recursive: true });
fs.writeFileSync(path.join(root, "giao-trinh/hinh/danh-sach-hinh-can-ve.csv"), "﻿" + out.map((r) => r.map(q).join(",")).join("\r\n") + "\r\n");
const by = (k) => out.slice(1).filter((r) => r[1] === k).length;
console.log(`Danh sách: ${out.length - 1} hình — Đặc trưng Việt Nam ${by("Đặc trưng Việt Nam")} · Cảnh câu/truyện ${by("Cảnh câu/truyện")} · Từ trừu tượng ${by("Từ trừu tượng")}`);
