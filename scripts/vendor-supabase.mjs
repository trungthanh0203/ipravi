// Tải supabase-js (bản ESM của jsDelivr, gắn phiên bản) về public/vendor/supabase/ để phục vụ CÙNG NGUỒN với app:
//  - bỏ chuỗi 3 tầng yêu cầu tới CDN bên thứ ba lúc khởi động (nhanh hơn rõ khi mạng chậm);
//  - Service Worker cache được; không lộ IP của phụ huynh/bé cho CDN (GDPR); không phụ thuộc CDN còn sống.
// Chạy lại khi muốn nâng phiên bản:  node scripts/vendor-supabase.mjs [phiên bản, vd 2.116.0]
import fs from "node:fs";
import path from "node:path";

const version = process.argv[2] ?? "2";
const OUT = new URL("../public/vendor/supabase/", import.meta.url);
fs.mkdirSync(OUT, { recursive: true });

const fileOf = (p) => p.replace(/^\/npm\//, "").replace(/\/\+esm$/, "").replace(/@[\d.]+(?:-[\w.]+)?$/, "").replace(/^@/, "").replace(/[\/@]/g, "-") + ".js";
const seen = new Map(); // đường dẫn CDN → tên file cục bộ
const queue = [`/npm/@supabase/supabase-js@${version}/+esm`];
let entry = null;

while (queue.length) {
  const p = queue.shift();
  if (seen.has(p)) continue;
  const name = fileOf(p);
  seen.set(p, name);
  entry ??= name;
  const res = await fetch("https://cdn.jsdelivr.net" + p);
  if (!res.ok) throw new Error(`${p}: HTTP ${res.status}`);
  let code = await res.text();
  code = code.replace(/(from|import)\s*"(\/npm\/[^"]+\/\+esm)"/g, (_, kw, dep) => {
    if (!seen.has(dep)) queue.push(dep);
    return `${kw}"./${fileOf(dep)}"`;
  });
  code = code.replace(/\/\/# sourceMappingURL=.*$/m, "");
  fs.writeFileSync(new URL(name, OUT), code);
  console.log(name, code.length);
}
fs.writeFileSync(new URL("README.txt", OUT), `supabase-js đóng gói bởi jsDelivr (tải bằng scripts/vendor-supabase.mjs).\nFile vào: ${entry}\nNguồn: ${[...seen.keys()].join("\n       ")}\n`);
console.log("Xong. File vào:", entry);
