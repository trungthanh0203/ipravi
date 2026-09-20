import { el } from "../../ui.js";
import { T } from "../../strings.js";
import { playItem, visual, nativeLang, nativeLabel, say } from "../media.js";

// Học từ mới: thẻ từng mục — hình + chữ Việt + nút nghe tiếng Việt / nghe chậm / nghe tiếng bản ngữ.
export function run(ctx) {
  return new Promise((resolve) => {
    let i = 0;
    let first = true;

    function show() {
      const item = ctx.items[i];
      const last = i === ctx.items.length - 1;
      ctx.setProgress(i, ctx.items.length);
      ctx.box.replaceChildren(
        el("div", { class: "flash" },
          visual(item, "big"),
          el("div", { class: "word" }, item.text_vi),
          el("div", { class: "row-btns" },
            el("button", { class: "btn small", onclick: () => playItem(item) }, "🔊 " + T.listenVi),
            el("button", { class: "btn small ghost", onclick: () => playItem(item, { slow: true }) }, "🐢 " + T.listenSlow),
            el("button", { class: "btn small ghost", onclick: () => playItem(item, { lang: nativeLang() }) }, "🔊 " + nativeLabel())),
          el("div", { class: "row" },
            el("button", { class: "btn ghost small", disabled: i === 0, onclick: () => { i--; show(); } }, "◀ " + T.prev),
            el("span", { class: "muted" }, `${i + 1}/${ctx.items.length}`),
            el("button", { class: "btn small", onclick: () => (last ? resolve({ correct: 0, total: 0 }) : (i++, show())) },
              last ? T.playNow : T.next + " ▶")))
      );
      const play = () => playItem(item);
      if (first) { first = false; say(T.instrIntro).then(play); } else play();
    }
    show();
  });
}
