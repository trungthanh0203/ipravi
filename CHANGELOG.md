# Nhật ký thay đổi — Tôi luyện tiếng Việt

Mốc LỚN thôi (đổi schema/kiến trúc/quyết định sản phẩm) — sửa nhỏ/vá lỗi lặt vặt KHÔNG ghi vào đây
(xem git log nếu cần). File này không tự nạp lại mỗi phiên (khác `CLAUDE.md`), chỉ đọc khi cần tra
lý do 1 quyết định cũ.

- **2026-09 — Đảo thứ tự nội dung theo cấp:** Cấp 1↔3 đổi chỗ nội dung (Cấp 1 = học vần, Cấp 2 = từ
  vựng, Cấp 3 = câu ngắn, Cấp 4 = đọc hiểu không đổi); tên/emoji/tuổi từng cấp giữ nguyên gắn với
  số. Lý do: chủ dự án coi học vần là nền tảng khởi đầu.
- **2026-09 — Bỏ AI/dịch máy ở khu admin:** thử Gemini qua `/api/suggest`, gặp lỗi vùng bị chặn +
  quá tải liên tục → gỡ hẳn, quyết định KHÔNG dùng AI dịch nữa (admin điền tay + từ điển gợi ý).
- **022_bai_ban.sql — nền dữ liệu "Tiếng Việt Bài Bản":** migration đầu tiên tạo bảng mới sau 001
  (schema riêng `bb_*`, xem CLAUDE.md).
- **GĐ 2 — luồng chọn hồ sơ:** ban đầu định chặn hồ sơ `learner` ở màn avatar (buộc vào qua khu phụ
  huynh) — sau khi chủ dự án dùng thật cho chính con mình, đảo ngược quyết định, mọi hồ sơ vào được
  từ avatar như nhau. Bỏ thẻ "Hồ sơ học bài bản" riêng trong khu phụ huynh (thừa sau khi avatar đã
  đủ dùng).
- **023_bb_progress.sql — Luyện tập/SRS Bài Bản:** thêm `bb_progress`/`bb_srs_state`, toán Leitner
  (`bb/srs.js`).
- **024_bb_a0_and_say.sql — cấp "A0" (chuyên đề bảng chữ cái/ngữ âm):** đã trao đổi với chủ dự án
  trước khi làm (vị trí, cột mới, cấu trúc 5 bài).
  Dữ liệu ngữ âm lấy nguyên từ `sounds.js`/`viet.js`, không tự bịa.
- **025_bb_unit_title_tr.sql:** `bb_units` thiếu `title_tr` so với `bb_lessons` — vá + thêm seed
  `005_bb_a1_title_translations.sql` cho nội dung đã nhập trước migration này.
- **2026-09-27→28 — Đồng bộ UI 2 tab admin (Trẻ em/Bài Bản):** thứ tự nút ▲▼/Sửa, rút gọn chữ nút
  Ẩn/Đóng/Xoá, nhãn ngôn ngữ rõ ràng "DE: … · EN: …" cho bản dịch — áp dụng đồng loạt cả 2 tab.
- **2026-09-28 — Luyện tập Bài Bản thêm kết quả + phân nhóm kỹ năng:** trước đó chạy xong 1 lượt là
  lặng lẽ thoát, không phân nhóm — thêm `resultScreen()` + `GROUPS` giống khu Trẻ em.
- **2026-09-28 — `runLesson()` đổi từ tuần tự sang lưới chọn chặng tự do** (yêu cầu chủ dự án): vào
  bài thấy ngay mọi chặng có dữ liệu, học chặng nào tuỳ ý, chặng rỗng bị ẩn, chặng xong có ✓. Xem
  chi tiết kiến trúc hiện tại ở `CLAUDE.md` mục "Tiếng Việt Bài Bản".
- **2026-09-29 — Tách CLAUDE.md/CHANGELOG.md:** `CLAUDE.md` từng phình tới 96KB (nạp lại toàn bộ
  mỗi khi đổi, tốn token/chậm mọi lượt) — tách tường thuật lịch sử sang đây, giữ CLAUDE.md chỉ còn
  luật/sự thật hiện tại. Xoá `KE_HOACH_TIENG_VIET_BAI_BAN.md` (theo yêu cầu chủ dự án).
- **2026-09-29 — Header/footer dùng chung mọi màn điều hướng chính:** trước đó mỗi trang tự vẽ
  header riêng — `bai-ban-home.js` thiếu nút chọn giọng, và nút Thoát của nó lỡ đưa về khu phụ
  huynh thay vì màn chọn avatar (khác hẳn `child-home.js`). Tách `profileHeader()`/`sessionFooter()`
  dùng chung trong `child/media.js`, cả 2 khu Trẻ em/Bài Bản đều gọi qua đó — sửa luôn cả 2 lỗi.
- **2026-09-29 — Bài Bản chậm do thiếu cache + gọi mạng thừa:** `bb/api.js` chưa hề cache
  Level/Unit/Lesson (khác `child/api.js` đã cache 60s từ lâu) nên bấm qua lại giữa các màn hình
  luôn chờ mạng lại từ đầu; `bb/practice.js` tải lại NGUYÊN catalog Luyện tập mỗi lần quay về lưới
  kỹ năng (khác `child/practice.js` giữ `ctx.data` cả phiên); mỗi lần chấm 1 thẻ từ vựng tốn 2
  round-trip liền (SELECT dò trạng thái cũ rồi mới UPSERT) dù dữ liệu đó caller đã có sẵn. Sửa cả 3:
  thêm cache giống khu Trẻ em, giữ catalog trong bộ nhớ + tự vá tại chỗ bằng hàm thuần (không chờ
  mạng), bỏ SELECT thừa. Đo bằng mock: bấm "Kỹ năng khác" sau khi ôn xong → 0 lệnh mạng (trước đó
  tải lại cả bộ).

**Bẫy lặp lại nhiều lần lúc code (đã gộp thành 1 luật chung trong CLAUDE.md, không kể lại đây nữa):**
`replaceChildren()` gốc không lọc null/dàn phẳng mảng — gặp ở cả `admin/bb.js` lẫn `bb/practice.js`.
