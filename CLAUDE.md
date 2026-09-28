# Tôi luyện tiếng Việt

PWA học tiếng Việt cho trẻ gốc Việt 3–8 tuổi. Nguồn sự thật đầy đủ:
`YEU_CAU_APP_TIENG_VIET_CHO_TRE_EM.md` (đọc bằng Grep/offset, đừng đọc nguyên file). Độc lập với
iLapra (`D:\LangPrac`), chỉ mượn mẫu thiết kế. **Chủ dự án tự chạy git** — đừng commit/push.

**File này chỉ giữ luật + sự thật HIỆN TẠI, ngắn gọn.** Tường thuật "đã sửa gì/lỗi gặp ra
sao/ngày nào" → `CHANGELOG.md` (chỉ mốc LỚN, không tự nạp lại mỗi phiên). Thêm mục mới vào
CLAUDE.md: viết 1–3 dòng nêu sự thật, đừng kể quá trình sửa. Xem "Cách làm việc" cuối file —
**bắt buộc áp dụng nghiêm túc** để tiết kiệm token/thời gian mỗi lượt.

## Cấu trúc

- `public/` = deploy (KHÔNG đặt docs/migration/CSV vào đây). `index.html` = landing tĩnh; nút
  "Vào học" → `/app/`. `app/index.html` = app thật, mọi đường dẫn TUYỆT ĐỐI (`/css/...`, `/js/...`).
  `manifest.json`, `sw.js` (mạng-trước; cache-trước `/vendor/` + media Storage; đổi `VERSION` khi
  đổi vendor/route), `css/app.css`. `vendor/supabase/` tải sẵn (`vendor-supabase.mjs`, không CDN).
  `vendor/mascot/rooster.png` = ảnh gà trống THẬT (không emoji 🐓) — xem "Mascot" dưới.
- `js/` ES modules thuần, không build/`package.json`: `main.js` (boot) · `flow.js`
  (`decideScreen()` = luồng vào app) · `state.js` · `config.js` · `supabase.js` · `strings.js`
  (MỌI chữ giao diện, chỉ tiếng Việt) · `pin.js` · `audio.js` (`pickAudio`) · `pronunciation.js` ·
  `data.js` (avatar) · `ui.js` (`el()`) · `payments.js` · `pages/<màn>.js` (export `mount(root)`) ·
  `child/` (khu học trẻ) · `bb/` (khu học "Bài Bản", mirror `child/`) · `admin/` (mỗi tab 1 file
  `content|bb|record|parents|billing|settings.js`; tab "Trẻ em"/"Bài Bản" MỖI TAB TỰ NHÚNG "📄 Nhập
  CSV hàng loạt" riêng; `csv.js`/`bb-csv.js` [hàm thuần], `ops.js`/`bb-ops.js`, `notice.js`).
- `worker.js`+`tts.js`+`wrangler.jsonc` = Cloudflare Worker (`public/`, `/api/config`, `/api/tts`
  CHỈ admin). `main` KHÔNG đặt `_worker.js`.
- `giao-trinh/csv/` = CSV khu Trẻ em; `giao-trinh/bai-ban/` = CSV riêng Bài Bản (KHÁC schema, lẫn
  vào `csv/` làm `seed.test.mjs` báo lỗi giả). Không deploy. Sửa CSV → `node tests/curriculum.test.mjs`.
- `supabase/migrations/NNN_*.sql` chạy TAY; `seed/` dữ liệu mẫu; `tests/` test SQL (PGlite);
  `tests/` (gốc) test JS; `tests/browser/mock-sb.js` Supabase giả; `scripts/dev-server.mjs` local.

## Mô hình triển khai

1 trung tâm = 1 Worker + 1 Supabase riêng, chung mã nguồn. Cấu hình (`CENTER_NAME`,
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `LANGUAGES`, `BRAND_COLOR`) ở Cloudflare Dashboard → Variables
(KHÔNG ghi `wrangler.jsonc`). Local: sao `.dev.vars.example`→`.dev.vars`, `npx wrangler dev`.
Không có `center_id` ở bảng nào.

`LANGUAGES` = danh sách `mã:Tên` bất kỳ; UI đọc động từ `CONFIG.languages`, KHÔNG hardcode.
`giao-trinh/csv/*.csv` có sẵn cột `de,en,fr,ko,ja`; `validateRows` chỉ đọc cột khớp `LANGUAGES`,
cột thừa chỉ cảnh báo. Thêm ngôn ngữ mới: cột CSV + `seed/002_title_translations.sql` +
`tts.js DEFAULT_VOICES` nếu cần TTS; `admin/dict.js` không tự có — admin gõ tay (không bịa).

Dựng bản mới: Supabase mới → chạy `001_init.sql`…`025_bb_unit_title_tr.sql` theo thứ tự → đăng ký
1 tài khoản → `update accounts set role='admin' where email='...'` → biến Cloudflare (+`TTS_PROVIDER`/
`TTS_KEY`/`TTS_REGION` nếu dùng TTS) → deploy. Mẫu tuỳ chọn: `seed/001_sample_content.sql`.

## Quy tắc dễ sai

- `decideScreen()`: thứ tự điều kiện LÀ LUẬT của luồng vào app — thêm màn mới phải chèn đúng chỗ.
- `/` = landing, app ở `/app/`; đường dẫn trong `app/index.html` phải TUYỆT ĐỐI. "Cài app về máy"
  ở `pages/auth.js` (`T.install`/`T.legal`, link `dieu-khoan.html`/`chinh-sach-bao-mat.html` —
  nháp AI, cần luật sư rà trước khi công khai).
- **Mascot:** `vendor/mascot/rooster.png` (ảnh thật, KHÔNG emoji/Twemoji). `emoji.js`:
  `mascotIcon(class)`, `mascotHero()` (dùng ở MỌI màn "gà trống đứng một mình" — đừng tự dựng bằng
  `emojiNodes`). Đổi ảnh → tăng `VERSION` sw.js + build lại `icons/icon.svg` (nhúng base64).
- Trẻ KHÔNG đăng nhập, chạy bằng phiên phụ huynh; avatar hiện TẤT CẢ (đóng vai mật khẩu hình). Khu
  phụ huynh: PIN 4 số (`askPin()`), khoá 5 phút sau 5 lần sai (lưu thiết bị).
- `accounts.child_slots` (mặc định 1) ép bằng TRIGGER; trần `settings.max_children` (6), chỉ admin
  tăng (qua `payments`). Phụ huynh không sửa `role/access_*/child_slots` (`accounts_guard`).
  `accounts.phone`/`address` (tuỳ chọn) hỏi ở `setup-pin.js`, sửa ở khu phụ huynh.
- Hết hạn (`isExpired()`) → chỉ còn màn gia hạn + đăng xuất. RLS: học/ghi tiến độ cần
  `has_access()`; đọc dữ liệu con thì không.
- `payments`: phụ huynh chỉ tạo `pending` (giá từ `tuition_plans`, trigger); admin xác nhận →
  trigger cộng hạn/tăng slot. Phí con thêm trả 1 lần, gia hạn sau không cộng lại. Admin ghi hộ =
  chèn rồi xác nhận (`billing.recordPayment`).
- Âm thanh đích = TTS file sẵn (`content_audio`, chọn qua `pickAudio()`); giọng trình duyệt chỉ TẠM
  (`speakFallback`). iOS chỉ phát sau cú chạm.
- **Chấm phát âm** (`pronunciation.js`, hàm thuần): so THEO TỪNG TIẾNG `ok`/`tone`(0,5)/
  `initial`(0,4)/`close`(0,3)/`wrong`/`missing`, bỏ từ loại đầu. KHÔNG đo âm học thật → chỉ là GỢI
  Ý, không hiện điểm cho bé. Lưu `pronunciation_attempts.detail` (không lưu file ghi âm — giọng trẻ
  qua Google/Apple là vấn đề GDPR cần tư vấn trước khi công khai).
- PostgREST cắt ở 1000 dòng — lọc hẹp phải `.range()`. RLS thiếu quyền → 0 dòng, không báo lỗi.
- **Khu admin (Trẻ em):** trẻ chỉ thấy `approved` — duyệt bài phải duyệt cả chủ đề chứa nó. CSV
  luôn tạo NHÁP, nhập lại không trùng (khớp tên không phân biệt hoa/thường), ô trống không xoá dữ
  liệu cũ. `act(fn, okText)`: `fn` PHẢI `return false` khi Huỷ `confirm()`. `/api/tts` kiểm admin
  qua RPC `is_admin`; giọng ưu tiên: admin chọn > `TTS_VOICES` > `DEFAULT_VOICES`. Giới giọng đoán
  từ TÊN nếu `TTS_VOICES` là chuỗi (`voice-names.js guessGender`).
- **Thêm nhanh** (`admin/quickadd.js`+`autofill.js`+`dict.js`): admin gõ chữ Việt, điền sẵn theo
  thứ tự CSDL > `dict.js` > luật — không tìm ra thì TRỐNG, không bịa. KHÔNG dùng AI/dịch máy (đã
  thử rồi gỡ — xem CHANGELOG.md).
- **Giọng nữ/nam:** `content_audio.gender`; bé chọn qua `child_profiles.voice_gender` >
  `accounts.voice_pref.gender` > nữ. Giọng TRẺ EM tiếng Việt chỉ có bằng thu người thật.
- **Cấp học:** `units.level` 1–4 (🥚🐣🐥🐓, không khoá, chỉ gợi ý). Đạt cấp = ≥80% từ mastery ≥3.
  Nội dung: Cấp1=học vần, Cấp2=từ vựng, Cấp3=câu ngắn, Cấp4=đọc hiểu (đã đảo, xem CHANGELOG.md).
  Đổi cấp → rà `admin/autofill.js defaultKinds()`, `child/pools.js sortable()`, `levels.js focus`,
  và mọi chỗ so `.level` với số cứng thay vì `LEVELS`/`levelOf()`.
- Cấp 3 (học vần): `content_items.say_vi` = chữ ĐỌC khác chữ hiển thị; `viet.js` = hàm thuần ngữ
  âm. Cấp 4 (đọc hiểu): `item_type='question'`, `extra={choices,answer}`, tách khỏi `items` ở
  `lesson.js`. Twemoji (`emoji.js`, CC-BY — giữ ghi công); `content_items.pic` (literal/decor)
  quyết định hoạt động chọn-theo-hình; ảnh riêng `image_path` ưu tiên hơn emoji.
- Thu giọng người thật (`admin/record.js`): Web Audio→`wav.js` (hàm thuần) → Trẻ em ghi
  `content_audio` nhiều-dòng, Bài Bản ghi `bb-ops.setAudioPath` (cột phẳng, ghi đè). Ngân hàng âm
  (`sounds.js`+`admin/bank.js`) dùng chung cho `spell_along` (đánh vần theo phần).
  Chữ hoa (`"A a"`, `child/activities/casing.js`), Tô chữ (`trace`, phông Playwrite VN,
  `scoreTrace` chấm theo MẢNH, GĐ1 không kiểm nét) tự sinh hoạt động từ dữ liệu, không cần cột mới.
- Tên dịch (`units/lessons.title_tr` jsonb) qua nút "🌐"/CSV `unit_<lang>`/`lesson_<lang>`; diễn
  giải (`.description`, text thuần, KHÁC `title_tr`) qua ✎ Sửa. Seed:
  `002_title_translations.sql`/`003_lesson_descriptions.sql`/`004_unit_descriptions.sql`.
- **Luyện tập theo kỹ năng** (Trẻ em): 📖 Học | 🎮 Luyện tập
  độc lập, chơi trên MỌI nội dung đã duyệt. `child/skills.js GROUPS/SKILLS`; 3 kỹ năng
  `story:true` (1 lượt = cả 1 bài). Lọc mục ở `child/pools.js POOLS/feasible` (sửa ở đó, đừng lọc
  trong thân trò). Thêm trò mới → `RUNNERS`, `POOLS`, `SKILLS`, SQL `skill_of()`, `TEXT_KINDS`.
- `state.activeChildId` (sessionStorage) giữ bé đang học qua `SIGNED_IN` lặp lại. Khu admin tải lại
  dùng `beginLoad(box)` (`admin/view.js`) — giữ vị trí cuộn, đừng tự `replaceChildren("Đang tải…")`.
- **Header/footer dùng chung mọi màn điều hướng chính** (`child/media.js`: `profileHeader(onExit)`
  avatar+tên+giọng+Thoát, `sessionFooter()` liên hệ — `bb/media.js` re-export cho khu Bài Bản). Nút
  Thoát LUÔN về `avatars` (`state.activeChildId=null`, KHÔNG set `state.parentOpen`). Màn đang chơi
  1 bài/1 chặng cụ thể KHÔNG dùng — giữ header riêng (tiến độ + thoát lượt).
  `audio.js` tải trước NGUYÊN file rồi phát từ bộ nhớ (SW không cache 206/iOS). Đừng để 1 hàm "tải
  dữ liệu" gánh việc ẩn/hiện UI.
- **`replaceChildren()` gốc (khác `el()`) KHÔNG lọc null/dàn phẳng mảng** → hiện thẳng
  `"null"`/`"[object HTMLDivElement],…"` lên màn hình. LUÔN bọc `el("div", null, ...)` trước khi
  gắn trực tiếp — gặp bẫy này ở CẢ `admin/bb.js` lẫn `bb/practice.js`.
- **"Tiếng Việt Bài Bản"** (giáo trình cho người lớn/nước ngoài, CÙNG app/tài khoản, không phải
  app riêng; lịch sử/quyết định: `CHANGELOG.md`).
  Schema (`022_bai_ban.sql`, đầu tiên tạo bảng mới sau 001): `bb_levels`(CEFR/A0)→`bb_units`→
  `bb_lessons`(`lesson_type` core/review/reading/writing)→`bb_lesson_steps`(7 loại: dialogue/vocab/
  grammar/phonics/minigame/reading/writing)→bảng nội dung riêng (`bb_dialogue_lines`, `bb_vocab`,
  `bb_grammar`, `bb_phonics_pairs`, `bb_reading_passages`+`_questions`, `bb_writing_tasks`);
  minigame KHÔNG có bảng riêng, chạy runtime từ 4 loại kia CÙNG BÀI. RLS tái dùng
  `is_admin()`/`has_access()`. `child_profiles.profile_type`(`child`|`learner`) vào được từ avatar
  như nhau; `decideScreen()` rẽ `bai-ban-home`/`child-home` theo đó.
  Mã (`public/js/bb/`, mirror `child/`): `api.js` (chỉ `approved`), `media.js` (dùng lại
  `speakFallback`/`nativeLang`/`titleIn`/`titleSpeakers` từ `child/media.js`), `pron.js` (không
  lưu), `runner.js` (`runLesson()` = **LƯỚI CHỌN CHẶNG TỰ DO**: vào bài thấy mọi chặng CÓ DỮ LIỆU,
  chạm chặng nào học chặng đó, xong ✓ tự về lưới; ẩn chặng rỗng qua `hasContent()`, minigame qua
  `minigame.feasible()`), `skills.js` (`GROUPS`/`SKILLS`, 4 kỹ năng — Từ vựng có box Leitner, 3 còn
  lại chỉ "xem lại"), `practice.js` (lưới theo nhóm + `resultScreen()` chung), `srs.js` (Leitner),
  `practice-core.js` (`pickSession()`), `steps/*.js` (1 renderer/loại, `run(box, step[, pool])`).
  `pages/bai-ban-home.js`: Level→Unit→Lesson + Home (Học/Luyện tập). Theme `body.bb-theme` chỉ đổi
  biến CSS — tái dùng tối đa `.unit-grid`/`.unit-card`/`.skill-grid`… của khu trẻ em.
  Tiến độ (`023_bb_progress.sql`): `bb_progress`(chặng xong)+`bb_srs_state`(ôn tập, không FK, code
  tự kiểm). `api.loadStepProgress()` (✓ trong 1 bài) / `loadLessonProgress()` (✓ tổng ở danh sách —
  mẫu số CHỈ tính chặng có dữ liệu thật).
  Admin: tab "Bài Bản" (`admin/bb.js`+`bb-ops.js`), cây Cấp→Chủ đề→Bài→Chặng, duyệt LAN LÊN/ẩn LAN
  XUỐNG. CSV (`admin/bb-csv.js`): 1 dòng = 1 dòng nội dung 1 CHẶNG; cột `unit_<lang>`/`lesson_<lang>`
  CHỈ áp dụng lúc TẠO MỚI. TTS ghi `audio_path` phẳng (ghi đè, khác `content_audio` nhiều-dòng).
  Nội dung thật (GĐ 7, đang soạn — CHƯA qua người biết tiếng Việt rà): A0
  (`bai-ban-a0-bang-chu-cai-ngu-am-thanh-dieu.csv`, sinh từ `sounds.js`/`viet.js` không tự bịa) +
  A1 (`bai-ban-a1-chao-hoi-gia-dinh.csv`, 4 chủ đề: Chào hỏi/Gia đình/Số đếm/Màu sắc) — cả 2 ở
  `giao-trinh/bai-ban/`. Seed `005_bb_a1_title_translations.sql` chỉ cần cho bản ĐÃ nhập CSV
  trước khi có cột `unit_<lang>`.

## Test + local

- JS thuần: `node tests/{unit,admin,practice,autofill,curriculum,bb}.test.mjs`.
- SQL/RLS: `npm i --no-save @electric-sql/pglite` rồi `node supabase/tests/{rls,seed}.test.mjs`
  (PGlite, giả lập auth/role). **Mỗi migration/bảng mới → thêm test vào rls.test.mjs.** Không mô
  phỏng Storage/PostgREST nhúng bảng — chỉ kiểm được trên Supabase thật.
- Local: `node scripts/dev-server.mjs` (hoặc `preview_start "dev"`), đọc `.dev.vars`. Dữ liệu giả:
  dev-server phục vụ `tests/browser/*` ở `/__tests/` — `installMock(sb, {...})` rồi gán
  `state.session/account/children` + `render()`.
- Cú pháp: `node --input-type=module --check < file.js` (KHÔNG dùng `node --check`, bỏ sót lỗi ES
  module).

## Còn thiếu

Phân loại (`sort`) khu Trẻ em; dashboard phụ huynh chi tiết; giới hạn giờ/ngày; giáo viên hỗ trợ;
xuất/xoá dữ liệu con; icon PNG iOS; avatar thật cho bé. **Đang làm chính: Bài Bản GĐ 7** (soạn đủ
nội dung thật, mới A0+A1 một phần). Chưa thử Supabase/Storage/TTS thật (đăng ký/email/RLS
phiên/Storage/Azure-Google TTS/nhúng bảng PostgREST).

## Cách làm việc

Việc lớn (dữ liệu, phân quyền, học phí, đổi luồng chính) → lập kế hoạch, xin duyệt trước khi code;
việc nhỏ → làm thẳng, chỉ soát cú pháp. Trả lời ngắn gọn. Mọi bảng mới phải có RLS + test chéo.

**Tiết kiệm token/thời gian (bắt buộc, chốt 2026-09-29):**
1. KHÔNG viết tường thuật dài vào `CLAUDE.md` — chỉ 1–3 dòng sự thật/luật. Mốc LỚN mới ghi
   `CHANGELOG.md` (vài dòng); sửa nhỏ/vá lỗi thì KHÔNG ghi ở đâu cả, để git log tự lưu.
2. Đọc file lớn bằng Grep/offset, KHÔNG Read nguyên file khi chỉ cần 1 đoạn.
3. Test: chỉ chạy file test liên quan lúc đang sửa; chạy đủ bộ **1 lần** lúc cuối, không lặp lại.
4. Đừng nhúng payload lớn (base64, CSV nguyên file…) thẳng vào lệnh gọi tool — ghi file tạm rồi
   dùng đường dẫn.
5. Mức kiểm tra tương xứng rủi ro: sửa chữ/CSS nhỏ → không cần bật trình duyệt dò từng bước; chỉ
   việc lớn (schema, luồng, logic tính điểm) mới cần thử kỹ qua trình duyệt.
6. Gộp nhiều bước trình duyệt vào `browser_batch` thay vì gọi tuần tự nhiều lần.
