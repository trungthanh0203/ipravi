# Hướng dẫn hình minh hoạ cho "Tôi luyện tiếng Việt"

Dành cho **hoạ sĩ / giáo viên / người làm nội dung**. Mục tiêu: hình trong bài **đúng nghĩa, đúng thực tế Việt Nam, giống trong sách dạy**, và app vẫn nhẹ, nhanh.

## 1. Hình nào dùng gì (đã có sẵn trong app)
| Loại hình | Nguồn | Khi nào |
|---|---|---|
| **Emoji Twemoji** (mặc định) | Bộ hình đồng nhất, tự lưu trong app | Từ cụ thể quen thuộc: con chó, quả táo, cái ghế… (~ 90% Cấp 1–3) |
| **Ảnh riêng** (ưu tiên hơn emoji) | Bạn tải lên từng mục | Khi emoji sai/không có: đặc trưng Việt Nam, cảnh truyện, từ trừu tượng |

Mỗi mục có **vai trò hình**: **✓ Đúng nghĩa** (hình dùng để bé chọn/ghép/đoán) hoặc **✦ Trang trí** (chỉ để nhìn; không dùng làm đáp án). *Nếu hình không thể hiện đúng nghĩa của chữ, đặt "Trang trí" — trò chơi chọn/ghép theo hình sẽ tự bỏ qua mục đó.*

## 2. Danh sách cần vẽ
File **`danh-sach-hinh-can-ve.csv`** (sinh bằng `node scripts/hinh-can-ve.mjs`; chạy lại khi thêm nội dung) liệt kê những mục nên có ảnh riêng, xếp theo **ưu tiên**:
1. **Đặc trưng Việt Nam (≈ 50):** phở, cơm, bánh chưng, áo dài, nón lá, cây tre, lì xì, đèn lồng, con trâu… — emoji chỉ *gần đúng*.
2. **Cảnh câu/truyện (≈ 115):** tranh cho câu/truyện Cấp 4 (Thánh Gióng, Tấm Cám, Hồ Gươm…). Emoji chỉ ghép được "cảnh" 2 biểu tượng.
3. **Từ trừu tượng (≈ 15):** to/nhỏ, nhanh/chậm, nóng/lạnh… (nên vẽ **cặp tương phản**).

Không cần vẽ: hình từ khoá của chữ cái và chữ hoa (đã là minh hoạ phụ).

## 3. Yêu cầu kỹ thuật cho file hình
- **Định dạng:** PNG hoặc WebP (**không SVG** — app từ chối vì lý do an toàn), khung **vuông 1024×1024 px** (app tự thu nhỏ còn ≤ 512 px và nén WebP, thường 20–80 KB/ảnh).
- **Nền trong suốt** (hoặc nền trắng đồng nhất), **một chủ thể chính ở giữa**, chừa lề ~8%.
- **Không có chữ trong tranh** (chữ do app hiển thị; tranh có chữ sẽ lộ đáp án và khó đọc).
- **Cùng một phong cách** cho cả bộ: cùng nét viền, bảng màu, độ dày nét; màu tươi, dễ nhìn với trẻ 3–8 tuổi; không hình đáng sợ/bạo lực (đặc biệt cảnh truyện Thánh Gióng, Tấm Cám).
- **Đúng văn hoá và thực tế** (đối chiếu sách giáo khoa/thực tế): trang phục, món ăn, phong cảnh; nhân vật mặc trang phục phù hợp (áo dài truyền thống đúng kiểu, nón lá…).
- **Tên file = chữ của mục** để tải hàng loạt: `bánh chưng.png` hoặc không dấu `banh-chung.png`. Hai mục chỉ khác dấu ("ba"/"bà") **bắt buộc** đặt tên đúng chữ có dấu. Cột "tên file gợi ý" trong danh sách đã đặt sẵn.

## 4. Quy trình đưa vào app (mỗi bài)
1. Tab **Nội dung** → mở bài → **🖼 Tải nhiều ảnh** → chọn các file của bài (chỉ ghép với mục của bài đang mở). App báo file nào không ghép được.
2. Bấm **🖼 Xem dạng thẻ (duyệt hình)** để giáo viên **xem cả bài** hình + chữ: hình sai thì bấm 🖼 thay, hoặc đặt **✦ Trang trí**.
3. Khi hài lòng → **Duyệt bài**.
Cũng có thể tải ảnh riêng cho từng **chủ đề** (nút 🖼 ở đầu thẻ chủ đề).

## 5. Vì sao app vẫn nhanh
- Ảnh nén ngay trong trình duyệt của admin (≤ 512 px, WebP) trước khi lên Storage → ~ 182 ảnh ≈ 4–10 MB tổng.
- Mỗi ảnh tải **một lần** rồi được Service Worker cache-trước; emoji Twemoji cũng vậy (mỗi hình ~1 KB, tải khi cần).
- Không tải trước cả bộ hình; app chỉ tải hình của bài đang học (tải nền lúc bé bấm "Bắt đầu").

## 6. Bản quyền
- **Hoạ sĩ thuê:** hợp đồng ghi rõ quyền dùng **thương mại**, không giới hạn thời gian/địa điểm, được chỉnh sửa/nén.
- **Hình do AI tạo:** đọc kỹ điều khoản thương mại của công cụ; **duyệt từng ảnh** (AI hay sai chi tiết: bánh chưng, áo dài, số ngón tay, chữ trong tranh); lưu lại lệnh tạo hình để giữ phong cách.
- **Twemoji** (CC-BY 4.0): bắt buộc ghi công — đã có dòng ghi công ở khu phụ huynh. Không bỏ dòng này.
