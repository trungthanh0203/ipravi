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
  giản.
- `tests/browser/mock-sb.js` thêm 2 bảng `bb_progress`/`bb_srs_state` vào `TABLES` để thử được bằng dữ liệu giả.

**Cập nhật 2026-09-25 (mini-game thật — 3/5 engine, ngoài lộ trình 7 giai đoạn gốc, làm theo yêu cầu chủ dự án sau
khi dùng thử):** `bb/steps/minigame.js` từ chỗ đứng → 3 engine chạy thật, KHÔNG cần bảng mới (dùng `bb_lesson_steps.config`
jsonb có sẵn từ migration 022): 🔤 Ghép nghĩa (`meaning_pick`), 🎧 Phân biệt âm (`phonics_discrim`), 🧩 Xếp câu
(`sentence_builder`, tái dùng đúng `orderTask()` của `bb/steps/writing.js`). Admin chọn kind ở `admin/bb.js`
`minigamePanel()` (`bb-ops.updateStepConfig()`). Engine nhận `steps` (toàn bộ chặng đã duyệt của bài, kèm `.content`)
qua tham số thứ 3 mới của `run(box, step, steps)` — `bb/runner.js` truyền cho MỌI renderer, chỉ minigame.js dùng.
**2 engine còn thiếu của 5 engine gốc (lật thẻ trí nhớ, đóng vai hội thoại chấm phát âm) CHƯA làm** — chủ dự án chọn
làm 3 game trước rồi xem thử, quyết định làm tiếp 2 game còn lại sau. flashcard SRS (engine thứ 5 trong danh sách
gốc) không làm riêng cho chặng Mini-game vì đã có ở màn Luyện tập › Từ vựng (`runVocabReview`), làm lại sẽ trùng.
**Nhân tiện làm luôn "Boss cuối Unit"** (mục 5 gợi ý cũ): bài `lesson_type='review'` → Mini-game của bài đó gộp
THÊM dữ liệu Từ vựng/Ngữ pháp/Ngữ âm/Hội thoại của MỌI bài khác trong CÙNG Chủ đề (`api.loadUnitPool()`), không chỉ
riêng bài đó — đúng tinh thần "Mỗi Unit có 1 Boss cuối gộp kiến thức" ở mục 1. **Cùng đợt, `admin/record.js` (tab
Thu âm) thêm nút chọn giáo trình** (👶 Trẻ em / 🎓 Bài Bản) vì trước đó chỉ thu được cho khu trẻ em — Ngân hàng âm
hiện ở cả 2 (dùng chung). Chi tiết kỹ thuật + lỗi gặp lúc thử (parseLessonKey ép Number() sai, step.config không tự
cập nhật sau khi lưu): xem CLAUDE.md mục "Quy tắc dễ sai" (2 bullet mới "Thu âm chia theo giáo trình" và "Mini-game
Bài Bản"). Đã thử bằng dữ liệu giả (mock-sb.js): cả 3 engine + Boss cuối Unit chạy đúng, chưa thử Supabase thật.

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

- Migration kế tiếp đánh số `024_...` (GĐ 4 đã dùng `023_bb_progress.sql`; GĐ 5 không thêm migration nào; đợt
  mini-game 2026-09-25 cũng không thêm migration — `config` đã có sẵn từ 022).
- Mini-game: 3/5 engine đã làm (2026-09-25, xem mục 8 cuối). 2 engine còn lại (lật thẻ trí nhớ, đóng vai hội thoại
  chấm phát âm) vẫn là việc mở — có thể làm bất cứ lúc nào, không phụ thuộc GĐ 7.
- Muốn thêm hồ sơ thứ 2+ cho khu TRẺ EM (không liên quan Bài Bản) giờ cũng dùng được qua "+ Thêm hồ sơ mới" thêm ở
  GĐ 2 (trước đây chỉ tạo được hồ sơ đầu tiên) — tiện thể sửa luôn một khoảng trống cũ của app, không phải việc của
  GĐ 2/kế hoạch Bài Bản, nhưng cần khi thử nghiệm.
- GĐ 7 (soạn nội dung thật) giờ có thể dùng CSV nhập hàng loạt (mục 16) thay vì chỉ nhập tay từng mục qua giao
  diện (mục 14) — nên soạn nội dung thật dưới dạng CSV theo đúng cột đã tả ở `admin/bb-csv.js`.

## 18. GĐ 7 bắt đầu — mẻ nội dung đầu tiên + 2 lỗi CSV sửa lúc soạn (2026-09-27)

Chủ dự án yêu cầu soạn thử nội dung giáo trình thật dạng CSV để tự nhập vào hệ thống (GĐ 7, trước đó ngoài phạm vi
code vì "cần người soạn nội dung thật" — nay chủ dự án tự yêu cầu AI soạn, không phải người biết tiếng Việt/văn hoá
thật tự viết, nên xem là **bộ khởi đầu để rà lại**, không phải nội dung "cuối cùng" như các mẻ nội dung khu trẻ em).

**File:** `giao-trinh/csv/bai-ban-a1-chao-hoi-gia-dinh.csv` — sinh bằng `node scripts/gen-bai-ban-a1.mjs` (sửa nội
dung thì sửa trong script rồi chạy lại, ĐỪNG sửa tay file CSV — dễ lệch cột/thiếu ngoặc kép khi câu có dấu phẩy).
**Phạm vi (bộ khởi đầu, không phải đủ A1–A2 như tài liệu nguồn 8 Unit/31 bài):** cấp A1 "Sơ cấp 1", 2 chủ đề (Chào
hỏi 👋, Gia đình 👪), mỗi chủ đề 3 bài (2 bài `core` + 1 bài `review`/Boss cuối Unit) = 6 bài, 24 chặng, 64 dòng.
Đủ cả 5 loại chặng có nội dung CSV được (dialogue/vocab/grammar/phonics/minigame), riêng reading chỉ dùng ở 1 bài
(Bài 2 chủ đề Gia đình, 1 đoạn văn + 2 câu hỏi) để có ví dụ; chưa có bài `writing` nào (task_type fill/order/write
chưa thử với nội dung thật). Nghĩa chỉ có **en+de** (chưa có fr/ko/ja — khác quy ước "đủ cả 5" của giáo trình khu
trẻ em; thêm ngôn ngữ sau nếu cần). Cả 3 engine mini-game đã cài (meaning_pick/sentence_builder/phonics_discrim)
đều được dùng, gồm cả 2 bài Boss cuối Unit (mỗi bài chỉ có 1 chặng dialogue tự soạn riêng cho bài Boss + 1 chặng
minigame — không có vocab/phonics riêng, dựa hẳn vào `loadUnitPool()` gộp từ 2 bài core cùng chủ đề).

**2 lỗi phát hiện + sửa lúc soạn (trước khi soạn nội dung thật, đã tự kiểm bằng `validateRows`/`buildPlan` +
`importPlan` + chạy hết bài bằng `mock-sb.js` — không phải chỉ đọc code):**
1. **`bb-ops.importPlan()` tính `sort_order` sai khi nhập CSV có NHIỀU chủ đề/bài/chặng mới CÙNG 1 cha trong 1 lần
   nhập** — code cũ dùng lại `nextOrder(existing.xxx.filter(...))` (chỉ tính dòng ĐÃ CÓ TỪ TRƯỚC) cho MỌI dòng mới,
   nên 2 bài mới của cùng 1 chủ đề đều nhận `sort_order = 1` (không phải 1 rồi 2) → thứ tự bài/chủ đề/chặng lộn xộn
   khi nhập giáo trình thật nhiều bài cùng lúc (lỗi cũ của khu trẻ em không có vì `execute()` ở `admin/import.js`
   tính đúng — chỉ riêng `bb-ops.importPlan()` copy sai). Sửa bằng bộ đếm `counters`/`bump()` cục bộ, tăng dần theo
   TỪNG cha (đơn vị/bài/chặng), tính cả dòng vừa tạo trong CÙNG lần nhập.
2. **Chặng `minigame` chưa nhập được qua CSV** (đã ghi "không có nội dung CSV" trong comment cũ, nhưng thật ra chỉ
   cần ghi `config.kind`, không cần bảng nội dung) — thêm cột `game` (`admin/bb-csv.js` `GAME_KINDS` = 3 engine đã
   cài) + `STEP_TYPES` thêm `"minigame"` + `bb-ops.importPlan()` cập nhật `bb_lesson_steps.config` khi gặp nhóm
   `stepType==="minigame"` (chạy cho CẢ chặng mới lẫn đã có — nhập lại đổi được `game` mà không tạo trùng). Test:
   4 kiểm tra mới trong `tests/bb.test.mjs` (validateRows nhận/từ chối cột `game`, `buildPlan` gắn đúng `config`).

**Đã thử (browser thật qua mock-sb.js, không phải chỉ chạy test hàm thuần):** dán CSV → Kiểm tra → 64 dòng hợp lệ,
0 lỗi, 0 cảnh báo → Nhập vào → đúng 1 cấp/2 chủ đề/6 bài/24 chặng mới → duyệt cả cấp (`setLevelStatus`, lan xuống
đủ 4 tầng) → vào vai người học, chơi hết Bài 1 (5 chặng, kể cả mini-game Ghép nghĩa) → **quay lại danh sách bài,
Bài 1 hiện ✓** → vào bài Boss "Bài 3: Ôn tập" của chủ đề Chào hỏi → mini-game hiện "Thẻ 1/8" — ĐÚNG gộp từ vựng của
CẢ Bài 1 lẫn Bài 2 (12 từ, giới hạn 8 lượt/phiên) chứ không phải chỉ từ vựng riêng bài Boss (bài Boss không có
chặng Từ vựng) → sang chủ đề Gia đình, Bài 2 (có chặng Đọc hiểu): đoạn văn → 2 câu hỏi trắc nghiệm đều chấm đúng
(✓ Đúng rồi) → mini-game Xếp câu xáo đúng chữ, ghép lại đúng câu gốc, tự chuyển câu kế. Console sạch trong suốt
toàn bộ lượt thử. **Chưa thử Supabase/Storage/TTS thật** (chưa sinh âm thanh cho các dòng CSV này — bấm "🔊 Sinh
giọng đọc (TTS)" ở khu admin sau khi nhập, hoặc dùng tab Thu âm để thu giọng người thật, xem CLAUDE.md).

**Việc còn mở (không phải lỗi, chỉ là phạm vi):** chỉ 2 chủ đề (KE_HOACH mục 5 gợi ý 8–10 chủ đề/cấp); chưa có bài
`writing`; chưa có fr/ko/ja; 2 chủ đề tiếp theo hợp lý để mở rộng theo đúng gợi ý mục 5 (khách sạn, xin việc, gọi
điện thoại, mua sắm) — cần chủ dự án (hoặc người biết tiếng Việt/văn hoá thật) rà lại nội dung hiện có trước khi mở
rộng thêm, vì đây là bộ do AI soạn, chưa qua kiểm định của người dạy/nói tiếng Việt thật.

## 19. Chuyên đề "Bảng chữ cái, Ngữ âm & Thanh điệu căn bản" — cấp "A0" tiền-A1 (2026-09-27)

Chủ dự án yêu cầu làm chuyên đề mở đầu dạy 29 chữ cái + ngữ âm + 6 thanh điệu, nhấn mạnh "dễ nhìn dễ hiểu, đầy đủ từ
tổng quan đến chi tiết" — đã trao đổi trước khi làm (3 câu hỏi: đặt ở đâu, có thêm cột `say_vi` không, 5 bài đề
xuất có ổn không) rồi mới code.

**Quyết định đã chốt qua trao đổi:**
- **Cấp riêng mã "A0"** (không phải chủ đề đầu của A1 — chủ dự án chọn phương án tách cấp nếu khả thi). Cần
  migration `024_bb_a0_and_say.sql`: nới CHECK của `bb_levels.code` từ `^[ABC][12]$` → `code = 'A0' or code ~
  '^[ABC][12]$'` (giữ nguyên mọi cấp cũ, chỉ THÊM lựa chọn). Cập nhật theo: `admin/bb-ops.createLevel()` +
  `admin/bb-csv.validateRows()` (2 chỗ có regex mã cấp, phải sửa CẢ HAI).
- **Thêm cột `bb_vocab.say_vi`** (cùng migration 024) — giống hệt tiền lệ `content_items.say_vi` bên khu trẻ em:
  chữ hiển thị khác chữ ĐỌC (vd hiển thị "b" nhưng đọc "bờ"). Không có cột này thì TTS/thu âm sẽ đọc sai tên chữ
  cái/phụ âm ghép. Cập nhật theo: `bb-ops.createVocab/updateVocab` nhận thêm `say_vi`; `bb-ops.importPlan()` vocab
  mapping thêm `say_vi: r.say`; `bb-csv.js` thêm cột CSV `say` (chỉ áp dụng cho `step_type=vocab`); `admin/bb.js`
  `vocabForm`/`vocabPanel` thêm ô "Cách đọc" + hiển thị "(đọc: …)"; `admin/record.js` (tab Thu âm) dùng
  `say_vi||word_vi` làm `sampleText` (nghe mẫu TTS khi thu) nhưng vẫn HIỆN `word_vi` (chữ hiển thị) trong danh sách
  mục cần thu; `bb/steps/vocab.js`, `bb/practice.js` (Luyện tập › Từ vựng), `bb/steps/minigame.js` (Ghép nghĩa) đều
  dùng `w.say_vi || w.word_vi` cho CẢ audio (`playPath` fallback) LẪN chấm phát âm (`micButton`) — hiện thêm dòng
  "Đọc là: "…"" dưới chữ khi có `say_vi`.
- **5 bài đúng như đề xuất**, không đổi: Tổng quan bảng chữ cái → Nguyên âm → Phụ âm → Thanh điệu → Ghép vần (bài
  cuối `lesson_type='review'` — Boss cuối Unit, tận dụng NGUYÊN tính năng `loadUnitPool()` đã làm ở mục 18, không
  cần code thêm gì).

**Dữ liệu ngữ âm LẤY NGUYÊN từ nguồn đã có, không tự bịa lại** (đúng nguyên tắc "không dùng AI/dịch máy" áp dụng
rộng ra: nghĩa/tên đọc của chữ cái phải có nguồn, không đoán): `public/js/sounds.js` (`INITIAL_SOUND` — tên đọc 28
phụ âm đơn+ghép; `VOWELS` — 12 nguyên âm + tên đọc khi khác chữ hiển thị) và `public/js/viet.js` (`TONES` — tên +
mô tả lên/xuống giọng của 6 thanh, `CONFUSE` qua `spellingChoices()` — nhóm phụ âm dễ nhầm) — CÙNG nguồn "Ngân hàng
âm" đã dùng cho khu trẻ em, đảm bảo tên đọc nhất quán toàn app. Script sinh CSV:
`scripts/gen-bai-ban-a0-phonics.mjs` (import trực tiếp 2 file trên, không copy tay).

**Phân biệt "lỗi phát âm thật" và "chỉ khác cách viết" (quan trọng, tránh minigame Ngữ âm vô nghĩa):** `CONFUSE`
gộp cả 2 loại phụ âm dễ nhầm khác nhau hẳn về bản chất — (1) NGHE khác nhau theo vùng miền: ch/tr, s/x, d/gi/r,
l/n (hợp cho chặng `phonics`/mini-game `phonics_discrim` — "nghe rồi đoán âm nào"); (2) CHỈ khác quy tắc VIẾT, đọc
GIỐNG NHAU 100% theo sau nguyên âm nào: c/k, g/gh, ng/ngh (KHÔNG đưa vào `bb_phonics_pairs` — nghe y hệt nhau nên
trò "nghe rồi đoán" sẽ vô nghĩa; đưa vào 1 dòng `grammar` riêng giải thích quy tắc viết ở Bài 3 "Phụ âm"). Chặng
`phonics` của Bài 3 chỉ dùng 5 cặp loại (1): ch-tr, s-x, d-gi, d-r, l-n (dùng 2 cặp cho nhóm 3-chiều d/gi/r).

**Nội dung (92 dòng CSV):** cấp A0 "Nhập môn" (can-do: đọc đúng 29 chữ, phân biệt nguyên âm/phụ âm, nhận biết 6
thanh, ghép được vần đơn giản) → 1 chủ đề "Bảng chữ cái, Ngữ âm & Thanh điệu căn bản" 🔤 → 5 bài: **Bài 1** grammar
(2 sự thật mở đầu) + vocab (29 chữ cái ĐÚNG thứ tự bảng chữ cái, có `say_vi` cho phụ âm + ă/â/y) + minigame
Ghép nghĩa; **Bài 2** vocab (12 nguyên âm) + grammar (12 từ ví dụ, 1 từ/nguyên âm: ba, ăn, ấm, em, đêm, đi, to, cô,
nhớ, thu, thư, ý) + minigame Ghép nghĩa; **Bài 3** grammar (đơn/ghép + quy tắc viết c/k,g/gh,ng/ngh) + vocab (28
phụ âm đơn+ghép từ `INITIAL_SOUND`) + phonics (5 cặp dễ nhầm) + minigame Phân biệt âm; **Bài 4** vocab (6 âm tiết
mẫu ba/bá/bà/bả/bã/bạ — ví dụ kinh điển dạy 6 thanh, chỉ đổi thanh giữ nguyên phụ âm+vần) + grammar (6 mô tả
lên/xuống giọng lấy nguyên từ `TONES.hint`) + phonics (hỏi/ngã — 2 thanh dễ nhầm nhất) + minigame Phân biệt âm;
**Bài 5** (`review`, Boss) grammar (công thức "Âm đầu + Vần + Thanh điệu = Tiếng" + 4 ví dụ tách chữ: bà, mẹ, cô,
chị) + minigame Ghép nghĩa (gộp cả 75 mục từ vựng của 4 bài trước qua `loadUnitPool()`). Nghĩa chỉ có en+de (gloss
chung "vowel a"/"consonant b" kiểu `Vokal/Konsonant`, cùng khuôn `LETTER_TR` đã dùng ở `admin/autofill.js` khu trẻ
em — không tự đặt nghĩa riêng cho từng chữ).

**Đã thử (browser thật qua mock-sb.js — nhập → duyệt → chơi hết CẢ 5 bài):** dán 92 dòng CSV → Kiểm tra → đúng
"92 dòng hợp lệ · 1 cấp, 1 chủ đề, 5 bài, 16 chặng mới" → Nhập vào → `setLevelStatus` duyệt lan xuống đủ 4 tầng →
xác nhận qua truy vấn: `sort_order` của 5 bài đúng 1→5 liên tiếp (không lặp lại lỗi sort_order đã sửa ở mục 18) →
vào vai người học: Bài 1 hiện đúng 29 thẻ chữ cái, mục "b" hiện "Đọc là: "bờ"" dưới chữ + nghe đúng "bờ" (không
phải TTS đọc "bê" kiểu chữ cái tiếng Anh) → Bài 3 chặng Ngữ âm hiện đủ 5 cặp tĩnh để nghe, mini-game Phân biệt âm
chạy đúng 5 lượt → Bài 4 hiện đúng 6 âm tiết mẫu + 6 mô tả lên/xuống giọng + cặp hỏi/ngã → **Bài 5 (Boss): mini-game
Ghép nghĩa hiện "Thẻ 1/8" với target "ba" (từ Bài 4) và nhiễu "Konsonant l"/"Vokal o"/"Konsonant ph" (từ Bài 1-3)**
— xác nhận `loadUnitPool()` gộp đúng từ vựng của CẢ 4 bài trước vào bài Boss, không chỉ riêng bài đó. Khu admin:
mở mục Từ vựng của Bài 1 → hiện đúng "b phụ âm (đọc: bờ)" + nút ✎ Sửa mở form có ô "Cách đọc" điền sẵn "bờ". Console
sạch trong suốt toàn bộ lượt thử (cả learner lẫn admin). **Chưa thử Supabase/Storage/TTS thật.**

**Việc còn mở:** chỉ có tiếng Anh/Đức (chưa fr/ko/ja); chưa sinh âm thanh TTS thật cho 92 dòng (cần bấm "🔊 TTS"
từng mục hoặc dùng tab Thu âm — nay ĐÃ thu được cho Bài Bản, xem mục "Thu âm chia theo giáo trình" trong CLAUDE.md);
nội dung do AI soạn theo yêu cầu, gồm cả các gloss ngữ âm học tiếng Anh cho 6 thanh (level/rising/falling/dipping/
broken rising/heavy tone) — **nên có người dạy tiếng Việt cho người nước ngoài rà lại thuật ngữ** trước khi công
khai, nhất là phần mô tả 6 thanh (đây là chỗ dễ sai thuật ngữ ngôn ngữ học nhất trong toàn bộ nội dung đã soạn).

**Sửa tên sau khi dùng thật (2026-09-27):** chủ dự án yêu cầu bỏ "căn bản" khỏi tên chủ đề ("Bảng chữ cái, Ngữ âm &
Thanh điệu **căn bản**" → bỏ "căn bản") và bỏ "Tổng quan" khỏi tên Bài 1 ("Bài 1: **Tổng quan** bảng chữ cái" →
"Bài 1: Bảng chữ cái") — sửa trong `scripts/gen-bai-ban-a0-phonics.mjs` rồi sinh lại CSV, không sửa tay file CSV.
Cùng đợt, `admin/bb.js` được thống nhất lại với `admin/content.js` (khu trẻ em) về 5 điểm UI: thứ tự nút Sửa/▲▼,
rút gọn chữ nút Ẩn/Đóng/Xoá (bỏ tên đối tượng), và thêm nhãn ngôn ngữ rõ ràng ("DE: … · EN: …") cho bản dịch ở mọi
dòng nội dung — chi tiết đầy đủ xem CLAUDE.md mục "Quy tắc dễ sai" (bullet "Thống nhất chữ trên nút...").
