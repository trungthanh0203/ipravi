// Nhớ vị trí đang xem trong "Tiếng Việt Bài Bản" (Level/Unit/Lesson hoặc đang ở Luyện tập) qua sessionStorage —
// F5/refresh khôi phục lại ĐÚNG chỗ đang học thay vì rơi về Home phải chọn lại Học/Luyện tập (chủ dự án báo
// 2026-09-30). Dùng chung giữa pages/bai-ban-home.js (ghi mỗi lần điều hướng) và bb/runner.js (xoá lúc bấm "Thoát"
// giữa chừng 1 bài — nếu không xoá, mở lại hồ sơ này sẽ nhảy lại đúng bài cũ dù người học đã chủ động thoát ra).
const NAV_KEY = "tltv-bb-nav";
export const saveNav = (nav) => { try { sessionStorage.setItem(NAV_KEY, JSON.stringify(nav)); } catch { /* bỏ qua */ } };
export const clearNav = () => { try { sessionStorage.removeItem(NAV_KEY); } catch { /* bỏ qua */ } };
export const readNav = () => { try { return JSON.parse(sessionStorage.getItem(NAV_KEY)); } catch { return null; } };
