// Trợ giúp dựng DOM an toàn (không dùng innerHTML với dữ liệu người dùng).
export function el(tag, props, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function mount(root, ...nodes) {
  root.replaceChildren(...nodes);
}

export function msg(kind, text) {
  return el("div", { class: `msg ${kind}` }, text);
}
