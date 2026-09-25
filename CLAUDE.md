# Tôi luyện tiếng Việt

PWA học tiếng Việt cho trẻ gốc Việt 3–8 tuổi (linh vật gà trống đỏ cam). Tài liệu yêu cầu đầy
đủ + các quyết định đã chốt: `YEU_CAU_APP_TIENG_VIET_CHO_TRE_EM.md` (nguồn sự thật — đọc mục
liên quan bằng Grep/offset, đừng đọc nguyên file). Dự án ĐỘC LẬP với iLapra (`D:\LangPrac`),
chỉ mượn mẫu thiết kế. **Chủ dự án tự chạy git** — đừng commit/push.

## Cấu trúc

- `public/` — phần được deploy (static assets). **Không đặt docs/migration/CSV vào đây.**
  - `index.html` = **trang giới thiệu** (landing page tĩnh, không phụ thuộc JS module của app) cho khách chưa vào app; nút "Vào học"
    trỏ `/app/`. `app/index.html` = **app thật** (preload cấu hình + modulepreload) — `manifest.json` có `start_url`/`scope` = `/app/`
    nên mở từ icon đã cài (PWA) vào thẳng app, bỏ qua trang giới thiệu; mọi đường dẫn trong `app/index.html` viết TUYỆT ĐỐI
    (`/css/...`, `/js/...`) vì trang nằm trong thư mục con còn CSS/JS/vendor vẫn ở gốc `public/`. `manifest.json`, `sw.js` (mạng-trước;
    cache-trước cho `/vendor/` và media Storage; đổi `VERSION` khi tải lại vendor HOẶC đổi cấu trúc route), `css/app.css`
  - `vendor/supabase/` — supabase-js **tải về sẵn** (chạy `node scripts/vendor-supabase.mjs [phiên bản]`, rồi tăng `VERSION` trong sw.js): cùng nguồn với app nên khởi động nhanh, không gọi CDN bên thứ ba (GDPR). Đừng import từ CDN.
  - `vendor/mascot/rooster.png` — hình linh vật gà trống THẬT (ảnh do chủ dự án cung cấp, không phải emoji) dùng làm
    logo/mascot ở mọi nơi thống nhất; xem quy tắc dùng ở mục "Quy tắc dễ sai" (dòng nói về `mascotHero()`).
  - `js/` ES modules thuần, không build step, không `package.json`:
    `main.js` (boot) · `flow.js` (`decideScreen()` = luồng vào app) · `state.js` · `config.js`
    · `supabase.js` · `strings.js` (MỌI chữ giao diện, chỉ tiếng Việt) · `pin.js` · `audio.js`
    (`pickAudio` = luật chọn giọng) · `pronunciation.js` (chấm phát âm Web Speech API) · `data.js`
    (avatar) · `ui.js` (`el()` dựng DOM) · `payments.js` (yêu cầu học phí/thêm con của phụ huynh) ·
    `pages/<màn hình>.js` (mỗi file export `mount(root)`) · `child/` (khu học của trẻ) ·
    `admin/` (khu quản trị: mỗi tab 1 file `content|bb|record|parents|billing|settings.js` — tab **"Trẻ em"**
    (`content.js`) và tab **"Bài Bản"** (`bb.js`) MỖI TAB TỰ NHÚNG mục "📄 Nhập CSV hàng loạt" của MÌNH ở đầu trang
    (`<details>` gấp gọn) thay vì 1 tab "Nhập CSV" dùng chung — xem "Quy tắc dễ sai" (dòng nói về `import.js`); cùng
    `csv.js`/`bb-csv.js` [hàm thuần], `audio.js` [TTS + tải giọng thật], `ops.js`/`bb-ops.js` [duyệt/xoá], `notice.js`,
    `text.js` [chữ giao diện admin])
- `worker.js` + `tts.js` + `wrangler.jsonc` — Cloudflare Worker: phục vụ `public/`, `/api/config` (cấu hình riêng từng
  bản triển khai đọc từ biến môi trường) và `/api/tts` (sinh giọng đọc, CHỈ admin). `main` KHÔNG được đặt `_worker.js`.
- `giao-trinh/` — **giáo trình** (khung 4 cấp 🥚🐣🐥🐓, đối chiếu chương trình trong nước + TT 28/2018) và `csv/` nhập được vào app.
  Không nằm trong `public/` nên không bị deploy. Sửa CSV xong chạy `node tests/curriculum.test.mjs`.
- `supabase/migrations/NNN_*.sql` chạy TAY; `supabase/seed/` dữ liệu mẫu; `supabase/tests/` test SQL; `tests/` test JS;
  `tests/browser/mock-sb.js` Supabase giả để thử giao diện; `scripts/dev-server.mjs` chạy local.

## Mô hình triển khai

1 trung tâm/admin = 1 Worker + 1 dự án Supabase riêng, chung mã nguồn. Cấu hình từng bản
(`CENTER_NAME`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `LANGUAGES`, `BRAND_COLOR`) đặt ở Cloudflare
Dashboard → Variables (KHÔNG ghi vào `wrangler.jsonc`; đã có `keep_vars`). Chạy thử local:
sao `.dev.vars.example` → `.dev.vars`, rồi `npx wrangler dev`. Không có `center_id` ở bảng nào.

**Đa ngôn ngữ theo khu vực (mở rộng 2026-09):** `LANGUAGES` nhận DANH SÁCH BẤT KỲ `mã:Tên` (vd bản Châu Âu
`en:English,de:Deutsch,fr:Français`; bản Châu Á `en:English,ko:한국어,ja:日本語`) — toàn bộ UI (form đăng ký chọn
"ngôn ngữ ở nhà" `pages/auth.js`, ô tên dịch chủ đề/bài, cột nghĩa khi nhập CSV, chọn giọng TTS theo ngôn ngữ ở Cài
đặt) đều đọc động từ `CONFIG.languages`, KHÔNG hardcode — không cần sửa code khi đổi bộ ngôn ngữ của 1 bản triển khai.
Bộ CSV giáo trình dùng CHUNG cho mọi khu vực: `giao-trinh/csv/*.csv` đã có sẵn cột nghĩa `de,en,fr,ko,ja` (đủ cả 5,
2026-09) — `validateRows` chỉ đọc đúng cột khớp `LANGUAGES` của bản đang nhập, cột thừa chỉ bị cảnh báo "không được
dùng" (không lỗi, không chặn nhập) — vd bản Châu Âu (`en,de,fr`) nhập cùng 1 file CSV này thì cột `ko`/`ja` tự bị bỏ
qua. Muốn thêm ngôn ngữ thứ 6+: (1) thêm cột nghĩa mới vào CSV giáo trình + cột `de/en/fr/ko/ja` tương ứng trong
`supabase/seed/002_title_translations.sql` (tên chủ đề/bài); (2) nếu dùng TTS, thêm giọng mặc định vào
`tts.js` `DEFAULT_VOICES` (đã có sẵn ~15 ngôn ngữ cho Azure gồm es/it/zh/pt/nl/pl/ru/th/cs, Google thì mới chỉ có
vi/de/en); (3) `admin/dict.js` (từ điển gợi ý Thêm nhanh) không tự có ngôn ngữ mới — admin gõ tay, đúng hành vi đã
thiết kế ("không tìm ra thì để trống, không bịa"). KHÔNG cần sửa code cho việc đổi/thêm ngôn ngữ — chỉ cần cấu hình
`LANGUAGES` + soạn nội dung dịch.

Dựng bản mới: tạo dự án Supabase → chạy `001_init.sql` … `023_bb_progress.sql` (theo thứ tự, tất cả trong `supabase/migrations/`) → đăng ký 1
tài khoản qua app → `update public.accounts set role='admin' where email='...'` → đặt biến ở Cloudflare (thêm `TTS_PROVIDER`,
`TTS_KEY` [Secret], `TTS_REGION` nếu dùng sinh giọng — xem `tts.js`/`.dev.vars.example`) → deploy. Dữ liệu mẫu (tuỳ chọn):
`supabase/seed/001_sample_content.sql`.

## Quy tắc dễ sai (đã chốt trong tài liệu yêu cầu)

- **Thứ tự điều kiện trong `decideScreen()` là luật của luồng vào app** — thêm màn hình mới phải
  chèn đúng chỗ, đừng append cuối (bài học từ iLapra: thứ tự tab lệch làm mở nhầm màn hình nặng).
- **`/` (root) là trang giới thiệu, app thật ở `/app/`** (xem mục Cấu trúc). Thêm file HTML/JS mới
  cho app thì đặt trong `js/`/`css/` ở gốc (dùng chung cho cả 2 trang) hoặc `app/` nếu chỉ app cần;
  ĐỪNG thêm đường dẫn tương đối kiểu `href="css/..."` vào `app/index.html` — phải tuyệt đối
  (`/css/...`). Hướng dẫn "Cài app về máy" (3 thiết bị + liên hệ) hiện dưới nút đăng nhập/đăng ký ở
  `pages/auth.js`, chữ lấy từ `T.install` trong `strings.js`. Cùng chỗ có dòng nhắc đồng ý
  `T.legal` liên kết tới 2 trang tĩnh gốc `public/`: `dieu-khoan.html`, `chinh-sach-bao-mat.html`
  (bản nháp do AI viết theo hành vi thật của app — **cần luật sư rà lại** trước khi công khai,
  nhất là đoạn nói về giọng nói trẻ đi qua Web Speech API/Google/Apple). Landing page (`index.html`)
  cũng link 2 trang này ở footer. **Linh vật gà trống = hình thật** (`public/vendor/mascot/rooster.png`, PNG nền
  trong suốt, ảnh do chủ dự án cung cấp — KHÔNG phải emoji 🐓/Twemoji: Twemoji 🐓 trông nhạt màu, giống gà mái, đã bị
  thay hoàn toàn ở mọi chỗ dùng làm logo/linh vật, 2026-09). `emoji.js` export `MASCOT_URL` + `mascotIcon(className)`
  (1 thẻ `<img>`) + `mascotHero()` (bọc `mascotIcon()` trong `.mascot-hero`, dùng ở MỌI nơi có "chú gà trống đứng một
  mình": bắt đầu bài, đăng nhập, kết quả bài/Luyện tập, "Con là ai nào?"...) — thêm màn hình mascot mới thì gọi
  `mascotHero()`, ĐỪNG tự dựng bằng `emojiNodes("🐓")`. Ảnh đã quay đầu sang phải sẵn trong file nên KHÔNG cần lật —
  class `.rooster` (`transform: scaleX(-1)`) chỉ còn dùng khi thật sự cần lật một emoji khác, đừng bọc quanh
  `mascotIcon()`. Icon nhỏ lặp lại dùng thẳng `mascotIcon("<tên class cỡ riêng>")`: mặt sau thẻ Trí nhớ
  (`activities/games.js`, `.mem-mascot`), biểu tượng Cấp 4 "Gà trống" ở lưới cấp độ trong app (`pages/child-home.js`,
  `.lv-mascot`/`.lv-mascot-inline` — chỉ cấp 4 dùng ảnh thật, cấp 1–3 vẫn Twemoji 🥚🐣🐥 để giữ cùng 1 bộ icon), và
  logo/hero/nút CTA/thẻ cấp độ ở landing page (`index.html`, dùng thẳng `<img src="/vendor/mascot/rooster.png">` vì
  trang này không load `emoji.js`). Favicon + icon PWA (`public/icons/icon.svg`, tham chiếu ở `manifest.json` và mọi
  trang HTML) = nền vuông bo góc màu thương hiệu + tấm nền trắng bo góc + `rooster.png` nhúng base64 (`<image>`,
  để icon vẫn là 1 file SVG độc lập, không cần tải thêm) — đổi ảnh gà trống thì phải build lại icon.svg này (nhúng
  base64 bằng tay hoặc script nhỏ), không chỉ đổi rooster.png. Thêm/đổi ảnh mascot → tăng `VERSION` ở sw.js
  (rooster.png nằm dưới `/vendor/` nên được cache-trước).
- Trẻ KHÔNG đăng nhập; app chạy bằng phiên phụ huynh. Màn hình chọn avatar hiện TẤT CẢ avatar
  (không chỉ của các con) — avatar đóng vai mật khẩu bằng hình. Vào khu phụ huynh: nút nhỏ + PIN 4
  số (`askPin()`); PIN chỉ dùng cho việc này, khoá tạm 5 phút sau 5 lần sai (lưu ở thiết bị).
- Số con ≤ `accounts.child_slots` (mặc định 1) được ép bằng TRIGGER (RLS không tự đếm số lượng);
  trần `settings.max_children` (mặc định 6); chỉ admin (qua xác nhận `payments`) tăng được.
  Phụ huynh không sửa được `role/access_*/child_slots` (trigger `accounts_guard`).
- `accounts.phone`/`accounts.address` (migration 018, tuỳ chọn, không bị `accounts_guard` chặn): hỏi ở `pages/setup-pin.js`
  ngay dưới phần đặt PIN lúc đăng ký, sửa lại được sau ở khu phụ huynh → thẻ "Liên hệ" (`pages/parent.js` `contactCard`).
- Hết hạn = khoá hết: `isExpired()` → chỉ còn màn hình gia hạn (`expired`) + đăng xuất + (sau này)
  xuất/xoá dữ liệu. RLS: nội dung học và ghi tiến độ cần `has_access()`; đọc dữ liệu của con thì không.
- Giao dịch `payments`: phụ huynh chỉ tạo được dòng `pending`, giá lấy từ `tuition_plans` (trigger);
  admin xác nhận → trigger tự cộng hạn (`greatest(now, hạn cũ) + duration_days`) hoặc tăng
  `child_slots`. Phí con thêm: trả 1 lần khi thêm (gợi ý 20% học phí, admin sửa được); gia hạn về
  sau không tự cộng phí con.
- Âm thanh: đích là TTS sinh sẵn thành file (giọng đọc của trình duyệt chỉ là `speakFallback` TẠM khi
  mục chưa có file — xem "Trạng thái"); `content_audio` đã có
  `source/voice_kind/region/speed` để thêm giọng người thật mà không sửa code — luôn chọn giọng qua
  `pickAudio()`. iOS chỉ cho phát sau cú chạm.
- **Chấm phát âm / đánh giá đọc** (`pronunciation.js`, hàm thuần, test trong `tests/unit.test.mjs`): Web Speech API cho CHỮ nhận dạng được (tối đa 5 phương án; lấy phương án gần mẫu nhất) rồi so THEO TỪNG TIẾNG: `ok` / `tone` (sai dấu thanh, 0,5 điểm) / `initial` (nhầm âm đầu ch↔tr…, 0,4) / `close` (0,3) / `wrong` / `missing`; tiếng thừa chỉ tăng mẫu số; bỏ từ loại đầu (con/cái/quả…). KHÔNG đo âm học thật (cao độ, độ dài, ngắt nghỉ) và mô hình ngôn ngữ có thể "tự sửa" về từ quen → kết quả chỉ là GỢI Ý; `initial` có thể là giọng vùng miền. Bé thấy sao + từng tiếng (✓ hoặc 🔊 chạm nghe lại — không tô "sai") + 1 lời nhắc; KHÔNG hiện điểm. Mỗi lượt lưu `pronunciation_attempts.detail` = `{v:1, syl:[[chữ, trạng thái]…], level, extras}` (cột jsonb có từ 001; không lưu file ghi âm). Giao diện chung ở `child/pron-ui.js` (`attemptRead`, `readAloudBox`): dùng ở trò `listen_repeat` VÀ ở thẻ học từ mới (nút 🎤 "Con đọc thử" cho từng từ; chưa bật chấm điểm/trình duyệt chưa hỗ trợ thì bấm vào hiện lời giải thích, không im lặng; lượt đọc ở thẻ học chỉ lưu `pronunciation_attempts`, không đổi `mastery`). Phụ huynh xem "Đánh giá đọc to" (`summarizePron`: mức Xuất sắc/Tốt/Khá/Cần luyện thêm, phân bố lỗi, từ hay đọc chưa đúng, lời khuyên, xu hướng) ở khu phụ huynh. Giọng trẻ đi qua Google/Apple → vấn đề GDPR cần tư vấn trước khi công khai. Cần thử trên ghi âm trẻ thật + iOS/Android thật + PWA đã cài (Safari standalone có thể không hỗ trợ nhận dạng). Muốn chấm thanh điệu thật phải dùng dịch vụ chuyên dụng phía máy chủ (gửi âm thanh đi → phải sửa luật "không lưu/không gửi ghi âm" + đồng ý của phụ huynh; kiểm tra nhà cung cấp có hỗ trợ tiếng Việt).
- PostgREST cắt âm thầm ở 1000 dòng — `select()` không lọc hẹp phải phân trang `.range()`.
  Cột id identity dùng `generated BY DEFAULT`. RLS thiếu quyền chỉ trả 0 dòng, không báo lỗi.
- **Khu admin:** trẻ chỉ thấy mục `approved` ở CẢ chủ đề, bài và mục từ → duyệt bài phải duyệt luôn chủ đề chứa nó (`ops.setLessonStatus`).
  Nhập CSV luôn tạo NHÁP, chạy lại không tạo trùng (khớp theo tên chủ đề+bài+từ, không phân biệt hoa/thường), ô trống không xoá
  dữ liệu cũ, đổi chữ/nghĩa thì xoá âm thanh cũ của ngôn ngữ đó (`dropAudio`). Xoá nội dung phải dọn file Storage (`ops.js`).
  Nút "Nhập vào (tạo bản nháp)" mờ khi CSV không có gì để ghi — tính cả trường hợp CHỈ đổi cấp/tên dịch (không đổi từ/câu nào,
  vd đảo thứ tự cấp): `plan.counts.new + update + levelChanges.length + titleChanges.length` (lỗi cũ: chỉ tính `new+update`, phát
  hiện lúc đảo cấp giáo trình 2026-09). `content.js` có 2 hàm `act(fn, okText)` bọc thao tác xoá/duyệt: `fn` PHẢI `return false`
  khi bấm Huỷ ở `confirm()` — không thì `act` vẫn báo "Đã..." dù chưa làm gì (đã sửa 3 chỗ: duyệt/xoá chủ đề, xoá bài).
  `/api/tts` kiểm admin bằng chính token của người gọi qua RPC `is_admin` (không dùng service_role); giọng ưu tiên: admin chọn (`settings.tts_voices` = `{lang:{female,male}}`, gửi kèm yêu cầu, **kiểm tên giọng bằng regex** vì được đưa vào SSML) > `TTS_VOICES` > mặc định theo giới (`DEFAULT_VOICES` trong `tts.js`, ~15 ngôn ngữ gồm ko/ja); `/api/config.ttsVoices` cho app biết ngôn ngữ nào có TTS; trình duyệt tải file lên
  Storage bằng phiên admin. Giọng TTS mặc định trong `tts.js` đã đối chiếu tài liệu nhà cung cấp nhưng CHƯA nghe thử chất lượng/gọi API thật (Google tiếng Việt chỉ có Standard/Wavenet, không có Neural2) — báo lỗi "voice" thì ghi đè `TTS_VOICES`.
  **Giới của giọng:** `TTS_VOICES`/`tts_voices` nên là `{female,male}`; nếu là CHUỖI thì giới được đoán từ TÊN giọng (`public/js/voice-names.js` `guessGender`, dùng chung Worker + admin) — lỗi cũ: coi mọi chuỗi là giọng nữ nên chuỗi `vi-VN-NamMinhNeural` làm mọi file "nữ" đọc bằng giọng nam. `admin/audio.generate` từ chối lưu khi giọng thật trái giới ô; migration 006 vá nhãn cũ + RPC `admin_audio_summary` (Cài đặt → "Kiểm tra giọng đã sinh").
- **Thêm nhanh / sửa nội dung ở tab Trẻ em** (`admin/quickadd.js` biểu mẫu, `admin/autofill.js` luật điền sẵn [hàm thuần, test `tests/autofill.test.mjs`], `admin/dict.js` từ điển khởi đầu ~200 từ, `ops.js` `createUnit/createLesson/createItems/updateUnit/updateLesson/moveIn`): admin chỉ gõ chữ Việt — chủ đề (nút ➕ ở tiêu đề mỗi cấp), bài (➕ trong chủ đề đang mở), từ/câu (➕ trong bài đang mở; nhiều dòng, có bảng xem trước sửa được rồi mới lưu). Điền sẵn KHÔNG dùng AI/dịch máy (quyết định chủ dự án): nguồn = mục đã có trong CSDL cùng chữ (emoji + nghĩa + loại) > `dict.js` > luật (loại: chữ cái/từ/cụm từ/câu theo hình thức; cách đọc chữ cái `sayOf`; nghĩa mẫu "Buchstabe b"/"letter b"; tuổi theo cấp `ageRange`; bộ hoạt động bài mới theo cấp `defaultKinds`) > gợi ý emoji từ từ đã biết nằm trong câu (ghi rõ "gợi ý từ …"). Không tìm ra thì để TRỐNG, không bịa — nghĩa của từ lạ admin điền tay. Chủ đề/bài mới luôn NHÁP; mục mới lấy trạng thái của bài (bài đã duyệt → mục hiện ngay). Có sinh TTS sau khi lưu (tuỳ chọn). Thêm từ vào `dict.js` để "Thêm nhanh" biết thêm; emoji trong đó phải khớp giáo trình (test kiểm). Sửa: ✎ Sửa của chủ đề (tên + emoji + TÊN DỊCH từng ngôn ngữ) và của bài (tên + tên dịch) — cùng bố cục với lúc thêm mới, ô dịch trống = xoá (`ops.updateUnit/updateLesson` nhận `title_tr`, ngôn ngữ không có trong form giữ nguyên); đã BỎ nút 🌐 Tên dịch riêng và "Tải nhiều ảnh" (ảnh riêng chỉ tải từng mục bằng nút 📷). Hàng mục sửa trực tiếp: nút 💾 Lưu luôn hiện ở cuối dòng (mờ khi chưa đổi, sáng khi có thay đổi, Enter cũng lưu; cột nút dính mép phải), ô Loại + Cách đọc, **tuổi là 1 ô "3-8"** (`autofill.parseAge/formatAge`: "5", "3-8", "3-", "-8", trống = mọi tuổi; 0–12); ▲▼ đổi thứ tự bài/mục (thứ tự mục quan trọng với `order_story`); xoá đã có từ trước. Câu hỏi đọc hiểu (`question`) chỉ nhập bằng CSV.
- **Không dùng AI/dịch máy ở khu admin (đã thử rồi GỠ, 2026-09):** đã làm dịch bằng Gemini qua Worker (`/api/suggest`) nhưng gặp 503 "high demand" liên tục, rồi lỗi "User location is not supported" (Worker chạy ở colo bị Google chặn theo vùng), nên chủ dự án quyết định bỏ. Mã đã xoá khỏi nhánh chính; muốn xem lại thì xem lịch sử git (tìm `suggest.js`, `admin/ai.js`). Nghĩa của từ lạ do admin điền tay; từ điển `admin/dict.js` + mục đã có trong CSDL giúp điền sẵn.
- Giao dịch `payments` (kể cả admin tạo) LUÔN vào ở `pending`; gia hạn/tăng số con chỉ chạy khi cập nhật `pending→confirmed`
  (trigger). Admin ghi nhận thay phụ huynh = chèn rồi xác nhận (`billing.recordPayment`). Thông báo "Đã …" sau thao tác admin
  dùng `notice.set()` (giữ qua lần tải lại danh sách).
- **Giọng nữ/nam:** `content_audio.gender`; tiếng Việt sinh cả ♀ và ♂ (thường + chậm = 4 file/từ), ngôn ngữ gốc mặc định chỉ ♀ (♂ khi admin nhập giọng nam ở Cài đặt);
  ngôn ngữ KHÔNG có TTS → không có ô âm thanh → khu trẻ dùng giọng trình duyệt (`speakFallback`). Bé chọn giọng: `child_profiles.voice_gender` (nút 👩/👨 trong lúc học) >
  mặc định phụ huynh `accounts.voice_pref.gender` > nữ. `pickAudio` ưu tiên giới đã chọn > người thật > loại giọng > vùng miền; thiếu giới đó thì dùng giới còn lại.
  Giọng TRẺ EM: Azure có (vd en-US-AnaNeural) nhưng KHÔNG có cho tiếng Việt → chỉ có bằng thu giọng người thật (`voice_kind='child'`; chưa có UI cho bé chọn).
- **Cấp học:** `units.level` 1–4 (🥚 Trứng, 🐣 Gà con, 🐥 Gà choai, 🐓 Gà trống; `levels.js` = khung + `levelProgress`/`recommendedLevel`, hàm thuần có test). Bé thấy 4 chặng → chủ đề → bài; **không khoá cấp**, chỉ gợi ý "Con đang ở đây" (cấp có nội dung đầu tiên chưa đạt). "Đạt cấp" = ≥80% số từ có mastery ≥3. CSV có cột `level` (tuỳ chọn; trống = giữ cấp cũ / mặc định 1). Tab Nội dung nhóm theo cấp, đổi cấp bằng ô chọn.
  **Thứ tự nội dung theo cấp (đổi 2026-09, quyết định chủ dự án):** tên/emoji từng cấp (Trứng/Gà con/Gà choai/Gà trống)
  **giữ nguyên gắn với số** như cũ — đổi là NỘI DUNG nào nằm ở cấp nào: **Cấp 1 = học vần** (trước là Cấp 3, `cap3-ga-choai-hoc-van.csv`
  — chủ dự án coi đây là nền tảng khởi đầu, tương ứng với việc nhóm "Chữ – Viết" cũng đứng đầu bên Luyện tập), **Cấp 2 = từ vựng
  cơ bản** (trước là Cấp 1, `cap1-trung-tu-vung.csv`), **Cấp 3 = câu ngắn** (trước là Cấp 2, `cap2-ga-con-cau-ngan.csv`), **Cấp 4 =
  đọc hiểu** (không đổi, `cap4-ga-trong-doc-hieu.csv`). Đã đổi giá trị cột `level` NGAY TRONG 3 file CSV trên (không đổi tên file —
  tên file vẫn mang số cũ, chỉ là tên gọi lịch sử, đọc `level` bên trong file mới đúng); mọi nơi khác đọc cấp qua `unit.level`/
  `levelOf()` nên tự đúng, không cần sửa. Đã sửa 2 chỗ hardcode theo NỘI DUNG (không phải theo số cấp trước đó — nay đổi số cho khớp):
  `admin/autofill.js` `defaultKinds()` (bộ hoạt động học vần chuyển từ nhánh cấp 3 sang cấp 1), `child/pools.js` `sortable()` (trò
  "Phân loại" chỉ dùng mục có chủ đề — chuyển từ "Cấp 1–2" sang "Cấp 2–3"). `levels.js`: **tên/emoji/`age`/`ageRange()` CỐ Ý
  không đổi** (gắn với số cấp như cũ; độ tuổi hiển thị theo cấp vì vậy không còn tăng dần — chủ dự án xác nhận không quan trọng,
  giáo viên tự định hướng tuổi cho bé) nhưng **`focus` (dòng mô tả ngắn dưới tên cấp) ĐÃ đổi theo nội dung mới** (cấp 1 giờ ghi
  "Học vần…", cấp 2 "Nghe – nhận biết – nói từ…", cấp 3 "Nói câu ngắn…" — khớp nội dung thật, tránh gây hiểu lầm như ảnh chụp màn
  hình chủ dự án gửi lúc phát hiện mô tả cũ). Đổi cấp mới thì nhớ rà cả 3 chỗ hardcode trên (`defaultKinds`, `sortable`, `focus`)
  và bất kỳ chỗ nào so `.level` với số cụ thể thay vì dùng `LEVELS`/`levelOf()` chung.
- **Học vần (Cấp 3):** `item_type` thêm `letter`/`syllable`; `content_items.say_vi` = chữ ĐỌC thành tiếng khi khác chữ hiển thị (chữ "b" → "bờ"; dùng qua `spoken(item)` trong `viet.js` ở TTS admin, giọng trình duyệt, chấm phát âm). `viet.js` = hàm thuần ngữ âm (`toneOf`, `splitSyllable`, `TONES`). 5 hoạt động mới trong `child/activities/phonics.js` (`listen_pick_tone`, `build_syllable`, `fill_letter`, `read_pick`, `order_words`; tự bỏ qua nếu bài không đủ mục phù hợp; các dạng cần nhận mặt chữ bị ẩn với bé <5 tuổi). CSV có cột `say` và `activities` (bộ hoạt động cho bài MỚI; trống = 4 hoạt động chuẩn; bài đã có không đổi). Thêm loại hoạt động mới → sửa `RUNNERS` (lesson.js), `ACTIVITY_DEFAULTS` (csv.js), CHECK ở migration, test. Giáo trình Cấp 3 = `giao-trinh/csv/cap3-ga-choai-hoc-van.csv` (sinh bằng script, có luật kiểm riêng trong `tests/curriculum.test.mjs`: đủ 29 chữ cái, emoji thanh đúng, hoạt động chơi được).
- **Đọc hiểu (Cấp 4):** `item_type` thêm `question` (câu hỏi đọc hiểu; `content_items.extra` = `{choices:[…], answer:n}`, CSV: cột `choices` cách nhau `|`, `answer` đếm từ 1; CHECK ở DB + kiểm ở `csv.js`). `lesson.js` TÁCH mục question khỏi `items` (chỉ `read_quiz` dùng, qua `ctx.questions`); `child_stats` không đếm câu hỏi. 5 hoạt động mới trong `child/activities/reading.js` (`read_quiz`, `fill_word`, `write_check`, `spell_word`, `order_story`; `arrange()` dùng chung cho xếp chữ/xếp câu; `order_story` dùng THỨ TỰ mục của bài làm đáp án → đừng xáo `sort_order`). Giáo trình Cấp 4 = `giao-trinh/csv/cap4-ga-trong-doc-hieu.csv` (sinh bằng script, luật kiểm riêng trong `tests/curriculum.test.mjs`: hoạt động chơi được, câu hỏi hợp lệ, emoji không trùng).
- **Hình (đã nâng cấp):** ① **Twemoji** (`emoji.js`, `public/vendor/twemoji/`, CC-BY 4.0 — PHẢI giữ dòng ghi công ở khu phụ huynh): `visual()` vẽ emoji bằng `<img>` SVG (~1 KB/hình, tải khi cần + SW cache-trước; `prefetchEmoji` khi mở bài); emoji chưa có file (`twemoji-index.js` — SINH bởi `node scripts/vendor-twemoji.mjs`, chạy lại khi thêm emoji mới rồi tăng `VERSION` ở sw.js) rơi về phông máy; test giáo trình báo THIẾU nếu CSV có emoji chưa có file. ② **Vai trò hình** `content_items.pic` (null/`literal` = hình đúng nghĩa; `decor` = trang trí): các hoạt động chọn/ghép theo hình (`listen_pick` chế độ hình, `match`, `read_pick`, `spell_word`, hình gợi ý ở `trace`) chỉ dùng mục `isLiteral`; CSV có cột `pic`. ③ **Ảnh riêng** (`image_path` ưu tiên hơn emoji): tab Trẻ em có nút 📷 Ảnh (từng mục và chủ đề), "Xem dạng thẻ (duyệt hình)" (đã bỏ "Tải nhiều ảnh"; `image-util.matchFiles` còn trong mã nhưng không còn nút gọi); nén ngay trong trình duyệt (`admin/images.js`: ≤512 px, WebP ≤300 KB, KHÔNG nhận SVG); xoá mục/bài/chủ đề dọn cả file ảnh (`ops.js`). Danh sách hình cần vẽ: `node scripts/hinh-can-ve.mjs` → `giao-trinh/hinh/` (kèm hướng dẫn cho hoạ sĩ).
- **Hình của mục (cũ):** `image_path` (ảnh) ưu tiên hơn `emoji`; emoji có thể là "cảnh" 2–3 emoji (`visual()` tự thu nhỏ). Câu hỏi đọc hiểu KHÔNG có hình (giao diện không hiển thị). Hoạt động dựa vào hình (`read_pick`, `match`…) chỉ hợp khi hình thật sự đúng nghĩa — đừng dùng cho câu trừu tượng/tục ngữ. Kế hoạch nâng cấp (vai trò hình, Twemoji, ảnh riêng, chữ hoa, tô chữ, đánh vần từng phần, thu âm trong app): `KE_HOACH_NANG_CAP_HINH_ANH_CHU_HOA_TO_CHU_THU_AM.md` (chờ chốt quyết định D1–D6).
- **Thu giọng người thật (tab "Thu âm", `admin/record.js`):** thu bằng Web Audio (`mic.js`, mẫu thô — KHÔNG MediaRecorder vì định dạng khác nhau giữa trình duyệt) → `wav.js` (hàm thuần: cắt lặng, chuẩn hoá −1 dBFS, 24 kHz, WAV mono 16-bit; có test) → `audio.uploadHuman` (Storage + `content_audio`, `source=human`, `gender`, `voice_kind`, `region`). Mặc định giọng NAM người lớn; giọng nữ/trẻ em chọn ở ô "Giọng"/"Loại giọng" (giọng trẻ em cần đồng ý bằng văn bản của phụ huynh trẻ — GDPR). Có tải hàng loạt (tên file = chữ của mục). **Ngân hàng âm** (`sounds.js` + `admin/bank.js`): chủ đề ẨN `units.hidden=true` (bé không thấy; `loadUnits` lọc, `child_stats` bỏ; RLS vẫn cho đọc để phát âm) chứa âm phụ âm (bờ, cờ…), nguyên âm, tên 6 thanh, ~85 vần — dùng cho đánh vần theo phần. Micro chỉ thử được trên máy thật.
- **Đánh vần theo phần (`spell_along`, `child/activities/spell.js`):** `viet.spellParts("bà")` → bờ – a – ba – huyền – bà (bỏ phần trùng/không cần). Mỗi phần tra trong NGÂN HÀNG ÂM (`api.loadSoundBank()`, Map chữ → mục kèm âm thanh, nhớ 5 phút) → `media.playPart()`: giọng người thật/TTS nếu đã có file, không thì giọng trình duyệt (`sayOfPart`: ă → á). Bước ① nghe–nhìn (các phần sáng lần lượt, chạm phần nào nghe phần đó), bước ② tự đánh vần (`arrange()`). Bài chưa có hoạt động này thì thêm bằng SQL (bài đã nhập không tự đổi hoạt động). Muốn giọng TTS tốt hơn giọng trình duyệt cho các âm nhỏ: tab Trẻ em → "Ngân hàng âm" → Sinh âm thanh còn thiếu.
- **Chữ hoa (`child/activities/casing.js`):** mục chữ hoa có dạng `"A a"` (`type=letter`; `viet.caseParts` tách, chữ thường phải = chữ hoa viết thường; chữ ghép `"Ngh ngh"`). 3 hoạt động tự sinh từ dữ liệu, không cần cột mới: `match_case` (ghép hoa–thường), `pick_case` (nhiễu = chữ hình gần giống, `viet.lookalikes`), `fix_capital` (chạm từ phải viết hoa: `viet.capitalIndexes` = từ đầu câu + từ viết hoa giữa câu, nên câu dữ liệu PHẢI viết hoa đúng). Bài chữ hoa dùng hình tên riêng chỉ để trang trí → không dùng hoạt động chọn theo hình (test giáo trình cho phép trùng emoji ở bài không có hoạt động chọn theo hình). Nút ▲▼ ở tab Trẻ em đổi thứ tự chủ đề trong cùng cấp (`ops.moveUnit`, hoán đổi `sort_order`).
- **Tô chữ (`trace`, `child/activities/trace.js` + `trace-score.js`):** phông **Playwrite VN** (mẫu chữ thảo tiểu học VN, SIL OFL; `public/vendor/fonts/`, tự lưu — không gọi Google) vẽ chữ mẫu mờ trên Canvas; bé tô bằng Pointer Events (`touch-action:none`, bỏ qua lòng bàn tay khi có bút). Chấm trên lưới ½ kích thước bằng `scoreTrace` (hàm thuần, có test): độ phủ + nét thừa + **từng MẢNH liền nhau của chữ mẫu mảnh** (thân, mỗi dấu thanh/dấu mũ…) — bỏ dấu thanh là chưa đạt dù độ phủ chung cao. Không hiện "sai", được sửa lại 1 lần (khoanh cam mảnh chưa tô). `viet.traceTexts`: cặp "A a" → tô cả hoa và thường; từ/chữ ≤ 8 ký tự → tô; câu → không. **Giai đoạn 1: KHÔNG kiểm thứ tự/hướng nét.** Không nạp được phông → hoạt động tự bỏ qua. Phông đã kiểm đủ glyph cho mọi chuỗi cần tô trong CSV (81 ký tự). Đổi phông/vendor → tăng `VERSION` ở sw.js. Chữ thảo ≠ chữ in (A, D, Q, G, I…) — báo phụ huynh.
- **Số thứ tự chủ đề** (`levels.numberUnits`): số THỨ TỰ TRONG CẤP (1, 2, 3… — không phải "cấp.số"), tính lúc hiển thị từ `sort_order` (không lưu; ▲▼ đổi thì số đổi), hiện ở tab Trẻ em và ở khu bé (thẻ chủ đề + tiêu đề danh sách bài). Chủ đề ẩn không có số. Khu bé chỉ thấy chủ đề đã duyệt nên số ở đó liền nhau — khi mọi chủ đề đã duyệt thì khớp với quản trị.
- **Tên dịch chủ đề/bài** (`units.title_tr`/`lessons.title_tr` = `{de:"…"}`, migration 015): khu bé có 2 nút 🔊 VI + ngôn ngữ gốc cạnh tên chủ đề và từng bài (`media.titleSpeakers`, giọng trình duyệt — chưa có file TTS cho tên); nút gốc chỉ hiện khi có tên dịch. Nhập bằng nút "🌐 Tên dịch" ở tab Trẻ em hoặc cột CSV `unit_<lang>`/`lesson_<lang>` (ô trống không xoá tên cũ). Dịch sẵn (de+en) cho giáo trình hiện có: `supabase/seed/002_title_translations.sql` (chạy TAY sau 015; chỉ bổ sung, giữ tên sửa tay; thêm chủ đề/bài mới vào CSV thì phải thêm dòng ở đây — test seed báo thiếu).
- **Diễn giải chủ đề/bài** (`units.description`/`lessons.description`, text thuần tiếng Việt — KHÔNG phải jsonb đa
  ngôn ngữ như `title_tr`; `lessons.description` migration 020, `units.description` migration 021, 2 cột ĐỘC LẬP):
  bài hiện ngay dưới tên bài ở màn "Bắt đầu" (`child/lesson.js`, class `.lesson-desc`); chủ đề hiện ngay dưới tên chủ
  đề ở màn danh sách bài (`pages/child-home.js` `showLessons`, class `.unit-desc`) — chưa có thì không hiện dòng đó,
  không lỗi. **Sửa ở khu admin**: nút ✎ Sửa của CẢ chủ đề lẫn bài (tab Trẻ em) đều mở `renameForm`
  (`admin/quickadd.js`, `withDescription: true`) hiện thêm ô "Nội dung diễn giải" cùng tên + tên dịch
  (`ops.updateUnit`/`ops.updateLesson`, dùng chung hàm `descriptionPatch()`, ≤500 ký tự, để trống = xoá). Chưa có cột
  `description` ở CSV/Thêm nhanh (chủ đề/bài mới tạo chưa có diễn giải, phải vào ✎ Sửa điền sau). Nội dung cho giáo
  trình hiện có: `supabase/seed/003_lesson_descriptions.sql` (180 bài, chạy TAY sau 020) và
  `supabase/seed/004_unit_descriptions.sql` (44 chủ đề, chạy TAY sau 021) — cả 2 chỉ bổ sung (giá trị đã có, kể cả sửa
  tay ở admin, thì giữ nguyên, không ghi đè); thêm chủ đề/bài mới vào CSV thì phải thêm dòng tương ứng — test seed báo
  thiếu, xem `supabase/tests/seed.test.mjs`.
- **Luyện tập theo kỹ năng** (kế hoạch + quyết định: `KE_HOACH_LUYEN_TAP_THEO_KY_NANG.md`; GĐ 0–1 đã làm): màn hình chính của bé có 2 nút lớn 📖 Học | 🎮 Luyện tập, **hai phần độc lập** — Luyện tập chơi trên MỌI nội dung đã duyệt, không cần đã học bài. **Nhóm/kỹ năng** (`child/skills.js` `GROUPS`/`SKILLS`) — thứ tự nhóm hiện trên lưới là **Chữ – Viết → Nghe – Nói → Vui – Nhớ**, rồi tới 3 nhóm `comingSoon: true` **CHƯA có trò** (chỉ hiện tiêu đề + thẻ "Sắp ra mắt"): Toán học, Truyện – Thơ, Tin tức (chờ chốt chi tiết mới thêm `SKILLS`/`RUNNERS`). 12 kỹ năng "thường" (Nghe, Nói, Thanh điệu, Hiểu nghĩa, Trí nhớ, Phân loại, Tô chữ, Đánh vần, Ghép chữ, Đọc, Viết hoa, Chính tả) lấy mục theo `POOLS`/`feasible` như cũ; **3 kỹ năng `story: true`** (1 "lượt" = CẢ 1 bài, không lấy mục rời) — **Đọc nhớ**/**Nghe nhớ** (nhóm Vui – Nhớ, `read_quiz`/`listen_quiz`, tận dụng nguyên bài Cấp 4 đã có sẵn đoạn văn + câu hỏi trắc nghiệm, KHÔNG cần soạn nội dung riêng: `api.loadStoryLessons()` tìm bài có mục `question`, đoạn văn = MỌI mục còn lại của bài đó bất kể `item_type`) và **Giao tiếp** (nhóm Nghe – Nói, `dialogue`, admin bật hoạt động `dialogue` cho 1 bài — migration 019 — rồi soạn các dòng XEN KẼ hệ thống hỏi/bé đọc theo VỊ TRÍ, dòng lẻ = hệ thống nói chỉ phát âm thanh, dòng chẵn = bé đọc câu trả lời có sẵn, chấm phát âm như `listen_repeat`; `api.loadDialogueLessons()`). Cả 3 kỹ năng story: chưa có bài phù hợp thì thẻ tự mờ, không lỗi. Luồng (`child/practice.js`): lưới kỹ năng → (bé ≥ 5 tuổi) phạm vi Tất cả/Từ hay sai/Cấp/Chủ đề → phiên (kỹ năng thường ~7 lượt 1–3 trò; kỹ năng story = đúng 1 bài) → kết quả (sao + từ nên luyện lại, không hiện điểm). Bé < 5 tuổi: tự vào phạm vi "Tất cả", chỉ thấy kỹ năng không cần đọc chữ (`kindAllowed`).
  **Kiến trúc:** `api.loadCatalog()` tải MỘT lần mọi mục đã duyệt (nhẹ, phân trang 1000) + `loadAllProgress()` (+ `loadStoryLessons()`/`loadDialogueLessons()` cho 3 kỹ năng story, tải song song, lỗi thì `[]` — không chặn phần còn lại); toàn bộ chọn phiên ở trình duyệt bằng hàm thuần (`practice-core.js`, test `tests/practice.test.mjs`, gồm kiểm trên CSV giáo trình thật: cả 3 kỹ năng story — readMemory/listenMemory dùng dữ liệu Cấp 4, converse dùng
  `giao-trinh/csv/hoi-thoai-giao-tiep.csv` — đều dùng dữ liệu THẬT, không còn phải giả). **Vị từ lọc mục của từng trò thường nằm ở `child/pools.js`** (`POOLS`/`feasible`) — CÁC TRÒ VÀ LUYỆN TẬP DÙNG CHUNG, sửa luật lọc ở đó, đừng lọc trong thân hàm trò; 3 trò story KHÔNG có trong `POOLS` (cố tình) — dùng `storySkillPlayable`/`planStoryPractice`/`scopeStoryLessons` riêng (practice-core.js), `practice.js` `storyData(skill, data)` chọn đúng nguồn (`storyLessons` hay `dialogueLessons`) theo `skill.id`. Mỗi phiên (trò thường) chỉ dùng mục cùng "họ" (chữ–vần | từ | câu; `familyOf`) vì trò lấy đáp án nhiễu từ chính tập mục; mỗi trò nhận tập mục riêng (chọn theo trọng số: chưa thuộc, hay sai, lâu chưa gặp). `child/runners.js` = bảng `RUNNERS` chung bài học + luyện tập; `child/session.js` `makeCtx` dựng ctx chung (`items` + `questions` tuỳ trò). 6 trò chỉ có ở Luyện tập (KHÔNG nằm trong bảng `activities`/CHECK, trừ `dialogue` — xem dưới): `activities/games.js` — `meaning_pick` (nghe từ Việt ↔ nghĩa bản ngữ), `memory_flip`, `sort_unit` (mỗi chủ đề Cấp 1–2 = 1 giỏ), `pick_spelling` (`viet.spellingChoices`: ch/tr, s/x, d/gi/r, l/n, c/k, g/gh, ng/ngh), `tone_pair`; `activities/reading.js` — `listen_quiz` (`runListenQuiz`, giống `read_quiz` nhưng ẩn chữ đoạn văn, chỉ "Câu 1/2/3…" + 🔊). `dialogue` (`activities/dialogue.js` `runDialogue`) NGƯỢC LẠI **CÓ** trong bảng `activities`/CHECK (migration 019) vì cần admin bật cho 1 bài cụ thể (checkbox "Bài giao tiếp (hỏi–đáp)" lúc Thêm bài, hoặc cột `activities` khi nhập CSV) — và vì nằm trong bảng `RUNNERS` DÙNG CHUNG, bài có hoạt động `dialogue` chạy được CẢ ở "Học" bình thường (sau phần học từ mới — hơi thừa vì lặp lại các dòng vừa xem, chấp nhận được) LẪN ở Luyện tập (kỹ năng "Giao tiếp") — đã thử cả 2 đường. **Nội dung mẫu (mở rộng đủ 4 cấp, 2026-09):** `giao-trinh/csv/hoi-thoai-giao-tiep.csv` — 1 chủ đề "Chủ đề hội thoại cấp N" 💬 CHO MỖI CẤP (level=N khớp tên, kiểm ở `tests/curriculum.test.mjs`), mỗi chủ đề gồm nhiều bài hội thoại — **1 bài / 1 chủ đề nội dung đã có** (không phải 1 bài / 1 bài học, để tránh trùng lặp và tránh gượng ép với các chủ đề thuần luyện âm/ngữ pháp không có nội dung hội thoại tự nhiên — xem giải trình chọn chủ đề trong lịch sử trò chuyện nếu cần đối chiếu): Cấp 1 (học vần) 8 bài dựa trên chủ đề con "Đọc từ và câu ngắn", Cấp 2 (từ vựng) 17 bài (1/chủ đề), Cấp 3 (câu ngắn) 10 bài (1/chủ đề, gồm 2 bài gốc "Làm quen"/"Lễ phép"), Cấp 4 (đọc hiểu) 10 bài dựa trên 2 chủ đề con "Đọc đoạn văn ngắn"/"Kể chuyện theo tranh" — tổng 45 bài. Dòng lẻ = hệ thống hỏi, dòng chẵn = bé đọc, mỗi bài ≥ 4 dòng (≥ 2 lượt); **chưa có cột riêng đánh dấu vai trò**, admin soạn thêm bài giao tiếp PHẢI nhập đúng thứ tự xen kẽ. Cơ chế nhận diện bài hội thoại (`api.loadDialogueLessons()`) không hardcode cấp/tên chủ đề nên thêm chủ đề hội thoại cấp mới không cần sửa code, chỉ cần thêm CSV + `title_tr` (002) + `description` (003) cho unit/bài mới. Thêm trò/kỹ năng mới → `RUNNERS`, `POOLS` (trừ trò story), `SKILLS`, hàm SQL `skill_of()` (test rls mục 22 kiểm khớp), `TEXT_KINDS` nếu cần nhận mặt chữ.
  **Nhật ký:** migration 016 thêm `activity_log.skill/source` (`lesson`|`practice`); phiên luyện tập ghi 1 dòng `kind='practice'` (không `lesson_id` → không bao giờ thành "xong bài"/sao bài học) + 1 dòng mỗi trò; luyện tập CÓ tăng `mastery` và tính vào chuỗi ngày. **`child_stats` đã sửa phút học** (trước đây đếm đôi vì cộng cả dòng trò lẫn dòng bài): chỉ cộng dòng `lesson`/`practice` → số phút cũ giảm sau khi chạy 016. Chạy 016 TRƯỚC khi deploy (`saveActivityLogs` có đường lui nếu thiếu cột, nhưng khi đó mất nhật ký luyện tập). **GĐ 2 (đã làm):** migration 017 = RPC `child_skill_stats(p_child)` (mỗi kỹ năng: số phiên + số phiên đạt ≥ 85, lượt/điểm TB/phút 30 ngày, điểm kỳ trước; dòng cũ chưa có `skill` suy ra bằng `skill_of(kind)`; phút cộng theo từng trò, không cộng dòng phiên). Huy hiệu 🥉3 · 🥈10 · 🥇25 phiên đạt ≥ 85 (`skills.js`: `badgeOf`, `badgeProgress`, `GOOD_SCORE`) hiện ở thẻ kỹ năng + màn hình phạm vi + lễ nhận huy hiệu ở kết quả (cập nhật tại chỗ, `data.skills`); thiếu 017 thì bỏ qua huy hiệu, vẫn chơi được. Khu phụ huynh (`stats.js`): "Luyện tập theo kỹ năng" (thanh điểm, ▲▼ ≥ 5 điểm, huy hiệu, `suggestSkills`: ≤ 2 gợi ý — điểm thấp hoặc chưa chơi) + "Đánh giá đọc to". Chưa làm: tab admin "Luyện tập" (GĐ 3), thẻ Kể chuyện/Đọc hiểu chọn bài + giới hạn phút/ngày (GĐ 5). Emoji mới cần Twemoji (🥉🥈🎮🗂️🔎…): chạy `node scripts/vendor-twemoji.mjs` (tải từ CDN) rồi tăng `VERSION` ở sw.js — chưa chạy thì tạm rơi về phông máy.
- **Không khoá bài:** bé chọn bất kỳ bài/cấp nào (quyết định 2026-09); chỉ gợi ý "Học tiếp".
- **Thống kê:** RPC `child_stats(p_child, p_tz)` (SECURITY INVOKER — RLS quyết định ai xem; chỉ tính nội dung đã duyệt) trả cấp/sao/chuỗi ngày/14 ngày/điểm phát âm/từ cần ôn. Giao diện: `stats.js` (bản bé `childStatsView`; bản phụ huynh `parentStatsView` trong khu phụ huynh). Thêm số liệu → sửa RPC + test rls.test.mjs mục 13.
- **Không được dựng lại màn hình khi cùng 1 phiên:** supabase-js phát lại `SIGNED_IN` mỗi lần app/tab được mở lại sau một lúc; `main.js` chỉ cập nhật phiên nếu cùng người dùng (lỗi cũ: bé đang học bị đẩy về danh sách bài). Bé đang học được nhớ trong `sessionStorage` (`state.activeChildId`), nên trang bị hệ điều hành thu hồi rồi nạp lại vẫn vào lại khu học.
- **Khu admin tải lại không được làm nhảy trang:** mọi `mount(box)` của tab dùng `beginLoad(box)` (`admin/view.js`) — giữ nội dung + chiều cao cũ trong lúc tải, trả lại vị trí cuộn sau khi vẽ. Đừng `box.replaceChildren("Đang tải…")` khi vùng đã có nội dung.
- **Âm thanh cho bé:** `audio.js` tải trước NGUYÊN file (blob, `prefetchItems` khi mở bài) rồi phát từ bộ nhớ; SW không cache phản hồi 206 và bỏ qua yêu cầu Range (iOS Safari). Danh sách chủ đề/bài nhớ 60 giây (`child/api.js`, `clearCache()` khi bé thoát).
- Đừng để 1 hàm "tải dữ liệu" gánh việc ẩn (hiện khung UI...). Chỉ tải dữ liệu màn hình đang cần.
- **"Tiếng Việt Bài Bản"** (giáo trình có cấu trúc cho người lớn/người nước ngoài; kế hoạch + quyết định:
  `KE_HOACH_TIENG_VIET_BAI_BAN.md`; **GĐ 1–6 ĐÃ LÀM ĐỦ** (nền dữ liệu, luồng chọn hồ sơ, giao diện học 7 chặng,
  Luyện tập/SRS, khu admin — GỒM CẢ CSV nhập hàng loạt + TTS, test hàm thuần/RLS đầy đủ); **chỉ còn GĐ 7 (soạn nội
  dung thật) chưa làm** — ngoài phạm vi code): **1 GIAO DIỆN HỌC KHÁC trong CÙNG 1 app**, cùng tài khoản phụ huynh/dự án Supabase —
  KHÔNG phải app/mô hình thu phí riêng. Migration `022_bai_ban.sql` (đầu tiên sau `001_init.sql` tạo bảng mới — mọi
  migration 002–021 trước đó chỉ ALTER): phân cấp `bb_levels` (mã CEFR A1/A2/B1…) → `bb_units` → `bb_lessons` (có
  `lesson_type` core/review/reading/writing) → `bb_lesson_steps` (7 chặng tuần tự/bài: hội thoại · từ vựng · ngữ
  pháp · ngữ âm · mini-game · đọc hiểu · luyện viết) → bảng nội dung riêng theo từng loại chặng
  (`bb_dialogue_lines`, `bb_vocab`, `bb_grammar`, `bb_phonics_pairs`, `bb_reading_passages`+`bb_reading_questions`,
  `bb_writing_tasks`); mini-game không có bảng riêng, chạy runtime từ `bb_vocab`/`bb_phonics_pairs` (còn là chỗ
  đứng `bb/steps/minigame.js`, chưa nối vào Luyện tập — xem "GĐ 4" bên dưới).
  RLS tái dùng nguyên `is_admin()`/`has_access()` — duyệt/nháp giống nội dung trẻ em, không thêm hàm phân quyền
  mới. `child_profiles.profile_type` (`child`|`learner`, mặc định `child`) phân biệt hồ sơ con/hồ sơ người học —
  **không đổi** trigger `child_profiles_limit`/`accounts_guard`/phí thêm con 20% (người học vẫn tính vào
  `child_slots` như con bình thường). Test: `supabase/tests/rls.test.mjs` mục 24 (26 kiểm tra).
  **GĐ 2 (luồng chọn hồ sơ):** hồ sơ `learner` vào được **CẢ 2 đường** — bấm đúng avatar ở màn hình đầu (`avatars.js`
  khớp avatar với MỌI `profile_type`, không phân biệt — sửa 2026-09-25, xem lý do dưới) **và** từ khu phụ huynh
  (thẻ "Hồ sơ học bài bản" trong `parent.js`, nút "Vào học", vẫn giữ — tiện khi phụ huynh tự tạo hồ sơ học cho
  chính mình, không cần nhớ avatar). `decideScreen()` (`flow.js`) rẽ nhánh theo `profile_type` của hồ sơ đang chọn:
  `learner` → màn `bai-ban-home`, `child` → `child-home` như cũ. `create-child.js` có bước chọn **Loại hồ sơ**
  (`<select>`, đặt dưới "Năm sinh" — sửa 2026-09-25, ban đầu là 2 nút `.tabs` ở đầu form); tạo `learner` thì vào
  thẳng Bài Bản, tạo `child` thì không tự vào (bé vẫn phải tự bấm avatar). Tiện thể thêm nút "+ Thêm hồ sơ mới"
  trong khu phụ huynh (`state.creatingProfile`) — trước GĐ 2 app KHÔNG có cách tạo hồ sơ thứ 2 trở đi dù đã được
  cấp thêm slot (màn `create-child` chỉ tự mở khi `children.length === 0`), lỗ hổng cũ không liên quan Bài Bản
  nhưng phải vá để tính năng này dùng được.
  **Sửa sau khi dùng thật (2026-09-25):** ① form tạo hồ sơ đổi "Loại hồ sơ" từ `.tabs` sang `<select>` + dời xuống
  dưới "Năm sinh" (yêu cầu trực tiếp). ② `bai-ban-home.js` `shell()` thiếu icon avatar cạnh tên — đã thêm
  `avatarEmoji()` cho khớp `child-home.js`. ③ **Đảo ngược quyết định ban đầu** — `avatars.js` từng cố tình CHẶN hồ
  sơ `learner` ở màn avatar mặt trước (buộc vào qua khu phụ huynh, theo đúng câu trong artifact gốc bàn TRƯỚC khi
  có người dùng thật); thực tế đầu tiên chủ dự án tạo hồ sơ `learner` cho **chính con mình** tự học — bé bấm đúng
  avatar mà bị báo sai, gây khó hiểu. Nay bỏ hẳn điều kiện lọc theo `profile_type` ở `avatars.js`, mọi hồ sơ vào
  được từ avatar như nhau. **Sửa tiếp lần 2 cùng ngày:** avatar đã đủ dùng cho cả 2 loại hồ sơ nên thẻ "Hồ sơ học
  bài bản" + nút "Vào học" riêng trong `parent.js` (`learnerProfilesCard()`) trở thành thừa, gây hỏi "sao lại có
  thẻ này" — đã BỎ HẲN; danh sách hồ sơ ở thẻ tóm tắt đầu trang giờ gộp chung mọi loại, chỉ thêm nhãn nhỏ
  `🎓 Bài Bản` (`T.bbProfileTag`) để phân biệt. Đồng thời `progressCard()` ("Tiến độ học của con") lọc bỏ hồ sơ
  `learner` khỏi ô chọn — RPC `child_stats` không biết gì về `bb_progress`/`bb_srs_state` nên trước đó chọn vào hồ
  sơ `learner` sẽ ra toàn số 0, hiểu lầm là "chưa học gì". View tiến độ riêng cho Bài Bản (level/box Leitner) —
  CHƯA làm, hình dạng thống kê khác hẳn khu trẻ em nên không gộp 1 view được. Chi tiết đầy đủ:
  `KE_HOACH_TIENG_VIET_BAI_BAN.md` mục 8 "Sửa lại sau khi dùng thật" + "Sửa tiếp lần 2".
  **GĐ 3 (giao diện học 7 chặng):** thư mục mới `public/js/bb/` (mirroring `child/`) — `bb/api.js` (tải
  Level/Unit/Lesson/nội dung chặng, chỉ mục `approved`), `bb/media.js` (dùng lại nguyên `speakFallback`/`nativeLang`
  từ `child/media.js` + `playPath()` phát file bucket `content`/rơi về giọng trình duyệt), `bb/pron.js`
  (`micButton()` dùng lại hàm chấm phát âm thuần của `pronunciation.js` nhưng KHÔNG lưu kết quả — chưa có bảng
  tiến độ cho Bài Bản, và `pronunciation_attempts` khoá cứng FK vào `content_items` nên không dùng lại được),
  `bb/runner.js` (`runLesson()`, cùng khung với `child/lesson.js` `playLesson()` nhưng không ghi log/tính sao),
  `bb/steps/{dialogue,vocab,grammar,phonics,minigame,reading,writing}.js` (mỗi file 1 renderer `run(box, step)`;
  `minigame.js` là chỗ đứng — engine thật (5 kiểu) chưa làm, không gắn cứng vào 1 giai đoạn cụ thể (xem GĐ 4 bên
  dưới); `reading`/`writing` chấm ngay tại chỗ ở trình duyệt, KHÔNG
  lưu; `writing` dạng `write` KHÔNG tự chấm văn tự do, chỉ cho xem câu mẫu). `pages/bai-ban-home.js` viết lại hoàn
  toàn: điều hướng trong-trang Level→Unit→Lesson (giống `pages/child-home.js`) rồi gọi `runLesson()`. **Theme riêng**
  `body.bb-theme` (bật ở `flow.js` `render()`) chỉ đổi biến `--brand`/`--bg`… sang tông xanh dương — mọi
  `.card`/`.btn`/`.pill`… tự đổi theo vì đã dùng `var(--brand)`, không viết CSS riêng cho từng thành phần; CHỦ Ý tái
  dùng tối đa lớp CSS có sẵn của khu trẻ em (`.unit-grid`, `.lesson-list`, `.opt-grid`, `.mic`…), chỉ thêm vài lớp
  `.bb-*` mới cho hình dạng riêng. `tests/browser/mock-sb.js` thêm 11 bảng `bb_*` + nhúng `bb_levels` để thử được
  bằng dữ liệu giả. Đã thử: chạy đủ 7 chặng liên tiếp + chấm điểm client-side (đọc hiểu, điền từ, xếp câu) + thoát
  giữa chừng + màn rỗng, CHƯA thử Supabase thật.
  **GĐ 4 (Luyện tập/SRS):** migration `023_bb_progress.sql` (sau `022`) — `bb_progress(child_id, step_id,
  completed_at)` (chặng nào đã đi qua; `bb/runner.js` gọi `api.saveStepProgress()` sau mỗi chặng, KHÔNG `await`;
  dùng để đánh dấu ✓ ở danh sách bài + chặn diện ôn tập chỉ còn mục đã gặp qua) và `bb_srs_state(child_id,
  item_type, item_id, box, due_at, reviewed_count, correct_count)` (`item_type` ∈ vocab/grammar/phonics/dialogue,
  KHÔNG có FK vì Postgres không có "FK tuỳ loại" — toàn vẹn do code kiểm; `box` Leitner 1–5 CHỈ có ý nghĩa thật với
  `vocab`, 3 loại còn lại không chấm, chỉ `due_at` dùng sắp "lâu chưa ôn"). RLS CÙNG luật với
  `child_progress`/`activity_log` (đọc luôn được để xuất/xoá; ghi chỉ khi còn hạn + đúng con/học viên của mình).
  Test: `rls.test.mjs` mục 25 (10 kiểm tra). `bb/srs.js` (toán Leitner thuần: `nextBox`, `dueAfter`,
  `INTERVAL_DAYS=[0,1,2,4,8,16]`) + `bb/practice-core.js` (`pickSession()` — ưu tiên mục đến hạn, hàm thuần không
  gọi mạng, giống tinh thần `child/practice-core.js`) — test `tests/bb.test.mjs` (47 kiểm tra, gồm cả CSV GĐ 5). `bb/skills.js` —
  CHỈ 4 kỹ năng (không phải 12 như khu trẻ em): 🔤 Từ vựng (`graded:true`, có box Leitner thật) · 💬 Hội thoại ·
  📐 Ngữ pháp · 🎧 Ngữ âm (3 mục sau chỉ "xem lại", không chấm). `bb/practice.js` — màn Luyện tập: từ vựng dùng
  `runVocabReview()` riêng (từng thẻ, ẩn nghĩa → tự đánh giá Nhớ/Quên); 3 loại còn lại **TÁI DÙNG NGUYÊN** renderer
  của chặng bài học (`bb/steps/dialogue|grammar|phonics.js`, gọi thẳng `run(box, {content: session})` với mục từ
  nhiều bài) rồi đánh dấu "đã ôn lại" bằng `api.saveReviewBatch()` (đẩy hạn +3 ngày, không chấm). `runLesson()`
  nhận thêm `childId`. `pages/bai-ban-home.js` thêm màn Home (2 thẻ 📖 Học / 🎯 Luyện tập, tái dùng NGUYÊN
  `.home-cards`/`.home-card.learn`/`.home-card.practice` của khu trẻ em) thay vì vào thẳng `showLevels()`.
  **Cố tình CHƯA làm** (đã quyết định, không phải thiếu sót): bảng ghi lượt đọc thử phát âm riêng cho Bài Bản
  (`bb/pron.js` `micButton()` vẫn không lưu kết quả ở bất kỳ đâu, kể cả trong Luyện tập); mini-game thật
  (`bb/steps/minigame.js` vẫn là chỗ đứng, chưa nối vào Luyện tập — có thể làm trước GĐ 5, không phụ thuộc khu
  admin, xem ghi chú cuối kế hoạch). `tests/browser/mock-sb.js` thêm `bb_progress`/`bb_srs_state`. Đã thử: học
  xong 1 bài → 7 dòng `bb_progress` → danh sách bài hiện ✓ → Luyện tập hiện đúng số mục cần ôn từng loại → ôn Từ
  vựng (Nhớ → box 2, due +2 ngày; Quên → box 1, due +1 ngày, khớp `INTERVAL_DAYS`) → ôn 3 loại còn lại bằng đúng
  giao diện chặng bài học → mọi kỹ năng về "Chưa có gì để ôn"; Luyện tập lúc chưa học gì hiện đúng thông báo, không
  lỗi. Chưa thử Supabase thật.
  **GĐ 5 (khu admin nhập nội dung):** tab mới **"Bài Bản"** trong khu quản trị (`admin/bb.js` + `admin/bb-ops.js`),
  cây Cấp→Chủ đề→Bài→Chặng (7 loại)→nội dung riêng từng loại, cùng khuôn `admin/content.js` (`beginLoad`, `notice`,
  `slotToggle`, biểu mẫu `.qa-box`). Duyệt LAN LÊN (duyệt 1 chặng tự duyệt luôn bài/chủ đề/cấp chứa nó), ẩn LAN
  XUỐNG — giống hệt nguyên tắc `ops.setLessonStatus` bên khu trẻ em. `▲▼` dùng lại NGUYÊN `ops.moveIn()`; ảnh
  `bb_vocab.image_path` dùng lại NGUYÊN `images.setImage/clearImage`; âm thanh viết MỚI `bb-ops.setAudioPath/
  clearAudioPath` (generic cho mọi cột `audio_path`/`audio_a_path`/`audio_b_path` của mọi bảng `bb_*` — khác hẳn
  `content_audio` nhiều-dòng bên khu trẻ em). Xoá dọn Storage trước khi xoá dòng (DB tự xoá dây chuyền qua ON
  DELETE CASCADE). **Lỗi đã gặp + sửa lúc thử (2 CHỖ trong cùng file):** `panel.replaceChildren(nút, data.map(...))`
  thiếu `...` trước `.map()`, và sau đó cùng lỗi tái diễn ở `preview.replaceChildren(..., cond ? el() : null)` +
  `fields.replaceChildren(cond ? [el(),el()] : null)` (form Luyện viết đổi trường theo loại) — `replaceChildren()`
  GỐC (khác `el()`) KHÔNG tự lọc `null` / dàn phẳng mảng, ép thành chuỗi `"null"`/`"[object HTMLDivElement],..."`
  hiện thẳng lên màn hình; sửa bằng cách luôn bọc qua 1 `el("div", null, ...)` trước khi gắn vào
  `replaceChildren()` — **bẫy chung của cả file, nhớ khi thêm chỗ gọi `replaceChildren()` trực tiếp mới**. Cũng sửa
  thông báo "Đã lưu" bị `refresh()` xoá mất ngay vì viết chung `panel` — tách riêng `flash` div sống ngoài `panel`.
  **TTS:** `bb-ops.generateAudio()` dùng lại NGUYÊN `synth()`/`getVoices()` từ `admin/audio.js` (cùng `/api/tts`,
  cùng giọng đã cấu hình ở Cài đặt) rồi lưu vào `audio_path` phẳng (GHI ĐÈ khi sinh lại, không giữ nhiều giọng như
  `content_audio`) — nút "🔊 TTS" hiện cạnh nút tải file thủ công ở mọi chỗ có sẵn chữ để đọc. **CSV nhập hàng
  loạt:** `admin/bb-csv.js` (hàm thuần: `validateRows`/`buildPlan`, test `tests/bb.test.mjs`) +
  `bb-ops.importPlan()` (ghi CSDL) — 1 dòng CSV = 1 dòng nội dung của 1 CHẶNG (khác hẳn 1 dòng = 1 mục bên khu trẻ
  em), cột đọc tuỳ `step_type`; mỗi bài chỉ 1 chặng/loại qua CSV (không có cột `step_order`, đơn giản hoá có chủ
  đích); so trùng theo tên/chữ chính không phân biệt hoa/thường ở MỌI tầng (Cấp/Chủ đề/Bài/Chặng + nội dung trong
  chặng) → nhập lại không tạo trùng, đúng nguyên tắc cũ của khu trẻ em. Giao diện `csvSection()` nằm ngay đầu tab
  Bài Bản (không phải tab riêng). Đã thử bằng dữ liệu giả: tạo đủ Cấp→Chủ đề→Bài→cả 7 loại chặng + nhập CSV 7 dòng
  phủ 4 loại chặng vào CSDL trống (đúng số tầng mới tạo) → nhập lại NGUYÊN VẸN cùng file lần 2 → số dòng mọi bảng
  TRƯỚC/SAU giống hệt nhau (không tạo trùng); duyệt lan lên đúng 4 tầng; xoá cả cấp sạch dây chuyền — không lỗi
  console trong suốt quá trình. Chưa thử tải file ảnh/âm thanh thật, chưa thử gọi `/api/tts` thật, chưa thử
  Supabase thật — chi tiết + ghi chú kỹ thuật ở `KE_HOACH_TIENG_VIET_BAI_BAN.md` mục 8–17.
- **Gọn lại khu admin sau khi có 2 giáo trình (2026-09):** ban đầu "Nhập CSV" (`admin/import.js`) là 1 tab RIÊNG
  dùng chung cho khu trẻ em — gây hiểu lầm là dùng chung luôn cho Bài Bản (2 giáo trình có CSV/cột hoàn toàn khác
  nhau, xem trên). Đã bỏ tab "Nhập CSV" riêng: đổi tên tab "Nội dung" → **"Trẻ em"** và nhúng thẳng `import.js`
  (`mount(box, {onImported})`, giữ nguyên hàm nạp/ghi CSDL) làm mục "📄 Nhập CSV hàng loạt" gấp gọn (`<details>`) ở
  đầu `content.js` — CÙNG kiểu với `csvSection()` của tab Bài Bản, `onImported` nối vào `reload()` của `content.js`.
  "Thu âm" (`record.js`, thu giọng người thật — quy trình khác hẳn, không có CSV) giữ nguyên là tab riêng. Nhân
  tiện sửa 1 lỗi `replaceChildren` null có sẵn từ trước trong `render()` của `import.js` (chưa ai để ý vì trước đây
  `onImported` không được gọi — tab đứng riêng không tự tải lại sau khi nhập nên thông báo "Xong: …" hiện đúng,
  không lộ chỗ hiện "nullnull"; giờ nhúng vào tab dùng chung `reload()` mới lộ ra khi kiểm bằng trình duyệt) — bọc
  lại trong 1 `el("div", null, …)` như đã làm ở `bb.js`. Cũng chuyển thông báo thành công sang `notice.set()` (thay
  vì viết thẳng vào `result` rồi bị `reload()` xoá mất ngay).

- **Hàm thuần + Worker + CSV + TTS:** `node tests/unit.test.mjs`, `node tests/admin.test.mjs` (134 kiểm tra), `node tests/practice.test.mjs` (Luyện tập + huy hiệu, 104 kiểm tra), `node tests/autofill.test.mjs` (Thêm nhanh, 43 kiểm tra), `node tests/curriculum.test.mjs` (CSV giáo trình) và `node tests/bb.test.mjs` (Leitner + chọn phiên ôn tập + CSV nhập hàng loạt "Tiếng Việt Bài Bản", 47 kiểm tra) — không cần cài gì.
- **SQL + RLS chéo vai trò:** `npm i --no-save @electric-sql/pglite` rồi `node supabase/tests/rls.test.mjs` (219 kiểm tra) và
  `node supabase/tests/seed.test.mjs` (19). Chạy MỌI migration theo thứ tự trên Postgres trong bộ nhớ, giả lập auth/role của Supabase
  (`_pg.mjs`). **Mỗi migration/bảng mới phải thêm kiểm tra vào rls.test.mjs.** Không mô phỏng Storage và PostgREST (nhúng bảng, tên
  ràng buộc khoá ngoại như `accounts!payments_account_id_fkey`) — 2 chỗ này chỉ kiểm được trên Supabase thật.
- **Chạy giao diện local:** `node scripts/dev-server.mjs` (hoặc `preview_start` tên `dev`) — dùng chính `worker.js`, đọc `.dev.vars`
  (biến môi trường thật > .dev.vars > giá trị giả). KHÔNG điền giá trị thật vào `.dev.vars.example`.
- **Thử màn hình bằng dữ liệu giả (không đụng Supabase thật):** dev-server phục vụ `tests/browser/*` ở `/__tests/`. Trong trình duyệt:
  `const {sb}=await import('/js/supabase.js'); const {installMock}=await import('/__tests/mock-sb.js'); const m=installMock(sb,{units:[...]})`,
  gán `state.session/account/children` (`/js/state.js`) rồi `(await import('/js/flow.js')).render()`. `m.db` là dữ liệu, `m.files` là
  Storage. Giọng đọc giả: gán lại `speechSynthesis.speak`; TTS giả: bọc `window.fetch` cho `/api/tts`. Đã dùng để thử khu trẻ + khu admin.

## Trạng thái (2026-09-20)

**Đã có:** Worker + dev-server; migration 001 (đã chạy trên Supabase của chủ dự án), **002 + 003 (chủ dự án chạy tay)**; dữ liệu mẫu;
luồng đăng ký → PIN → tạo hồ sơ con → chọn avatar → khu phụ huynh (công tắc chấm phát âm, **xin thêm con**, lịch sử thanh toán) →
**khu học của trẻ** (chủ đề → bài — **không khoá bài/cấp**, chỉ gợi ý "Học tiếp" → học từ mới → 4 hoạt động → kết quả) → màn hình hết hạn (**"Tôi đã thanh toán"**).
**Khu admin (bước 3):** tab *Trẻ em* (chủ đề/bài/mục từ, duyệt/ẩn, sửa tại chỗ, nghe thử, sinh TTS còn thiếu hoặc từng ô, tải giọng người
thật, xoá kèm dọn file — gồm mục "📄 Nhập CSV hàng loạt" gấp gọn ở đầu trang: kiểm tra + xem trước + chặn khi còn lỗi, file mẫu, câu lệnh
cho AI), *Phụ huynh* (RPC tổng quan, ghi nhận học phí, cấp thêm con, khoá/mở), *Học phí & thanh toán* (hàng chờ xác nhận, mức học phí,
lịch sử), *Cài đặt*. Đã thử bằng dữ liệu giả.
- **Âm thanh:** file TTS sinh qua `/api/tts`; mục chưa có file thì khu trẻ tạm dùng giọng đọc của trình duyệt (`speakFallback`).
- Chấm phát âm bỏ từ loại đầu ("con", "màu", "quả"...) khi so khớp — nếu không, nói sai cả con vật vẫn ~50 điểm.

**Giọng TTS:** tab Cài đặt chọn giọng nữ + nam theo ngôn ngữ (nghe thử trước), tab Trẻ em có ô ♀/♂ và "Sinh lại TTS bằng giọng hiện tại" (giữ giọng người thật); bé/phụ huynh chọn giọng nghe (migration 005).
**Giáo trình:** đã có khung + **383 mục học vần + chữ hoa (Cấp 1, 62 bài)**, 207 từ (Cấp 2, gồm Giờ giấc/Thứ trong tuần/Vị trí mới), 82 câu (Cấp 3, gồm chủ đề Sự việc theo thời gian: Con đang làm gì/Con đã làm/Con sẽ làm), **208 mục đọc hiểu/chính tả/viết (Cấp 4, 29 bài)** (số cấp đã đảo 2026-09, xem mục "Cấp học"), **294 mục bài giao tiếp (cả 4 cấp, 45 bài — xem "Luyện tập theo kỹ năng")**; cả 5 file CSV giáo trình đã có đủ nghĩa **5 ngôn ngữ de/en/fr/ko/ja** (2026-09, xem mục "Mô hình triển khai" — dùng chung cho mọi bản triển khai vùng); đánh vần từng phần, tô chữ/viết tay, đọc to cả đoạn có chấm điểm chưa làm — xem `giao-trinh/…md` mục 7. **Lưu ý kiểm cú pháp:** dùng `node --input-type=module --check < file.js` (`node --check file.js` bỏ sót lỗi trong file ES module).

**Chưa làm:** hoạt động phân loại (`sort`, cần nhóm/thể loại cho mục từ), dashboard phụ huynh (tiến độ, chế độ cùng học), chi tiết từng bé
trong tab Phụ huynh, giới hạn thời gian/ngày, thu âm giọng người thật ngay trong app, vai trò giáo viên hỗ trợ, xuất/xoá dữ liệu con,
icon PNG (iOS cần `apple-touch-icon`; hiện chỉ có `icons/icon.svg` "any", chưa có bản PNG riêng), avatar thật cho bé
(hình linh vật gà trống thì ĐÃ có — `vendor/mascot/rooster.png`, xem mục "Cấu trúc"), thông báo nhắc học.
**Chưa thử với Supabase/Storage/TTS thật:** đăng ký/đăng nhập/xác nhận email, đọc nội dung qua RLS với phiên thật, tải file lên Storage,
gọi Azure/Google TTS thật, nhúng bảng của PostgREST (`select('*, a(b)')`).

## Cách làm việc

Việc lớn (dữ liệu, phân quyền, học phí/số con) → lập kế hoạch, xin duyệt trước khi code; việc nhỏ
(chữ/màu/bố cục) → làm thẳng, chỉ soát cú pháp. Trả lời ngắn gọn, nêu khuyến nghị + đánh đổi chính.
Mọi bảng mới phải có RLS + kiểm thử chéo giữa các vai trò.
