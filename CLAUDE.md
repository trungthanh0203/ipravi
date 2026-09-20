# Tôi luyện tiếng Việt

PWA học tiếng Việt cho trẻ gốc Việt 3–8 tuổi (linh vật gà trống đỏ cam). Tài liệu yêu cầu đầy
đủ + các quyết định đã chốt: `YEU_CAU_APP_TIENG_VIET_CHO_TRE_EM.md` (nguồn sự thật — đọc mục
liên quan bằng Grep/offset, đừng đọc nguyên file). Dự án ĐỘC LẬP với iLapra (`D:\LangPrac`),
chỉ mượn mẫu thiết kế. **Chủ dự án tự chạy git** — đừng commit/push.

## Cấu trúc

- `public/` — phần được deploy (static assets). **Không đặt docs/migration/CSV vào đây.**
  - `index.html` (preload cấu hình + modulepreload), `manifest.json`, `sw.js` (mạng-trước; cache-trước cho `/vendor/` và media Storage; đổi `VERSION` khi tải lại vendor), `css/app.css`
  - `vendor/supabase/` — supabase-js **tải về sẵn** (chạy `node scripts/vendor-supabase.mjs [phiên bản]`, rồi tăng `VERSION` trong sw.js): cùng nguồn với app nên khởi động nhanh, không gọi CDN bên thứ ba (GDPR). Đừng import từ CDN.
  - `js/` ES modules thuần, không build step, không `package.json`:
    `main.js` (boot) · `flow.js` (`decideScreen()` = luồng vào app) · `state.js` · `config.js`
    · `supabase.js` · `strings.js` (MỌI chữ giao diện, chỉ tiếng Việt) · `pin.js` · `audio.js`
    (`pickAudio` = luật chọn giọng) · `pronunciation.js` (chấm phát âm Web Speech API) · `data.js`
    (avatar) · `ui.js` (`el()` dựng DOM) · `payments.js` (yêu cầu học phí/thêm con của phụ huynh) ·
    `pages/<màn hình>.js` (mỗi file export `mount(root)`) · `child/` (khu học của trẻ) ·
    `admin/` (khu quản trị: mỗi tab 1 file `content|import|parents|billing|settings.js`, cùng `csv.js` [hàm thuần],
    `audio.js` [TTS + tải giọng thật], `ops.js` [duyệt/xoá], `notice.js`, `text.js` [chữ giao diện admin])
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

Dựng bản mới: tạo dự án Supabase → chạy `001_init.sql` … `012_case_activities.sql` (theo thứ tự, tất cả trong `supabase/migrations/`) → đăng ký 1
tài khoản qua app → `update public.accounts set role='admin' where email='...'` → đặt biến ở Cloudflare (thêm `TTS_PROVIDER`,
`TTS_KEY` [Secret], `TTS_REGION` nếu dùng sinh giọng — xem `tts.js`/`.dev.vars.example`) → deploy. Dữ liệu mẫu (tuỳ chọn):
`supabase/seed/001_sample_content.sql`.

## Quy tắc dễ sai (đã chốt trong tài liệu yêu cầu)

- **Thứ tự điều kiện trong `decideScreen()` là luật của luồng vào app** — thêm màn hình mới phải
  chèn đúng chỗ, đừng append cuối (bài học từ iLapra: thứ tự tab lệch làm mở nhầm màn hình nặng).
- Trẻ KHÔNG đăng nhập; app chạy bằng phiên phụ huynh. Màn hình chọn avatar hiện TẤT CẢ avatar
  (không chỉ của các con) — avatar đóng vai mật khẩu bằng hình. Vào khu phụ huynh: nút nhỏ + PIN 4
  số (`askPin()`); PIN chỉ dùng cho việc này, khoá tạm 5 phút sau 5 lần sai (lưu ở thiết bị).
- Số con ≤ `accounts.child_slots` (mặc định 1) được ép bằng TRIGGER (RLS không tự đếm số lượng);
  trần `settings.max_children` (mặc định 6); chỉ admin (qua xác nhận `payments`) tăng được.
  Phụ huynh không sửa được `role/access_*/child_slots` (trigger `accounts_guard`).
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
- Chấm phát âm MVP = Web Speech API + so khớp chữ (như iLapra), KHÔNG chấm thanh điệu thật; ngưỡng
  dễ, không hiện "sai", không lưu file ghi âm. Giọng trẻ đi qua Google/Apple → vấn đề GDPR cần tư vấn
  trước khi công khai. Cần thử trên ghi âm trẻ thật + iOS/Android thật + PWA đã cài.
- PostgREST cắt âm thầm ở 1000 dòng — `select()` không lọc hẹp phải phân trang `.range()`.
  Cột id identity dùng `generated BY DEFAULT`. RLS thiếu quyền chỉ trả 0 dòng, không báo lỗi.
- **Khu admin:** trẻ chỉ thấy mục `approved` ở CẢ chủ đề, bài và mục từ → duyệt bài phải duyệt luôn chủ đề chứa nó (`ops.setLessonStatus`).
  Nhập CSV luôn tạo NHÁP, chạy lại không tạo trùng (khớp theo tên chủ đề+bài+từ, không phân biệt hoa/thường), ô trống không xoá
  dữ liệu cũ, đổi chữ/nghĩa thì xoá âm thanh cũ của ngôn ngữ đó (`dropAudio`). Xoá nội dung phải dọn file Storage (`ops.js`).
  `/api/tts` kiểm admin bằng chính token của người gọi qua RPC `is_admin` (không dùng service_role); giọng ưu tiên: admin chọn (`settings.tts_voices` = `{lang:{female,male}}`, gửi kèm yêu cầu, **kiểm tên giọng bằng regex** vì được đưa vào SSML) > `TTS_VOICES` > mặc định theo giới (`DEFAULT_VOICES` trong `tts.js`, ~15 ngôn ngữ gồm ko/ja); `/api/config.ttsVoices` cho app biết ngôn ngữ nào có TTS; trình duyệt tải file lên
  Storage bằng phiên admin. Giọng TTS mặc định trong `tts.js` đã đối chiếu tài liệu nhà cung cấp nhưng CHƯA nghe thử chất lượng/gọi API thật (Google tiếng Việt chỉ có Standard/Wavenet, không có Neural2) — báo lỗi "voice" thì ghi đè `TTS_VOICES`.
  **Giới của giọng:** `TTS_VOICES`/`tts_voices` nên là `{female,male}`; nếu là CHUỖI thì giới được đoán từ TÊN giọng (`public/js/voice-names.js` `guessGender`, dùng chung Worker + admin) — lỗi cũ: coi mọi chuỗi là giọng nữ nên chuỗi `vi-VN-NamMinhNeural` làm mọi file "nữ" đọc bằng giọng nam. `admin/audio.generate` từ chối lưu khi giọng thật trái giới ô; migration 006 vá nhãn cũ + RPC `admin_audio_summary` (Cài đặt → "Kiểm tra giọng đã sinh").
- Giao dịch `payments` (kể cả admin tạo) LUÔN vào ở `pending`; gia hạn/tăng số con chỉ chạy khi cập nhật `pending→confirmed`
  (trigger). Admin ghi nhận thay phụ huynh = chèn rồi xác nhận (`billing.recordPayment`). Thông báo "Đã …" sau thao tác admin
  dùng `notice.set()` (giữ qua lần tải lại danh sách).
- **Giọng nữ/nam:** `content_audio.gender`; tiếng Việt sinh cả ♀ và ♂ (thường + chậm = 4 file/từ), ngôn ngữ gốc mặc định chỉ ♀ (♂ khi admin nhập giọng nam ở Cài đặt);
  ngôn ngữ KHÔNG có TTS → không có ô âm thanh → khu trẻ dùng giọng trình duyệt (`speakFallback`). Bé chọn giọng: `child_profiles.voice_gender` (nút 👩/👨 trong lúc học) >
  mặc định phụ huynh `accounts.voice_pref.gender` > nữ. `pickAudio` ưu tiên giới đã chọn > người thật > loại giọng > vùng miền; thiếu giới đó thì dùng giới còn lại.
  Giọng TRẺ EM: Azure có (vd en-US-AnaNeural) nhưng KHÔNG có cho tiếng Việt → chỉ có bằng thu giọng người thật (`voice_kind='child'`; chưa có UI cho bé chọn).
- **Cấp học:** `units.level` 1–4 (🥚 Trứng, 🐣 Gà con, 🐥 Gà choai, 🐓 Gà trống; `levels.js` = khung + `levelProgress`/`recommendedLevel`, hàm thuần có test). Bé thấy 4 chặng → chủ đề → bài; **không khoá cấp**, chỉ gợi ý "Con đang ở đây" (cấp có nội dung đầu tiên chưa đạt). "Đạt cấp" = ≥80% số từ có mastery ≥3. CSV có cột `level` (tuỳ chọn; trống = giữ cấp cũ / mặc định 1). Tab Nội dung nhóm theo cấp, đổi cấp bằng ô chọn.
- **Học vần (Cấp 3):** `item_type` thêm `letter`/`syllable`; `content_items.say_vi` = chữ ĐỌC thành tiếng khi khác chữ hiển thị (chữ "b" → "bờ"; dùng qua `spoken(item)` trong `viet.js` ở TTS admin, giọng trình duyệt, chấm phát âm). `viet.js` = hàm thuần ngữ âm (`toneOf`, `splitSyllable`, `TONES`). 5 hoạt động mới trong `child/activities/phonics.js` (`listen_pick_tone`, `build_syllable`, `fill_letter`, `read_pick`, `order_words`; tự bỏ qua nếu bài không đủ mục phù hợp; các dạng cần nhận mặt chữ bị ẩn với bé <5 tuổi). CSV có cột `say` và `activities` (bộ hoạt động cho bài MỚI; trống = 4 hoạt động chuẩn; bài đã có không đổi). Thêm loại hoạt động mới → sửa `RUNNERS` (lesson.js), `ACTIVITY_DEFAULTS` (csv.js), CHECK ở migration, test. Giáo trình Cấp 3 = `giao-trinh/csv/cap3-ga-choai-hoc-van.csv` (sinh bằng script, có luật kiểm riêng trong `tests/curriculum.test.mjs`: đủ 29 chữ cái, emoji thanh đúng, hoạt động chơi được).
- **Đọc hiểu (Cấp 4):** `item_type` thêm `question` (câu hỏi đọc hiểu; `content_items.extra` = `{choices:[…], answer:n}`, CSV: cột `choices` cách nhau `|`, `answer` đếm từ 1; CHECK ở DB + kiểm ở `csv.js`). `lesson.js` TÁCH mục question khỏi `items` (chỉ `read_quiz` dùng, qua `ctx.questions`); `child_stats` không đếm câu hỏi. 5 hoạt động mới trong `child/activities/reading.js` (`read_quiz`, `fill_word`, `write_check`, `spell_word`, `order_story`; `arrange()` dùng chung cho xếp chữ/xếp câu; `order_story` dùng THỨ TỰ mục của bài làm đáp án → đừng xáo `sort_order`). Giáo trình Cấp 4 = `giao-trinh/csv/cap4-ga-trong-doc-hieu.csv` (sinh bằng script, luật kiểm riêng trong `tests/curriculum.test.mjs`: hoạt động chơi được, câu hỏi hợp lệ, emoji không trùng).
- **Hình của mục:** `image_path` (ảnh) ưu tiên hơn `emoji`; emoji có thể là "cảnh" 2–3 emoji (`visual()` tự thu nhỏ). Câu hỏi đọc hiểu KHÔNG có hình (giao diện không hiển thị). Hoạt động dựa vào hình (`read_pick`, `match`…) chỉ hợp khi hình thật sự đúng nghĩa — đừng dùng cho câu trừu tượng/tục ngữ. Kế hoạch nâng cấp (vai trò hình, Twemoji, ảnh riêng, chữ hoa, tô chữ, đánh vần từng phần, thu âm trong app): `KE_HOACH_NANG_CAP_HINH_ANH_CHU_HOA_TO_CHU_THU_AM.md` (chờ chốt quyết định D1–D6).
- **Thu giọng người thật (tab "Thu âm", `admin/record.js`):** thu bằng Web Audio (`mic.js`, mẫu thô — KHÔNG MediaRecorder vì định dạng khác nhau giữa trình duyệt) → `wav.js` (hàm thuần: cắt lặng, chuẩn hoá −1 dBFS, 24 kHz, WAV mono 16-bit; có test) → `audio.uploadHuman` (Storage + `content_audio`, `source=human`, `gender`, `voice_kind`, `region`). Mặc định giọng NAM người lớn; giọng nữ/trẻ em chọn ở ô "Giọng"/"Loại giọng" (giọng trẻ em cần đồng ý bằng văn bản của phụ huynh trẻ — GDPR). Có tải hàng loạt (tên file = chữ của mục). **Ngân hàng âm** (`sounds.js` + `admin/bank.js`): chủ đề ẨN `units.hidden=true` (bé không thấy; `loadUnits` lọc, `child_stats` bỏ; RLS vẫn cho đọc để phát âm) chứa âm phụ âm (bờ, cờ…), nguyên âm, tên 6 thanh, ~85 vần — dùng cho đánh vần theo phần. Micro chỉ thử được trên máy thật.
- **Đánh vần theo phần (`spell_along`, `child/activities/spell.js`):** `viet.spellParts("bà")` → bờ – a – ba – huyền – bà (bỏ phần trùng/không cần). Mỗi phần tra trong NGÂN HÀNG ÂM (`api.loadSoundBank()`, Map chữ → mục kèm âm thanh, nhớ 5 phút) → `media.playPart()`: giọng người thật/TTS nếu đã có file, không thì giọng trình duyệt (`sayOfPart`: ă → á). Bước ① nghe–nhìn (các phần sáng lần lượt, chạm phần nào nghe phần đó), bước ② tự đánh vần (`arrange()`). Bài chưa có hoạt động này thì thêm bằng SQL (bài đã nhập không tự đổi hoạt động). Muốn giọng TTS tốt hơn giọng trình duyệt cho các âm nhỏ: tab Nội dung → "Ngân hàng âm" → Sinh âm thanh còn thiếu.
- **Chữ hoa (`child/activities/casing.js`):** mục chữ hoa có dạng `"A a"` (`type=letter`; `viet.caseParts` tách, chữ thường phải = chữ hoa viết thường; chữ ghép `"Ngh ngh"`). 3 hoạt động tự sinh từ dữ liệu, không cần cột mới: `match_case` (ghép hoa–thường), `pick_case` (nhiễu = chữ hình gần giống, `viet.lookalikes`), `fix_capital` (chạm từ phải viết hoa: `viet.capitalIndexes` = từ đầu câu + từ viết hoa giữa câu, nên câu dữ liệu PHẢI viết hoa đúng). Bài chữ hoa dùng hình tên riêng chỉ để trang trí → không dùng hoạt động chọn theo hình (test giáo trình cho phép trùng emoji ở bài không có hoạt động chọn theo hình). Nút ▲▼ ở tab Nội dung đổi thứ tự chủ đề trong cùng cấp (`ops.moveUnit`, hoán đổi `sort_order`).
- **Không khoá bài:** bé chọn bất kỳ bài/cấp nào (quyết định 2026-09); chỉ gợi ý "Học tiếp".
- **Thống kê:** RPC `child_stats(p_child, p_tz)` (SECURITY INVOKER — RLS quyết định ai xem; chỉ tính nội dung đã duyệt) trả cấp/sao/chuỗi ngày/14 ngày/điểm phát âm/từ cần ôn. Giao diện: `stats.js` (bản bé `childStatsView`; bản phụ huynh `parentStatsView` trong khu phụ huynh). Thêm số liệu → sửa RPC + test rls.test.mjs mục 13.
- **Không được dựng lại màn hình khi cùng 1 phiên:** supabase-js phát lại `SIGNED_IN` mỗi lần app/tab được mở lại sau một lúc; `main.js` chỉ cập nhật phiên nếu cùng người dùng (lỗi cũ: bé đang học bị đẩy về danh sách bài). Bé đang học được nhớ trong `sessionStorage` (`state.activeChildId`), nên trang bị hệ điều hành thu hồi rồi nạp lại vẫn vào lại khu học.
- **Khu admin tải lại không được làm nhảy trang:** mọi `mount(box)` của tab dùng `beginLoad(box)` (`admin/view.js`) — giữ nội dung + chiều cao cũ trong lúc tải, trả lại vị trí cuộn sau khi vẽ. Đừng `box.replaceChildren("Đang tải…")` khi vùng đã có nội dung.
- **Âm thanh cho bé:** `audio.js` tải trước NGUYÊN file (blob, `prefetchItems` khi mở bài) rồi phát từ bộ nhớ; SW không cache phản hồi 206 và bỏ qua yêu cầu Range (iOS Safari). Danh sách chủ đề/bài nhớ 60 giây (`child/api.js`, `clearCache()` khi bé thoát).
- Đừng để 1 hàm "tải dữ liệu" gánh việc ẩn (hiện khung UI...). Chỉ tải dữ liệu màn hình đang cần.

## Kiểm thử

- **Hàm thuần + Worker + CSV + TTS:** `node tests/unit.test.mjs`, `node tests/admin.test.mjs` (120 kiểm tra) và `node tests/curriculum.test.mjs` (CSV giáo trình) — không cần cài gì.
- **SQL + RLS chéo vai trò:** `npm i --no-save @electric-sql/pglite` rồi `node supabase/tests/rls.test.mjs` (144 kiểm tra) và
  `node supabase/tests/seed.test.mjs` (9). Chạy MỌI migration theo thứ tự trên Postgres trong bộ nhớ, giả lập auth/role của Supabase
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
**Khu admin (bước 3):** tab *Nội dung* (chủ đề/bài/mục từ, duyệt/ẩn, sửa tại chỗ, nghe thử, sinh TTS còn thiếu hoặc từng ô, tải giọng người
thật, xoá kèm dọn file), *Nhập CSV* (kiểm tra + xem trước + chặn khi còn lỗi, file mẫu, câu lệnh cho AI), *Phụ huynh* (RPC tổng quan, ghi nhận
học phí, cấp thêm con, khoá/mở), *Học phí & thanh toán* (hàng chờ xác nhận, mức học phí, lịch sử), *Cài đặt*. Đã thử bằng dữ liệu giả.
- **Âm thanh:** file TTS sinh qua `/api/tts`; mục chưa có file thì khu trẻ tạm dùng giọng đọc của trình duyệt (`speakFallback`).
- Chấm phát âm bỏ từ loại đầu ("con", "màu", "quả"...) khi so khớp — nếu không, nói sai cả con vật vẫn ~50 điểm.

**Giọng TTS:** tab Cài đặt chọn giọng nữ + nam theo ngôn ngữ (nghe thử trước), tab Nội dung có ô ♀/♂ và "Sinh lại TTS bằng giọng hiện tại" (giữ giọng người thật); bé/phụ huynh chọn giọng nghe (migration 005).
**Giáo trình:** đã có khung + 176 từ (Cấp 1) + 64 câu (Cấp 2) + **383 mục học vần + chữ hoa (Cấp 3, 62 bài)**, **208 mục đọc hiểu/chính tả/viết (Cấp 4, 29 bài)**; chữ hoa, đánh vần từng phần, tô chữ/viết tay, đọc to cả đoạn có chấm điểm chưa làm — xem `giao-trinh/…md` mục 7. **Lưu ý kiểm cú pháp:** dùng `node --input-type=module --check < file.js` (`node --check file.js` bỏ sót lỗi trong file ES module).

**Chưa làm:** hoạt động phân loại (`sort`, cần nhóm/thể loại cho mục từ), dashboard phụ huynh (tiến độ, chế độ cùng học), chi tiết từng bé
trong tab Phụ huynh, giới hạn thời gian/ngày, thu âm giọng người thật ngay trong app, vai trò giáo viên hỗ trợ, xuất/xoá dữ liệu con,
icon PNG (iOS cần `apple-touch-icon`), hình linh vật/avatar thật, thông báo nhắc học.
**Chưa thử với Supabase/Storage/TTS thật:** đăng ký/đăng nhập/xác nhận email, đọc nội dung qua RLS với phiên thật, tải file lên Storage,
gọi Azure/Google TTS thật, nhúng bảng của PostgREST (`select('*, a(b)')`).

## Cách làm việc

Việc lớn (dữ liệu, phân quyền, học phí/số con) → lập kế hoạch, xin duyệt trước khi code; việc nhỏ
(chữ/màu/bố cục) → làm thẳng, chỉ soát cú pháp. Trả lời ngắn gọn, nêu khuyến nghị + đánh đổi chính.
Mọi bảng mới phải có RLS + kiểm thử chéo giữa các vai trò.
