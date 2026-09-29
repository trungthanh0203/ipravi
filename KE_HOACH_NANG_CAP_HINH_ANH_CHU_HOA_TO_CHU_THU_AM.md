# Kế hoạch nâng cấp: hình ảnh, chữ hoa, tô chữ, đánh vần từng phần, thu giọng người thật

> **Thứ tự đã chốt (2026-09-20):** ① Thu âm (giọng NAM của chủ dự án trước; nữ và trẻ em để sau) → ② Đánh vần theo phần (tạm dùng TTS) → ③ Tô chữ (mẫu chữ thảo) → ④ Nâng cấp hình ảnh. Chữ hoa: chưa xếp. **Tiến độ: ① Thu âm ✅ (migration 010 + tab Thu âm) · ② Đánh vần theo phần ✅ (migration 011) · ③ Tô chữ ✅ giai đoạn 1 (migration 013) · ④ Hình ảnh ✅ (migration 014: vai trò hình + Twemoji + ảnh riêng) · Chữ hoa ✅ (migration 012, đã chốt C1–C4).**
>
> Bản nháp để **bàn và chốt** (2026-09-20). Chưa code phần nào ngoài mục 1.1 (đã sửa nhanh hình ở Cấp 4). Mọi ước lượng tính theo
> "phiên làm việc" (S ≈ 1 phiên ngắn, M ≈ 1–2 phiên, L ≈ 3+ phiên). Cuối file có **danh sách quyết định cần bạn chọn**.

## 0. Tóm tắt và thứ tự đề xuất

| # | Hạng mục | Cỡ | Phụ thuộc | Vì sao đặt ở đây |
|---|---|---|---|---|
| 1 | **Hình ảnh**: vai trò hình (đúng nghĩa / trang trí), hình đồng nhất trên mọi máy, tải ảnh minh hoạ riêng | S + M + M | — | Hình sai làm bé học sai; sửa trước khi soạn thêm nội dung |
| 2 | **Chữ hoa** (nội dung + hoạt động ghép hoa–thường) | S–M | — | Ít rủi ro, cần cho tô chữ |
| 3 | **Tô chữ giai đoạn 1** (theo mẫu chữ, chấm độ phủ) | M | 2 (cho chữ hoa) | Bé viết được ngay, không cần dữ liệu nét |
| 4 | **Thu giọng người thật trong app** + ngân hàng âm | M | — | Nền cho mục 5; cũng giải quyết TTS đọc chữ cái dở |
| 5 | **Đánh vần theo từng phần** | M | 4 (chạy được trước bằng TTS, hay hơn khi có giọng thu) | |
| 6 | Tô chữ giai đoạn 2 (đúng thứ tự nét) | L | 3 | Làm sau, nếu thật cần |

## 1. Hình ảnh không khớp nội dung

### 1.1 Đã sửa nhanh (Cấp 4)
Tôi rà 208 mục và thấy 4 loại lỗi; đã xử lý những gì làm được bằng dữ liệu:
- **Câu hỏi đọc hiểu (36 mục) có emoji vô nghĩa** (🔢 💼 📛…) — thực ra giao diện không hiển thị hình cho câu hỏi → **đã bỏ hình** ở các dòng này.
- **Câu trừu tượng chỉ có 1 emoji** (vd "Chỉ có Lang Liêu nghèo, chàng chẳng biết làm gì" chỉ có 😟; "Thánh Gióng… roi sắt gãy" chỉ có 🎋) → **đổi thành "cảnh" 2 emoji** thể hiện chủ thể + hành động (😟🌾, 🎋⚔️, 🐉🌊, 🐴🔥…) — ~65 câu; khung hình tự thu nhỏ chữ cho vừa.
- **Tục ngữ/ca dao**: hình không thể hiện được nghĩa ("Học ăn, học nói, học gói, học mở" ↔ 📖) mà hoạt động *đọc – chạm hình* lại dùng hình để đoán → **bỏ hoạt động đó** khỏi 3 bài này (dùng điền từ, xếp từ, chọn câu viết đúng, nói theo).
- Còn lại là **giới hạn của emoji**, không sửa bằng dữ liệu được → các đề xuất 1.2.

> Nhờ bạn cho 3–5 ví dụ hình bạn thấy *không hợp* (bài nào, mục nào) để tôi so với danh sách của mình — có thể bạn thấy ở Cấp 1–3 chứ không chỉ Cấp 4.

### 1.2 Vấn đề gốc của emoji
1. **Mỗi hệ điều hành vẽ một kiểu** (iPhone ≠ Android ≠ Windows); emoji mới có thể hiện ô vuông trên máy cũ (🪑 🥇 🟩…).
2. **Không có hình cho khái niệm Việt Nam** (bánh chưng, áo dài, nón lá, phở đúng kiểu, cây tre, đèn lồng…) — đang dùng hình gần đúng.
3. **Tính từ/hành động/câu chuyện** không có hình đúng nghĩa (to ↔ 🐘, "nhanh" ↔ 🐆 khiến bé nhầm "voi" với "to").
4. Không có cách đánh dấu "hình này chỉ để trang trí, đừng dùng để đoán đáp án".

### 1.3 Đề xuất (làm theo thứ tự A → B → C)

**A. Thêm "vai trò hình" cho mục — cỡ S, rẻ nhất, chặn được lỗi loại 3–4**
- Cột mới `content_items.pic` = `literal` (hình *đúng nghĩa*, được dùng để chọn/ghép) hoặc `decor` (chỉ trang trí).
- Các hoạt động dựa vào hình (`listen_pick`, `read_pick`, `match`, `order_story` dạng thẻ hình) **chỉ dùng mục `literal`**; bài không đủ mục literal thì hoạt động tự bỏ qua (đã có cơ chế này).
- Mặc định: `word`/`phrase` = literal; câu, truyện, tục ngữ = decor. CSV có cột `pic`; tab Nội dung có ô chọn.
- Có thêm **chế độ "duyệt hình"** ở tab Nội dung: xem cả bài dạng thẻ lớn (hình + chữ) để người duyệt phát hiện hình sai nhanh hơn bảng chữ hiện nay.

**B. Hình đồng nhất trên mọi máy (Twemoji) — cỡ M**
- Nhúng bộ Twemoji (bản duy trì `jdecked/twemoji`, giấy phép **CC-BY 4.0**: cần ghi công trong mục "Giới thiệu") thay vì phông emoji của máy. Script chỉ trích ~600 emoji đang dùng thành một sprite SVG cùng nguồn (không gọi CDN). Kết quả: giống nhau trên iPhone/Android/Windows, không còn ô vuông.
- Đánh đổi: +~150 KB (nén); nếu emoji chưa có trong Twemoji (mới quá) thì rơi về phông máy.
- (OpenMoji cũng đẹp nhưng CC BY-SA — buộc chia sẻ tương tự; không chọn.)

**C. Ảnh minh hoạ riêng cho phần emoji không làm được — cỡ M (code) + nội dung**
- App **đã hiển thị** `image_path` (ưu tiên hơn emoji), nhưng **chưa có nơi tải ảnh**. Cần: (1) ô tải ảnh trong tab Nội dung, (2) cột CSV `image` + **tải hàng loạt** (thả nhiều file, tên file = từ không dấu, vd `banh-chung.png`; app ghép và cho xem trước), (3) nén/đổi kích thước ảnh ở trình duyệt (≤ 300 KB, 512 px) trước khi lên Storage; sw.js đã cache-trước media.
- **Nguồn ảnh (chọn 1, đề xuất kết hợp):**
  | Nguồn | Ưu | Nhược |
  |---|---|---|
  | Hoạ sĩ vẽ bộ tranh phong cách chung | Đẹp, đúng văn hoá, bản quyền rõ | Tốn tiền + thời gian; cần brief |
  | Ảnh do AI tạo (cùng 1 prompt phong cách) | Nhanh, rẻ | Hay sai chi tiết (bánh chưng, áo dài, số ngón tay…), cần người duyệt từng ảnh; phải xem điều khoản thương mại của công cụ |
  | Giữ emoji (+Twemoji) | Rẻ, đồng nhất | Xem 1.2 |
- **Đề xuất:** giữ emoji/Twemoji cho từ cụ thể quen thuộc (≈ 90% Cấp 1–3); chỉ làm ảnh riêng cho ≈ **40 mục đặc trưng Việt Nam** + ≈ **100 "cảnh truyện"** (Cấp 4) + vài chục khái niệm trừu tượng. Ước khoảng 150–200 ảnh.

## 2. Thu giọng người thật ngay trong app (+ ngân hàng âm)

**Vì sao cần:** TTS đọc chữ/vần đơn lẻ dễ sai; giọng trẻ em tiếng Việt Azure không có; đánh vần theo phần cần nhiều file nhỏ.

### 2.1 Màn hình "Thu âm" (tab mới cho admin)
- **Chọn danh sách cần thu:** theo bài / theo chủ đề / "mục chưa có giọng người thật" / **ngân hàng âm** (2.2). Cài **1 lần cho cả phiên**: giọng **nữ/nam**, **người lớn/trẻ em**, **vùng** (Bắc/Trung/Nam), tốc độ (thường/chậm).
- **Mỗi mục 1 màn hình lớn:** chữ to + chữ đọc (`say`) + nút nghe mẫu TTS; nút **● Thu / ■ Dừng / ▶ Nghe lại / ✓ Giữ / ↻ Thu lại**; đồng hồ mức micro; tiến độ "đã thu 23/29"; phím tắt (Space thu/dừng, Enter giữ, ← → chuyển mục). Giữ xong tự sang mục kế.
- **Tự cắt khoảng lặng đầu/cuối, chuẩn hoá âm lượng** (đỉnh −1 dB) để mọi file cùng độ to.
- **Đường tải thay thế:** thu ngoài (Audacity/điện thoại) rồi **thả hàng loạt** file `b.wav`, `ba.wav`… → app ghép theo tên, cho nghe thử, rồi lưu.
- Lưu bằng đường có sẵn: Storage `content` + dòng `content_audio` (`source='human'`, `voice_kind`, `gender`, `region`, `speed`) → `pickAudio` **tự ưu tiên giọng người thật** — không sửa khu bé.

### 2.2 Ngân hàng âm
- Một chủ đề **ẩn** ("Ngân hàng âm": `units.hidden`, bé không thấy) chứa các mục *chỉ để lấy âm*: 29 âm chữ cái, ~70 vần (an, ang, ưa…), 6 tên thanh, các tiếng chưa dấu (ba, ma…). Dùng lại toàn bộ pipeline hiện có (sinh TTS tạm, thu giọng người thật, tải trước âm thanh).
- Đầu ra: khoảng **150–250 file ngắn** cho 1 giọng (nữ người lớn); nhân đôi cho giọng nam; giọng trẻ em là bước riêng.

### 2.3 Kỹ thuật và rủi ro
- **Định dạng:** `MediaRecorder` mỗi trình duyệt ra định dạng khác nhau (Chrome: webm/opus; Safari: mp4) và không phải máy nào phát được → thu **PCM thô bằng Web Audio**, cắt/chuẩn hoá, **lưu WAV mono 24 kHz 16-bit** (~48 KB/giây; chữ cái ~1 giây, từ ~1,5 giây) — phát được ở mọi nơi. Sau này nếu dung lượng lớn thì chuyển MP3 (thêm thư viện lamejs).
- Cần **HTTPS + cử chỉ chạm** (đã đúng với PWA); iOS phải cấp quyền micro mỗi phiên. Phải **thử trên iPhone/Android thật**.
- **Pháp lý/GDPR:** thu giọng **người lớn** của chính admin thì đơn giản; thu **giọng trẻ em** là dữ liệu cá nhân của trẻ → cần đồng ý của phụ huynh trẻ đó bằng văn bản, ghi rõ mục đích, không dùng cho mục đích khác.
- Kiểm thử: hàm cắt lặng/chuẩn hoá/mã hoá WAV là hàm thuần → test tự động; phần micro chỉ thử được bằng tay.
- Cỡ: **M**. (Thêm tab "Thu âm" + 1 migration nhỏ cho `units.hidden`.)

## 3. Đánh vần theo từng phần (`spell_along`)

**Chuỗi mẫu cho "bà":** *bờ – a – ba – huyền – bà* (âm đầu → vần → tiếng chưa dấu → tên dấu → tiếng). Với "bàn": *bờ – an – ban – huyền – bàn*.
- App tách bằng `splitSyllable` + `stripTone` + `toneOf` (đã có), rồi **tra từng phần trong ngân hàng âm**; **phần nào chưa có file thì rơi về TTS/giọng trình duyệt** → tính năng chạy được ngay ngày đầu, và **tự hay lên** khi thu thêm giọng người thật (không sửa code).
- **2 chế độ:** ① *Xem – nghe*: các phần sáng lên theo từng âm thanh, chạm phần nào nghe phần đó; ② *Tự đánh vần*: bé chạm các phần theo thứ tự (mỗi lần chạm nghe âm đó), cuối cùng nghe cả tiếng, được sao.
- Không cần dữ liệu mới cho từng bài: mọi mục `word` 1 tiếng ở Cấp 3–4 chơi được ngay.
- **Điểm cần chốt:** *cách đánh vần khác nhau giữa các bộ sách* (có tranh cãi khi đổi chương trình 2018); nên chốt theo sách mà bé sẽ học — xem quyết định D3. Có thể đặt chuỗi là **tuỳ chỉnh được** ở tab Cài đặt.
- Cỡ: **M**; phần lớn là giao diện + hàm tách/tra âm (có test).

## 4. Chữ hoa — ✅ ĐÃ LÀM (C1–C4 đã chốt theo đề xuất: chủ đề riêng sau "Chữ cái", từ khoá là tên riêng, có nút đổi thứ tự, có bài chữ ghép)

**Mục tiêu bé làm được:** nhận ra 29 chữ hoa; **ghép mỗi chữ hoa với chữ thường**; biết **khi nào viết hoa** (đầu câu, tên riêng, địa danh); (sau này) tô chữ hoa.

### 4.1 Nội dung (CSV, Cấp 3, một chủ đề mới "Chữ hoa")
- **Mỗi mục là một cặp** `Aa` (`type=letter`, cột `say` = âm đọc, giống chữ thường) — bé thấy chữ hoa và chữ thường đi cùng nhau.
- **Chia nhóm** đúng như chữ thường để bé thấy quen:  ① A O Ô Ơ · ② I E Ê U Ư · ③ B M N L · ④ T C K Q D Đ · ⑤ H G R S V X · ⑥ Ă Â Y P → **6 bài**; thêm **1–2 bài chữ ghép** ở đầu tên riêng: Ch, Gh, Gi, Kh, Ng, Ngh, Nh, Ph, Qu, Th, Tr (11 mục). Khoảng **7–8 bài, ~40 mục**.
- **Từ khoá** = **tên riêng/địa danh**, vì đó là nơi dùng chữ hoa (bé học chữ hoa *để làm gì*). Gợi ý (người duyệt chốt): A **An** · Â **Âu Cơ** (đã gặp ở truyện Cấp 4) · B **Bình** · C **Cúc** · D **Dung** · Đ **Đà Nẵng** · E **Em**? · Ê **Êđê** · G **Gia Lai** · H **Hà Nội** · I **Ích**? · K **Kim** · L **Lan** · M **Mai** · N **Nam** · O **Oanh** · Ô — · P **Pleiku** · Q **Quang** · R **Rạng**? · S **Sơn** · T **Tâm** · U **Uyên** · V **Việt Nam** · X **Xuân** · Y **Yên Bái**. Chữ **Ă, Ơ, Ư** hiếm mở đầu tên riêng → dùng **từ đầu câu** ("**Ăn** cơm đi con.", "**Ơi**, mẹ ơi!", "**Ư**, đúng rồi!"). *Đây là danh sách của tôi — cần người Việt bản ngữ chốt tên nào tự nhiên.*
- **Hình:** tên người dùng emoji người (👦 👧), địa danh dùng "cảnh" 2 emoji; **không dùng cờ** (Windows hiện thành chữ). Vì hình của tên riêng chỉ mang tính **trang trí**, các bài này **không dùng hoạt động "chọn hình"** (xem vai trò hình ở mục 1.3-A).

### 4.2 Hoạt động (3 hoạt động mới, đều **không cần dữ liệu thêm**)
| Hoạt động | Bé làm gì | Cách sinh |
|---|---|---|
| `match_case` ghép hoa ↔ thường | Ghép các thẻ chữ hoa với chữ thường (4–5 cặp) | Tách `Aa` → `A` và `a` |
| `pick_case` chọn chữ tương ứng | Thấy `b` chọn `B` trong 3 chữ (và ngược lại); nhiễu là các chữ hoa dễ lẫn (B/D/P, Q/O, G/C) | Từ chính các cặp của bài |
| `fix_capital` chạm từ cần viết hoa | Câu viết toàn chữ thường ("bà kể chuyện cho lan nghe"), bé chạm các từ phải viết hoa | Từ câu có sẵn: từ viết hoa **không đứng đầu câu** = tên riêng; đầu câu luôn hoa |
Kèm `listen_pick_text` và `listen_repeat` sẵn có (nghe âm → chọn chữ; nói theo). Bài "Viết hoa đầu câu và tên riêng" của Cấp 4 (`write_check`) giữ nguyên làm bước tiếp theo.

### 4.3 Việc kỹ thuật kèm theo
- **Migration `012`**: thêm 3 loại hoạt động vào CHECK (+ test SQL); `ACTIVITY_DEFAULTS`, `RUNNERS`, chữ giao diện.
- **Thứ tự chủ đề (nút ▲▼ ở tab Nội dung)** — *cần làm cùng*: chủ đề mới nhập được xếp **cuối** cấp, nên "Chữ hoa" sẽ nằm sau "Đọc từ và câu ngắn" thay vì ngay sau "Chữ cái". Thêm nút đổi thứ tự (hoán đổi `sort_order`) cũng giải quyết mục "đổi thứ tự chủ đề" còn tồn đọng. Cỡ S.
- **Hàm thuần có test:** tách cặp `Aa`, sinh nhiễu chữ hoa, tìm từ cần viết hoa trong câu.
- **Tô chữ (mục 5)** sau này thêm chữ hoa bằng chính các mục này (không cần dữ liệu mới).

### 4.4 Ước lượng và rủi ro
- Cỡ **M** (1–2 phiên): CSV ~40 mục + 3 hoạt động nhỏ + nút đổi thứ tự.
- **Sư phạm:** trường ở Việt Nam thường dạy chữ hoa cùng/ngay sau chữ thường ở lớp 1; với trẻ gốc Việt ở nước ngoài dạy **sau khi bé đã đọc được chữ thường** là hợp lý — nhưng bạn có thể muốn xen vào từng nhóm (xem quyết định C1).
- **Hình dạng chữ hoa khác nhau giữa kiểu in và kiểu thảo** (vd chữ hoa thảo của A, D, Q, G khác kiểu in): app hiện kiểu **in** (phông giao diện) ở bài nhận mặt chữ, kiểu **thảo** (Playwrite VN) khi tô chữ — cần báo cho phụ huynh để khỏi thắc mắc.
- Tên riêng gắn với văn hoá/miền: chọn tên phổ biến, trung tính; tránh tên chỉ dùng một miền nếu bé học ở vùng khác.

### 4.5 Quyết định cần bạn chọn
| # | Câu hỏi | Đề xuất |
|---|---|---|
| C1 | Dạy chữ hoa **sau** toàn bộ chữ thường (chủ đề riêng) hay **xen** vào từng nhóm chữ? | Chủ đề riêng, đặt ngay sau "Chữ cái" (ít làm lại nội dung đã nhập) |
| C2 | Từ khoá là **tên riêng/địa danh** (kèm từ đầu câu cho Ă, Ơ, Ư) — đồng ý? | Đồng ý; bạn hoặc người bản ngữ duyệt danh sách tên |
| C3 | Làm luôn nút **đổi thứ tự chủ đề** ▲▼? | Có (cần để đặt đúng chỗ) |
| C4 | Bài chữ ghép (Ch, Gh, Ngh…) có ở cả bản hoa không? | Có, 1 bài |

## 5. Tô chữ

### Giai đoạn 1 — tô theo mẫu, chấm độ phủ (cỡ M) — ✅ ĐÃ LÀM
> Thực tế đã làm hơn kế hoạch: chấm **từng mảnh** của chữ (thân/dấu thanh/dấu mũ) chứ không chỉ độ phủ chung; khoanh cam mảnh chưa tô; đã kiểm phông có đủ glyph cho toàn bộ chuỗi cần tô; xem `child/activities/trace.js`, `trace-score.js`.
- **Mẫu chữ:** phông **Playwrite VN** (Google Fonts, TypeTogether) — thiết kế theo *mẫu chữ thảo tiểu học Việt Nam*, có kiểu **đứng** và **nghiêng**, có bản **"Guides" có dòng kẻ**; miễn phí cho dùng thương mại. **Tự lưu phông trong app** (không gọi Google — GDPR) và **xác nhận lại giấy phép** khi tải về.
- **Cách chơi:** chữ mờ (viền nét đứt) hiện trên khung có dòng kẻ; bé dùng ngón tay/bút cảm ứng tô lên; nút "Xoá làm lại". Kỹ thuật: Canvas + Pointer Events (`touch-action: none` để không cuộn trang khi tô), rà soát **độ phủ** (bao nhiêu % chữ mẫu được tô) và **nét thừa** (mực nằm ngoài chữ) → 1–3 sao. **Không bao giờ hiện "sai"**, chỉ khuyến khích tô lại.
- Áp dụng cho: chữ cái thường/hoa, dấu thanh, chữ số, từ ngắn (2–3 chữ) — dùng luôn `text_vi` của mục, **không cần dữ liệu mới**. Hoạt động mới `trace` (+ CHECK ở migration).
- **Giới hạn phải nói thật:** *không kiểm tra thứ tự/hướng nét* (tô đúng hình nhưng có thể nét ngược); ngón tay trên kính ≠ cầm bút trên giấy → app là **phần bổ trợ**, vẫn nên tập viết trên vở.

### Giai đoạn 2 — đúng thứ tự nét (cỡ L, làm sau nếu cần)
- Cần **dữ liệu đường nét** (đường tâm, thứ tự, hướng) cho 29 chữ thường + 29 hoa + 5 dấu ≈ 63 ký tự. Không có sẵn — phải tự soạn: (a) công cụ admin "Tạo nét": hiện chữ mẫu, người soạn chấm điểm/kéo đường cho từng nét, lưu JSON trong repo; (b) hoặc tự động làm mỏng từ phông rồi người sửa thứ tự/hướng.
- Hoạt động `trace_ordered`: hoạt hình mẫu (chấm chạy theo nét) → bé tô đúng nét đầu → đúng nét kế…
- Rủi ro: tốn công soạn và **phải có người dạy viết chữ tiểu học duyệt thứ tự nét** theo đúng mẫu chữ.

## 6. Ước lượng và rủi ro tổng

- Tổng cỡ: mục 1 (S+M+M) → 2 (S–M) → 3 (M) → 4 (M) → 5 (M) → 6 (L, tuỳ chọn) ≈ **8–12 phiên** cho mục 1–5.
- Mọi thứ có **migration mới** (`010_…`) + test SQL + test hàm thuần theo quy tắc dự án; mọi thứ giao diện **thử trên dữ liệu giả**, nhưng **micro, cảm ứng, phông trên iPhone/Android thật chỉ thử được trên máy thật** — cần bạn thử giúp ở cuối mỗi bước.
- Không có mục nào phá dữ liệu hiện có; nội dung đã nhập giữ nguyên.

## 7. Quyết định cần bạn chọn (kèm đề xuất)

| # | Câu hỏi | Đề xuất |
|---|---|---|
| D1 | Nguồn ảnh minh hoạ riêng (mục 1.3-C): hoạ sĩ / AI / chỉ emoji+Twemoji? Ngân sách? | Twemoji cho phần lớn + **hoạ sĩ hoặc AI có người duyệt** cho ~150–200 ảnh đặc trưng Việt Nam/cảnh truyện |
| D2 | Ai sẽ thu âm, giọng nào (nữ/nam; người lớn/trẻ em; Bắc/Nam)? Có thu **giọng trẻ em** không? | Bắt đầu **giọng nữ người lớn** của bạn hoặc người quen (1 vùng), rồi giọng nam; **giọng trẻ em để sau** vì cần đồng ý phụ huynh |
| D3 | Kiểu đánh vần theo sách nào bé sẽ học (đầy đủ *bờ–a–ba–huyền–bà* hay rút gọn)? | Làm chuỗi **tuỳ chỉnh được**; mặc định kiểu truyền thống đầy đủ |
| D4 | Tô chữ: mẫu chữ **thảo** (Playwrite VN, như vở tập viết VN) hay chữ **in**? Bắt đầu chỉ giai đoạn 1? | Mẫu chữ thảo, chỉ **giai đoạn 1** trước; quyết định giai đoạn 2 sau khi thử với bé thật |
| D5 | Định dạng âm thu: WAV (đơn giản, phát mọi nơi, file to) hay MP3 (nhỏ, thêm thư viện)? | **WAV** trước |
| D6 | Thứ tự làm | Như bảng mục 0; nếu bạn ưu tiên khác (vd thu âm trước) đổi được, mục 3 phụ thuộc mục 2 |
