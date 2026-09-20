// Thông báo giữ qua lần tải lại: thao tác xong thì tải lại danh sách, thông báo "Đã ... " hiện ở lần vẽ kế tiếp.
let pending = null;
export const notice = {
  set(kind, text) { pending = { kind, text }; },
  take() { const p = pending; pending = null; return p; },
};
