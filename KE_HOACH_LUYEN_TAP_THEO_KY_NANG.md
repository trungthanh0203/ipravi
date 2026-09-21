# Kế hoạch: Luyện tập theo kỹ năng

Trạng thái (2026-09-21): **GĐ 0 + 1 ĐÃ LÀM** (kèm cả 5 trò mới của GĐ 4 vì chủ dự án chốt làm đủ 12 kỹ năng). Chưa làm: GĐ 2 (huy hiệu + thống kê theo kỹ năng), GĐ 3 (tab admin), GĐ 5 (Kể chuyện/Đọc hiểu chọn bài, giới hạn phút/ngày, thử thách tổng hợp).

**Quyết định đã chốt (chủ dự án 2026-09-21):** D1 làm đủ 12 kỹ năng. D2 Luyện tập là phần RIÊNG với Học — bé tự chọn, chơi trên MỌI nội dung đã duyệt, không cần đã học bài (nên phạm vi "Bài đã học" bỏ; mặc định "Tất cả"). D3–D7 theo đề xuất: luyện tập có tăng `mastery`; huy hiệu 🥉🥈🥇 (GĐ 2); giới hạn phút/ngày làm riêng sau; bé không thấy điểm số; sửa lỗi phút học đếm đôi ngay trong migration 016.

**Khác với bản đề xuất bên dưới khi làm:** (1) không có RPC `practice_pool` — trình duyệt tải một lần "danh mục" mục đã duyệt (nhẹ, phân trang) + tiến độ rồi chọn phiên bằng hàm thuần `practice-core.js` (dễ test hơn, kiểm được trên CSV giáo trình thật; đủ nhanh với ~830 mục, sẽ phải xem lại nếu nội dung lên hàng chục nghìn mục); (2) migration 016 chỉ có cột `skill/source`, hàm `skill_of()` và bản sửa `child_stats` (chưa có `settings.practice`, `child_skill_stats` — thuộc GĐ 2–3); (3) vị từ lọc mục nằm ở `child/pools.js` và các trò cũ đã được sửa để dùng chung.

Bản đề xuất gốc (soạn sau khi đọc `lesson.js`, `child/activities/*`, `child/api.js`, `stats.js`, migration 007–010, `admin/csv.js`):

## 1. Ý tưởng và điều kiện kỹ thuật

Bé đã học xong bài thì chơi lại các trò **theo kỹ năng** (Nghe, Nói, Tô chữ…) trên **nhiều bài cùng lúc**, ưu tiên từ hay sai. Không thêm nội dung — dùng lại nội dung đã duyệt.

Điều đã kiểm trong code, làm cho việc này rẻ hơn dự tính:

| Phát hiện | Hệ quả |
|---|---|
| Mọi trò là `run(ctx)` nhận `ctx.items` rồi tự chọn lượt (`sample(pool, rounds)`), tự bỏ qua (`SKIP`) nếu thiếu mục. Chỉ `order_story` và `read_quiz` gắn với 1 bài (`items.slice(0,6)` theo thứ tự soạn; `ctx.questions`). | Luyện tập = dựng `ctx` giả với mục lấy từ nhiều bài rồi gọi lại đúng các `RUNNERS`. **17/19 trò dùng lại nguyên, không sửa.** |
| `ctx.record()` đã ghi `child_progress` (mastery ±1, `wrong_count`). Thống kê "từ cần ôn" đã có (`review`, chỉ 8 từ). | "Ưu tiên từ sai" không cần bảng mới, chỉ cần RPC xếp hạng dài hơn. |
| `activity_log` ghi mỗi trò (`kind` = tên trò) + 1 dòng `kind='lesson'` cho cả bài. | Thống kê theo kỹ năng suy ra được từ `kind`; **chỉ cần thêm cột phân biệt nguồn** để luyện tập không bị tính là "xong bài". |
| Bài xong/sao = `kind='lesson'` (`best` trong `child_stats`). | Phiên luyện tập ghi `kind='practice'` → tự nhiên không đụng sao/cấp của phần Học. |
| ⚠ `child_stats` cộng `duration_seconds` của MỌI dòng log (`daily`), trong khi mỗi bài có cả dòng từng trò lẫn dòng cả bài. | Theo code, **phút học đang bị đếm khoảng gấp đôi** (chưa kiểm bằng dữ liệu thật). Phải sửa trước khi thống kê theo kỹ năng: chỉ cộng dòng "phiên" (`lesson`/`practice`). |
| Các trò tự chọn nhiễu từ `ctx.items`. | Trộn mục nhiều bài **phải cùng "họ"** (chữ/vần · từ · câu), nếu không sẽ lẫn nhiễu vô nghĩa (chữ "b" làm nhiễu cho "con bò"). Đây là chi tiết dễ sai nhất. |

## 2. Danh sách kỹ năng (bảng cũ + phần bổ sung)

Bảng 7 kỹ năng của bạn giữ nguyên. Sau khi rà các trò hiện có và điểm yếu của trẻ gốc Việt (nghe được nhưng khó đọc–viết, sai thanh điệu/chính tả), **đề xuất bổ sung 5 kỹ năng**. Tổng 12 thẻ, chia 3 nhóm màu để bé dễ phân biệt.

| # | Kỹ năng | Nhóm | Trò dùng | Trạng thái |
|---|---|---|---|---|
| 1 | 👂 Nghe | Nghe–Nói | `listen_pick`, `listen_pick_text` | có sẵn |
| 2 | 🎤 Nói | Nghe–Nói | `listen_repeat` (+ "đọc to câu" sau) | có sẵn |
| 3 | 🎵 **Thanh điệu** *(mới, tách khỏi Nghe)* | Nghe–Nói | `listen_pick_tone` + **`tone_pair`** (nghe má/mà/mả, chọn chữ đúng) | 1 trò cũ + 1 mới |
| 4 | 🧠 **Hiểu nghĩa** *(mới)* | Nghe–Nói | **`meaning_pick`**: nghe từ Việt → chọn nghĩa ngôn ngữ gốc (và ngược lại) | mới — quan trọng nhất cho trẻ song ngữ |
| 5 | 🧩 **Trí nhớ** *(mới)* | Vui–Nhớ | **`memory_flip`**: lật thẻ tìm cặp hình ↔ chữ ↔ tiếng | mới |
| 6 | 🗂️ **Phân loại** *(mới)* | Vui–Nhớ | **`sort_unit`**: xếp từ vào 2–3 giỏ (giỏ = chủ đề: con vật/trái cây…) — không cần thêm dữ liệu vì chủ đề chính là nhóm | mới (cũng chính là hoạt động `sort` còn dở) |
| 7 | ✏️ Tô chữ | Chữ–Viết | `trace` | có sẵn |
| 8 | 🔤 Đánh vần | Chữ–Viết | `spell_along` | có sẵn |
| 9 | 🧱 Ghép chữ | Chữ–Viết | `build_syllable`, `fill_letter`, `order_words`, `spell_word`, `match_case`, `pick_case` | có sẵn |
| 10 | 📖 Đọc | Chữ–Viết | `read_pick`, `fill_word` | có sẵn |
| 11 | 🅰️ Viết hoa & dấu câu | Chữ–Viết | `fix_capital`, `write_check` | có sẵn |
| 12 | 🔎 **Chính tả** *(mới)* | Chữ–Viết | **`pick_spelling`**: chọn từ viết đúng giữa cặp hay nhầm ch/tr, s/x, d/gi/r, c/k/q, g/gh, ng/ngh, l/n (Cấp 3–4 đã dạy các luật này nhưng chưa có trò riêng để luyện) | mới |

Hai loại **gắn với 1 bài** (chỉ hiện dạng "chọn bài đã học", không trộn nhiều bài):
- 📚 **Kể chuyện** = `order_story` (xếp câu thành chuyện).
- 📰 **Đọc hiểu** = `read_quiz` (đoạn + câu hỏi).
Danh sách bài để chọn lấy từ bảng `activities` (bài nào có 2 trò này) ∩ bài bé đã hoàn thành.

Cân nhắc nhưng **để sau**: "Giao tiếp tình huống" (gặp bà nói gì? — cần kiểu nội dung mới), "Đọc to cả đoạn có chấm điểm" (đã ghi ở giáo trình mục 7), "Thử thách tổng hợp" (trộn 3 kỹ năng, mở khi bé có ≥ 6 huy hiệu).

## 3. Trải nghiệm của bé (dễ phân biệt, dễ nhìn, hấp dẫn)

**Nguyên tắc chung:** bé 3–8 tuổi chưa đọc thạo → biểu tượng to + giọng linh vật đọc tên trò; không đếm giờ, không hiện "sai" (giữ luật hiện tại: sai 2 lần thì hiện đáp án); màu và biểu tượng của mỗi kỹ năng **giữ nguyên ở mọi nơi** (thẻ, dải đầu phiên, kết quả, huy hiệu, thống kê phụ huynh).

1. **Màn hình chính: 2 nút lớn khác màu** — 📖 *Học* (cam, như hiện nay: 4 chặng, "Học tiếp") và 🎮 *Luyện tập* (xanh). Số liệu vui ⭐🔥📚 giữ ở trên. Bé <5 tuổi chỉ thấy 2 nút, không chữ dài.
2. **Chọn kỹ năng:** lưới thẻ 2 cột (điện thoại) / 3 cột (máy tính bảng); mỗi thẻ = Twemoji lớn + tên 1–2 từ + màu nhóm + 3 chấm huy hiệu 🥉🥈🥇. Thẻ chưa đủ mục hiển thị **mờ dịu, không ẩn**, chạm vào linh vật nói: "Con học thêm vài bài nữa để mở trò này nhé!" kèm nút *Đi học bài* (bé thấy mục tiêu thay vì thấy thiếu). Kỹ năng tắt ở admin thì ẩn hẳn. Bé <5 tuổi tự ẩn các kỹ năng cần nhận mặt chữ (dùng lại `MIN_AGE_FOR_TEXT` / `TEXT_KINDS`).
3. **Chọn phạm vi** (1 hàng 3–4 nút tròn có biểu tượng, mặc định chọn sẵn để bé chỉ cần bấm *Chơi nào!*):
   - 📗 **Bài đã học** (mặc định)
   - 🥚🐣🐥🐓 **Một cấp** (chọn cấp có nội dung đã học)
   - 🎯 **Từ hay sai** (kèm số từ, vd "12 từ"; ẩn nếu 0)
   - 🗺️ **Một chủ đề** (chỉ hiện với bé ≥ 5 tuổi hoặc trong khu phụ huynh)
   Bé <5 tuổi: bỏ bước này, tự chọn "Bài đã học" (hoặc "Từ hay sai" nếu có).
4. **Trong phiên:** dải màu đầu màn hình = biểu tượng + tên kỹ năng + **các chấm tiến độ** (●●○○○○ — dễ hiểu hơn thanh %), nhãn nhỏ "Luyện tập" để phân biệt với bài học; không có bước "học từ mới" (intro). Mỗi phiên **6–8 lượt**, ghép 1–3 trò cùng kỹ năng để đỡ chán (vd Nghe: 3 lượt nghe–chọn hình + 3 lượt nghe–chọn chữ). Giữ nút 🔊 và 👩/👨 như trong bài.
5. **Kết quả:** 1–3 sao (dùng lại `starsFor`), linh vật vui, và **"Mình luyện lại các từ này nhé"** với 1–4 từ sai (chạm để nghe) + nút *Chơi lại từ khó* (nhảy vào phạm vi Từ hay sai). Có huy hiệu mới thì hiện hiệu ứng riêng. Phiên chưa đủ dữ liệu → thông báo nhẹ nhàng, không bao giờ để bé kẹt màn trống.
6. **Huy hiệu kỹ năng:** 🥉 sau 3 phiên đạt ≥ 85 điểm, 🥈 sau 10, 🥇 sau 25 (tính từ log, không thêm bảng). Sao luyện tập **không** cộng vào sao bài học (tránh lẫn), nhưng phiên luyện tập **có** tính vào chuỗi ngày 🔥 và vào `mastery` của từ.

## 4. Thiết kế kỹ thuật

### 4.1 Đăng ký kỹ năng (1 nguồn sự thật): `public/js/child/skills.js`
```
SKILLS = [{ id:'listen', emoji:'👂', color, group, name, kinds:['listen_pick','listen_pick_text'],
            needsText:false, minItems:4, boundToLesson:false }, …]
eligible(kind, items)  // đúng vị từ lọc mà từng trò dùng
```
- Tách vị từ lọc (`traceTexts`, `words>=3`, `isLiteral`, `caseParts`…) thành hàm export dùng chung với runner → **trò và trang admin không thể lệch nhau** (hiện mỗi runner tự lọc trong thân hàm).
- Test: mọi `kind` trong `RUNNERS` thuộc đúng 1 kỹ năng; mọi kỹ năng chỉ trỏ tới kind có thật; danh sách khớp hàm SQL `skill_of()` (mục 4.3).

### 4.2 Bộ máy phiên: `child/practice.js`
1. Lấy **ứng viên** bằng RPC `practice_pool(p_child, p_scope, p_level, p_unit, p_limit)` (SECURITY INVOKER — RLS quyết định, chỉ nội dung đã duyệt, không lấy chủ đề ẩn/câu hỏi; chỉ bài bé đã hoàn thành). Trả về id + `mastery`, `wrong_count`, `last_seen_at` — không tải cả bảng, tránh trần 1000 dòng.
2. Chấm điểm ưu tiên (hàm thuần, có test): `w = 1 + 2·[mastery<3] + min(wrong,3) + min(ngày_từ_lần_cuối/7, 2)`; chọn có trọng số, không lặp, ~12–16 mục/phiên (đủ nhiễu cho trò chọn).
3. **Cắt theo "họ"** (chữ–vần | từ–cụm từ | câu–truyện–bài hát) rồi theo `eligible()`; chọn họ đủ mục nhất khớp phạm vi.
4. Tải mục đầy đủ (`.in('id', ids)`, gồm nghĩa + âm thanh), `prefetchItems`, dựng `ctx` giống `playLesson` (`record`, `setProgress`, `savePron`) → chạy 1–3 trò bằng `RUNNERS` với `config.rounds` chia sao cho tổng 6–8 lượt.
5. Kiểm tính khả thi **trước khi vào phiên** (dùng `eligible`) để không rơi vào phiên toàn `SKIP`; nếu không đủ thì báo nhẹ nhàng.
6. Cú chạm *Chơi nào!* mở khoá âm thanh iOS. Thoát giữa chừng không ghi log (giống bài học).
7. Tách phần dùng chung của `playLesson` (dựng ctx + vòng chạy + ghi log) thành hàm `runActivities()` để bài học và luyện tập dùng chung — tránh sao chép ~60 dòng.

### 4.3 Dữ liệu — migration `016_practice.sql` (chạy tay, chạy lại được)
- `activity_log`: thêm `skill text` (kỹ năng, ghi cho CẢ dòng bài học lẫn luyện tập → thống kê kỹ năng gồm cả hai) và `source text not null default 'lesson' check (source in ('lesson','practice'))`. Phiên luyện tập: 1 dòng `kind='practice'` (thời lượng cả phiên, `lesson_id` null) + dòng từng trò. Dữ liệu cũ không cần backfill: `skill_of(kind)` suy ra.
- Hàm `skill_of(kind) immutable` (bảng ánh xạ trò → kỹ năng, cùng nội dung `skills.js`).
- RPC `practice_pool` và `child_skill_stats(p_child, p_tz)` (theo kỹ năng: số phiên, phút, điểm TB 7/30 ngày, số phiên ≥85, số từ sai; SECURITY INVOKER).
- **Sửa `child_stats`**: phút học chỉ cộng dòng `kind in ('lesson','practice')`. Mở đầu migration có bước ghi chú "kiểm số phút trước/sau" để bạn tự đối chiếu.
- `settings.practice jsonb not null default '{}'` (cấu hình admin, mục 4.5). Dùng luôn RLS sẵn có của `settings` (đọc: mọi người đăng nhập; ghi: admin). Không tạo bảng mới. CHECK `jsonb_typeof = 'object'`.
- Không cần bảng huy hiệu/streak riêng.
- **Test `rls.test.mjs` (mục 22):** phụ huynh chỉ đọc log/pool của con mình; phụ huynh không sửa được `settings.practice`; `practice_pool` chỉ trả nội dung đã duyệt, không trả chủ đề ẩn/câu hỏi/bài chưa học; hết hạn (`has_access()` false) → pool rỗng; `child_stats` phút không còn gấp đôi; chạy lại migration không mất dữ liệu.

### 4.4 Trò mới (làm sau khi khung chạy được, mỗi trò 1 file + test)
Đều theo khuôn có sẵn (`pick()`/`arrange()`/`rounds()`), luật "sai 2 lần thì hiện đáp án, không phạt":
- `meaning_pick` — dùng `translations` (ngôn ngữ phụ huynh chọn); 2 chiều; có nút nghe cả 2 phía. Mục thiếu nghĩa thì bỏ qua.
- `memory_flip` — 6–8 thẻ (3×2 hoặc 4×2), cặp hình↔chữ (bé <5: hình↔tiếng); thẻ to, lật có âm thanh; không giới hạn lượt lật.
- `sort_unit` — 2 giỏ (3 giỏ cho bé ≥ 6 tuổi), 5–6 thẻ; cần mục từ ≥ 2 chủ đề khác nhau trong phạm vi. **Chỉ có ở Luyện tập** (cần mục nhiều chủ đề).
- `pick_spelling` — cặp nhầm lẫn thêm vào `viet.js` (`confusions`, hàm thuần có test); nhiễu là dạng viết SAI chính tả (vd "chó"↔"tró"); phải loại nhiễu trùng một từ có thật khác nghĩa (vd "chó"↔"tró" ổn, nhưng "cá"↔"ká"…, "sáo"↔"xáo" cần kiểm với danh sách từ của giáo trình).
- `tone_pair` — nhóm âm tiết cùng gốc (`stripTone` bằng nhau) có ≥ 3 thanh trong phạm vi.
Trò dùng cho luyện tập **không** cần thêm vào CHECK `activities.kind` (chỉ bài học mới cần); `activity_log.kind` là text tự do.

### 4.5 Tab admin "Luyện tập" (`admin/practice.js`, chữ ở `admin/text.js`)
Không đụng nội dung. Lưu vào `settings.practice`:
- Bảng kỹ năng × cột: **Bật/tắt**, ☑ Cấp 1–4, **số lượt/phiên** (mặc định 6–8), **tuổi từ–đến**.
- Cột **"Đủ điều kiện"**: số mục đã duyệt đủ chơi kỹ năng đó theo từng cấp (dùng chung `eligible()`), để admin thấy ngay kỹ năng nào chưa có dữ liệu — không phải đoán.
- Cài đặt chung: độ dài phiên mặc định, bật/tắt "ưu tiên từ hay sai", (tuỳ chọn, mục 6) giới hạn phút/ngày mặc định.
- Quy tắc: pool của kỹ năng = mục trong phạm vi ∩ cấp được bật. Chưa cấu hình → mặc định trong code (mọi kỹ năng bật, mọi cấp) nên app chạy được khi chưa vào tab này.
- Dùng `beginLoad(box)` như các tab khác; thông báo "Đã …" qua `notice.set()`.

### 4.6 Thống kê cho phụ huynh
Trong khu phụ huynh, dưới "Tiến độ": thẻ **Theo kỹ năng** = thanh ngang cùng màu/biểu tượng của bé, mỗi kỹ năng: số phiên 30 ngày, phút, điểm TB, xu hướng ▲▼; dòng gợi ý *"Con nên luyện thêm: Đánh vần (điểm TB 58)"*; danh sách **từ hay sai** đầy đủ (không chỉ 8 từ). Bản của bé chỉ hiện huy hiệu.

## 5. Kế hoạch triển khai theo giai đoạn

| GĐ | Nội dung | Rủi ro | Phụ thuộc |
|---|---|---|---|
| **0. Nền** | migration 016 (cột log, `skill_of`, sửa phút, RPC), `skills.js` + tách vị từ lọc, tách `runActivities()` khỏi `playLesson`, test hàm thuần + SQL | Thấp; đụng `child_stats` nên phải kiểm phút | — |
| **1. MVP luyện tập** | 2 nút Học/Luyện tập, chọn kỹ năng, chọn phạm vi (Đã học/Cấp/Hay sai), phiên 6–8 lượt bằng **trò có sẵn** (kỹ năng 1,2,3*,7–11), kết quả + từ hay sai | Trung bình: họ mục, phiên rỗng | GĐ 0 |
| **2. Huy hiệu + thống kê** | huy hiệu 🥉🥈🥇, thẻ "Theo kỹ năng" ở khu phụ huynh, danh sách từ hay sai | Thấp | GĐ 1 |
| **3. Tab admin** | `settings.practice`, bảng bật/tắt/cấp/lượt/tuổi, cột "Đủ điều kiện" | Thấp | GĐ 1 |
| **4. Trò mới** | `meaning_pick` → `memory_flip` → `pick_spelling` → `sort_unit` → `tone_pair` (thứ tự theo giá trị cho bé song ngữ) | Trung bình: chất lượng nhiễu, âm thanh; mỗi trò thử với dữ liệu thật | GĐ 1 |
| **5. Gắn bài + tuỳ chọn** | thẻ *Kể chuyện*/*Đọc hiểu* dạng chọn bài; giới hạn phút/ngày; "Thử thách tổng hợp" | Giới hạn thời gian cần cơ chế khoá + PIN → nên tách quyết định riêng | GĐ 1–2 |

*Ghi chú theo `*`:* kỹ năng 3 chỉ có `listen_pick_tone` cho tới khi có `tone_pair` (GĐ 4).

Cổng nghiệm thu mỗi giai đoạn: `node tests/unit.test.mjs`, `admin.test.mjs`, `curriculum.test.mjs`, `supabase/tests/rls.test.mjs` + `seed.test.mjs`, kiểm cú pháp bằng `node --input-type=module --check`, thử giao diện bằng `mock-sb.js` (bé <5 tuổi và ≥5 tuổi, phạm vi rỗng, mất mạng giữa phiên). **Chưa thể kiểm bằng máy thật trong môi trường này:** phát âm thanh iOS, chạm/kéo trên cảm ứng (`sort_unit`, `memory_flip`), hiệu năng nạp mục khi Supabase thật — cần thử trên điện thoại/máy tính bảng thật trước khi cho bé dùng.

## 6. Quyết định cần bạn chốt

| # | Câu hỏi | Đề xuất |
|---|---|---|
| D1 | Danh sách 12 kỹ năng: giữ, bớt, hay thêm? (đặc biệt "Hiểu nghĩa", "Chính tả", "Phân loại", "Trí nhớ") | Giữ đủ 12; làm 8 kỹ năng dùng trò có sẵn trước |
| D2 | Phạm vi mặc định: "Bài đã học"? Có bỏ "Một chủ đề" cho bé nhỏ? | Mặc định "Bài đã học"; bé <5 tuổi tự động, không hỏi |
| D3 | Luyện tập có tăng `mastery` (góp vào "đạt cấp" ≥ 80% từ thuộc)? | **Có**, vì chỉ luyện các từ đã học; sao bài học vẫn tách riêng |
| D4 | Huy hiệu 🥉🥈🥇 theo số phiên ≥ 85 điểm (3/10/25)? | Đồng ý; chỉnh ngưỡng sau khi có dữ liệu thật |
| D5 | Giới hạn phút/ngày: làm trong GĐ 5 hay tách dự án riêng (cần PIN phụ huynh + màn "nghỉ ngơi")? | Tách riêng, làm sau MVP |
| D6 | Kết quả có hiển thị điểm số cho bé? | Chỉ sao + lời khen; điểm số chỉ ở khu phụ huynh |
| D7 | Sửa lỗi phút học gấp đôi ngay (lịch sử số liệu cũ sẽ đổi khi chạy migration)? | Có — nếu không, thống kê theo kỹ năng sẽ sai |

Khuyến nghị: duyệt **GĐ 0 + 1** trước (MVP, không có trò mới, dùng dữ liệu hiện có); cho bé/phụ huynh thử rồi mới chốt GĐ 3–5 theo phản hồi thực tế.
