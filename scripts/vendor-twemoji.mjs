// Tải các emoji ĐANG DÙNG trong app về public/vendor/twemoji/ (bộ Twemoji của jdecked, CC-BY 4.0) và sinh public/js/twemoji-index.js (danh sách
// tên file có sẵn — để giao diện biết emoji nào dùng được mà không phải đoán/gọi 404).
// Quét: giao-trinh/csv/*.csv (cột emoji, unit_emoji), public/js/*.js, supabase/seed/*.sql, và các emoji thêm ở dòng lệnh.
// Chạy:  node scripts/vendor-twemoji.mjs [emoji thêm…]      (chạy lại khi thêm emoji mới vào nội dung; tăng VERSION trong public/sw.js)
import fs from "node:fs";
import path from "node:path";
import { parseCsv } from "../public/js/admin/csv.js";
import { twemojiName, graphemes, isEmojiGrapheme } from "../public/js/emoji.js";

const root = new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const OUT = path.join(root, "public/vendor/twemoji");
const SRC = "https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/svg/";
fs.mkdirSync(OUT, { recursive: true });

const found = new Set();
const scan = (s) => { for (const g of graphemes(s)) if (isEmojiGrapheme(g)) found.add(g); };
for (const f of fs.readdirSync(path.join(root, "giao-trinh/csv"))) {
  const { headers, rows } = parseCsv(fs.readFileSync(path.join(root, "giao-trinh/csv", f), "utf8"));
  for (const col of ["emoji", "unit_emoji"]) { const i = headers.indexOf(col); if (i >= 0) rows.forEach((r) => scan(r[i])); }
}
const walk = (dir, exts) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? (d.name === "vendor" ? [] : walk(path.join(dir, d.name), exts)) : exts.some((e) => d.name.endsWith(e)) ? [path.join(dir, d.name)] : []));
for (const f of [...walk(path.join(root, "public/js"), [".js"]), ...walk(path.join(root, "supabase/seed"), [".sql"])]) {
  if (f.endsWith("twemoji-index.js")) continue;
  scan(fs.readFileSync(f, "utf8"));
}
process.argv.slice(2).forEach(scan);

const names = new Map([...found].map((g) => [twemojiName(g), g]));
let ok = 0;
const missing = [];
const queue = [...names.keys()];
async function worker() {
  while (queue.length) {
    const n = queue.shift();
    const file = path.join(OUT, n + ".svg");
    if (fs.existsSync(file)) { ok++; continue; }
    const r = await fetch(SRC + n + ".svg");
    if (!r.ok) { missing.push(`${names.get(n)} (${n})`); continue; }
    fs.writeFileSync(file, await r.text());
    ok++;
  }
}
await Promise.all(Array.from({ length: 8 }, worker));

const have = fs.readdirSync(OUT).filter((f) => f.endsWith(".svg")).map((f) => f.slice(0, -4)).filter((n) => names.has(n)).sort();
fs.writeFileSync(path.join(root, "public/js/twemoji-index.js"),
  `// SINH TỰ ĐỘNG bởi scripts/vendor-twemoji.mjs — đừng sửa tay. Tên file Twemoji có sẵn trong public/vendor/twemoji/.\nexport const TWEMOJI = new Set(${JSON.stringify(have)});\n`);
console.log(`Emoji đang dùng: ${names.size} · có file: ${have.length} · thiếu: ${missing.length}${missing.length ? " → " + missing.join(" ") : ""}`);
