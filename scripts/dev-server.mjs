// Máy chủ chạy thử local, không cần wrangler: dùng chính worker.js + phục vụ ./public.
// Cấu hình đọc từ biến môi trường (giống Cloudflare); thiếu thì dùng giá trị GIẢ để xem giao diện
// (đăng ký/đăng nhập sẽ không chạy được nếu chưa có SUPABASE_URL/SUPABASE_ANON_KEY thật).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import worker from "../worker.js";

const root = fileURLToPath(new URL("../public/", import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".mp3": "audio/mpeg",
};

// Đọc .dev.vars (KEY=VALUE, như wrangler). Ưu tiên: biến môi trường thật > .dev.vars > giá trị giả.
function readDevVars() {
  try {
    const out = {};
    for (const line of readFileSync(new URL("../.dev.vars", import.meta.url), "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (m) out[m[1]] = m[2];
    }
    return out;
  } catch {
    return {};
  }
}

const env = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_ANON_KEY: "dummy-anon-key",
  LANGUAGES: "de:Deutsch,en:English",
  ...readDevVars(),
  ...process.env,
  ASSETS: {
    async fetch(req) {
      let p = decodeURIComponent(new URL(req.url).pathname);
      if (p.endsWith("/")) p += "index.html";
      const file = normalize(join(root, p));
      if (!file.startsWith(root)) return new Response("Forbidden", { status: 403 });
      try {
        return new Response(await readFile(file), { headers: { "content-type": TYPES[extname(file)] || "application/octet-stream" } });
      } catch {
        return new Response("Not found", { status: 404 });
      }
    },
  },
};

// CHỈ dev-server (không có trong Worker/deploy): phục vụ tests/browser/* ở /__tests/ để thử giao diện bằng dữ liệu giả.
const testsRoot = fileURLToPath(new URL("../tests/browser/", import.meta.url));

createServer(async (req, res) => {
  if (req.url.startsWith("/__tests/")) {
    const file = normalize(join(testsRoot, decodeURIComponent(req.url.slice("/__tests/".length).split("?")[0])));
    if (!file.startsWith(testsRoot)) return res.writeHead(403).end();
    try {
      res.writeHead(200, { "content-type": TYPES[extname(file)] || "text/plain", "cache-control": "no-store" }).end(await readFile(file));
    } catch {
      res.writeHead(404).end("Not found");
    }
    return;
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const hasBody = !["GET", "HEAD"].includes(req.method) && chunks.length > 0;
  const r = await worker.fetch(
    new Request(`http://${req.headers.host}${req.url}`, {
      method: req.method,
      headers: req.headers,
      body: hasBody ? Buffer.concat(chunks) : undefined,
    }),
    env
  );
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(Buffer.from(await r.arrayBuffer()));
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
