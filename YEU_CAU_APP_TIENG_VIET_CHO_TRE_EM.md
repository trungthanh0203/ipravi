# TÀI LIỆU YÊU CẦU — "Tôi luyện tiếng Việt": app học tiếng Việt cho trẻ em gốc Việt 3–8 tuổi

> Tài liệu này dành cho dự án code MỚI (độc lập hoàn toàn với iLapra). Người đọc
> (lập trình viên / AI code) cần hiểu: sản phẩm là gì, cho ai, làm những gì trước,
> những gì KHÔNG làm, và các quyết định đã chốt. Chỗ nào ghi **[CẦN QUYẾT]** là
> câu hỏi còn mở — hỏi chủ dự án, đừng tự đoán.
>
> **Điều chỉnh 2026-09-19 (3 đợt)** — (1) giao diện toàn tiếng Việt; ngôn ngữ phụ huynh chọn
> lúc đăng ký dùng cho nghĩa + âm thanh bản ngữ; (2) mỗi bản triển khai = 1 admin, không lớp
> học, admin đóng vai giáo viên; (3) phụ huynh tự đăng ký, dùng thử 1 tuần, trả học phí để gia
> hạn; (4) **đợt 3:** PIN 4 số cho khu phụ huynh; **mỗi tài khoản phụ huynh có 1 con, thêm con
> phải trả thêm phí và admin cấp thêm**; **chỉ dùng giọng TTS nhưng thiết kế sẵn để thay bằng
> giọng người thật/trẻ em/người lớn**; giao diện học của trẻ **có chữ tiếng Việt + nút nghe
> tiếng Việt + nút nghe tiếng bản ngữ**; **chỉ làm PWA**; **có chấm phát âm tự động bằng AI
> ngay từ MVP**; chốt tên, linh vật, độ tuổi 3–8. Xem mục 2, 4, 8, 9.

---

## 1. Tổng quan sản phẩm

**Sản phẩm:** **"Tôi luyện tiếng Việt"** — ứng dụng PWA giúp **trẻ em gốc Việt 3–8 tuổi sống
ở nước ngoài** học và giữ tiếng Việt **tự do tại nhà hoặc bất cứ đâu** (học online, không
theo lớp/lịch cố định). Trẻ học bằng **nghe + nhìn tranh + chạm + nói**; chữ tiếng Việt hiện
cùng hình nhưng trẻ chưa biết đọc vẫn học được nhờ âm thanh.

**Nhận diện:** linh vật **gà trống màu đỏ cam** (dẫn dắt trẻ, nói hướng dẫn, phản ứng khi trẻ
đúng/sai); màu chủ đạo **đỏ cam**. Tên miền: xem mục 13.

**Mô hình sử dụng (3 bên):**
1. **Chủ dự án** — làm và bán app.
2. **Admin** — người mua app để vận hành, thường là **người Việt ở nước ngoài đang dạy
   tiếng Việt cho nhiều bé** (cá nhân hoặc trung tâm nhỏ). Admin soạn/nhập nội dung (dùng AI
   soạn theo mẫu), đặt **mức học phí**, theo dõi các bé, xác nhận thanh toán và cấp thêm tài
   khoản con cho phụ huynh.
3. **Phụ huynh + trẻ** — phụ huynh **tự đăng ký tài khoản**, **dùng thử 1 tuần**, sau đó **trả
   học phí để gia hạn**; mỗi tài khoản có **1 hồ sơ con**, muốn thêm con phải **đăng ký và trả
   thêm phí** để admin cấp thêm.

**Điểm khác biệt so với app học ngoại ngữ đại trà:**
- Phụ huynh và admin **theo dõi và kiểm soát** được việc học (tiến độ, thời gian, từ đã biết,
  bài đã học, điểm phát âm).
- Admin (người đang dạy trẻ thật) xem được tiến độ các bé và hỗ trợ trực tiếp — app là công
  cụ đi kèm việc dạy của họ, không thay thế họ.
- Thiết kế xoay quanh **âm thanh** (trẻ gốc Việt thường nghe hiểu được nhưng chưa đọc/viết) và
  có **chấm phát âm tự động bằng AI** để trẻ luyện nói.

**Nguồn cảm hứng kỹ thuật:** app học ngoại ngữ iLapra của cùng chủ dự án (đã chạy thật, có
phân quyền, dashboard theo dõi). Dự án này **tách riêng hoàn toàn** (repo riêng, cơ sở dữ liệu
riêng, tên miền riêng) nhưng có thể tái dùng mẫu thiết kế đã kiểm chứng (mục 11).

## 2. Các quyết định đã chốt

| # | Quyết định |
|---|---|
| 1 | **Tên sản phẩm: "Tôi luyện tiếng Việt". Linh vật: gà trống màu đỏ cam.** Đối tượng: **trẻ gốc Việt 3–8 tuổi**, tiếp cận qua **phụ huynh** tự đăng ký trên bản triển khai của admin. Người lớn/người nước ngoài: giai đoạn sau. |
| 2 | **Toàn bộ chữ trên giao diện bằng tiếng Việt** (phụ huynh, admin, trẻ). Không làm chuyển đổi ngôn ngữ giao diện. |
| 3 | **Ngôn ngữ của phụ huynh** (Đức trước, sau đó Anh…) **chọn lúc đăng ký** = **ngôn ngữ bản ngữ của trẻ**. Ngôn ngữ này quyết định: (a) nghĩa hiển thị cho phụ huynh bằng ngôn ngữ nào, (b) **âm thanh đọc nghĩa bằng ngôn ngữ đó** — có ở cả khu phụ huynh và giao diện học của trẻ (xem 4.0b, 5). Thêm ngôn ngữ mới = thêm bản dịch + âm thanh, không sửa code. |
| 4 | **Mỗi bản triển khai = 1 admin/đơn vị** (1 cơ sở dữ liệu + 1 hosting + 1 tên miền riêng). Không làm đa admin trong 1 hệ thống. **Nội dung học của mỗi bản triển khai riêng biệt, không cần đồng bộ giữa các bản.** |
| 5 | **Phụ huynh cài app, đăng ký và đăng nhập sẵn** trên thiết bị. Trẻ mở app → chọn **đúng avatar của mình** để vào giao diện học. Phụ huynh vào khu riêng qua **1 nút nhỏ + mã PIN 4 số** phụ huynh tự đặt lúc đầu (xem 4.0). |
| 6 | **Học online tự do, KHÔNG có tổ chức lớp học.** Mỗi bé học theo tiến độ riêng. |
| 7 | **Admin đóng vai trò giáo viên.** Giáo viên hỗ trợ (thêm đề, trả lời hỗ trợ) là vai trò tuỳ chọn, **để làm sau**. |
| 8 | **Phụ huynh tự đăng ký** (không cần mã), **dùng thử 1 tuần đầy đủ nội dung**, sau đó trả học phí để gia hạn; **thời gian dùng tương ứng mức học phí** do admin tự đặt (giá, thời gian, tiền tệ). **Hết hạn = khoá hết** (xem 8). |
| 9 | **Số con:** mỗi tài khoản phụ huynh mặc định **1 hồ sơ con**; **không bắt buộc đăng ký thêm ngay từ đầu** — có thể **vài tháng sau** mới xin thêm con thứ 2, thứ 3… bất cứ lúc nào. Phụ huynh **làm việc với admin để admin cấp thêm** số con, và **trả thêm phí cho admin**. Quy tắc phí: **mỗi con thêm = 20% phí đăng ký lúc đầu** (tỉ lệ % do admin chỉnh được). **Trần số con tối đa: 6 mỗi tài khoản** (mặc định; **admin quyết định/chỉnh được**). Ràng buộc số con ở cơ sở dữ liệu (xem 8). |
| 10 | **Thanh toán học phí và phí thêm con: ghi nhận bằng tay** (phụ huynh báo đã trả → admin xác nhận). Chưa có cổng thanh toán tự động. |
| 11 | **Chỉ dùng giọng tổng hợp (TTS) ở giai đoạn này** (chưa thu giọng người thật), **nhưng thiết kế dữ liệu/phát âm thanh sẵn** để sau này thêm giọng người thật, giọng trẻ em, giọng người lớn mà không sửa code (xem 4.4, 9.2). |
| 12 | **Giao diện học của trẻ có chữ tiếng Việt**, kèm nút **nghe đọc tiếng Việt** và nút **nghe tiếng bản ngữ** (theo ngôn ngữ phụ huynh chọn). Vẫn audio-first: mọi hướng dẫn được đọc thành tiếng, không bắt buộc đọc mới chơi được (xem 4.0b, 4.1). |
| 13 | **Chấm phát âm tự động có ngay trong MVP** — bản đầu dùng **Web Speech API của trình duyệt** (như iLapra, không phí dịch vụ), hàm chấm tách riêng để nâng cấp lên dịch vụ chuyên dụng sau (xem 4.6). |
| 14 | **Chỉ làm PWA.** Không phát hành App Store/Google Play. |
| 15 | **Nội dung khởi đầu do admin dùng AI soạn theo mẫu** rồi nhập vào hệ thống (CSV/công cụ nội dung) và tự duyệt (xem 7). |
| 16 | **Cổng phụ huynh dùng mã PIN 4 số.** 2 con dùng chung thiết bị: **chấp nhận** giới hạn "chạm avatar của anh/chị vẫn vào được hồ sơ đó" ở MVP. |
| 17 | Tư vấn pháp lý GDPR/dữ liệu trẻ em: **làm sau**, nhưng vẫn là việc bắt buộc trước khi công khai (mục 9.5). |
| 18 | **App riêng hoàn toàn**, không dùng chung dữ liệu/tài khoản với iLapra. |

## 3. Người dùng và vai trò

1. **Phụ huynh (chủ tài khoản)** — **tự đăng ký** (xem 4.0), **chọn ngôn ngữ của mình**
   (Đức/Anh…) lúc đăng ký, được **dùng thử 1 tuần**, tạo hồ sơ con (**1 con mặc định**, thêm
   con phải trả thêm phí), xem tiến độ, đặt giới hạn thời gian, bật/tắt chấm phát âm, xem hạn
   dùng, **thanh toán học phí để gia hạn**. Có thể **không giỏi tiếng Việt** (sống ở Đức) →
   khu phụ huynh hiển thị **từ tiếng Việt + nghĩa bằng ngôn ngữ của phụ huynh + nút nghe cho
   cả hai**, để phụ huynh học/kiểm tra cùng con.
2. **Trẻ (hồ sơ con, 3–8 tuổi)** — KHÔNG có email/mật khẩu riêng. Vào học bằng cách chọn đúng
   **avatar/hình con vật** trên thiết bị của gia đình (xem 4.0). Không tự đăng xuất, không
   vào được khu phụ huynh nếu không nhập PIN.
3. **Admin** — người mua app (thường là người dạy tiếng Việt cho trẻ). Quản lý nội dung học,
   đặt mức học phí, xác nhận thanh toán, **cấp thêm tài khoản con**, xem danh sách phụ huynh
   + các bé + tiến độ, hỗ trợ phụ huynh. **1 cấp admin duy nhất** cho mỗi bản triển khai.
4. **Giáo viên hỗ trợ** *(tuỳ chọn, giai đoạn sau)* — tài khoản do admin tạo, chỉ có quyền
   **thêm đề/bài** và **trả lời câu hỏi hỗ trợ**. Vì admin làm được mọi việc của giáo viên,
   vai trò này **không cần cho MVP**.

Không có "trung tâm", "lớp", "mã lớp" trong hệ thống. Mọi phụ huynh trong bản triển khai đều
là học viên của admin đó.

## 4. Trải nghiệm học của trẻ (trọng tâm giai đoạn 1)

### 4.0 Luồng vào app (đăng ký → đăng nhập → chọn avatar → khu phụ huynh)

1. **Lần đầu (phụ huynh làm):** cài app (PWA) → **đăng ký bằng email/mật khẩu + chọn ngôn ngữ
   của mình** (xác nhận email) → đăng nhập → **bắt đầu 1 tuần dùng thử** → **đặt mã PIN 4
   số** (bước bắt buộc) → tạo **hồ sơ con** (1 con) và **gán 1 avatar** → (tuỳ chọn) bật
   chấm phát âm và cấp quyền micro. Phiên đăng nhập **giữ lâu dài** trên thiết bị (không bắt
   đăng nhập lại mỗi lần mở app).
2. **Các lần mở sau — màn hình chọn avatar** (màn hình đầu tiên mặc định, ít chữ):
   - Hiện **bộ avatar/hình con vật** (không chỉ avatar của các con).
   - Trẻ chạm **đúng avatar của mình** → vào thẳng giao diện học của hồ sơ đó.
   - Chạm **avatar không thuộc hồ sơ nào** → không vào; gà trống nhẹ nhàng nói (audio) "chưa
     đúng rồi, con thử lại nhé", không phạt, không khoá.
   - Nên hiện **cả avatar không có hồ sơ** lẫn avatar có hồ sơ (lẫn lộn) để việc "nhớ đúng
     avatar của mình" có tác dụng như 1 mật khẩu bằng hình; nếu chỉ hiện avatar của các con
     thì chọn nào cũng vào được.
3. **Phụ huynh vào khu riêng:** ở góc màn hình chọn avatar có **1 nút nhỏ, kín đáo** (vd ổ
   khoá/"Bố mẹ") → **nhập PIN 4 số** → mở khu phụ huynh (dashboard, cài đặt, hạn dùng/học
   phí, xoá dữ liệu). Nút này **không** làm nổi bật để trẻ không bị hút vào.
4. **Thoát khỏi giao diện học của trẻ** về màn hình chọn avatar: có nút/đường thoát đơn giản
   cho trẻ (không cần PIN). Đăng xuất, đổi PIN, xoá dữ liệu, xin thêm tài khoản con, thanh
   toán → đều nằm trong khu phụ huynh (đã qua PIN). Riêng **xoá dữ liệu** chỉ cần thêm 1 hộp
   thoại xác nhận (không bắt nhập PIN lần nữa).
5. **Admin** đăng nhập bằng màn hình đăng nhập thường (email/mật khẩu) và vào thẳng dashboard
   của mình; **không** đi qua màn hình chọn avatar (chỉ dành cho tài khoản phụ huynh).

**Mã PIN:**
- **Chỉ dùng như một lớp nhập thêm khi phụ huynh muốn vào giao diện phụ huynh** (đã chốt); PIN
  **không** dùng để đăng nhập tài khoản, không dùng cho việc nào khác.
- **4 chữ số, do phụ huynh tự thiết lập** lúc đầu; **1 PIN cho mỗi tài khoản phụ huynh**. Chỉ
  phụ huynh **đổi được** PIN, và phải **nhập PIN cũ hoặc mật khẩu tài khoản** mới đổi.
- Lưu **dạng băm**, không lưu PIN gốc. PIN 4 số dễ đoán → **khoá tạm** (vd 5 phút) sau 5 lần
  nhập sai liên tiếp; quên PIN → đặt lại bằng **mật khẩu tài khoản**.

> **Giới hạn cần biết:** nếu gia đình có nhiều con dùng chung 1 thiết bị, con A chạm avatar
> của con B vẫn vào được hồ sơ của B (vì đó là avatar hợp lệ). **Đã chấp nhận ở MVP.** Mỗi con
> trong cùng 1 gia đình **phải có avatar khác nhau** (ràng buộc duy nhất).
>
> **Hết hạn dùng / phiên hết hạn:** nếu phiên phụ huynh hết hạn/bị đăng xuất, màn hình chọn
> avatar không dùng được — hiện màn hình đăng nhập kèm audio "nhờ bố mẹ giúp con nhé". Nếu
> tài khoản **hết hạn dùng** → xem mục 8 (khoá hết, chỉ còn màn hình gia hạn).

### 4.0b Màn hình học của trẻ: chữ + nghe tiếng Việt + nghe tiếng bản ngữ

Mỗi mục từ/câu hiện trên giao diện trẻ gồm:
- **Hình minh hoạ lớn** + **chữ tiếng Việt** (có dấu, cỡ lớn, rõ ràng);
- Nút 🔊 **"Nghe tiếng Việt"** (có "nghe chậm");
- Nút 🔊 **"Nghe tiếng bản ngữ"** — đọc **nghĩa bằng ngôn ngữ phụ huynh đã chọn lúc đăng ký**
  (vd tiếng Đức), để trẻ hiểu nghĩa;
- Giai đoạn đầu **chữ nghĩa bản ngữ không hiện trên màn hình trẻ** (chỉ nghe) — chữ nghĩa nằm
  ở khu phụ huynh. **[CẦN QUYẾT]** nếu muốn hiện thêm chữ cho trẻ lớn (6–8 tuổi).
- Trẻ 3–5 tuổi có thể chưa đọc chữ → vẫn chơi được hoàn toàn nhờ hình + âm thanh; trẻ 6–8 tuổi
  dùng chữ để làm quen mặt chữ/dấu thanh. Hồ sơ con có **độ tuổi/mức độ** để điều chỉnh độ
  khó và mức độ nhấn mạnh chữ.

### 4.1 Nguyên tắc thiết kế cho trẻ 3–8 tuổi
- **Không bắt buộc đọc mới chơi được:** điều hướng bằng biểu tượng/tranh lớn; mọi hướng dẫn
  được **đọc thành tiếng**; chữ luôn đi kèm hình và âm thanh.
- **Chạm to** (vùng chạm lớn, khoảng cách rộng), ít chi tiết trên 1 màn hình, chạy tốt trên
  tablet/điện thoại phổ thông.
- Phiên học **ngắn** (khoảng 5–10 phút), có **linh vật gà trống** dẫn dắt, phản hồi ngay bằng
  âm thanh + hình ("đúng rồi!").
- **Không** quảng cáo, không liên kết ra ngoài, không chat với người lạ, không mua hàng
  trong màn hình của trẻ.
- Sai không bị phạt nặng: nhẹ nhàng cho nghe lại, thử lại.
- Vì học tự do (không có giáo viên bên cạnh), **mọi hướng dẫn phải tự giải thích được** bằng
  giọng nói + hình, trẻ không cần người lớn ngồi cạnh để hiểu cách chơi.

### 4.2 Các dạng hoạt động (MVP cần tối thiểu 5 dạng, gồm chấm phát âm)
1. **Nghe – chạm hình:** nghe từ/câu tiếng Việt → chọn đúng tranh trong 2–4 tranh.
2. **Nghe – nhắc lại – chấm phát âm:** nghe mẫu → trẻ nói → app chấm → phản hồi nhẹ nhàng.
   Chi tiết ở mục 4.6.
3. **Ghép cặp:** ghép tranh với tranh/âm thanh (lật thẻ, nối).
4. **Sắp xếp / phân loại theo chủ đề:** kéo thả tranh vào nhóm (con vật, đồ ăn, gia đình…).
5. **Nghe – chạm chữ:** nghe từ → chọn đúng chữ tiếng Việt (dành cho trẻ đã bắt đầu nhận mặt
   chữ; có thể bật/tắt theo độ tuổi).
6. *(Giai đoạn 2)* **Truyện & bài hát:** có audio, tranh minh hoạ, từ nổi bật khi đọc tới.

### 4.3 Nội dung và tổ chức bài học
- Tổ chức: **Chủ đề (unit) → Bài học (lesson) → Hoạt động (activity)**, mỗi bài học nhỏ
  (khoảng 5–10 mục từ). Trẻ đi theo lộ trình mở khoá dần, không phụ thuộc lịch lớp.
- Chủ đề ưu tiên: gia đình, cơ thể, con vật, đồ ăn, màu sắc, số đếm, đồ chơi, ngôi nhà, thời
  tiết, chào hỏi/lễ phép (xưng hô: ông/bà/bố/mẹ/anh/chị/em), Tết và văn hoá Việt.
- Mục học: **từ đơn → cụm từ → câu ngắn**; với trẻ 6–8 tuổi thêm câu dài hơn, làm quen dấu
  thanh và chữ viết.
- Cần xử lý **giọng vùng miền** (Bắc/Nam, có thể Trung) — chưa làm ở giai đoạn TTS đầu, nhưng
  dữ liệu phải chừa chỗ cho giọng vùng miền (xem 4.4, 9.2).

### 4.4 Âm thanh (yêu cầu quan trọng nhất)

**Giai đoạn này: chỉ dùng giọng tổng hợp (TTS), sinh sẵn thành file.** Thiết kế để sau này
thay/bổ sung giọng người thật mà không sửa code.

- **Sinh sẵn, không đọc trực tiếp lúc chạy:** khi admin nhập/duyệt nội dung, hệ thống **sinh file
  audio TTS** cho tiếng Việt (chậm + thường) và cho từng bản dịch (Đức/Anh…), lưu vào Storage
  có CDN. Không dùng giọng đọc có sẵn của trình duyệt/thiết bị (khác nhau giữa iOS/Android, chất
  lượng tiếng Việt không đảm bảo).
- **Mỗi file audio ghi rõ:** ngôn ngữ, **nguồn** (`tts` hoặc `human`), **loại giọng** (`adult`,
  `child`), giọng vùng miền (Bắc/Nam…, chỉ với tiếng Việt), tốc độ (thường/chậm), nhà cung cấp/tên giọng.
  Hiện chỉ có `source=tts`, nhưng cột và luật chọn đã sẵn sàng.
- **Luật chọn giọng khi phát (đặt trong 1 hàm duy nhất):** theo ưu tiên của tài khoản/hồ sơ
  (loại giọng, vùng miền) → nếu có **giọng người thật** thì ưu tiên hơn TTS → không có thì
  dùng TTS → không có nữa thì ẩn nút. Nhờ vậy sau này **thêm file giọng người thật/trẻ em/người
  lớn = chỉ thêm dữ liệu**, giao diện tự dùng, không sửa code.
- **Chất lượng tiếng Việt là rủi ro lớn nhất của TTS** (6 dấu thanh, phát âm sai dấu là hỏng
  bài học). Trước khi nhập nhiều nội dung phải **nghe thử và chọn** TTS tiếng Việt đạt yêu cầu;
  admin cần có cách **nghe lại từng mục và báo/sinh lại** khi thấy đọc sai (xem 7).
- Audio phải **tải sẵn/cache** để phát tức thì và chạy được khi mạng yếu (PWA + service
  worker); cân nhắc tải trước cả bài học.
- Lưu ý kỹ thuật: trình duyệt di động (đặc biệt iOS Safari) **chặn tự phát âm thanh nếu
  chưa có cú chạm của người dùng** — luồng vào bài học phải có 1 cú chạm "bắt đầu" trước
  khi phát audio đầu tiên. (Cú chạm chọn avatar ở 4.0 có thể chính là cú chạm đó.)
- Dấu thanh và phát âm là khó khăn lớn nhất → mỗi mục cần nút "nghe chậm" và "nghe lại".
- **Lời nói của linh vật** (hướng dẫn, khen, động viên) cũng là audio sinh sẵn theo cùng cơ chế.
- **[CẦN QUYẾT]** Chọn dịch vụ TTS cho tiếng Việt, Đức, Anh (nghe thử; tiêu chí: dấu thanh đúng,
  tự nhiên, có giọng Bắc/Nam nếu được, có giọng phù hợp trẻ em nếu được, giá, vị trí dữ liệu).

### 4.5 Tiến độ và tạo động lực
- Sao/huy hiệu/album nhãn dán; hoàn thành bài mở khoá bài kế tiếp.
- Điểm phát âm (4.6) góp vào sao của bài, nhưng **không chặn** việc sang bài kế tiếp.
- Lặp lại ngắt quãng nhẹ nhàng (ôn lại từ đã học sau một khoảng thời gian) — đơn giản trước,
  tinh vi sau.
- Không dùng cơ chế gây nghiện (đếm ngược ép buộc, mất chuỗi gây lo lắng…).

### 4.6 Chấm phát âm tự động (có ngay trong MVP)

**Cách chấm ở MVP (theo đúng cách iLapra đang làm — đã kiểm tra mã nguồn `app.html`):** dùng
**Web Speech API của trình duyệt** (`SpeechRecognition`, đặt `lang = vi-VN`) để **nhận dạng lời
trẻ nói thành chữ**, rồi **so chữ nhận được với câu/từ mẫu** (tách từ, đếm số từ sai lệch, ra điểm
0–100 và chia 4 mức). Cách này **không phải chấm âm vị thật**, nhưng **không phải trả phí cho dịch
vụ nào** và **không cần máy chủ của mình xử lý** giọng nói. Hàm chấm (`scorePronunciation`) được
**tách riêng** để sau này thay bằng dịch vụ chấm chuyên dụng (vd Azure Pronunciation Assessment)
mà không phải sửa chỗ gọi.

**Luồng cho trẻ:** nghe mẫu (TTS) → chạm **nút micro to** → nói (tự dừng sau vài giây hoặc khi
im lặng) → trình duyệt nhận dạng → app so với mẫu → linh vật gà trống phản hồi bằng **1–3 sao**
+ lời khen/động viên → "nghe lại mẫu"/"thử lại"/"tiếp".

**Nguyên tắc cho trẻ:**
- **Khuyến khích, không phán xét:** ngưỡng chấm **dễ** cho trẻ nhỏ; mức thấp chỉ nói "mình thử
  lại nhé", không hiện "sai/0 điểm". Sau tối đa ~3 lần thử vẫn **cho đi tiếp**.
- Điểm thấp **không khoá** tiến độ bài học.
- Phụ huynh có thể **tắt** tính năng chấm phát âm (khi đó hoạt động này bị ẩn hoặc chuyển thành
  "nghe – lặp lại" không chấm).

**Yêu cầu kỹ thuật:**
- Thu âm bằng trình duyệt (cần HTTPS + **quyền micro**; xin quyền lúc phụ huynh bật tính năng,
  không xin bất ngờ giữa lúc trẻ chơi). **Phải thử micro trên thiết bị thật iOS Safari/PWA và
  Android** — lỗi thu âm thường chỉ lộ ở thiết bị thật.
- **Tách hàm chấm** (`scorePronunciation`) và cách lấy kết quả nhận dạng ra thành 1 lớp riêng để
  đổi được nhà cung cấp chấm. Nếu sau này dùng dịch vụ trả phí thì **khoá dịch vụ chỉ để ở phía
  máy chủ** (Worker/biến bí mật) và **giới hạn số lượt chấm mỗi bé mỗi ngày** (chống tốn phí + chống
  lạm dụng), có phản hồi thân thiện khi hết lượt ("mai mình luyện tiếp nhé"). Với Web Speech API
  của trình duyệt (MVP) thì không cần khoá/giới hạn phí này.
- **Trình duyệt không hỗ trợ nhận dạng giọng nói** (vd Firefox) hoặc **không có mạng/mạng yếu**:
  ẩn nút micro hoặc chuyển thành "nghe – lặp lại" không chấm, không làm treo bài học. Nhận dạng
  bằng Web Speech API thường **cần mạng** (trình duyệt gửi âm thanh lên máy chủ của hãng).
- **Không lưu file ghi âm:** ở MVP app không giữ đoạn thu, chỉ lưu điểm + chữ nhận dạng được +
  từ nào lệch. Lưu lại cho phụ huynh nghe = tính năng giai đoạn 2, chỉ khi phụ huynh bật (xem 9.5).
- Kết quả chi tiết lưu ở `pronunciation_attempts` để phụ huynh/admin xem từ nào hay sai.

**Rủi ro phải kiểm chứng SỚM (làm thử nghiệm kỹ thuật/spike trước khi làm cả tính năng):**
- **Đây là "nhận dạng chữ rồi so khớp", không phải chấm âm vị.** Tiếng Việt có **6 dấu thanh**;
  bộ nhận dạng thường **tự sửa cho ra từ có nghĩa** nên có thể cho điểm cao dù trẻ đọc sai dấu, và
  ngược lại chấm oan khi nhận dạng nhầm. Vì vậy điểm chỉ nên dùng để **khuyến khích + theo dõi
  xu hướng**, không dùng để "phán đúng/sai" từng dấu.
- **Giọng trẻ 3–8 tuổi** (cao, nói nhỏ, ngọng, ồn nền) làm giảm độ chính xác nhiều hơn người lớn.
  iLapra thử với người học ngoại ngữ trưởng thành; **chưa có bằng chứng** là chạy tốt với trẻ nhỏ
  nói tiếng Việt.
- **Khả năng chạy trên thiết bị của phụ huynh/trẻ:** Web Speech API hoạt động khác nhau giữa
  Chrome/Android, Safari iOS và **PWA đã cài ra màn hình chính** (iOS có thể hạn chế/không ổn định
  ở chế độ này), và **không có trên Firefox**. Phải **thử trên thiết bị iOS/Android thật, cả trong
  trình duyệt lẫn PWA đã cài**, trước khi cam kết.
- **Quyền riêng tư:** với Web Speech API, **âm thanh giọng trẻ do trình duyệt gửi lên máy chủ của
  hãng** (Google với Chrome, Apple với Safari) — mình **không có hợp đồng và không kiểm soát**
  được việc lưu trữ/dùng để huấn luyện/nơi xử lý dữ liệu. Đây là điểm phải đưa vào tư vấn pháp lý
  GDPR sau này (mục 9.5). Nếu không chấp nhận được, phải chuyển sang dịch vụ có hợp đồng xử lý dữ
  liệu (thường **có phí**).
- **Cần làm thử nghiệm kỹ thuật (spike) sớm** với **ghi âm thật của trẻ** (nhiều độ tuổi, giọng
  Bắc/Nam, trẻ ở nước ngoài có giọng pha): (1) Web Speech API `vi-VN` có đủ tốt không, (2) **chỉnh
  ngưỡng** cho từng độ tuổi, (3) so với 1 dịch vụ chấm chuyên dụng để biết đáng nâng cấp không.
  Nếu chưa đủ tin cậy, MVP hiển thị mức "khuyến khích" theo độ giống chung thay vì điểm số chính xác.
- **Chi phí:** cách MVP (Web Speech API) **không phát sinh phí dịch vụ chấm**. Chỉ **khi nâng cấp**
  lên dịch vụ chấm chuyên dụng mới có phí, thường theo lượt/thời lượng ghi âm, tăng theo số bé ×
  số lần luyện — lúc đó mới cần quyết ai trả và đặt hạn mức lượt/ngày. **TTS và chấm phát âm là 2
  việc khác nhau:** TTS chỉ tạo giọng đọc **mẫu** (có thể tốn một ít phí, chỉ 1 lần khi sinh audio
  lúc admin nhập nội dung); còn việc **nghe giọng của trẻ** là nhận dạng giọng nói (Web Speech API).
- **[CẦN QUYẾT]** Sau spike: giữ Web Speech API hay nâng cấp lên dịch vụ chấm chuyên dụng
  (khi đó: chọn dịch vụ + ai trả chi phí + hạn mức lượt/ngày).

## 5. Phần dành cho phụ huynh

Toàn bộ chữ trên giao diện phụ huynh là **tiếng Việt**. Vì phụ huynh có thể không giỏi
tiếng Việt, dùng **biểu tượng rõ ràng + câu chữ ngắn, đơn giản**; phần nội dung học
(từ/câu) luôn kèm nghĩa bằng ngôn ngữ đã chọn lúc đăng ký. Vào khu này phải **nhập PIN 4 số**.

- **Dashboard theo dõi:** số từ đã biết, bài đã học, thời gian học theo ngày/tuần, chuỗi
  ngày học, hoạt động gần đây, **điểm phát âm** (trung bình, từ hay sai) — theo **từng con**.
- **Chế độ phụ huynh cùng học:** danh sách từ đã/đang học, mỗi mục gồm:
  **[từ tiếng Việt] 🔊** và **[nghĩa bằng ngôn ngữ phụ huynh — vd tiếng Đức] 🔊** — hai nút
  nghe **cạnh chữ tương ứng**: nút cạnh chữ Việt phát tiếng Việt (có nghe chậm), nút cạnh
  nghĩa phát audio bằng ngôn ngữ của phụ huynh. Ngôn ngữ này lấy từ lựa chọn lúc đăng ký
  (có thể đổi lại trong cài đặt). Nếu 1 mục chưa có bản dịch/audio ở ngôn ngữ đó → ẩn nút
  hoặc hiện biểu tượng "chưa có", không báo lỗi.
- **Kiểm soát:** giới hạn thời gian/ngày, bật/tắt chấm phát âm và quyền micro, chọn loại giọng/
  vùng miền (khi đã có nhiều giọng), quản lý hồ sơ con (kèm gán avatar), **đổi PIN**, xoá
  dữ liệu của con.
- **Hạn dùng, học phí và thêm con:** xem ngày hết hạn, tình trạng (dùng thử/đang dùng/hết
  hạn), danh sách **mức học phí** admin đặt, chọn mức và **báo đã thanh toán để gia hạn**;
  **"Xin thêm tài khoản cho con"** (số con hiện có/được phép, số tiền phí thêm con theo quy
  tắc 20%, hướng dẫn thanh toán, liên hệ admin); xem lịch sử thanh toán (xem 8).
- **Nhắc học:** thông báo đẩy/email gửi cho **phụ huynh** (không gửi trực tiếp cho trẻ). Lưu ý
  PWA trên iOS chỉ nhận thông báo đẩy khi đã cài ra màn hình chính — có email dự phòng.
- **Hỗ trợ** *(giai đoạn sau)*: gửi câu hỏi cho admin/giáo viên hỗ trợ và nhận trả lời.

## 6. Phần dành cho admin (và giáo viên hỗ trợ sau này)

Không có lớp học. Admin làm việc trực tiếp với **danh sách phụ huynh và các bé**:
- **Quản lý tài khoản phụ huynh:** xem danh sách phụ huynh tự đăng ký (đang dùng thử/đang
  dùng/hết hạn), hạn dùng và **số tài khoản con được cấp** của từng người, **xác nhận thanh
  toán và gia hạn**, **cấp thêm tài khoản con** sau khi phụ huynh xin và trả phí, tạm khoá tài khoản.
- **Mức học phí và phí thêm con:** tạo/sửa/ẩn các mức học phí (tên, giá, tiền tệ, thời gian dùng
  được cộng thêm) và chỉnh **tỉ lệ phí mỗi con thêm** (mặc định 20%) — admin **tự đặt hết**
  (xem 8).
- **Theo dõi từng bé:** từ đã học, thời gian, hoạt động gần đây, điểm phát âm, bé nào lâu không
  học — để admin nhắc phụ huynh hoặc dạy kèm ngoài app. Xuất báo cáo cho phụ huynh nếu cần.
- **Nội dung học:** công cụ ở mục 7.
- **Cấu hình bản triển khai:** tên, logo, màu chủ đạo (mặc định đỏ cam), thông tin nhận thanh
  toán trong **1 file cấu hình/bảng cài đặt** (không sửa code).
- **Vai trò giáo viên hỗ trợ (giai đoạn sau, tuỳ chọn):** admin tạo tài khoản giáo viên, cấp
  quyền **thêm đề/bài** và **trả lời hỗ trợ**. MVP không cần vai trò này — admin làm hết.

## 7. Quản trị nội dung (công cụ cho admin)

**Cách soạn nội dung:** admin **dùng AI soạn nội dung theo mẫu** (từ tiếng Việt, chủ đề, mức độ,
độ tuổi, bản dịch Đức/Anh, câu ví dụ, gợi ý hình) rồi đưa vào hệ thống. Dự án **cung cấp sẵn**:
- **File mẫu CSV chuẩn** (đủ cột, có ví dụ) và **mẫu câu lệnh (prompt) cho AI** để ra đúng
  định dạng mẫu.
- **Kiểm tra khi nhập:** báo rõ dòng nào lỗi/thiếu cột, thiếu bản dịch, trùng lặp — vì nội dung do
  AI soạn dễ sai (nghĩa, dấu tiếng Việt, bản dịch).
- Nội dung nhập vào ở trạng thái **nháp → admin duyệt → đã duyệt** mới hiện cho học sinh
  (admin tự duyệt; người duyệt chính là admin).

Công cụ web để **không cần sửa code khi thêm nội dung**:
- Quản lý Chủ đề/Bài học/Mục từ; **tải lên hình ảnh**; nhập **bản dịch nghĩa theo từng ngôn
  ngữ** (Đức, Anh…); gắn thẻ chủ đề/mức độ/độ tuổi.
- **Sinh audio TTS tự động** cho tiếng Việt và cho từng bản dịch khi nhập/duyệt; nút **nghe
  lại từng mục, sinh lại** khi đọc sai; xem thống kê mục thiếu audio.
- **Cho phép tải lên file giọng người thật/giọng trẻ em/giọng người lớn** thay thế hoặc bổ
  sung cho TTS (chức năng có sẵn trong thiết kế dù giai đoạn này chưa dùng — xem 4.4, 9.2).
- Nhập hàng loạt bằng **CSV** (kèm tên file hình) — nội dung sẽ nhập rất nhiều.
  **Đã làm:** cột `unit, lesson, vi` (bắt buộc), `unit_emoji, emoji, type, min_age, max_age`, và 1 cột nghĩa cho mỗi ngôn ngữ (`de`, `en`…);
  nhận dấu phẩy/chấm phẩy/Tab; luôn tạo bản nháp; nhập lại không tạo trùng; có file mẫu và câu lệnh mẫu cho AI (xem `public/js/admin/csv.js`, `text.js`).
- Xem thống kê nội dung (số mục theo chủ đề/ngôn ngữ, mục thiếu audio/thiếu bản dịch/thiếu
  audio bản dịch).
- **Nội dung mỗi bản triển khai riêng biệt**, không đồng bộ giữa các bản. Dựng bản triển khai
  mới thì nhập/xuất bộ nội dung khởi đầu qua CSV (xem 9.3).
- *(Giai đoạn sau)* giáo viên hỗ trợ dùng chính công cụ này nhưng bị giới hạn ở phần **thêm
  đề/bài**.

## 8. Mô hình kinh doanh, dùng thử, học phí và thêm con

**Hai lớp mua bán:**
1. **Chủ dự án → Admin:** admin mua app (bản triển khai riêng của mình). Do chủ dự án tự thoả
   thuận và thu tiền, nằm NGOÀI app.
2. **Phụ huynh → Admin:** phụ huynh trả **học phí** (và **phí thêm con**) cho admin. Đây là
   phần app phải hỗ trợ (dưới đây).

**Vòng đời tài khoản phụ huynh:**
1. **Đăng ký → dùng thử 1 tuần:** `access_until` = ngày đăng ký + 7 ngày, trạng thái `trial`.
   Dùng thử **đầy đủ nội dung**, 1 hồ sơ con, chỉ 1 lần cho mỗi tài khoản. Cần **xác nhận
   email** để hạn chế tạo nhiều tài khoản chỉ để dùng thử lại; admin có thể tạm khoá tài khoản đáng ngờ.
2. **Chọn mức học phí và thanh toán:** admin định nghĩa các **mức học phí** (tên, giá, tiền tệ,
   **thời gian dùng được cộng thêm** — vd 1 tháng / 3 tháng / 1 năm). Thời gian dùng **tương
   ứng với mức học phí đã trả**, không tự do nhập số ngày. Admin **tự đặt hết** giá và tiền tệ.
3. **Gia hạn:** khi thanh toán được xác nhận, hệ thống cộng thời gian của mức đã chọn vào hạn
   dùng: **hạn mới = max(hôm nay, hạn cũ) + thời gian của mức đó**. Trạng thái chuyển `active`.
4. **Hết hạn = khoá hết:** trẻ **không vào được bài học** và tài khoản phụ huynh **bị khoá các
   chức năng dùng app** (dashboard, cài đặt…). **Chỉ còn** màn hình **gia hạn** (xem mức học
   phí, hướng dẫn thanh toán, báo đã thanh toán), **đăng xuất**, và **xuất/xoá dữ liệu** (quyền
   của phụ huynh theo GDPR — không được khoá). Dữ liệu **không bị xoá** khi hết hạn; gia hạn
   xong dùng lại bình thường.

**Số tài khoản con:**
- Mỗi tài khoản phụ huynh mặc định có **1 tài khoản con** (`child_slots = 1`), kể cả lúc dùng thử.
- Muốn thêm con thứ 2, thứ 3… phụ huynh **bấm "Xin thêm tài khoản cho con"** và **làm việc với
  admin**, **trả thêm phí cho admin**; sau khi admin xác nhận đã nhận tiền, admin **tăng
  `child_slots`** cho tài khoản đó (chỉ admin tăng được — phụ huynh không tự tăng).
- **Có thể thêm con bất cứ lúc nào, kể cả sau vài tháng** — phụ huynh không cần đăng ký trước
  số con dự kiến khi mới bắt đầu. **Trần tối đa 6 con** cho 1 tài khoản (mặc định), là cài đặt của
  admin (`max_children`, mặc định 6) và admin cũng là người **quyết định có cấp thêm hay không** cho
  từng phụ huynh; app không cho `child_slots` vượt trần này.
- **Quy tắc phí (đã chốt):** **mỗi con thêm chỉ trả MỘT LẦN, vào lúc thêm**, bằng **20% phí đăng
  ký lúc đầu**. Tỉ lệ 20% là **cài đặt của admin** (`extra_child_percent`, mặc định 20), không cứng
  trong code. App **gợi ý** số tiền = 20% × học phí của mức phụ huynh đang dùng (hiểu "phí đăng
  ký" là học phí mức đó); **admin được sửa số tiền** trước khi xác nhận. Ví dụ học phí 100 → gợi
  ý 20 cho mỗi con thêm.
- **Gia hạn về sau không tự cộng phí con thêm.** Khi hết hạn, **admin làm việc với phụ huynh xem
  có muốn tiếp tục không** rồi mới quyết định (giá, số con…) — phụ huynh chọn mức học phí và báo đã
  thanh toán như bình thường; số con đã được cấp (`child_slots`) **giữ nguyên** trừ khi admin điều
  chỉnh.
- **Ràng buộc ở cơ sở dữ liệu**: không tạo được hồ sơ con vượt `child_slots` (RLS chỉ chặn quyền
  đọc/ghi, không tự đếm số lượng → phải dùng trigger/ràng buộc).
- Thời gian dùng (`access_until`) tính **chung cho cả tài khoản phụ huynh** (mọi con dùng chung 1
  hạn).

**Cách ghi nhận thanh toán ở MVP (chốt: làm tay):** MVP **không tích hợp cổng thanh toán**.
Luồng: phụ huynh chọn mức học phí (hoặc "thêm con") → app hiện **hướng dẫn chuyển tiền của
admin** (ngân hàng/PayPal… do admin nhập trong cấu hình) → phụ huynh bấm **"Tôi đã thanh toán"**
(tạo giao dịch `pending`) → admin đối chiếu và **bấm xác nhận** → hệ thống tự gia hạn/tăng số
con. Admin cũng có thể tự ghi nhận 1 khoản thanh toán cho phụ huynh (trả tiền mặt…). Cổng thanh
toán tự động (Stripe/PayPal/SEPA…) để giai đoạn sau.

**Bảng/khái niệm cần có:** `tuition_plans` (mức học phí: tên, giá, tiền tệ, thời gian), bảng/dòng
**cài đặt** chứa `extra_child_percent` (mặc định 20), `payments` (giao dịch: phụ huynh, loại
`tuition`/`extra_child`, mức học phí, **số con thêm, tỉ lệ %, học phí gốc và tổng tiền — chụp lại
lúc trả**, trạng thái pending/confirmed/cancelled, người xác nhận, thời điểm),
`accounts.access_until`/`access_status`/`child_slots`. Chụp lại giá và tỉ lệ vào giao dịch để sau
này admin đổi giá/tỉ lệ không làm sai lịch sử.

**Bỏ khỏi bản đầu:** khuyến mãi, thưởng giới thiệu bạn, số chỗ (seat), cổng thanh toán tự động.
Nếu sau này cần thì làm ở giai đoạn 2 (iLapra đã có mẫu).

**Kênh phát hành:** **chỉ PWA** (chốt) — không lên App Store/Google Play, nên không vướng phí và
chính sách "mua trong ứng dụng" của cửa hàng. Nếu sau này đổi ý phải xem lại mục này.

## 9. Yêu cầu kỹ thuật và dữ liệu

### 9.1 Nền tảng khuyến nghị (theo kinh nghiệm iLapra; dự án mới có thể xem xét lại)
- **PWA** chạy tốt trên tablet và điện thoại; cài như app; **cache audio/hình** ngoại tuyến;
  phiên đăng nhập giữ lâu dài (xem 4.0). Kiểm thử micro, phát âm thanh, thông báo đẩy trên
  **thiết bị iOS/Android thật**.
- Backend: **Supabase** (Postgres + Auth + Storage + RLS) và hosting **Cloudflare**
  (Worker/Pages, có thể chạy tác vụ định kỳ). Lưu audio/hình ở Storage/R2 có CDN.
- **Worker** làm cầu nối tới dịch vụ **TTS** (sinh audio khi admin nhập nội dung; giữ khoá bí
  mật phía máy chủ). Chấm phát âm ở MVP chạy **ngay trong trình duyệt** (Web Speech API) nên không
  qua Worker; nếu sau này nâng lên dịch vụ chấm trả phí thì cho đi qua Worker (giữ khoá + giới hạn
  lượt gọi).
- Dự án riêng: tài khoản/tên miền/cơ sở dữ liệu tách hẳn iLapra.

### 9.2 Mô hình dữ liệu tổng quát (đề xuất, có thể tinh chỉnh)
- `content_items`: loại (từ/cụm/câu/truyện/bài hát), văn bản tiếng Việt, hình (`image_path`, hoặc
  `emoji` khi chưa có ảnh — cả `units` cũng có `emoji`; AI soạn nội dung chỉ cần gợi ý 1 emoji), chủ đề,
  mức độ, **độ tuổi gợi ý**, thứ tự, trạng thái duyệt.
- `content_audio`: item, **ngôn ngữ của audio** (`vi` cho tiếng Việt; `de`/`en`… cho audio
  đọc bản dịch), **`source`** (`tts` | `human`), **`voice_kind`** (`adult` | `child`), **giọng
  vùng miền** (chỉ với `vi`), tốc độ (thường/chậm), **nhà cung cấp/tên giọng**, URL file. Hiện chỉ có
  `tts`; thêm `human` = thêm dữ liệu. Luật chọn giọng nằm ở 1 hàm chung (xem 4.4).
- `translations`: item, **mã ngôn ngữ (de/en/…)**, nghĩa, câu ví dụ dịch. (KHÔNG dùng 1 cột
  "nghĩa" duy nhất — phải hỗ trợ nhiều ngôn ngữ.) Audio của bản dịch nằm ở `content_audio`
  với ngôn ngữ tương ứng.
- `units` / `lessons` / `activities` (loại hoạt động, cấu hình, danh sách mục thuộc về).
- `accounts` (vai trò: phụ huynh/admin, sau này thêm giáo viên hỗ trợ; **`content_language`**
  = ngôn ngữ phụ huynh chọn lúc đăng ký = ngôn ngữ bản ngữ của trẻ; không có cột ngôn ngữ giao
  diện vì giao diện luôn là tiếng Việt; **`pin_hash` + `pin_salt`** (PIN 4 số dạng băm; việc khoá
  tạm khi nhập sai chỉ lưu ở thiết bị, không lưu ở CSDL); `access_until`, `access_status`, **`child_slots`** cho phụ huynh;
  **`pronunciation_enabled`**, sở thích giọng).
- `tuition_plans` (mức học phí), cài đặt `extra_child_percent` (mặc định 20) và `max_children`
  (mặc định 6, admin chỉnh được), và `payments` (giao dịch — xem
  mục 8).
- `child_profiles` (thuộc phụ huynh; tên/biệt danh, **`avatar_id` — duy nhất trong cùng 1
  phụ huynh**, ngày sinh hoặc độ tuổi/mức độ, giới hạn thời gian). **Số dòng ≤ `child_slots`
  của phụ huynh — ép bằng trigger/ràng buộc ở cơ sở dữ liệu.**
- `child_progress` (mức thuộc từng mục của từng con), `activity_log` (kèm thời gian học
  `duration_seconds` — không có bảng `sessions` riêng).
- `pronunciation_attempts`: con, mục học, điểm/mức, chi tiết (từ/âm yếu), thời điểm. **Không lưu
  file ghi âm** (xem 4.6, 9.5).
- *(Giai đoạn 3)* `support_threads`/`support_messages` cho kênh hỏi–đáp.
- **Không có** bảng `centers`, `classes`, `memberships` và **không có cột `center_id`** ở bất
  kỳ bảng nào. Thông tin đơn vị (tên, logo, thông tin nhận thanh toán…) nằm trong file cấu
  hình/1 dòng bảng cài đặt.

### 9.3 Mỗi bản triển khai = 1 admin/đơn vị
- Mỗi admin có **dự án Supabase riêng + dự án Cloudflare riêng + tên miền riêng + khoá dịch vụ
  TTS/AI riêng (hoặc dùng chung — xem mục 13)**, dùng **chung 1 mã nguồn**. Khác nhau giữa các bản
  triển khai chỉ nằm ở: kết nối CSDL/khoá (biến môi trường), tên/logo/màu (file cấu hình), và dữ liệu.
- Vì vậy **không cần** kiểm thử chéo giữa các admin — cách ly nằm sẵn ở tầng hạ tầng.
  **RLS vẫn là lớp bảo mật chính bên trong 1 bản triển khai:** phụ huynh chỉ thấy con mình;
  admin thấy tất cả; (sau này) giáo viên hỗ trợ chỉ có quyền được cấp. **Vẫn bắt buộc kiểm
  thử chéo giữa các vai trò** (phụ huynh A không đọc được con của phụ huynh B; phụ huynh không
  đọc/ghi được dữ liệu quản trị; **không tự tăng được `child_slots` hay `access_until`**; không
  vượt được giới hạn số con).
- Cần có **quy trình dựng bản triển khai mới** thật gọn (checklist + migration khởi tạo đầy
  đủ + bộ nội dung khởi đầu xuất/nhập được + tạo tài khoản admin đầu tiên + cấu hình khoá TTS/AI).
- **Nội dung học của mỗi bản triển khai riêng biệt, không đồng bộ** (chốt). Cải tiến/sửa lỗi
  **mã nguồn** thì triển khai lại cho từng bản — giữ mã nguồn chung, tránh sửa riêng lẻ từng bản.

### 9.4 Ngôn ngữ (giao diện và nội dung)
- **Giao diện: chỉ tiếng Việt.** Không cần hệ thống dịch chuỗi giao diện; vẫn nên gom chữ
  giao diện vào 1 chỗ (file hằng số) cho dễ sửa câu chữ, nhưng không cần chuyển ngôn ngữ.
- **Ngôn ngữ nội dung dịch (de, en, …):** thêm ngôn ngữ mới = thêm bản dịch (`translations`) +
  audio bản dịch (`content_audio`), không sửa code. Danh sách ngôn ngữ phụ huynh được chọn
  lúc đăng ký lấy từ các ngôn ngữ đang có bản dịch; ra mắt đầu tiên **tiếng Đức**, sau đó
  **tiếng Anh**.
- Ngôn ngữ phụ huynh chọn = ngôn ngữ của **nút "nghe tiếng bản ngữ"** ở giao diện trẻ và của
  nghĩa/audio ở khu phụ huynh.

### 9.5 Riêng tư và an toàn trẻ em (BẮT BUỘC cân nhắc — thị trường Đức/EU)
- Thu thập **tối thiểu** dữ liệu về trẻ (không email/địa chỉ/ảnh thật của trẻ; tên có thể là biệt
  danh; avatar là hình con vật, không phải ảnh thật).
- Sự đồng ý của **phụ huynh** khi tạo hồ sơ con; cho phép **xem, xuất, xoá** dữ liệu của con
  (kể cả khi tài khoản đã hết hạn — mục 8).
- Admin xem được tiến độ các bé → phụ huynh cần được **thông báo rõ và đồng ý** lúc đăng ký
  rằng admin (người dạy) xem được tiến độ học của con.
- **Giọng nói của trẻ đi qua bên thứ ba** khi chấm phát âm — đây là dữ liệu nhạy cảm nhất của
  dự án. Với Web Speech API (MVP), **trình duyệt gửi âm thanh lên máy chủ của hãng** (Google/Apple)
  mà mình không kiểm soát. Do đó: chỉ bật khi **phụ huynh đồng ý và cấp quyền micro**, **không
  lưu file ghi âm**, nêu rõ trong thông báo cho phụ huynh, và đưa vào tư vấn pháp lý GDPR. Nếu
  nâng lên dịch vụ chuyên dụng: chọn nhà cung cấp có hợp đồng xử lý dữ liệu, xử lý ở EU và cam
  kết không dùng dữ liệu trẻ để huấn luyện.
- **Tư vấn pháp lý GDPR/dữ liệu trẻ em: quyết định làm sau**, nhưng **phải hoàn tất trước khi
  công khai/nhận phụ huynh thật** (kể cả vai trò pháp lý giữa chủ dự án và admin, cơ sở pháp lý
  cho việc giọng trẻ đi qua trình duyệt/dịch vụ nhận dạng của bên thứ ba). Trong lúc phát triển, giữ thiết kế theo hướng tối thiểu dữ liệu.
- Không theo dõi quảng cáo, không SDK phân tích gửi dữ liệu trẻ cho bên thứ ba khi chưa
  cân nhắc; máy chủ/dữ liệu nên ở khu vực phù hợp (EU).
- Thu âm lưu lại giọng trẻ (giai đoạn 2, nếu làm): chỉ lưu khi phụ huynh bật, chỉ phụ huynh/admin
  nghe được, có thể xoá.
- Phiên đăng nhập giữ lâu dài trên thiết bị của trẻ nghĩa là thiết bị mất/cho mượn = tài
  khoản phụ huynh mở được (nếu biết PIN) → PIN có khoá tạm khi nhập sai, đăng xuất/xoá dữ liệu
  phải xác nhận, và có cách đăng xuất từ xa/hết hạn phiên.

## 10. Phạm vi MVP (giai đoạn 1) và lộ trình

### MVP — làm trước
- Đăng ký/đăng nhập phụ huynh (giao diện **tiếng Việt**, xác nhận email, chọn **ngôn ngữ phụ
  huynh** — Đức trước), **dùng thử 1 tuần**, giữ phiên đăng nhập, **đặt PIN 4 số**, tạo **hồ sơ
  con** (1 con) + gán **avatar**.
- **Màn hình chọn avatar** (trẻ chọn đúng avatar để vào học, sai thì không vào) + **nút nhỏ vào
  khu phụ huynh có PIN**.
- Giao diện học cho trẻ **audio-first, có chữ tiếng Việt + nút nghe tiếng Việt + nút nghe tiếng
  bản ngữ**, linh vật gà trống, gồm **≥5 dạng hoạt động** (mục 4.2) trong đó có **chấm phát âm**.
- **Âm thanh TTS sinh sẵn** cho tiếng Việt + bản dịch, với **cấu trúc dữ liệu/luật chọn giọng
  sẵn sàng cho giọng người thật/trẻ em/người lớn**.
- **Chấm phát âm tự động** bằng Web Speech API của trình duyệt (mục 4.6), hàm chấm tách riêng để
  nâng cấp sau; kèm bước thử nghiệm kỹ thuật với giọng trẻ thật; phụ huynh bật/tắt.
- **Một bộ nội dung khởi đầu** (khoảng 5–8 chủ đề, mỗi chủ đề ~8–10 từ) do admin soạn bằng AI
  theo mẫu: hình + nghĩa tiếng Đức + audio TTS (tiếng Việt và nghĩa tiếng Đức).
- Dashboard phụ huynh: tiến độ, thời gian, từ đã học (kèm nghĩa tiếng Đức + nghe cả hai), điểm
  phát âm, hạn dùng, học phí, **xin thêm tài khoản con**.
- Dashboard admin: danh sách phụ huynh + các bé + tiến độ, quản lý **mức học phí/phí thêm con**,
  xác nhận thanh toán/gia hạn, **cấp thêm tài khoản con**, khoá tài khoản.
- Công cụ admin nội dung: file mẫu CSV + mẫu prompt AI, nhập CSV có kiểm tra lỗi, tải hình, bản
  dịch, **sinh/nghe lại/sinh lại audio TTS**, duyệt nháp.
- File cấu hình tên/logo/màu (đỏ cam)/thông tin nhận thanh toán của bản triển khai.
- Học phí: phụ huynh chọn mức + báo đã thanh toán, **admin xác nhận tay → tự gia hạn**; **hết
  hạn = khoá hết** (trừ màn hình gia hạn, đăng xuất, xuất/xoá dữ liệu).
- RLS theo vai trò + ràng buộc số con + kiểm thử chéo giữa các vai trò.

### Giai đoạn 2
- Thêm ngôn ngữ phụ huynh **tiếng Anh** (bản dịch + audio); thêm nhiều chủ đề; **truyện và
  bài hát**; **giọng người thật, giọng trẻ em, giọng người lớn** (thu và tải lên); giọng vùng miền
  Bắc/Nam; **lưu ghi âm của trẻ để phụ huynh/admin nghe lại** (nếu phụ huynh bật); ôn tập ngắt
  quãng tốt hơn.
- Thông báo nhắc học cho phụ huynh; cổng thanh toán tự động; khuyến mãi/giới thiệu bạn nếu cần.

### Giai đoạn 3
- **Giáo viên hỗ trợ** (thêm đề + trả lời hỗ trợ), kênh hỏi–đáp phụ huynh ↔ admin/giáo viên;
  **nhánh học cho người lớn/người nước ngoài** (chưa làm bây giờ); cải tiến độ chính xác chấm
  phát âm (thanh điệu, giọng vùng miền).

### Ngoài phạm vi hiện tại
- **Phát hành trên App Store/Google Play** (chốt: chỉ PWA).
- **Tổ chức lớp học** (lớp, mã lớp, lịch lớp) — đã quyết không làm; **đa admin/đa trung tâm
  trong 1 hệ thống**; chuyển đổi ngôn ngữ giao diện; **đồng bộ nội dung giữa các bản triển khai**.
- Người lớn/người nước ngoài học tiếng Việt.

## 11. Bài học từ iLapra (tránh lặp lại lỗi đã gặp)

- Supabase/PostgREST **âm thầm cắt tối đa 1000 dòng** mỗi truy vấn không lọc → luôn **phân trang**
  (`.range()`) hoặc lọc theo phạm vi hẹp; đừng tải nguyên bảng lớn (nội dung sẽ lên hàng nghìn mục).
- Cột id dạng identity phải là **`generated BY DEFAULT`** (không `ALWAYS`) nếu sau này có
  upsert/nhập lại (nhập CSV lại nội dung đã có).
- RLS **không báo lỗi khi thiếu quyền, chỉ trả 0 dòng** → khi cần đọc quan hệ ngược (vd admin
  đọc hồ sơ các bé, phụ huynh đọc trạng thái hạn dùng của mình…) phải kiểm tra **toàn bộ chuỗi
  bảng** liên quan cùng lúc.
- Đừng để 1 hàm "tải dữ liệu" gánh thêm trách nhiệm ẩn (vd hiện khung giao diện) — tách việc
  rõ ràng để khi tối ưu không làm hỏng luồng khác.
- Tác vụ nặng lúc đăng nhập/vào tab làm giao diện đơ → chỉ tải dữ liệu **màn hình đang
  cần**, tải lười phần còn lại. (Áp dụng cho màn hình chọn avatar: chỉ tải danh sách hồ sơ
  con, chưa tải nội dung học.)
- Thứ tự tab/khung điều hướng phải khớp mảng cấu hình (đã từng mở nhầm tab nặng).
- **Test trên bản deploy thật** (không chỉ file cục bộ) và trên **thiết bị thật** (tablet/iOS
  Safari); lỗi hiển thị/âm thanh/micro thường chỉ lộ ở đó.
- Tạo tài khoản đăng nhập bằng cách ghi thẳng SQL vào bảng auth của Supabase từng gây lỗi đăng
  nhập thật; cách ổn định là **người dùng tự đăng ký bằng luồng đăng ký công khai của Supabase**,
  quản trị chỉ gán vai trò/quyền sau đó → dự án này để **phụ huynh tự đăng ký**, không để
  admin tạo thẳng tài khoản đăng nhập.
- Migration SQL đánh số thứ tự, người chủ dự án tự chạy trong SQL Editor, và **phải có
  migration khởi tạo đầy đủ từ đầu** (kể cả bảng admin) để dựng môi trường mới không phải làm tay
  — đặc biệt quan trọng ở dự án này vì mỗi admin mới là 1 CSDL mới.

## 12. Cách làm việc mong muốn với AI/lập trình viên

- Chủ dự án **tự chạy git** (commit/push) — không tự commit/push.
- Việc lớn (đổi cấu trúc dữ liệu, phân quyền, luồng học phí/số con, tích hợp AI) → **lập kế
  hoạch và xin duyệt trước khi code**; việc nhỏ (chỉnh chữ/màu/bố cục) → làm thẳng, không cần test dài dòng.
- Trả lời ngắn gọn; khi có nhiều cách, đưa **khuyến nghị + đánh đổi chính**.
- Ghi tài liệu dự án ngắn gọn để phiên sau đọc lại (quy tắc dễ sai, quyết định đã chốt).
- Kiểm thử đề nghị: thay đổi có logic → kiểm tra thao tác thật trong trình duyệt bằng dữ liệu
  giả; đặc biệt **kiểm tra chéo phân quyền (RLS) giữa các vai trò** cho mọi bảng mới.
- **Thứ tự làm gợi ý:** làm **thử nghiệm kỹ thuật chấm phát âm (spike)** và **chọn TTS tiếng
  Việt** song song với việc dựng khung (đăng ký, PIN, avatar, dữ liệu) — vì 2 việc này có rủi ro
  cao nhất và quyết định chọn dịch vụ/chi phí.

## 13. Việc đã chốt và câu hỏi còn mở [CẦN QUYẾT]

**Đã chốt (đưa vào mục 2):** tên "Tôi luyện tiếng Việt" + gà trống đỏ cam; nguồn âm thanh = TTS
(thiết kế sẵn cho giọng thật); chỉ PWA; độ tuổi 3–8; nội dung do admin soạn bằng AI theo mẫu;
nút nhỏ vào khu phụ huynh dùng PIN; chấp nhận chạm avatar anh/chị; nội dung mỗi bản riêng, không
đồng bộ; thanh toán ghi nhận tay; thêm con = xin + trả thêm phí + admin cấp; dùng thử đầy đủ và
khoá hết khi hết hạn nhưng vẫn cho vào màn hình gia hạn/đăng xuất/xuất-xoá dữ liệu; PIN chỉ để
vào khu phụ huynh; phí mỗi con thêm = 20% phí đăng ký (tỉ lệ admin chỉnh được); học phí do admin
tự đặt; trần 6 con/tài khoản (admin quyết định), thêm con bất cứ lúc nào kể cả sau vài tháng;
GDPR làm sau (nhưng phải trước khi công khai).

**Còn mở:**
1. **Tên miền** (tên sản phẩm đã có); ai vẽ hình **gà trống linh vật** và bộ avatar.
2. **Chọn dịch vụ TTS** cho tiếng Việt/Đức/Anh — nghe thử (mục 4.4).
3. **Chấm phát âm — thử nghiệm kỹ thuật (spike):** Web Speech API có đủ tốt với giọng trẻ 3–8
   tuổi nói tiếng Việt, trên iOS/Android thật và PWA đã cài không? **Ngưỡng chấm** cho từng độ tuổi.
   Chấp nhận việc âm thanh trẻ đi qua Google/Apple hay cần dịch vụ có hợp đồng (mục 4.6, 9.5)?
4. **Nếu phải nâng lên dịch vụ chấm chuyên dụng (trả phí):** chọn dịch vụ nào, **ai trả chi phí**
   (chủ dự án hay từng admin), **hạn mức lượt chấm/ngày** mỗi bé. Chưa cần quyết nếu MVP dùng Web
   Speech API là đủ.
5. *(Đã chốt: phí thêm con trả 1 lần khi thêm, gia hạn do admin làm việc với phụ huynh; trần 6
   con; thêm con giữa kỳ được.)*
6. **Chữ nghĩa bản ngữ trên màn hình trẻ:** chỉ nghe (đề xuất) hay hiện thêm chữ cho trẻ 6–8 tuổi?
7. **Admin/khách hàng thử nghiệm đầu tiên** — xác định người cụ thể để lấy phản hồi sớm và lấy ghi
   âm thử (kèm sự đồng ý của phụ huynh).
8. **Tư vấn pháp lý GDPR/dữ liệu trẻ em** — để sau, nhưng cần hẹn thời điểm trước khi nhận phụ
   huynh thật (đặc biệt vì giọng trẻ đi qua bên thứ ba khi chấm phát âm).
