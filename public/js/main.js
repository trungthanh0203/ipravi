import { loadConfig, CONFIG } from "./config.js";
import { initSupabase, sb } from "./supabase.js";
import { state, resetState, loadAccountAndChildren } from "./state.js";
import { render } from "./flow.js";
import { el, mount } from "./ui.js";
import { T } from "./strings.js";

function fatal(message) {
  mount(
    document.getElementById("app"),
    el("div", { class: "card" }, el("h1", null, T.fatalTitle), el("p", { class: "muted" }, message))
  );
}

async function boot() {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});

  try {
    await loadConfig();
  } catch (e) {
    fatal(e.message);
    return;
  }
  initSupabase(CONFIG);

  const { data } = await sb.auth.getSession();
  state.session = data.session;
  if (state.session) {
    try {
      await loadAccountAndChildren();
    } catch (e) {
      fatal("Không tải được tài khoản: " + e.message);
      return;
    }
  }
  await render();

  // Không await lệnh Supabase trực tiếp trong callback (dễ bị treo) — đẩy sang setTimeout.
  sb.auth.onAuthStateChange((event, session) => {
    if (event !== "SIGNED_IN" && event !== "SIGNED_OUT") return;
    setTimeout(async () => {
      if (!session) {
        resetState();
      } else if (state.session?.user?.id === session.user.id && state.account) {
        // supabase-js phát lại SIGNED_IN mỗi khi tab/app được mở lại sau một lúc (lấy lại phiên). Cùng một người → chỉ cập nhật phiên,
        // KHÔNG dựng lại màn hình (lỗi cũ: bé đang học bị đẩy về danh sách bài mỗi khi quay lại app).
        state.session = session;
        return;
      } else {
        state.session = session;
        try {
          await loadAccountAndChildren();
        } catch (e) {
          fatal("Không tải được tài khoản: " + e.message);
          return;
        }
      }
      await render();
    }, 0);
  });
}

boot();
