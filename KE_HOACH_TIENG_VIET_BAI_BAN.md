# Kế hoạch: "Tiếng Việt Bài Bản" — giáo trình có cấu trúc cho người lớn/người nước ngoài

> Lưu lại từ artifact "Tiếng Việt Bài Bản" (claude.ai) để có nguồn sự thật cục bộ trong repo — đọc mục liên quan
> bằng Grep/offset, đừng đọc nguyên file. **Trạng thái: Giai đoạn 1 (nền dữ liệu), Giai đoạn 2 (luồng chọn hồ sơ),
> Giai đoạn 3 (giao diện học 7 chặng) và Giai đoạn 4 (Luyện tập/SRS) ĐÃ LÀM.** Các giai đoạn 5–7 CHƯA làm.

## 0. Đã chốt

- **Đây là 1 GIAO DIỆN HỌC KHÁC trong CÙNG 1 app**, cùng tài khoản phụ huynh, cùng dự án Supabase — **KHÔNG** phải
  app/hệ thống riêng, **KHÔNG** có mô hình thu phí riêng. Người học bài bản dùng lại nguyên `child_profiles` +
  `child_slots`/`tuition_plans`/phí thêm con 20% đã có, chỉ thêm cột `profile_type` (`child` | `learner`).
- **Không khoá bài** — giống hệt app trẻ em, chỉ gợi ý "Học tiếp", người học tự chọn Level/Unit/Bài bất kỳ.
- **7 chặng/bài** (không phải 5): Hội thoại → Từ vựng → Ngữ pháp → Ngữ âm → Mini-game → **Đọc hiểu** → **Luyện viết**
  (2 chặng cuối bổ sung so với bản đề xuất gốc, để bù khoảng trống "chưa có bài đọc/viết riêng" của tài liệu nguồn).
- **Dùng lại nguyên công nghệ/UI đã làm cho app trẻ em**: `ui.js` `el()`, `audio.js`, `pronunciation.js` (Web Speech
  API), pipeline TTS `/api/tts`, quy ước CSV admin — không xây lại từ đầu.
- Cần 1 màn "Luyện tập" riêng cho người học, theo mô hình `skills.js` + `practice-core.js` (hàm thuần, có test)
  nhưng danh mục kỹ năng khác app trẻ em (SRS từ vựng kiểu Leitner, ôn hội thoại, ôn ngữ pháp/ngữ âm).

## 1. Nhận xét tài liệu nguồn (`giao-trinh-tieng-viet-app-v3.md`, tổng hợp từ Tiếng Việt 123 + Quê Việt)

Đã đọc toàn bộ 31 bài (8 Unit, A1–A2). Phương pháp tốt, nên giữ:

- Mô hình 4 trụ cột: hội thoại thật → từ vựng trực quan → công thức ngữ pháp → ma trận ngữ âm.
- "Công thức hình họa" cho ngữ pháp (vd `Chào + đại từ`) — dễ số hoá thành bài tập kéo-thả.
- Mỗi Unit có 1 "Boss" cuối gộp kiến thức thành 1 tình huống nhập vai.
- Đã phân biệt Bắc/Nam ngay trong từ vựng (bố/ba, bát/chén).

Khoảng trống đã biết trước (bù bằng 2 chặng Đọc hiểu/Luyện viết mới, xem mục 0):

- Thiếu kỹ năng đọc đoạn văn dài / luyện viết câu-đoạn riêng.
- Unit 7 không có bài ôn riêng (nhảy thẳng bài 28 → Unit 8); bài 31 gộp ôn 2 unit cuối, không đều với các unit trước.
- Thiếu vài chủ đề thường gặp ở giáo trình A1–A2: khách sạn/đặt phòng, xin việc/phỏng vấn, gọi điện thoại, mua quần
  áo theo size, chỉ đường rẽ trái/phải chi tiết.
- 31 bài (~10–13 giờ nội dung) là khởi đầu tốt, chưa phải "đầy đủ A1–A2 thật" (CEFR ước ~100–200 giờ để đạt A1→A2 từ
  số 0; "Elementary Vietnamese" 14 bài/1 cấp; "Quê Việt" 6 quyển trải A/B/C — quy mô 1 series nhiều sách).

## 2. Khung phân cấp — ĐÃ LÀM ở migration 022

Giữ nguyên 4 tầng đề xuất gốc (Level → Unit → Lesson → Step), chuẩn hoá để KHÔNG giới hạn cứng "2 cấp/8 unit/31 bài".

| Tầng | Bảng | Ghi chú |
|---|---|---|
| LEVEL | `bb_levels` | Mã CEFR (A1, A2, B1…) — không dùng số 1/2/3/4 kiểu app trẻ em. `code`, `name_vi`, `can_do` (can-do statement), `sort_order`, `status`. |
| UNIT | `bb_units` | Chủ đề lớn, thuộc 1 level. `title_vi`, `emoji`, `description`, `sort_order`, `status`. |
| LESSON | `bb_lessons` | `title_vi`, `title_tr` (jsonb, tên dịch theo `LANGUAGES`), `lesson_type` (`core`\|`review`\|`reading`\|`writing`), `description`, `sort_order`, `status`. |
| STEP | `bb_lesson_steps` | Chặng tuần tự trong 1 bài. `step_type` (`dialogue`\|`vocab`\|`grammar`\|`phonics`\|`minigame`\|`reading`\|`writing`), `config` (jsonb, vd mini-game chọn engine), `sort_order`, `status`. |

Bảng nội dung riêng theo từng loại chặng (khoá bằng `step_id → bb_lesson_steps`):

- `bb_dialogue_lines` (chặng Hội thoại): `speaker`, `line_vi`, `line_tr`, `audio_path`, `sort_order`.
- `bb_vocab` (chặng Từ vựng): `word_vi`, `pos` (loại từ), `meaning` (jsonb theo ngôn ngữ), `image_path`, `audio_path`.
- `bb_grammar` (chặng Ngữ pháp): `formula`, `formula_tr`, `examples` (jsonb mảng `{vi, tr}`).
- `bb_phonics_pairs` (chặng Ngữ âm): `sound_a`, `sound_b`, `examples`, `audio_a_path`, `audio_b_path`.
- `bb_reading_passages` + `bb_reading_questions` (chặng Đọc hiểu): đoạn văn + câu hỏi trắc nghiệm (`choices`/`answer`,
  cùng quy ước `content_items.extra` của Cấp 4 app trẻ em).
- `bb_writing_tasks` (chặng Luyện viết): `task_type` (`fill`\|`order`\|`write`), `prompt_vi`, `prompt_tr`, `content`
  (jsonb, hình dạng tuỳ `task_type`).
- Mini-game (chặng `minigame`) **không có bảng nội dung riêng** — chạy runtime từ `bb_vocab`/`bb_phonics_pairs` của
  chính bài đó (làm ở GĐ 4).

RLS: **tái dùng `is_admin()`/`has_access()`** — admin xem/sửa hết; người dùng chỉ đọc mục `approved` khi còn hạn,
đúng luật nội dung trẻ em. Bảng nội dung theo chặng đọc được khi CHẶNG CHA đã duyệt (không có status riêng).

`child_profiles.profile_type` (`child` | `learner`, mặc định `child`) — **không đổi** trigger `child_profiles_limit`
(vẫn tính vào `child_slots`) hay `accounts_guard`/`payments_before_update` (phí thêm con 20%).

## 3. Mô hình dữ liệu — mức khái niệm (tham khảo, đã cụ thể hoá ở mục 2)

| Khối | Vai trò | Tận dụng hay mới |
|---|---|---|
| `bb_levels` | A1, A2, B1… + can-do | Bảng mới |
| `bb_units` | Chủ đề lớn | Tận dụng cách làm của `units` |
| `bb_lessons` | Bài, có `lesson_type` | Tận dụng cách làm của `lessons` |
| `bb_lesson_steps` | 7 chặng tuần tự/bài | Bảng mới — khác biệt cốt lõi so với app trẻ em |
| `bb_vocab`/`bb_dialogue_lines`/`bb_grammar`/`bb_phonics_pairs` | Nội dung chi tiết từng chặng | Tận dụng hạ tầng TTS/CSV, schema riêng |
| mini-game (runtime) | 5 engine: flashcard SRS, sentence builder, dialogue roleplay (chấm phát âm), phonics discrimination, unit boss quest | Tận dụng `pronunciation.js` nguyên vẹn cho Dialogue Roleplay |
| `learner_profiles` = `child_profiles` mở rộng | Hồ sơ người học | Tận dụng nguyên bảng + `child_slots`/phí 20%, chỉ thêm `profile_type` |
| `bb_progress`/`bb_srs_state` | Tiến độ + điểm SRS (Leitner) | Bảng mới (GĐ 4) — chưa làm |

## 4. Luồng trải nghiệm học (GĐ 2–3, chưa làm)

```
Chọn hồ sơ (👤 người học, cạnh 👶 các con) → Chọn Level (A1/A2…) → Lưới 8 Unit + % hoàn thành
  → Danh sách bài (gợi ý "Học tiếp", không khoá) → 7 chặng tuần tự → Kết quả + SRS nhắc ôn từ
```
Bài `review` (Boss) hiện đủ, tính vào tiến độ, **không** bị ẩn/khoá — dùng nguyên logic "không khoá bài" đã có.

## 5. Quy mô "đầy đủ" (tham khảo, KHÔNG làm ngay)

| Cấp | Tình trạng | Unit ước tính | Bài ước tính | Ghi chú |
|---|---|---|---|---|
| A1 | Đã có 4 unit / 16 bài | 8–10 | 32–40 | Bổ sung: khách sạn, xin việc, điện thoại, mua sắm quần áo |
| A2 | Đã có 4 unit / 15 bài | 8–10 | 32–40 | Bổ sung 1 bài `reading` + 1 bài `writing` mỗi unit |
| B1 | Chưa có | 8–10 | 32–40 | Để sau — chỉ cần kiến trúc không chặn thêm cấp mới |

## 6. Quyết định đã chốt

✓ Không khoá bài · ✓ Bổ sung đọc/viết ngay từ đầu (7 chặng) · ✓ Dùng lại nguyên công nghệ/UI app trẻ em ·
✓ Cần màn "Luyện tập" riêng, tái dùng `skills.js` + `practice-core.js` · ✓ Không phải app riêng — 1 giao diện khác
trong cùng app, cùng tài khoản/Supabase/`child_slots`/phí thêm con.

## 7. Lộ trình triển khai (7 giai đoạn)

Khuyến nghị: làm hết GĐ 1–3 cho **1 Unit duy nhất** (3 bài + 1 ôn tập, đủ 7 chặng) trước, chạy thông suốt từ DB →
giao diện → luyện tập, rồi mới mở rộng ra 8 unit.

| GĐ | Nội dung | Trạng thái |
|---|---|---|
| 1 | **Nền dữ liệu**: migration `bb_levels/bb_units/bb_lessons/bb_lesson_steps` + bảng nội dung theo từng loại chặng; cột `profile_type` vào `child_profiles` (KHÔNG đổi trigger `child_slots`/phí 20%); RLS tái dùng `has_access()`, test `rls.test.mjs`. | **✅ ĐÃ LÀM** — migration `022_bai_ban.sql`, test mục 24 (26 kiểm tra, `supabase/tests/rls.test.mjs`) |
| 2 | Luồng chọn hồ sơ + `decideScreen()`: thêm bước chọn loại (Trẻ em / Người học bài bản); sửa `decideScreen()` — CHÈN đúng chỗ theo `profile_type`, không append cuối. | **✅ ĐÃ LÀM** — xem mục 8 dưới đây cho chi tiết luồng + file đã sửa |
| 3 | Giao diện học (1 Unit mẫu, đủ 7 chặng): Level → Unit → Lesson (không khoá bài); 1 "runner" chạy tuần tự 7 chặng, mỗi chặng 1 renderer riêng; tái dùng `ui.js`, `audio.js`/`pronunciation.js`; theme CSS riêng để phân biệt trực quan với giao diện gà trống. | **✅ ĐÃ LÀM** — xem mục 10 dưới đây |
| 4 | Màn "Luyện tập" cho người học: SRS từ vựng kiểu Leitner, ôn hội thoại, ôn ngữ pháp/ngữ âm — theo mô hình `skills.js` + `practice-core.js`. | **✅ ĐÃ LÀM** — xem mục 12 dưới đây |
| 5 | Khu admin nhập nội dung: tab mới soạn bài bài bản — tái dùng quy ước CSV-nhập-được + pipeline TTS (`/api/tts`, `ops.js`), chỉ đổi schema mapping cho 7 chặng. | Chưa làm |
| 6 | Test + thử bằng dữ liệu giả: test hàm thuần (chọn phiên luyện tập, tính điểm SRS), test RLS chéo vai trò cho bảng mới, thử qua `mock-sb.js` trước khi đụng Supabase thật. | Chưa làm (GĐ 1 đã có phần test RLS) |
| 7 | Soạn nội dung thật (ngoài phạm vi code): chuyển `giao-trinh-tieng-viet-app-v3.md` thành CSV/JSON theo schema mới, nhập dần qua khu admin cho đủ 8 Unit/31+ bài, rồi mở rộng theo mục 5. | Chưa làm |

## 8. Giai đoạn 2 — luồng chọn hồ sơ + `decideScreen()` (ĐÃ LÀM)

**Quyết định khi làm (không lệch kế hoạch, chỉ cụ thể hoá):** màn hình avatar-mật khẩu ở mặt trước app (`avatars.js`)
là cơ chế dành cho TRẺ EM tự bấm vào học — hồ sơ `profile_type='learner'` KHÔNG hiện/khớp được ở đó (đúng câu đã
chốt trong artifact: "Phụ huynh vào từ chính khu phụ huynh hiện có, chọn hồ sơ người học... để vào giao diện này").
Vì màn "Tạo hồ sơ" (`create-child.js`) trong app hiện tại **chỉ chạy được khi `children.length === 0`** (lần đầu
onboarding — không có UI thêm hồ sơ thứ 2+ trở đi trước khi làm việc này), nên GĐ 2 CŨNG thêm 1 lối vào nhỏ
("+ Thêm hồ sơ mới" trong khu phụ huynh, `state.creatingProfile`) để tính năng thật sự dùng được — nếu không, chỉ
tài khoản hoàn toàn mới (chưa có con nào) mới tạo được hồ sơ `learner`.

**File đã sửa:**
- `public/js/state.js` — thêm `state.creatingProfile` (reset trong `resetState()`).
- `public/js/flow.js` `decideScreen()` — chèn 2 nhánh mới ĐÚNG VỊ TRÍ (không append cuối):
  `state.creatingProfile` → `"create-child"` (ngay sau nhánh `children.length === 0`, cùng nhóm "cần tạo hồ sơ");
  `state.activeChildId` → tra `profile_type` của hồ sơ đang chọn, `'learner'` thì `"bai-ban-home"` thay vì
  `"child-home"` (thay hẳn dòng `if (state.activeChildId) return "child-home"` cũ).
- `public/js/pages/create-child.js` — thêm bước chọn **Loại hồ sơ** (`.tabs`, 2 nút "👶 Con của tôi" / "🎓 Người học
  bài bản") ở đầu form; nhãn "Tên"/"Chọn hình đại diện" đổi chữ động theo loại đã chọn (learner không dùng avatar
  làm "mật khẩu" nên chữ giải thích khác); có nút "Huỷ, quay lại" khi đến từ khu phụ huynh
  (`cameFromParent = children.length > 0`); `insert(...).select().single()` để lấy `id` vừa tạo — tạo hồ sơ
  `learner` thì **vào thẳng** `bai-ban-home` (set `state.activeChildId`), tạo hồ sơ `child` thì KHÔNG tự vào (giữ
  đúng hành vi cũ: bé phải tự bấm avatar).
- `public/js/pages/avatars.js` — khớp avatar chỉ với hồ sơ `profile_type !== 'learner'` (learner luôn báo
  "Chưa đúng rồi" ở màn hình này dù avatar đúng — cố tình, để buộc vào qua khu phụ huynh).
- `public/js/pages/parent.js` — thêm `learnerProfilesCard()` (danh sách hồ sơ `learner` + nút "Vào học", ẩn hẳn khi
  không có hồ sơ nào); danh sách hồ sơ ở thẻ tóm tắt đầu trang lọc bớt `learner` (đã có thẻ riêng, tránh trùng);
  nút "+ Thêm hồ sơ mới" hiện khi còn slot trống (`children.length < child_slots`) → `state.creatingProfile = true`.
- `public/js/pages/bai-ban-home.js` — trang MỚI, **chỉ là chỗ đứng** (chào tên + "đang xây dựng" + nút Quay lại) để
  luồng chạy được đầu-cuối; giao diện học thật (7 chặng, theme riêng) làm ở GĐ 3.
- `public/js/strings.js` — thêm các khoá `childProfileType/childType*/childNickname Learner/childPickAvatarLearner/
  childCancel/addProfileBtn/bbLearnersTitle/bbEnterBtn/bbHomeTitle/bbHomeGreeting/bbHomeComingSoon/bbHomeBack`.

**Đã thử bằng dữ liệu giả** (`tests/browser/mock-sb.js`, xem mục "Kiểm thử" CLAUDE.md): tạo hồ sơ đầu tiên là
`learner` → vào thẳng Bài Bản; bấm "Quay lại" → về khu phụ huynh, thấy thẻ "Hồ sơ học bài bản" + "Vào học" hoạt
động; "+ Thêm hồ sơ mới" tạo thêm 1 hồ sơ `child` → không tự vào, về lại khu phụ huynh, hiện đúng trong danh sách
con; màn hình avatar mặt trước: bấm avatar của hồ sơ `learner` → bị từ chối ("Chưa đúng rồi"); bấm avatar của hồ sơ
`child` → vào `child-home` bình thường. Chưa thử với Supabase thật (chỉ có RLS PGlite ở GĐ 1 + dữ liệu giả ở GĐ 2).

## 10. Giai đoạn 3 — giao diện học 7 chặng (ĐÃ LÀM)

**Thư mục mới `public/js/bb/`** (mirroring `public/js/child/`, tách biệt khỏi khu trẻ em):
- `bb/api.js` — `loadLevels()`/`loadUnits(levelId)`/`loadLessons(unitId)` (chỉ mục `approved`, giống hệt nguyên tắc
  "chỉ tải dữ liệu màn hình đang cần" của `child/api.js`); `loadUnits()` nhúng `bb_levels(*)` qua PostgREST (giống
  cách `admin/billing.js` nhúng `tuition_plans`) để nút "◀ Quay lại" ở màn Lesson quay đúng về Level cha mà không
  phải tải lại. `loadLessonContent(lessonId)` — nạp mọi chặng ĐÃ DUYỆT của 1 bài (thứ tự `sort_order`) kèm `.content`
  đúng hình dạng từng loại chặng (mảng dòng cho dialogue/vocab/grammar/phonics/writing; `{passage, questions}` cho
  reading; `null` cho minigame).
- `bb/media.js` — **dùng lại nguyên** `speakFallback`/`nativeLang`/`nativeLabel` từ `child/media.js` (hàm thuần,
  không phụ thuộc gì riêng khu trẻ em) + `playPath(path, fallbackText)` (phát file trong bucket `content`, chưa có
  file thì đọc tạm bằng giọng trình duyệt — Bài Bản CHƯA có pipeline TTS/thu âm riêng, để GĐ 5).
- `bb/pron.js` — `micButton(text)` dùng lại NGUYÊN các hàm chấm phát âm thuần (`pronunciation.js`:
  `recognizeDetailed`, `assessReading`, `tier`) nhưng **KHÔNG lưu kết quả**: chưa có bảng tiến độ cho Bài Bản
  (`bb_progress` ở GĐ 4), và bảng `pronunciation_attempts` có FK cứng vào `content_items` (khu trẻ em) nên không
  dùng lại được nguyên bảng đó cho nội dung `bb_*`.
- `bb/runner.js` — `runLesson({root, lesson, onExit})`: màn "Bắt đầu" → vòng lặp qua từng chặng đã duyệt, mỗi chặng
  gọi đúng 1 renderer trong `STEP_RUNNERS` (nhận `(box, step)`, trả `Promise` resolve khi xong chặng) → màn hoàn
  thành. Cùng khung với `child/lesson.js` `playLesson()` (thanh tiến độ, nút Thoát, mở khoá âm thanh bằng cú chạm
  "Bắt đầu" cho iOS) nhưng KHÔNG ghi `activity_log`/tính sao — GĐ 3 chỉ là giao diện, chưa có tiến độ.
- `bb/steps/*.js` — 1 file/loại chặng, đều `export function run(box, step)`:
  - `dialogue.js` — từng dòng hội thoại (vai + câu + nghĩa) + 🔊 Nghe + 🎤 Đọc thử.
  - `vocab.js` — thẻ từ (chữ + loại từ + nghĩa + hình nếu có) + 🔊 + 🎤, dạng lưới.
  - `grammar.js` — công thức + câu ví dụ (không âm thanh/mic).
  - `phonics.js` — cặp âm dễ nhầm + 🔊 từng âm + ví dụ minh hoạ.
  - `minigame.js` — **chỗ đứng** ("Trò chơi... sẽ có ở bản cập nhật sau") — không có bảng nội dung riêng, engine
    thật (flashcard SRS, sentence builder…) chạy runtime từ `bb_vocab`/`bb_phonics_pairs`, làm ở GĐ 4.
  - `reading.js` — đoạn văn (+ 🔊 + nghĩa) → từng câu hỏi trắc nghiệm, chấm **ngay tại chỗ (client), KHÔNG lưu**;
    `answer` đếm từ 1, trừ 1 khi so với index mảng `choices` (0-based) trong JS.
  - `writing.js` — 3 dạng theo `task_type`: `fill` (điền từ, tự chấm so khớp chữ thường/khoảng trắng), `order`
    (xếp từ, tự chấm theo đúng thứ tự đã soạn trong `content.words`), `write` (viết tự do — **KHÔNG tự chấm**, chỉ
    cho xem câu mẫu `content.sample`, vì chưa có cách chấm văn bản tự do đáng tin cậy — cùng tinh thần "không bịa"
    của quy tắc "Không dùng AI/dịch máy ở khu admin" trong CLAUDE.md).
- `pages/bai-ban-home.js` — viết lại hoàn toàn (khác bản placeholder GĐ 2): `showLevels`/`showUnits`/`showLessons`
  điều hướng trong-trang (giống `pages/child-home.js`), gọi `runLesson()` khi bấm vào 1 bài; nút "Quay lại" ở `shell()`
  luôn đưa về khu phụ huynh (không có "thoát về màn avatar" vì hồ sơ `learner` không dùng màn avatar).
- **Theme riêng**: `body.bb-theme` (bật/tắt ở `flow.js` `render()`, giống `admin-wide`) chỉ **đổi biến màu**
  (`--brand`/`--brand-dark`/`--brand-light`/`--bg` sang tông xanh dương thay vì cam-đỏ) — mọi `.card`/`.btn`/`.tabs`/
  `.pill`… tự đổi theo vì đã dùng `var(--brand)` sẵn, không cần viết CSS riêng cho từng thành phần. `app.css` thêm
  1 khối CSS mới cuối file (`.bb-step-dots`, `.bb-line`, `.bb-vocab-card`, `.bb-grammar-card`, `.bb-phonics-pair`,
  `.bb-passage`, `.bb-question`, `.bb-task`, `.bb-write-area`…) — CHỦ Ý tái dùng tối đa lớp có sẵn của khu trẻ em
  (`.card`, `.btn`, `.unit-grid`/`.unit-card`, `.lesson-list`/`.lesson-btn`, `.opt-grid`/`.opt`, `.mic`/`.pron-feedback`,
  `.row-btns`, `.pill`) thay vì dựng lại từ đầu. Tiện thể sửa 1 lỗi nhỏ có sẵn: `.mic` có màu đổ bóng cam viết cứng
  (`rgba(232, 89, 12, .4)`) thay vì `var(--brand)` — đổi sang màu trung tính để đúng mọi theme (bao gồm cả bb-theme).
- **Test mở rộng:** `tests/browser/mock-sb.js` thêm 11 bảng `bb_*` vào `TABLES` + hỗ trợ nhúng `bb_levels` trong
  `embed()`, để thử được toàn bộ luồng bằng dữ liệu giả.

**Đã thử bằng dữ liệu giả:** Level (A1) → Unit (Chào hỏi) → Lesson (Bài 1) → chạy đủ 7 chặng liên tiếp (Hội thoại
2 dòng, Từ vựng 2 thẻ, Ngữ pháp 1 công thức, Ngữ âm 1 cặp âm, Mini-game placeholder, Đọc hiểu 1 đoạn + 1 câu hỏi
[chấm đúng/sai đúng], Luyện viết cả 3 dạng [fill đúng, order sai có hiện đáp án, write hiện/ẩn câu mẫu]) → màn
"Đã hoàn thành bài học!" → thoát về danh sách bài; nút "✕ Thoát bài" giữa chừng (ngay chặng 1) cũng thoát đúng;
màn Level/Unit/Lesson rỗng hiện đúng thông báo "Chưa có…"; theme xanh dương áp dụng đúng khi vào Bài Bản. Chưa thử
với Supabase thật (chưa có nội dung `bb_*` thật — soạn nội dung là GĐ 7).

## 12. Giai đoạn 4 — Luyện tập/SRS (ĐÃ LÀM)

**Migration `023_bb_progress.sql`** (sau `022_bai_ban.sql`):
- `bb_progress (child_id, step_id, completed_at)` unique(child_id, step_id) — chặng nào người học đã đi qua;
  `bb/runner.js` gọi `api.saveStepProgress()` sau mỗi chặng (KHÔNG `await` — không chặn chuyển chặng nếu mạng chậm,
  lỗi thì `console.warn`; lần học lại sau không đổi `completed_at` nhờ mã lỗi `23505` = đã có dòng, coi là bình
  thường). Dùng để: (1) đánh dấu ✓ ở danh sách bài (`api.loadLessonProgress()`, bài coi là xong khi ĐỦ mọi chặng đã
  duyệt của bài đó có trong `bb_progress`), (2) chặn diện ôn tập chỉ còn mục ĐÃ GẶP QUA.
- `bb_srs_state (child_id, item_type, item_id, box, due_at, reviewed_count, correct_count)` unique(child_id,
  item_type, item_id) — 1 dòng/mục đã gặp, `item_type` ∈ {vocab, grammar, phonics, dialogue}. `item_id` KHÔNG có
  khoá ngoại (item_type quyết định bảng nào — Postgres không có FK "tuỳ loại"; toàn vẹn do code kiểm). `box` (hộp
  Leitner 1–5) CHỈ có ý nghĩa thật với `vocab` (tự đánh giá Nhớ/Quên); 3 loại còn lại không chấm, `box` luôn = 1,
  chỉ `due_at` dùng để biết "lâu chưa ôn".
- RLS: **CÙNG luật với `child_progress`/`activity_log`** ở `001_init.sql` — đọc luôn được (xuất/xoá dữ liệu con);
  ghi (insert/update/delete) chỉ khi còn hạn (`has_access()`) và đúng con/học viên của mình, hoặc admin.
- Test: `supabase/tests/rls.test.mjs` mục 25 (10 kiểm tra).

**`public/js/bb/` — file mới:**
- `srs.js` — toán Leitner thuần: `nextBox(box, remembered)`, `dueAfter(box, from)`, `INTERVAL_DAYS = [0,1,2,4,8,16]`
  (index = box). Test: `tests/bb.test.mjs`.
- `practice-core.js` — chọn phiên ôn tập thuần (không gọi mạng, giống tinh thần `child/practice-core.js`):
  `pickSession(items, {limit, now})` ưu tiên mục ĐẾN HẠN (quá hạn lâu nhất trước), rồi tới mục chưa đến hạn (ôn sớm
  nhất trong số đó) — phiên không bao giờ trống nếu còn mục đã gặp qua. `isDue()`/`dueCount()`. Test: `tests/bb.test.mjs`.
- `skills.js` — `SKILLS` = 4 mục (không phải 12 như khu trẻ em, đúng theo kế hoạch): 🔤 Từ vựng (`graded: true` —
  CHỈ mục này có box Leitner thật), 💬 Hội thoại, 📐 Ngữ pháp, 🎧 Ngữ âm (3 mục sau `graded: false` — chỉ "xem lại").
- `practice.js` — UI màn Luyện tập: `showSkills()` (lưới 4 thẻ kỹ năng + số mục đến hạn, thẻ mờ/disable khi chưa có
  mục nào thuộc loại đó — tái dùng class `.unit-grid`/`.unit-card` có sẵn). Bấm vào 1 kỹ năng → `runSkill()`:
  - `vocab` → `runVocabReview()` — từng thẻ 1 (chữ + nghe + đọc thử, ẩn nghĩa) → bấm "Xem nghĩa" → hiện 2 nút
    "✗ Quên rồi" / "✓ Nhớ rồi" → lưu `api.saveVocabResult()` (tính lại box bằng `srs.js`) → thẻ kế tiếp.
  - `dialogue`/`grammar`/`phonics` → `runReviewList()` — **TÁI DÙNG NGUYÊN** renderer của chặng bài học
    (`bb/steps/dialogue.js`/`grammar.js`/`phonics.js`, gọi `run(box, {content: session})` với mục lấy từ NHIỀU bài
    đã học thay vì 1 chặng) rồi `api.saveReviewBatch()` đẩy hạn ôn tới +3 ngày cho cả nhóm mục vừa xem — không chấm,
    chỉ đánh dấu "đã ôn lại".
- `api.js` thêm: `saveStepProgress`, `loadLessonProgress`, `loadReviewCatalog` (mục ĐÃ GẶP QUA của cả 4 loại, kèm
  trạng thái SRS — mục chưa từng ôn có `due_at` ở rất xa quá khứ = đến hạn ngay), `saveVocabResult`,
  `saveReviewBatch`.
- `runner.js` — sau mỗi chặng gọi `api.saveStepProgress(childId, step.id)`; `runLesson()` nhận thêm tham số `childId`.
- `pages/bai-ban-home.js` — thêm màn **Home** (`showHome`, 2 thẻ 📖 Học / 🎯 Luyện tập, tái dùng NGUYÊN class
  `.home-cards`/`.home-card.learn`/`.home-card.practice` của khu trẻ em) làm điểm vào thay vì nhảy thẳng
  `showLevels()` như bản GĐ 3; `showLessons()` gọi `api.loadLessonProgress()` để đổi số thứ tự bài thành "✓" khi đã
  xong (lỗi tải không chặn xem danh sách bài, chỉ mất dấu ✓).
- **KHÔNG làm** (đã nói trước ở mục 11 cũ, giữ nguyên quyết định): bảng ghi lượt đọc thử phát âm riêng cho Bài Bản —
  `bb/pron.js` `micButton()` vẫn KHÔNG lưu kết quả ở mọi nơi dùng nó (cả trong bài học lẫn trong Luyện tập), giữ đơn
  giản; mini-game thật (5 engine) — `bb/steps/minigame.js` vẫn là chỗ đứng, chưa nối vào Luyện tập.
- `tests/browser/mock-sb.js` thêm 2 bảng `bb_progress`/`bb_srs_state` vào `TABLES` để thử được bằng dữ liệu giả.

**Đã thử bằng dữ liệu giả:** học xong 1 bài (7 chặng) → `bb_progress` có đủ 7 dòng → danh sách bài hiện "✓" thay vì
số → vào Luyện tập thấy đúng "2 mục cần ôn" cho Từ vựng/Hội thoại, "1 mục" cho Ngữ pháp/Ngữ âm (đúng số mục mỗi
loại trong bài) → ôn Từ vựng: thẻ 1 "Nhớ rồi" → `bb_srs_state` box=2, due +2 ngày; thẻ 2 "Quên rồi" → box=1, due +1
ngày (khớp `INTERVAL_DAYS`) → quay lại lưới kỹ năng, "Từ vựng" đổi thành "Chưa có gì để ôn" (due count về 0, thẻ
vẫn bấm được) → ôn lần lượt Hội thoại/Ngữ pháp/Ngữ âm (dùng nguyên giao diện chặng bài học) → cả 4 kỹ năng về
"Chưa có gì để ôn". Luyện tập lúc CHƯA học bài nào hiện đúng "Học vài bài trước đã nhé…", không lỗi. Chưa thử với
Supabase thật.

## 13. Ghi chú kỹ thuật khi tiếp tục GĐ 5+

- Migration kế tiếp đánh số `024_...` (GĐ 4 đã dùng `023_bb_progress.sql`).
- **GĐ 5 (khu admin nhập nội dung)** cần: tab mới soạn bài Bài Bản (7 chặng), tái dùng quy ước CSV-nhập-được +
  pipeline TTS (`/api/tts`, `ops.js`) — hiện `bb/media.js` `playPath()` chỉ đọc `audio_path` nếu ADMIN đã tự điền
  sẵn (chưa có nơi tải file lên qua giao diện, giống hệt tình trạng `content_audio`/`image_path` trước khi có tab
  Nội dung ở khu trẻ em).
- Mini-game thật (5 engine: flashcard SRS, sentence builder, dialogue roleplay, phonics discrimination, unit boss
  quest) — có thể LÀM TRƯỚC GĐ 5 nếu muốn (không phụ thuộc khu admin): nối vào `bb/steps/minigame.js` (thay nội
  dung placeholder) VÀ vào `bb/practice.js` (thêm 1 kỹ năng "🎮 Mini-game" hoặc gắn vào kỹ năng có sẵn) — dữ liệu
  đọc từ `bb_vocab`/`bb_phonics_pairs` của bài đã có, không cần bảng mới.
- Muốn thêm hồ sơ thứ 2+ cho khu TRẺ EM (không liên quan Bài Bản) giờ cũng dùng được qua "+ Thêm hồ sơ mới" thêm ở
  GĐ 2 (trước đây chỉ tạo được hồ sơ đầu tiên) — tiện thể sửa luôn một khoảng trống cũ của app, không phải việc của
  GĐ 2/kế hoạch Bài Bản, nhưng cần khi thử nghiệm.
