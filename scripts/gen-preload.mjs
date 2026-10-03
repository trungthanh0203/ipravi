// Sinh public/js/preload-map.json: màn hình → danh sách MỌI module nó (và module con) nạp, để flow.js modulepreload
// SONG SONG thay vì để trình duyệt khám phá từng tầng import (bai-ban-home.js sâu 5 tầng ≈ 5 lượt chờ mạng nối tiếp).
// Chạy lại sau khi thêm/bớt import: node scripts/gen-preload.mjs   (map cũ chỉ mất tối ưu, không gây lỗi)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const JS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "js");
const RE = /(?:^|\n)\s*(?:import|export)\b[^'"\n;]*?from\s*["'](\.[^"']+)["']|(?:^|\n)\s*import\s*["'](\.[^"']+)["']/g;
const depsOf = (f) => [...fs.readFileSync(f, "utf8").matchAll(RE)].map((m) => path.resolve(path.dirname(f), m[1] || m[2]));
function closure(entry, out = new Set()) {
  if (out.has(entry)) return out;
  out.add(entry);
  for (const d of depsOf(entry)) closure(d, out);
  return out;
}
const toUrl = (f) => "/js/" + path.relative(JS, f).split(path.sep).join("/");

const base = closure(path.join(JS, "main.js")); // main.js + flow.js... đã được nạp sẵn lúc khởi động
const map = {};
for (const f of fs.readdirSync(path.join(JS, "pages")).filter((x) => x.endsWith(".js"))) {
  const screen = f.replace(/\.js$/, "");
  map[screen] = [...closure(path.join(JS, "pages", f))].filter((m) => !base.has(m)).map(toUrl).sort();
}
const outFile = path.join(JS, "preload-map.json");
const text = JSON.stringify(map, null, 1) + "\n";
if (process.argv.includes("--check")) {
  const same = fs.existsSync(outFile) && fs.readFileSync(outFile, "utf8").replace(/\r\n/g, "\n") === text;
  console.log(same ? "preload-map.json còn mới" : "preload-map.json CŨ — chạy: node scripts/gen-preload.mjs");
  process.exit(same ? 0 : 1);
}
fs.writeFileSync(outFile, text);
console.log("preload-map.json:", Object.entries(map).map(([k, v]) => `${k}=${v.length}`).join(" "));
