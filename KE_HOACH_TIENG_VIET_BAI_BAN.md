# Kế hoạch: "Tiếng Việt Bài Bản" — giáo trình có cấu trúc cho người lớn/người nước ngoài

> Lưu lại từ artifact "Tiếng Việt Bài Bản" (claude.ai) để có nguồn sự thật cục bộ trong repo — đọc mục liên quan
> bằng Grep/offset, đừng đọc nguyên file. **Trạng thái: Giai đoạn 1–5 ĐÃ LÀM ĐỦ** (nền dữ liệu, luồng chọn hồ sơ,
> giao diện học 7 chặng, Luyện tập/SRS, khu admin — GỒM CẢ CSV nhập hàng loạt và TTS, làm nốt sau phản hồi "làm
> tiếp phần còn thiếu"). **Giai đoạn 6 (test)** có test hàm thuần + RLS đầy đủ cho mọi GĐ (không có phần "chưa làm"
> nào còn lại theo đúng phạm vi tài liệu này). **Giai đoạn 7 (soạn nội dung thật)** CHƯA làm — nằm ngoài phạm vi
> code, cần người soạn nội dung giáo trình thật.

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
| 5 | Khu admin nhập nội dung: tab mới soạn bài bài bản — tái dùng quy ước CSV-nhập-được + pipeline TTS (`/api/tts`, `ops.js`), chỉ đổi schema mapping cho 7 chặng. | **✅ ĐÃ LÀM ĐỦ (kể cả CSV + TTS)** — xem mục 14 + 16 dưới đây |
| 6 | Test + thử bằng dữ liệu giả: test hàm thuần (chọn phiên luyện tập, tính điểm SRS), test RLS chéo vai trò cho bảng mới, thử qua `mock-sb.js` trước khi đụng Supabase thật. | **✅ ĐÃ LÀM đúng phạm vi tài liệu này** — test hàm thuần (`tests/bb.test.mjs`, 47 kiểm tra: Leitner, chọn phiên, CSV) + RLS (`rls.test.mjs` mục 24–25, 20 kiểm tra) + thử `mock-sb.js` ở mọi GĐ (browser thật, không phải chỉ đọc code) |
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
con. Chưa thử với Supabase thật lúc mới làm (chỉ có RLS PGlite ở GĐ 1 + dữ liệu giả ở GĐ 2) — **đã thử trên trang
thật sau đó, xem "Sửa lại sau khi dùng thật" ngay dưới đây.**

### Sửa lại sau khi dùng thật (2026-09-25)

Chủ dự án tự deploy + tạo hồ sơ `learner` thật cho **chính con mình** (không phải cho bản thân phụ huynh) rồi phản
hồi 3 điều — cả 3 đã sửa:

1. **"Loại hồ sơ" đổi từ 2 nút `.tabs` sang `<select>` (dropdown)**, và đổi vị trí xuống **dưới "Năm sinh"** (trước
   đó đặt ở đầu form) — theo đúng yêu cầu, thứ tự form giờ là: Tên → Năm sinh → Loại hồ sơ → Chọn hình đại diện.
2. **Header khu Bài Bản (`bai-ban-home.js` `shell()`) thiếu icon avatar** — trước đó chỉ hiện tên, không giống khu
   trẻ em (`child-home.js` có `avatarEmoji(c.avatar_id)` cạnh tên) — đã thêm cho khớp.
3. **Đảo ngược quyết định ở mục 8 phía trên** ("hồ sơ `learner` KHÔNG vào được từ màn hình avatar mặt trước, cố
   tình buộc vào qua khu phụ huynh"): `public/js/pages/avatars.js` giờ khớp avatar với **MỌI** hồ sơ, không phân
   biệt `profile_type` nữa — hồ sơ `learner` bấm đúng avatar là vào được thẳng từ màn hình đầu, giống hệt hồ sơ
   `child`. **Lý do đảo quyết định:** giả định ban đầu (theo câu trong artifact gốc — bàn trước khi có người dùng
   thật) là "Tiếng Việt Bài Bản" chủ yếu dành cho NGƯỜI LỚN nên vào qua khu phụ huynh hợp lý hơn; nhưng thực tế đầu
   tiên chủ dự án dùng lại là tạo hồ sơ `learner` cho MỘT ĐỨA CON để bé tự học — bé tự bấm avatar như mọi hồ sơ
   khác, bị chặn ở màn hình avatar gây khó hiểu ("chọn đúng hình mà báo sai"). Cũng sửa `childPickAvatarLearner`/
   `childTypeLearnerHelp` (strings.js) — bỏ câu "chỉ để phân biệt hồ sơ trong khu phụ huynh" (không còn đúng).

### Sửa tiếp lần 2 sau khi dùng thật (2026-09-25, cùng ngày)

Sau khi mục 3 ở trên làm avatar vào được cho cả 2 loại hồ sơ, **thẻ "Hồ sơ học bài bản" + nút "Vào học" riêng
trong `parent.js` trở thành THỪA** — phụ huynh hỏi thẳng "tại sao lại có thẻ này ở đây" vì nó tách biệt không rõ
lý do với danh sách hồ sơ chung, trong khi avatar mặt trước đã đủ dùng. Đã bỏ hẳn `learnerProfilesCard()`; danh
sách hồ sơ ở thẻ tóm tắt đầu trang (`parent.js` `mount()`) giờ gộp chung MỌI loại hồ sơ (bỏ filter
`profile_type !== 'learner'` của lần sửa trước), chỉ gắn thêm 1 nhãn nhỏ `🎓 Bài Bản` (`T.bbProfileTag`) cạnh tên
để phân biệt — không còn nút riêng, không còn thẻ riêng.

**Đồng thời sửa 1 vấn đề thật khác chủ dự án chỉ ra:** `progressCard()` ("Tiến độ học của con") gọi RPC
`child_stats` — RPC này chỉ biết `content_items`/`child_progress`/`activity_log` của khu trẻ em, **không hề biết
gì về `bb_progress`/`bb_srs_state`** của Bài Bản. Trước khi sửa, hồ sơ `learner` vẫn lọt vào ô chọn của thẻ này
(vì trước đó không lọc ở `progressCard`, chỉ lọc ở danh sách tóm tắt phía trên) → chọn vào sẽ ra **toàn số 0**,
trông như "chưa học gì" dù có thể đã học kha khá bên Bài Bản — gây hiểu lầm. Đã lọc `progressCard()` chỉ còn hồ sơ
`profile_type !== 'learner'`. **Chưa làm** (không thuộc phạm vi sửa nhanh này): 1 view tiến độ RIÊNG cho Bài Bản —
2 giáo trình có hình dạng thống kê khác hẳn nhau (level/unit/lesson/box Leitner vs cấp/sao/streak), không gộp
chung 1 RPC/1 view được; cần thiết kế riêng, để dành cho GĐ sau.

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

## 14. Giai đoạn 5 — khu admin nhập nội dung, phần giao diện cây (ĐÃ LÀM — xem thêm mục 16 cho CSV + TTS)

**Tab mới "Bài Bản"** trong khu quản trị (`pages/admin.js` `TABS` thêm `"bb"`, nhãn ở `admin/text.js` `A.tabs.bb`):
- `admin/bb-ops.js` — CRUD cho cả 4 tầng có `status` (level/unit/lesson/step) + 7 loại nội dung, cùng khuôn với
  `admin/ops.js` (khu trẻ em): `clean()`/`only()`/`need()`/`nextOrder()` chuẩn hoá dữ liệu, mọi hàm `createX`/
  `updateX` validate rồi trả lỗi tiếng Việt rõ ràng. **Duyệt LAN LÊN** (duyệt 1 chặng → tự duyệt luôn bài/chủ đề/cấp
  chứa nó, giống `ops.setLessonStatus` lan lên unit bên khu trẻ em), **ẩn LAN XUỐNG** (ẩn 1 tầng → ẩn hết mọi tầng
  con, giống `ops.setLessonsStatus`). Xoá: dọn file Storage (ảnh `bb_vocab.image_path`, âm thanh `audio_path`/
  `audio_a_path`/`audio_b_path` ở mọi bảng nội dung) TRƯỚC khi xoá dòng — Postgres tự xoá dây chuyền DB (ON DELETE
  CASCADE, migration 022), chỉ Storage không tự dọn theo. `▲▼` đổi thứ tự dùng lại NGUYÊN `ops.moveIn()` — mọi bảng
  `bb_*` đều có `id`+`sort_order`, không cần viết hàm riêng. Ảnh `bb_vocab.image_path` dùng lại NGUYÊN
  `images.setImage()`/`clearImage()` (cùng hình dạng `id`+`image_path` với `content_items`/`units`).
  **Âm thanh là điểm khác biệt lớn nhất so với khu trẻ em**: `content_audio` (khu trẻ em) là bảng riêng nhiều-dòng
  (nhiều giọng/tốc độ/nguồn cho 1 mục); `bb_*` chỉ có 1 cột `audio_path` phẳng/bảng — nên viết mới
  `setAudioPath(table, row, col, file)`/`clearAudioPath()` (generic, dùng chung cho MỌI cột âm thanh của MỌI bảng
  `bb_*`) thay vì tái dùng `admin/audio.js` (gắn chặt với `content_audio`). Lúc viết mục này CHƯA có TTS (chỉ tải
  file admin có sẵn lên, ≤ 5 MB) — **đã bổ sung TTS ngay sau đó cùng ngày, xem mục 16.**
- `admin/bb.js` — giao diện cây Cấp → Chủ đề → Bài → Chặng (7 loại, chọn bằng `<select>` khi thêm) → nội dung riêng
  từng loại, cùng khuôn `admin/content.js`: `beginLoad()` giữ vị trí cuộn, `notice.set/take()` giữ thông báo qua
  lần tải lại toàn tab, `slotToggle()` mở/đóng biểu mẫu thêm/sửa (biểu mẫu = `.qa-box`/`.qa-grid` có sẵn, KHÔNG viết
  CSS mới ngoài `.bb-row` cho mỗi dòng nội dung). Biểu mẫu nhiều ngôn ngữ (nghĩa từ/dịch câu thoại/công thức/đoạn
  văn/đề bài — đều cùng hình dạng jsonb `{lang: chữ}`) dùng CHUNG 1 hàm `langBlock()` thay vì viết lại 6 lần.
  **Đơn giản hoá có chủ đích** (ghi rõ trong code, KHÔNG phải thiếu sót): câu ví dụ trong Ngữ pháp
  (`bb_grammar.examples`) chỉ nhập được câu tiếng Việt qua biểu mẫu nhanh, CHƯA hỗ trợ dịch từng câu ví dụ (sửa
  bằng SQL nếu cần) — để tránh biểu mẫu quá phức tạp cho 1 trường lồng nhau ít quan trọng.
  **Lỗi đã gặp và sửa khi thử bằng dữ liệu giả:** `panel.replaceChildren(nút, addSlot, data.map(...))` — hàm
  `replaceChildren()` GỐC của trình duyệt (khác hẳn `el()`/`mount()` của app, vốn tự `.flat()` mảng con) KHÔNG tự
  dàn phẳng mảng — truyền thẳng 1 mảng vào đó khiến trình duyệt ép kiểu mảng thành chuỗi
  (`"[object HTMLDivElement],..."`) và hiện y nguyên chuỗi đó lên màn hình thay vì render các dòng. Sửa: thêm `...`
  trước mọi `data.map(...)`/`questions.map(...)` khi truyền vào `panel.replaceChildren()`. Cùng lúc sửa 1 lỗi nhỏ
  khác: thông báo "Đã thêm/Đã lưu" bị mất ngay lập tức vì viết vào chính `panel` rồi `refresh()` xoá trắng `panel`
  đó — tách riêng 1 `flash` div SỐNG NGOÀI vòng đời của `panel` (xem `stepBlock()`) để thông báo không bị `refresh()`
  cuốn theo.
- **Đã thử bằng dữ liệu giả** (browser thật, không phải chỉ đọc code): tạo đủ Cấp → Chủ đề → Bài → cả 7 loại chặng
  → thêm nội dung cho Hội thoại (kèm dịch), Từ vựng, Đọc hiểu (đoạn văn + câu hỏi, dấu ✓ đúng chỗ đáp án đúng),
  Luyện viết (đủ cả 3 dạng fill/order/write, tóm tắt hiện đúng) — không còn lỗi hiển thị; "Duyệt chặng" lan lên
  đúng cả 4 tầng (chặng → bài → chủ đề → cấp đều chuyển "Đã duyệt"); "Xoá" cả 1 cấp xoá sạch dây chuyền không lỗi,
  không còn sót dữ liệu. Console không có lỗi trong suốt quá trình thử. **Chưa thử tải ảnh/âm thanh bằng file thật**
  (chỉ xác nhận nút hiện đúng theo trạng thái có/chưa có file — việc chọn file qua hộp thoại hệ điều hành khó mô
  phỏng bằng công cụ tự động), **chưa thử với Supabase thật**. Lúc thử phần này CSV nhập hàng loạt/TTS chưa có —
  **đã bổ sung cùng ngày, xem mục 16.**

## 16. Giai đoạn 5 — phần còn lại: CSV + TTS (ĐÃ LÀM)

**TTS:** `bb-ops.generateAudio(table, row, col, text, lang='vi', gender='female')` — dùng lại NGUYÊN `synth()` +
`getVoices()` từ `admin/audio.js` (cùng `/api/tts`, cùng giọng đã cấu hình ở tab Cài đặt) rồi lưu như `audio_path`
phẳng bình thường (KHÔNG phải `content_audio` nhiều-dòng — sinh lại thì GHI ĐÈ file cũ, không giữ lịch sử nhiều
giọng như khu trẻ em — đơn giản hoá có chủ đích). Nút **"🔊 TTS"** xuất hiện cạnh nút tải file thủ công ở mọi chỗ
có `audio_path` VÀ có sẵn chữ để đọc (`admin/bb.js` `audioBtn(..., text)` — dòng thoại, từ vựng, 2 âm của cặp ngữ
âm, đoạn văn đọc hiểu). Chưa có ô chọn giới/vùng miền riêng cho Bài Bản (luôn giọng nữ mặc định — đơn giản hoá,
có thể thêm sau nếu cần).

**CSV nhập hàng loạt:** `admin/bb-csv.js` (hàm THUẦN, test đầy đủ ở `tests/bb.test.mjs`) + phần thực thi
`bb-ops.importPlan()` (chạm CSDL). Khác hẳn CSV khu trẻ em (1 dòng = 1 mục): ở đây **1 dòng = 1 dòng nội dung của 1
CHẶNG** trong 1 bài — cột cần đọc tuỳ `step_type` của dòng đó (dialogue/vocab/grammar/phonics/reading/writing;
**minigame không nhập được qua CSV** vì không có bảng nội dung riêng). Cột luôn cần: `level` (mã CEFR), `unit`,
`lesson`, `step_type`; cột khác tuỳ loại (xem chú thích ngay trong `bb-csv.js` và dòng hướng dẫn hiện trong giao
diện). **Đơn giản hoá có chủ đích:** không có cột `step_order` — mỗi bài chỉ nhập được **1 chặng/loại** qua CSV
(đủ dùng thực tế; muốn 2 chặng cùng loại trong 1 bài thì thêm bằng tay ở giao diện). `validateRows()` gom lỗi/cảnh
báo theo đúng khuôn `admin/csv.js` (dòng + thông điệp tiếng Việt); `buildPlan()` so khớp Cấp/Chủ đề/Bài/Chặng đã
CÓ theo tên (không phân biệt hoa/thường, giống `csv.js` `keyOf()`) để không tạo trùng tầng, rồi gộp các dòng cùng
(bài, loại chặng) thành 1 "nhóm" = nội dung của 1 chặng. `importPlan()` tạo các tầng còn thiếu (level→unit→lesson→
step) rồi ghi nội dung qua `upsertContentRows()` (hàm dùng chung cho dialogue/vocab/grammar/phonics/writing, so
trùng theo chữ chính không phân biệt hoa/thường TRONG CÙNG 1 chặng — nhập lại KHÔNG tạo trùng, chỉ cập nhật bản
dịch/trường đã đổi, đúng nguyên tắc "Nhập CSV luôn tạo NHÁP, chạy lại không tạo trùng" của khu trẻ em) và
`upsertPassage()`/`upsertQuestions()` riêng cho reading (đoạn văn tối đa 1/chặng, câu hỏi so trùng theo câu hỏi).
Giao diện (`admin/bb.js` `csvSection()`) đặt ngay đầu tab Bài Bản (không phải tab riêng như "Nhập CSV" bên khu
trẻ em) — dán/tải file → Kiểm tra (xem trước số dòng hợp lệ + số tầng mới sẽ tạo + lỗi/cảnh báo) → Nhập vào.

**Lỗi đã gặp và sửa khi thử bằng dữ liệu giả (CÙNG GỐC với lỗi đã sửa ở mục 14, nhưng ở 2 CHỖ KHÁC):**
`preview.replaceChildren(..., v.errors.length ? el(...) : null, ...)` và
`fields.replaceChildren(t === "fill" ? [labeled(...), labeled(...)] : null, ...)` (biểu mẫu Luyện viết đổi trường
theo `task_type`) — cả 2 đều gọi THẲNG `replaceChildren()` gốc của trình duyệt với `null`/mảng lẫn trong tham số,
bị ép kiểu thành chuỗi `"null"`/`"[object HTMLLabelElement],..."` hiện lên màn hình. Sửa bằng cách bọc toàn bộ
trong 1 `el("div", null, ...)` trước khi gắn vào `replaceChildren()` — `el()` tự lọc `null` và tự dàn phẳng mảng,
native `replaceChildren()` thì KHÔNG — **đây là bẫy chung của cả file `admin/bb.js`, cần nhớ mỗi khi thêm chỗ mới
gọi trực tiếp `xxx.replaceChildren(...)` thay vì qua `el()`/`mount()`.**

**Đã thử bằng dữ liệu giả (browser thật):** nhập 1 file CSV mẫu đủ 7 dòng phủ 4/6 loại chặng (dialogue 2 dòng,
vocab 2 dòng, reading 1 đoạn văn + 1 câu hỏi, writing 1 bài fill) vào CSDL trống → xem trước đúng "sẽ tạo 1 cấp, 1
chủ đề, 1 bài, 4 chặng" → Nhập vào → mở cây kiểm tra: cả 4 chặng có đúng nội dung, nút "🔊 TTS" hiện đúng chỗ có
chữ. **Nhập lại NGUYÊN VẸN cùng file CSV đó lần 2** → xem trước đúng "sẽ tạo 0 cấp, 0 chủ đề, 0 bài, 0 chặng" → bấm
Nhập vào → so số dòng ở mọi bảng TRƯỚC/SAU: **giống hệt nhau tuyệt đối** (không tạo trùng bất kỳ dòng nào, kể cả
các tầng lẫn nội dung). Console sạch trong suốt quá trình. **Chưa thử gọi `/api/tts` thật** (cần Worker thật +
biến môi trường TTS, không mô phỏng được bằng `mock-sb.js`), **chưa thử với Supabase thật**.

## 17. Ghi chú kỹ thuật khi tiếp tục GĐ 7

- Migration kế tiếp đánh số `024_...` (GĐ 4 đã dùng `023_bb_progress.sql`; GĐ 5 không thêm migration nào).
- Mini-game thật (5 engine) vẫn là chỗ đứng — có thể làm bất cứ lúc nào, không phụ thuộc GĐ 7.
- Muốn thêm hồ sơ thứ 2+ cho khu TRẺ EM (không liên quan Bài Bản) giờ cũng dùng được qua "+ Thêm hồ sơ mới" thêm ở
  GĐ 2 (trước đây chỉ tạo được hồ sơ đầu tiên) — tiện thể sửa luôn một khoảng trống cũ của app, không phải việc của
  GĐ 2/kế hoạch Bài Bản, nhưng cần khi thử nghiệm.
- GĐ 7 (soạn nội dung thật) giờ có thể dùng CSV nhập hàng loạt (mục 16) thay vì chỉ nhập tay từng mục qua giao
  diện (mục 14) — nên soạn nội dung thật dưới dạng CSV theo đúng cột đã tả ở `admin/bb-csv.js`.
