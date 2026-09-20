# Giáo trình "Tôi luyện tiếng Việt" — trẻ gốc Việt 3–8 tuổi

> Bản 3 (2026-09-20: thêm Cấp 3 và Cấp 4, chia theo cấp). Đây là **khung giáo trình + dữ liệu nhập được** cho app, do AI soạn dựa trên các nguồn công khai
> (mục 9). **Bắt buộc có người Việt bản ngữ (tốt nhất là giáo viên tiểu học/mầm non) duyệt** trước khi cho trẻ học thật
> (mục 8). File dữ liệu: `csv/cap1-trung-tu-vung.csv` (176 từ), `csv/cap2-ga-con-cau-ngan.csv` (64 câu), `csv/cap3-ga-choai-hoc-van.csv` (383 mục học vần và chữ hoa) và `csv/cap4-ga-trong-doc-hieu.csv` (208 mục đọc hiểu/chính tả/viết). Mỗi file ghi cột `level` (1–4) để app xếp đúng cấp.

## 1. Giáo trình này phải làm được gì

1. **Đơn giản, dễ nhớ:** mỗi bài 5–8 mục, học 10–15 phút, luôn đi từ *nghe → nhìn hình → nói → (sau này) đọc/viết*.
2. **Không dạy chữ quá sớm:** trẻ gốc Việt thường *nghe hiểu được nhưng chưa đọc/viết* → xây vốn nghe–nói trước, đưa chữ vào
   dần từ khoảng 5 tuổi (mục 4, Cấp 3).
3. **Theo chuẩn để học lên cao:** đối chiếu 2 hệ thống — chương trình tiếng Việt **cho người Việt ở nước ngoài** (Bộ GD&ĐT)
   và chương trình **trong nước** (mầm non → Tiếng Việt lớp 1–2) — để cháu chuyển tiếp được sang trường Việt ngữ tại chỗ,
   sách "Chào tiếng Việt", hoặc học tiếp trong nước (mục 6).
4. **Vui:** trò chơi, đồng dao, bài hát, nhân vật xuyên suốt (linh vật gà trống) — đúng tinh thần các chương trình cho trẻ
   ở nước ngoài (mục 2).

## 2. Cơ sở tham khảo (đã đọc gì, lấy gì)

| Nguồn | Điều rút ra | Dùng vào |
|---|---|---|
| **Thông tư 28/2018/TT-BGDĐT** (26/11/2018, hiệu lực 11/01/2019) — *Chương trình tiếng Việt cho người Việt Nam ở nước ngoài* | 3 cấp độ, **6 bậc**, mỗi bậc 220 giờ (tổng 1.320 giờ); Sơ cấp = bậc 1–2, Trung cấp = 3–4, Cao cấp = 5–6. Bậc 1: giao tiếp cơ bản về bản thân, gia đình, nhu cầu hằng ngày; 4 kỹ năng nghe–nói–đọc–viết; làm chủ **6 thanh điệu** và các âm/vần; ~16 chủ đề giao tiếp (chào hỏi, gia đình, nhà ở, ăn uống, mua sắm, phương tiện…); mỗi bậc chia 4 module × 4 bài + ôn/kiểm tra | Xương sống chủ đề + thứ tự nghe–nói–đọc–viết; quy đổi cấp (mục 6) |
| **Bộ sách "Chào tiếng Việt"** (NXB Giáo dục VN, biên soạn theo TT 28/2018; kèm chương trình truyền hình VTV4 2023) | Cho trẻ **6–10** và **10–15** tuổi, **6 cấp độ**. Cấp 1: ngữ âm + dấu thanh; Cấp 2: giao tiếp nói qua truyện có nhân vật; Cấp 3: mở rộng từ vựng gắn cộng đồng. Học bằng **trò chơi, bài hát, thơ, đồng dao, vận động**, tình huống đời thường và phần văn hoá "Đất nước học"; nhân vật xuyên suốt | Phương pháp (chơi–hát–kể), thứ tự ngữ âm → giao tiếp, nhân vật linh vật |
| **Chương trình GDPT 2018 — môn Ngữ văn/Tiếng Việt (trong nước)** | Trục chính là 4 kỹ năng **đọc, viết, nói và nghe**; Tiếng Việt lớp 1 dạy **học vần** (chữ cái → âm → vần → dấu thanh → đánh vần) rồi luyện đọc, viết | Lộ trình chữ cái–vần–thanh của Cấp 3, đích đọc–viết của Cấp 4 |
| **Chương trình giáo dục mầm non (trẻ 5–6 tuổi)** | "Làm quen chữ cái": nhận biết **29 chữ cái**, luyện nghe–phát âm, tiền đọc–viết; là bước đệm vào lớp 1 | Cấp 3 bắt đầu từ ~5 tuổi, không bắt đọc–viết sớm hơn |
| **Nghiên cứu dạy tiếng cho trẻ thừa hưởng tiếng mẹ đẻ (heritage learners)** | Tận dụng vốn nghe–nói có sẵn; hoạt động **ghép cặp, đóng vai, mô phỏng**; truyện dân gian đơn giản hoá; bảng từ song ngữ, có hình và ghi chú văn hoá | Hoạt động trong app (ghép cặp, nghe–chạm, nói theo), nghĩa Đức/Anh cho phụ huynh |
| **Khung năng lực tiếng Việt cho người nước ngoài** (TT 17/2015/TT-BGDĐT), 6 bậc ↔ A1–C2 (CEFR) | Thang tham chiếu quốc tế | Chỉ để *quy đổi thô* — không phải thước đo cho trẻ gốc Việt |

**Điều tôi chưa xác nhận được — cần người duyệt đối chiếu:**
- Tôi đọc TT 28/2018 qua **bản tóm tắt** (không lấy được toàn văn từ một trang chính thức); số chủ đề, số âm/vần và cấu trúc
  module nêu ở trên **cần đối chiếu văn bản gốc** trước khi công bố "đạt chuẩn TT 28".
- **Không tìm thấy** khung chương trình chính thức (Rahmenlehrplan) cho tiếng Việt như *tiếng mẹ đẻ* ở Đức. Nếu trung tâm
  ở Đức muốn liên thông, cần hỏi trực tiếp Bộ Giáo dục tiểu bang / trường tiểu học của cháu.
- TT 28/2018 viết cho **mọi lứa tuổi** (có cả người lớn: nghề nghiệp, điện thoại, ngân hàng…). Tôi **giữ chủ đề gần gũi với
  trẻ 3–8 tuổi** thay vì sao chép nguyên danh sách.

## 3. Khung 4 cấp (mỗi cấp một chặng của chú gà)

| Cấp | Tên | Tuổi gợi ý | Trọng tâm | Dữ liệu trong repo |
|---|---|---|---|---|
| **1** | 🥚 **Trứng** | 3–4 | **Nghe – nhận biết – nói từ** | `cap1-trung-tu-vung.csv`: 14 chủ đề, 29 bài, 176 từ |
| **2** | 🐣 **Gà con** | 4–6 | **Nói câu ngắn (3–6 tiếng)**, lễ phép, đồng dao | `cap2-ga-con-cau-ngan.csv`: 8 chủ đề, 64 câu |
| **3** | 🐥 **Gà choai** | 5–7 | **Thanh điệu → chữ cái → vần → đọc** (học vần) | `cap3-ga-choai-hoc-van.csv`: 8 chủ đề, 62 bài, 383 mục |
| **4** | 🐓 **Gà trống** | 6–8+ | **Đọc hiểu đoạn ngắn, viết câu, kể chuyện** | `cap4-ga-trong-doc-hieu.csv`: 6 chủ đề, 29 bài, 208 mục |

Tuổi chỉ là gợi ý: trẻ 6 tuổi chưa nghe–nói tốt vẫn bắt đầu từ Cấp 1 (nhanh hơn), trẻ 4 tuổi nói tốt có thể nhảy sang Cấp 2.

### Cấp 1 — Trứng 🥚 (nghe – nhận biết – nói từ)

- **Chuẩn đầu ra ("con làm được"):** nghe một từ thì **chỉ đúng hình**; **nói lại** được từ đơn/cụm 2–3 tiếng; biết **chào hỏi – cảm ơn –
  xin lỗi** đúng phép; **đếm 1–10**; gọi tên người thân, bộ phận cơ thể, con vật, màu, đồ ăn, đồ dùng.
- **Nội dung (14 chủ đề):** Chào hỏi & lễ phép · Gia đình · Cơ thể · Con vật · Màu sắc & hình khối · Số đếm · Ăn uống · Trái cây ·
  Đồ chơi & đồ dùng học tập · Ngôi nhà · Thiên nhiên & thời tiết · Quần áo & xe cộ · Việc hằng ngày & cảm xúc · Tết & Việt Nam.
- **Thứ tự nên học:** Chào hỏi → Gia đình → Cơ thể → Con vật → Màu sắc → Số đếm → Ăn uống → Trái cây → Đồ chơi → Ngôi nhà →
  Thiên nhiên → Quần áo & xe cộ → Việc hằng ngày & cảm xúc → Tết & Việt Nam. (Bắt đầu từ thứ *gần cháu nhất* để có động lực.)
- **Nhịp học:** 3–4 bài/tuần → **khoảng 8–10 tuần**. Cứ **3 bài ôn lại 1 lần** những từ cũ (app đã theo dõi độ thuộc 0–5 mỗi từ).
- **Qua cấp khi:** ≥ **80% số từ** đạt mức thuộc **≥ 3/5**, và điểm nhắc lại phần lớn từ ≥ 2 sao.

### Cấp 2 — Gà con 🐣 (nói câu ngắn)

- **Chuẩn đầu ra:** nói được **câu 3–6 tiếng** về nhu cầu của mình (đói, khát, buồn ngủ, muốn chơi…), gia đình, bữa ăn, trường lớp,
  Tết; dùng **xưng hô lễ phép** ("con chào bà ạ", "con mời bà ăn cơm ạ"); thuộc **6–8 bài đồng dao**; kể lại 1 truyện 4 tranh bằng 3–4 câu.
- **Nội dung hiện có (8 chủ đề × 8 câu):** Lễ phép với người thân · Gia đình của con · Con cần gì · Bữa ăn · Ở trường · Tiếng kêu &
  thời tiết · Tết & lễ hội · Cảm xúc & lễ phép.
- **Cần soạn thêm (gợi ý, khoảng 8–10 chủ đề):** đi chợ/siêu thị · sinh nhật · công viên/sân chơi · đi khám bác sĩ · các mùa · nghề
  nghiệp quanh con · đi du lịch/thăm ông bà · gọi điện video cho ông bà · nói về ngày hôm nay (đã/đang/sẽ, đơn giản) · hỏi–đáp ngắn
  (ai, cái gì, ở đâu).
- **Đồng dao & bài hát cổ truyền (miền công cộng, chỉ cần tên bài để dạy vần nhịp và thanh điệu):** *Con cò bé bé, Rồng rắn lên mây,
  Thả đỉa ba ba, Chi chi chành chành, Dung dăng dung dẻ, Lạy trời mưa xuống, Con gà cục tác lá chanh, Ông giăng ông giảng*… (người duyệt
  chọn bản chữ chuẩn để đưa vào app).
- **Qua cấp khi:** nói đúng ≥ 80% câu của các chủ đề đã học (điểm nhắc lại ≥ 2 sao) và thuộc ≥ 6 đồng dao.

### Cấp 3 — Gà choai 🐥 (học vần: thanh → chữ cái → vần → đọc)

Cầu nối sang **Tiếng Việt lớp 1** và sách **"Chào tiếng Việt" cấp độ 1** (cấp 1 của bộ sách này được nhà xuất bản mô tả là làm quen chữ cái, phụ âm, nguyên âm và thanh điệu). Chỉ bắt đầu khi bé **từ ~5 tuổi** và đã xong phần lớn Cấp 1 (app chỉ *gợi ý*, không khoá).

- **Dữ liệu:** `csv/cap3-ga-choai-hoc-van.csv` — **383 mục, 62 bài, 8 chủ đề** (nhập được ngay; cần migration `008_phonics.sql`). Bảng bên dưới sinh từ chính file này.
- **Chuẩn đầu ra ("con làm được"):** phân biệt bằng tai **6 thanh**; nhận **29 chữ cái** và âm của chúng; **ghép âm + vần** thành tiếng; đọc được **từ và câu ngắn đã học**; biết luật **c/k/q, g/gh, ng/ngh**.
- **Nhịp học:** 3–4 bài/tuần → ~14–16 tuần. Thứ tự: 3A (thanh) → 3B (chữ cái) → 3C (ghép vần) → 3D (đọc). Có thể chạy **3A song song 3B** vì 3A không cần biết chữ.
- **Qua cấp khi:** ≥ 80% số mục có mức thuộc ≥ 3/5 (như mọi cấp) **và** bé tự đọc được ≥ 80% từ/câu ở 3D (phụ huynh nghe thử).

**Cách một bài chạy (khoảng 10–12 phút):** *nghe – nhìn – nói – chơi* — ① học mục mới (nghe, nhìn hình) → ② 3–4 hoạt động (bên dưới) → ③ nhận sao. Mọi mục đều có **hình + âm thanh**; trẻ chưa đọc được vẫn học bằng tai và mắt.

**Hoạt động mới của Cấp 3** (chọn bằng cột `activities` trong CSV):

| Hoạt động | Bé làm gì | Dạy gì |
|---|---|---|
| `listen_pick_tone` nghe – chọn thanh | Nghe 1 tiếng, chọn ký hiệu đúng (➖ ↗️ ↘️ ❓ 〰️ ⬇️) | phân biệt 6 thanh bằng tai |
| `listen_pick_text` nghe – chọn chữ | Nghe âm/tiếng, chọn đúng chữ | nối âm ↔ chữ |
| `match_case` ghép hoa ↔ thường | Ghép các thẻ chữ hoa với chữ thường; chạm thẻ nào nghe âm của chữ đó | nhận hình chữ hoa |
| `pick_case` chọn chữ tương ứng | Thấy `b` chọn `B` (hoặc ngược lại) trong 3 chữ; đáp án nhiễu là chữ **hình gần giống** (B/D/P, Q/O/G…) | phân biệt chữ hoa dễ lẫn |
| `fix_capital` chạm từ cần viết hoa | Câu hiện toàn chữ thường, chạm các từ phải viết hoa (đầu câu + tên riêng); được sửa lại 1 lần | quy tắc viết hoa |
| `spell_along` đánh vần theo phần | Xem và nghe các phần lần lượt sáng lên (bờ – a – ba – huyền – bà), rồi tự chạm theo đúng thứ tự; âm từng phần lấy từ "ngân hàng âm" (giọng thu hoặc TTS) | cách đánh vần, quan hệ âm đầu – vần – dấu |
| `build_syllable` ghép âm + vần | Nghe từ có hình, chọn âm đầu rồi phần vần | cấu tạo tiếng (âm đầu + vần + thanh) |
| `fill_letter` điền chữ còn thiếu | Thấy `＿à` + hình, chọn âm đầu | nhận âm đầu, chính tả |
| `read_pick` đọc – chạm hình | Thấy chữ, chọn hình đúng (không nghe trước) | đọc hiểu từ/câu |
| `order_words` sắp xếp từ thành câu | Nghe câu, chạm các từ theo thứ tự | trật tự từ, đọc câu |
| `match`, `listen_repeat` (đã có) | Ghép chữ ↔ hình; nói theo và được chấm | củng cố, phát âm |

**Nội dung theo giai đoạn:**

#### Sáu thanh điệu (8 bài, 43 mục)
**3A — Nghe thanh (chưa cần đọc chữ).** Bé nghe một tiếng rồi chọn *ký hiệu* của thanh (➖ ↗️ ↘️ ❓ 〰️ ⬇️). Bài đầu học *tên* 6 thanh (mỗi tên tự mang thanh của nó: ngang, sắc, huyền, hỏi, ngã, nặng); 7 bài sau là các bộ tiếng chỉ khác thanh (ma–má–mà–mả–mã–mạ, la–lá–là–lả–lạ, củ–cũ–cụ…).

| Bài | Mục |
|---|---|
| Tên sáu thanh | ngang, sắc, huyền, hỏi, ngã, nặng |
| Nghe sáu thanh: ma | ma, má, mà, mả, mã, mạ |
| Nghe các thanh: la | la, lá, là, lả, lạ |
| Nghe các thanh: cú | cú, cù, củ, cũ, cụ |
| Nghe sáu thanh: ta | ta, tá, tà, tả, tã, tạ |
| Nghe các thanh: bao | bao, báo, bào, bảo, bão |
| Nghe các thanh: ve | ve, vé, vè, vẻ, vẽ |
| Nghe các thanh: mai | mai, mái, mài, mải, mãi |

#### Chữ cái (12 bài, 67 mục)
**3B — 29 chữ cái, chia 6 nhóm** theo thứ tự dễ nghe – dễ phân biệt. Mỗi nhóm 2 bài: (1) *chữ + âm + từ khoá có hình* (b–bờ–bò 🐄); (2) *từ quen có chữ đó* (nhìn chữ, tìm chữ trong từ).

| Bài | Mục |
|---|---|
| Nhóm 1: a o ô ơ | a, o, ô, ơ |
| Nhóm 1: từ có a o ô ơ | bà, cá, bò, cờ, bơ, ô |
| Nhóm 2: i e ê u ư | i, e, ê, u, ư |
| Nhóm 2: từ có i e ê u ư | mì, khỉ, mẹ, lê, mũ, củ, chữ |
| Nhóm 3: b m n l | b, m, n, l |
| Nhóm 3: từ có b m n l | bé, bó, mơ, nơ, nến, lê, lọ |
| Nhóm 4: t c k q d đ | t, c, k, q, d, đ |
| Nhóm 4: từ có t c k q d đ | tôm, cam, kéo, quà, dừa, đàn |
| Nhóm 5: h g r s v x | h, g, r, s, v, x |
| Nhóm 5: từ có h g r s v x | hổ, gạo, rau, sữa, vở, xôi |
| Nhóm 6: ă â y p | ă, â, y, p |
| Nhóm 6: từ có ă â y | mắt, răng, cân, cây, mây, tay |

#### Chữ hoa (9 bài, 46 mục)
**3B+ — Chữ hoa, dạy SAU khi bé đã biết chữ thường** (đặt ngay sau "Chữ cái"; nếu chủ đề nằm cuối cấp thì dùng nút ▲ ở tab Nội dung để đưa lên). Mỗi mục là **một cặp "A a"** (chữ hoa + chữ thường), chia **6 nhóm giống chữ thường** + 2 bài chữ ghép (Ch, Gh, Gi, Kh, Ng, Ngh, Nh, Ph, Qu, Th, Tr). **Từ khoá là tên riêng/địa danh** (An, Bình, Hà Nội, Việt Nam…) vì đó là nơi dùng chữ hoa; với Ă, Ơ, Ư, I, Ô, E hiếm mở đầu tên riêng nên dùng **từ đầu câu** (Ăn, Ơi, Ừ, Im, Ông, Em). Bài cuối "Tên riêng viết hoa" luyện **chạm các từ phải viết hoa** trong câu. *Danh sách tên do AI gợi ý — người Việt bản ngữ cần duyệt (tên tự nhiên, trung tính giữa các miền).*

| Bài | Mục |
|---|---|
| Chữ hoa nhóm 1: A O Ô Ơ | A a, O o, Ô ô, Ơ ơ |
| Chữ hoa nhóm 2: I E Ê U Ư | I i, E e, Ê ê, U u, Ư ư |
| Chữ hoa nhóm 3: B M N L | B b, M m, N n, L l |
| Chữ hoa nhóm 4: T C K Q D Đ | T t, C c, K k, Q q, D d, Đ đ |
| Chữ hoa nhóm 5: H G R S V X | H h, G g, R r, S s, V v, X x |
| Chữ hoa nhóm 6: Ă Â Y P | Ă ă, Â â, Y y, P p |
| Chữ hoa ghép 1: Ch Gh Gi Kh Ng Ngh | Ch ch, Gh gh, Gi gi, Kh kh, Ng ng, Ngh ngh |
| Chữ hoa ghép 2: Nh Ph Qu Th Tr | Nh nh, Ph ph, Qu qu, Th th, Tr tr |
| Tên riêng viết hoa | An và Mai đi học., Bà ở Hà Nội., Cô Hoa dạy em hát., Nam và Bình chơi bóng., Mẹ đưa Lan đến trường., Ông kể chuyện về Thánh Gióng. |

#### Ghép âm với nguyên âm (5 bài, 34 mục)
**3C-1 — Âm + nguyên âm đơn.** Bé nghe một từ có hình rồi **ghép âm đầu + phần vần** (b + à = bà). Từ thật, có hình, quen thuộc.

| Bài | Mục |
|---|---|
| Vần a | ba, bà, cá, gà, lá, nhà |
| "Vần e |  ê",  ê",  ê",  ê",  ê",  ê",  ê" |
| Vần i | bi, bí, mì, khỉ, chị, đi |
| "Vần o |  ô,  ô,  ô,  ô,  ô,  ô,  ô,  ô |
| "Vần u |  ư",  ư",  ư",  ư",  ư",  ư",  ư" |

#### Vần có âm cuối (11 bài, 74 mục)
**3C-2 — Vần có âm cuối** (an, ăn, ân, am, at, ang, anh, ac, en, on, ai, oi, ao, au…) — nhóm theo vần, mỗi bài 5–9 từ thật có hình.

| Bài | Mục |
|---|---|
| "Vần an |  ăn,  ăn,  ăn,  ăn,  ăn,  ăn,  ăn |
| "Vần am |  ăm,  ăm,  ăm,  ăm,  ăm,  ăm |
| "Vần at |  ăt,  ăt,  ăt,  ăt,  ăt,  ăt,  ăt |
| "Vần ang |  anh",  anh",  anh",  anh",  anh",  anh",  anh",  anh",  anh" |
| "Vần ac |  ach,  ach,  ach,  ach,  ach,  ach,  ach |
| "Vần en |  ên,  ên,  ên,  ên,  ên,  ên |
| "Vần on |  ôm,  ôm,  ôm,  ôm,  ôm,  ôm,  ôm |
| "Vần ai |  ay,  ay,  ay,  ay,  ay,  ay |
| "Vần oi |  ôi,  ôi,  ôi,  ôi,  ôi,  ôi |
| "Vần ao |  eo",  eo",  eo",  eo",  eo",  eo",  eo",  eo" |
| "Vần au |  âu,  âu,  âu,  âu,  âu |

#### Nguyên âm đôi (4 bài, 27 mục)
**3C-3 — Nguyên âm đôi** ia/ua/ưa, iê, uô, ươ (ia–iê, ua–uô, ưa–ươ là các cặp bé hay lẫn).

| Bài | Mục |
|---|---|
| "Vần ia |  ua,  ua,  ua,  ua,  ua,  ua,  ua,  ua,  ua,  ua |
| Vần iê (yê) | biển, tiền, kiến, miệng, điện, xiếc |
| Vần uô | chuối, muối, chuông, thuốc, buồm |
| Vần ươ | vườn, bướm, trường, đường, cười, ngựa |

#### Phụ âm ghép và chính tả (5 bài, 35 mục)
**3C-4 — Phụ âm ghép** (ch, tr, kh, gh, ngh, gi, ng, nh, ph, qu, th) và **luật chính tả** c/k/q, g/gh, ng/ngh.

| Bài | Mục |
|---|---|
| Âm ch và tr | chó, chim, chuột, chổi, trứng, trăng, trống |
| "Âm kh |  gh và ngh",  gh và ngh",  gh và ngh",  gh và ngh",  gh và ngh",  gh và ngh" |
| "Âm gi |  ng và nh",  ng và nh",  ng và nh",  ng và nh",  ng và nh",  ng và nh" |
| "Âm ph |  qu và th",  qu và th",  qu và th",  qu và th",  qu và th",  qu và th" |
| "Luật chính tả: c/k/q |  g/gh,  g/gh,  g/gh,  g/gh,  g/gh,  g/gh,  g/gh,  g/gh,  g/gh,  g/gh |

#### Đọc từ và câu ngắn (8 bài, 57 mục)
**3D — Đọc từ và câu ngắn.** Dùng lại từ và câu Cấp 1–2 (bé *đã nói được*, nên chỉ việc nhận mặt chữ): đọc từ → chạm hình; sắp xếp các từ thành câu.

| Bài | Mục |
|---|---|
| Đọc từ: con vật quanh nhà | con chó, con mèo, con gà, con vịt, con heo, con bò, con cá |
| Đọc từ: người thân | bố, mẹ, ông, bà, anh, chị |
| Đọc từ: bữa cơm | cơm, phở, bánh mì, trứng, rau, canh |
| Đọc từ: trong nhà | cái giường, cái ghế, cái cửa, cái đèn, cái tivi, cái đồng hồ |
| Đọc câu: chào và cảm ơn | Con chào bà ạ., Con chào ông ạ., Con chào bố ạ., Con chào mẹ ạ., Con cảm ơn mẹ ạ., Con xin lỗi ạ., Con mời bà ăn cơm ạ., Con đi học đây ạ. |
| Đọc câu: nói về gia đình | Đây là bố., Đây là mẹ., Đây là bà., Nhà con có bốn người., Mẹ nấu cơm., Bố đi làm., Bà kể chuyện., Con yêu gia đình. |
| Đọc câu: ăn uống | Con rửa tay., Con ăn cơm., Con uống sữa., Con thích quả chuối., Cơm ngon quá!, Mẹ nấu canh., Nóng quá!, Con ăn phở. |
| Đọc câu: con vật kêu | Con mèo kêu meo meo., Con chó sủa gâu gâu., Con gà gáy ò ó o., Con vịt kêu cạc cạc., Con heo kêu ụt ịt., Con ếch kêu ộp ộp., Trời mưa rồi., Trời nắng đẹp quá. |

**Bảng 29 chữ cái và âm đọc** (cột `say` trong CSV; app đọc *âm*, không đọc *tên chữ*):

| Nhóm | Chữ → âm đọc |
|---|---|
| ① | a → a · o → o · ô → ô · ơ → ơ |
| ② | i → i · e → e · ê → ê · u → u · ư → ư |
| ③ | b → bờ · m → mờ · n → nờ · l → lờ |
| ④ | t → tờ · c → cờ · k → cờ · q → cờ · d → dờ · đ → đờ |
| ⑤ | h → hờ · g → gờ · r → rờ · s → sờ · v → vờ · x → xờ |
| ⑥ | ă → á · â → ớ · y → i dài · p → pờ |

- Thứ tự nhóm là **thiết kế riêng** cho học qua app (dễ nghe → khó phân biệt), *không sao chép* một bộ SGK; các bộ Tiếng Việt 1 trong nước sắp xếp khác nhau. Chữ in thường trước; **chữ hoa chưa soạn** (làm ở bản sau, gắn với tên riêng: An, Bình…).
- **Thanh điệu:** 6 thanh nhưng chỉ 5 dấu (thanh ngang không dấu). Mẹo hình: ngang = mặt hồ phẳng ➖, sắc = mũi tên lên ↗️, huyền = cầu tuột ↘️, hỏi = lượn xuống rồi lên ❓, ngã = sóng gồ ghề 〰️, nặng = rơi bịch ⬇️.
- **Ghi chú cho phụ huynh song ngữ:** nghĩa tiếng Đức/Anh của các bài thanh điệu ghi kèm tên thanh (vd "Wange (Ton sắc: steigend)") để phụ huynh biết bé đang học cặp nào.
- **Đối chiếu Chào tiếng Việt cấp 1:** nhà xuất bản chỉ công bố *mục tiêu chung* (chữ cái, phụ âm, nguyên âm, thanh điệu, học qua trò chơi/bài hát); **không công bố danh sách bài** nên Cấp 3 này *bám định hướng*, chưa đối chiếu từng bài. Người duyệt có sách trong tay nên đối chiếu và ghi lại chỗ khác.
- **Âm thanh:** TTS đọc **chữ/vần đơn lẻ** dễ sai (cột `say` giúp: "b" → "bờ", nhưng vẫn phải **nghe thử từng chữ cái**). Nên **thu giọng người thật** cho 29 chữ cái + các vần khoá (vài chục file, tải ở tab Nội dung).
- **Từ khoá có thể lệch vùng miền:** lạc (Bắc) = đậu phộng (Nam), bát/chén, hổ/cọp, mận/roi, thơm/dứa. CSV dùng cách nói miền Bắc; admin sửa tại tab Nội dung.

### Cấp 4 — Gà trống 🐓 (đọc hiểu, chính tả, viết, kể chuyện)

Cầu nối sang **Tiếng Việt lớp 1–2**, sách **"Chào tiếng Việt" cấp 2–3** hoặc lớp Việt ngữ tại chỗ. Bắt đầu khi bé **đã đọc được từ và câu ngắn** (xong phần lớn Cấp 3) — app chỉ *gợi ý*, không khoá.

- **Dữ liệu:** `csv/cap4-ga-trong-doc-hieu.csv` — **208 mục, 29 bài, 6 chủ đề** (nhập được ngay; cần migration `009_reading.sql`). Bảng dưới sinh từ chính file này.
- **Chuẩn đầu ra ("con làm được"):** đọc **đoạn 4–6 câu** và trả lời câu hỏi (ai, làm gì, ở đâu, thế nào); **xếp câu thành đoạn**, nhận ra câu **viết đúng** (viết hoa đầu câu, dấu câu); **viết đúng chính tả** các từ dễ lẫn; nói được từ **chỉ hoạt động/đặc điểm** và đặt câu; **kể lại** truyện ngắn theo tranh; biết một số **tục ngữ, ca dao**.
- **Nhịp học:** 2–3 bài/tuần → ~10–12 tuần. Có thể chạy xen: đoạn văn ↔ truyện cổ tích ↔ chính tả.
- **Qua cấp khi:** ≥ 80% số mục đạt mức thuộc ≥ 3/5 **và** bé kể lại được 1 truyện ngắn bằng 3–4 câu (phụ huynh nghe).
- **Câu hỏi đọc hiểu** là mục riêng (`type` = `question`, cột `choices` các đáp án cách nhau bằng `|`, cột `answer` = số thứ tự đáp án đúng). App xáo thứ tự đáp án mỗi lần; câu hỏi **không** tính vào "số từ đã thuộc".

**Hoạt động mới của Cấp 4:**

| Hoạt động | Bé làm gì | Dạy gì |
|---|---|---|
| `read_quiz` đọc đoạn – trả lời | Đọc/nghe cả đoạn (bấm 🔊 từng câu hoặc "Nghe cả đoạn"), rồi chọn đáp án; có nút "Đọc lại đoạn văn" | đọc hiểu |
| `order_story` xếp câu thành chuyện | Chạm các câu (có hình) theo đúng trình tự; mỗi lần chạm nghe câu đó | trình tự, kể chuyện |
| `fill_word` điền từ | Câu bị bỏ 1 từ, chọn từ đúng trong 3 từ | từ vựng, ngữ pháp |
| `write_check` chọn câu viết đúng | Chọn câu viết hoa/dấu câu đúng trong 3 câu (2 câu sai: quên viết hoa, thiếu/sai dấu) | viết hoa, dấu câu |
| `spell_word` chính tả | Nghe + xem hình, xếp chữ cái thành từ (có 2 chữ nhiễu) | chính tả |
| `order_words`, `read_pick`, `listen_repeat`, `match` (đã có) | Xếp từ thành câu; đọc – chạm hình; nói theo được chấm; ghép | củng cố |

**Nội dung:**

#### Đọc đoạn văn ngắn (6 bài, 48 mục)
Đoạn 5 câu về đời sống của bé (gia đình, buổi sáng, Tết, ngày mưa, thú cưng, trường học) + **3 câu hỏi đọc hiểu** (ai, làm gì, ở đâu, thế nào). Bé đọc/nghe đoạn văn, xếp lại các câu theo trình tự, điền từ còn thiếu, đọc theo.

| Bài | Câu/từ | Câu hỏi | Hoạt động |
|---|---|---|---|
| Gia đình của Nam | 5 | 3 | `read_quiz` `order_story` `fill_word` `listen_repeat` |
| Buổi sáng của em | 5 | 3 | `read_quiz` `order_story` `fill_word` `listen_repeat` |
| Tết ở nhà bà | 5 | 3 | `read_quiz` `order_story` `fill_word` `listen_repeat` |
| Ngày mưa | 5 | 3 | `read_quiz` `order_story` `fill_word` `listen_repeat` |
| Chú mèo của em | 5 | 3 | `read_quiz` `order_story` `fill_word` `listen_repeat` |
| Ở trường | 5 | 3 | `read_quiz` `order_story` `fill_word` `listen_repeat` |

#### Truyện cổ tích và truyền thuyết (9 bài, 67 mục)
Truyện quen thuộc **rút gọn thành 5–6 câu mỗi phần** (Sự tích bánh chưng bánh giầy, Thánh Gióng, Hồ Gươm, Con Rồng cháu Tiên, Tấm Cám, Sơn Tinh – Thủy Tinh), mỗi phần kèm 2 câu hỏi. Truyện dài chia 2 phần. Giữ đúng các tình tiết chính; **không** có tình tiết bạo lực (Tấm Cám dừng ở lúc Tấm làm hoàng hậu).

| Bài | Câu/từ | Câu hỏi | Hoạt động |
|---|---|---|---|
| Sự tích bánh chưng bánh giầy (1) | 5 | 2 | `read_quiz` `order_story` `fill_word` `listen_repeat` |
| Sự tích bánh chưng bánh giầy (2) | 5 | 2 | `read_quiz` `order_story` `fill_word` `listen_repeat` |
| Thánh Gióng (1) | 5 | 2 | `read_quiz` `order_story` `fill_word` `listen_repeat` |
| Thánh Gióng (2) | 6 | 2 | `read_quiz` `order_story` `fill_word` `listen_repeat` |
| Sự tích Hồ Gươm | 6 | 2 | `read_quiz` `order_story` `fill_word` `listen_repeat` |
| Con Rồng cháu Tiên | 6 | 2 | `read_quiz` `order_story` `fill_word` `listen_repeat` |
| Tấm Cám (1) | 5 | 2 | `read_quiz` `order_story` `fill_word` `listen_repeat` |
| Tấm Cám (2) | 5 | 2 | `read_quiz` `order_story` `fill_word` `listen_repeat` |
| Sơn Tinh và Thủy Tinh | 6 | 2 | `read_quiz` `order_story` `fill_word` `listen_repeat` |

#### Ca dao, tục ngữ và đồng dao (3 bài, 17 mục)
Tục ngữ ngắn về **biết ơn, gia đình, học tập, đoàn kết**; ca dao và đồng dao quen thuộc. Nghĩa tiếng Đức/Anh ghi kèm ý nghĩa để phụ huynh giải thích cho bé.

| Bài | Câu/từ | Câu hỏi | Hoạt động |
|---|---|---|---|
| Tục ngữ: biết ơn và gia đình | 6 | — | `read_pick` `fill_word` `order_words` `listen_repeat` |
| Tục ngữ: học tập và đoàn kết | 6 | — | `read_pick` `fill_word` `order_words` `listen_repeat` |
| Ca dao và đồng dao | 5 | — | `read_pick` `fill_word` `order_words` `listen_repeat` |

#### Viết đúng chính tả (4 bài, 33 mục)
**Viết hoa** đầu câu và tên riêng; **dấu câu** (chấm, chấm hỏi, chấm than, phẩy); **chính tả** dễ lẫn: c/k/q, g/gh, ng/ngh, ch/tr, s/x, d/gi/r. Bé chọn câu viết đúng, xếp chữ cái thành từ.

| Bài | Câu/từ | Câu hỏi | Hoạt động |
|---|---|---|---|
| Viết hoa đầu câu và tên riêng | 6 | — | `write_check` `fill_word` `order_words` `listen_repeat` |
| Dấu câu: chấm, chấm hỏi, chấm than | 7 | — | `write_check` `fill_word` `order_words` `listen_repeat` |
| Chính tả: c, k, q, g, gh, ng, ngh | 10 | — | `spell_word` `fill_letter` `read_pick` `listen_repeat` |
| Chính tả: ch, tr, s, x, d, gi, r | 10 | — | `spell_word` `fill_letter` `read_pick` `listen_repeat` |

#### Từ chỉ hoạt động và đặc điểm (3 bài, 23 mục)
Từ chỉ **hoạt động** (nhảy, bơi, viết…) và **đặc điểm** (to, nhỏ, nhanh, chậm…) rồi **đặt câu** với chúng — chuẩn bị cho tiết "từ và câu" của Tiếng Việt lớp 1–2.

| Bài | Câu/từ | Câu hỏi | Hoạt động |
|---|---|---|---|
| Từ chỉ hoạt động | 8 | — | `read_pick` `spell_word` `match` `listen_repeat` |
| Từ chỉ đặc điểm | 8 | — | `read_pick` `spell_word` `match` `listen_repeat` |
| Đặt câu với từ chỉ đặc điểm | 7 | — | `fill_word` `order_words` `write_check` `listen_repeat` |

#### Kể chuyện theo tranh (4 bài, 20 mục)
Truyện 5 tranh (gieo hạt, đi chợ, cơn mưa, sinh nhật): bé **xếp các câu theo đúng trình tự** rồi kể lại — luyện kể chuyện theo tranh.

| Bài | Câu/từ | Câu hỏi | Hoạt động |
|---|---|---|---|
| Em trồng cây | 5 | — | `order_story` `order_words` `read_pick` `listen_repeat` |
| Đi chợ cùng mẹ | 5 | — | `order_story` `order_words` `read_pick` `listen_repeat` |
| Cơn mưa và cầu vồng | 5 | — | `order_story` `order_words` `read_pick` `listen_repeat` |
| Sinh nhật của Lan | 5 | — | `order_story` `order_words` `read_pick` `listen_repeat` |

**Lưu ý khi duyệt Cấp 4 (bắt buộc có người Việt bản ngữ):**
- **Truyện cổ tích/truyền thuyết** là bản *rút gọn do AI soạn* từ các tình tiết phổ biến; các bản kể trong sách giáo khoa có thể khác chi tiết (vd tên nhân vật, thứ tự sự kiện). Đối chiếu với sách bé sẽ học, sửa ở tab Nội dung (sửa chữ sẽ xoá âm thanh cũ → sinh lại).
- **Tục ngữ/ca dao/đồng dao** có nhiều dị bản; đã chọn bản phổ biến nhất. Nghĩa tiếng Đức/Anh là *giải thích ý nghĩa*, không dịch từng chữ.
- **Câu hỏi đọc hiểu:** đáp án nhiễu đã chọn để bé không đoán được bằng loại trừ ngớ ngẩn — kiểm tra lại từng câu.
- **Điền từ** tự bỏ 1 từ thường trong câu, đáp án nhiễu lấy từ các từ khác trong bài: đôi khi một từ nhiễu cũng hợp nghĩa. Nếu gặp câu như vậy, sửa câu gốc cho rõ nghĩa hơn.
- **Giọng đọc đoạn dài:** TTS đọc từng *câu* (không đọc cả đoạn một lần), nên ngắt nhịp tự nhiên; nghe thử để chắc dấu thanh đúng.
- **Chưa có:** tập viết tay/tô chữ, viết đoạn tự do, đọc to cả đoạn có chấm điểm, chữ hoa A–Z đầy đủ, truyện dài hơn.

## 4. Cách học (gợi ý cho phụ huynh và người dạy)

- **10–15 phút/lần, 4–5 lần/tuần** hơn là 1 giờ/tuần. Ngắn, đều, có phần thưởng nhỏ (sao).
- **Vòng xoáy:** mỗi bài = *học từ mới (nghe, nhìn hình)* → *chơi (nghe–chạm, ghép cặp, nói theo)* → *ôn từ cũ*. Từ chưa thuộc tự quay lại.
- **Bố mẹ 5–10 phút/ngày:** cùng con nghe từ, hỏi lại bằng tiếng Việt ở nhà ("cái gì đây?", "con muốn gì?"). Khu phụ huynh sẽ có
  chế độ "cùng học" (nghĩa tiếng Đức/Anh + nút nghe) để phụ huynh chưa giỏi tiếng Việt vẫn đồng hành được — **tính năng này chưa làm**.
- **Sai không sao:** app khuyến khích, không "chấm sai"; tiếng Việt có 6 thanh nên cần nghe nhiều trước khi nói đúng.
- **Lễ phép:** dạy sớm cách xưng hô và câu lễ phép (dạ, ạ, mời, xin phép) vì đó là phần văn hoá quan trọng và dễ mất nhất ở trẻ ở nước ngoài.

## 5. Giọng vùng miền và cách xưng hô

Tiếng Việt khác nhau giữa Bắc/Trung/Nam ở một số từ thường dùng. **CSV mặc định dùng cách nói miền Bắc** (phổ biến trong nhiều
cộng đồng ở châu Âu). Người duyệt/admin **sửa trực tiếp** cho hợp gia đình các cháu:

| Mặc định trong CSV (Bắc) | Cách nói khác (Nam) |
|---|---|
| bố, mẹ | ba, má (hoặc tía, má) |
| con heo *(CSV đang dùng)* | con lợn (Bắc) — cả hai đều đúng, chọn 1 cách |
| quả chuối, quả táo… | trái chuối, trái táo… |
| cái bát | cái chén |
| xin chào, chúc ngủ ngon… | (giống nhau) |

Hiện app chưa hỗ trợ **nhiều biến thể vùng miền cho cùng 1 mục**; chỉ có cột `region` cho *âm thanh* (mục 7). Nên chọn 1 phiên bản
cho toàn bộ nội dung để trẻ khỏi rối.

## 6. Đối chiếu để "học lên cao"

Đối chiếu **xấp xỉ** (mục đích định hướng, không phải quy đổi chính thức):

| Cấp của app | Chương trình cho người Việt ở nước ngoài | Sách "Chào tiếng Việt" | Trong nước | Thang CEFR (tham chiếu) |
|---|---|---|---|---|
| 1 Trứng (3–4) | Tiền bậc 1 (nghe, từ vựng) | Chuẩn bị trước cấp 1 | Mầm non 3–4 tuổi: phát triển ngôn ngữ | — |
| 2 Gà con (4–6) | Bậc 1 (nói, nghe) | Cấp 1–2 (phần nói) | Mầm non 4–5 tuổi | ~A1 (nói) |
| 3 Gà choai (5–7) | Bậc 1 (ngữ âm, đọc–viết nhập môn) | Cấp 1 (ngữ âm + thanh) | Mầm non 5–6 → Tiếng Việt lớp 1 (học vần) | ~A1 |
| 4 Gà trống (6–8+) | Bậc 2 | Cấp 2–3 | Tiếng Việt lớp 1 cuối – lớp 2 | ~A2 |

**Kiểm tra trước khi cam kết "tương đương":** nhờ một giáo viên đối chiếu từng cấp với (a) toàn văn TT 28/2018, (b) sách "Chào tiếng Việt" cấp 1–2
thực tế, (c) Tiếng Việt lớp 1 bộ sách mà cháu sẽ học nếu về nước. Phần **viết tay** (tập viết nét, tô chữ) app **chưa** thay được — cần vở tập viết ngoài app.

## 7. Việc còn thiếu để làm trọn vẹn (yêu cầu cho app, chưa làm)

| Cần | Vì sao | Ghi chú kỹ thuật |
|---|---|---|
| ~~Kiểu mục `letter`/`syllable`, hoạt động nghe–chọn thanh, ghép âm + vần, điền chữ, đọc–chạm hình, sắp xếp câu~~ | Cấp 3 | **Đã làm** (migration 008, `child/activities/phonics.js`) |
| Hoạt động **đánh vần theo** (đọc từng phần: bờ – a – ba – huyền – bà) | Cấp 3 | Cần âm thanh từng phần → thu giọng người thật cho 29 chữ cái + vần khoá |
| **Chữ hoa**, **tập viết nét/tô chữ** | Cấp 3–4 | Chữ hoa thêm bằng CSV; tô chữ cần canvas + dữ liệu nét (làm sau) |
| **Thứ tự chủ đề** (kéo thả / nút lên–xuống) | Hiện thứ tự = thứ tự tạo; 2 chủ đề mẫu đang đứng đầu | Trước mắt: **xoá 2 chủ đề mẫu rồi nhập `cap1…csv`** để đúng thứ tự (chưa có học sinh thật) |
| Âm thanh **người thật** cho chữ cái/vần | TTS đọc chữ đơn lẻ dễ sai | Đã có sẵn cột `source=human`, `voice_kind`, `region` — chỉ cần thu và tải lên |
| **Biến thể vùng miền** của từ (ba/bố…) | Mục 5 | Cột riêng theo vùng hoặc bộ nội dung riêng |
| **Kiểm tra cuối cấp** + báo cáo "đã đạt cấp" | Điều kiện lên cấp (mục 3) | Dùng `child_progress.mastery` + `pronunciation_attempts` |
| Nội dung **Cấp 2 mở rộng** (thêm chủ đề: đi chợ, bác sĩ, các mùa…) và **Cấp 4 mở rộng** (thêm truyện, đoạn văn, chính tả) | Mục 3 | Soạn bằng AI theo `csv` mẫu rồi duyệt |
| **Viết tay**, **viết đoạn tự do**, **đọc to cả đoạn có chấm điểm** | Cấp 4+ | Cần canvas viết tay / nhận dạng giọng dài — chưa làm |

## 8. Quy trình duyệt chất lượng (bắt buộc — nội dung do AI soạn)

Người duyệt là **người Việt bản ngữ**; nếu được thì nhờ **giáo viên tiểu học/mầm non**. Kiểm từng mục theo bảng:

- [ ] **Chính tả & dấu thanh** đúng (ví dụ "hươu", "gió", "cầu vồng"); từ ngữ **tự nhiên với trẻ nhỏ**.
- [ ] **Xưng hô/lễ phép** đúng văn hoá (dạ, ạ, mời, xin phép); không có nội dung không phù hợp lứa tuổi.
- [ ] **Vùng miền** thống nhất (mục 5); từ khó/hiếm thì thay từ quen hơn.
- [ ] **Nghĩa tiếng Đức/Anh** đúng và dùng được khi đọc lên (người bản ngữ Đức/Anh hoặc phụ huynh song ngữ kiểm).
- [ ] **Emoji** hiển thị được trên iPhone, Android và Windows và **không gây hiểu lầm** (đã tránh emoji mới hoặc lá cờ; kiểm tra lại trên máy thật).
  Vài emoji chỉ gần đúng: 👗 cho *áo dài*, 🎋 cho *cây tre*, 🟩 cho *bánh chưng*, 💇 cho *tóc* — nên thay bằng ảnh thật khi có.
- [ ] **Chi tiết văn hoá**: Tết, Trung thu, lì xì… đúng phong tục; câu đồng dao chọn bản chuẩn.
- [ ] **Nghe thử TTS** từng bài (đúng dấu thanh) rồi mới **Duyệt**; chỗ TTS đọc sai thì thu giọng người thật.

Điểm cần nhờ người duyệt chú ý riêng trong 2 file này: cách nói *"con mời bà ăn cơm ạ"*, *"con heo kêu ụt ịt"*, *"con ếch kêu ộp ộp"*, *"con gà gáy ò ó o"*,
các câu dịch sang tiếng Đức của *Tết/lì xì/bánh chưng* (giữ tên riêng + giải thích ngắn), và cách gọi *chú/cô* (theo họ hàng bên nội hay ngoại).

## 9. Cách đưa vào app

1. Thay 2 chủ đề mẫu (nếu muốn đúng thứ tự): tab **Nội dung → Xoá** chủ đề "Con vật" và "Màu sắc" (chưa có học sinh thật).
2. Tab **Nhập CSV** (chạy migration `007_levels_stats.sql` trước) → chọn `giao-trinh/csv/cap1-trung-tu-vung.csv` → **Kiểm tra** (phải 0 lỗi, 0 cảnh báo) → **Nhập vào**.
3. Tab **Cài đặt → Giọng đọc (TTS)**: nghe thử và chọn giọng (nam/nữ) cho tiếng Việt và tiếng bản ngữ.
4. Tab **Nội dung**: mở từng chủ đề → **Sinh âm thanh còn thiếu** → nghe kiểm tra → **Duyệt** khi người duyệt đã đồng ý.
5. Làm tương tự với `cap2-ga-con-cau-ngan.csv` (sau khi Cấp 1 đã có người học). **Cột `level` trong CSV** (1–4) đưa chủ đề vào đúng cấp; đã nhập từ trước thì nhập lại file để cập nhật cấp, hoặc đổi bằng ô chọn ở tab Nội dung.
6. Chạy migration `008_phonics.sql`, rồi nhập `cap3-ga-choai-hoc-van.csv` (mỗi bài đã ghi sẵn bộ hoạt động ở cột `activities`; sau khi nhập vào tab **Nội dung**, **nghe thử TTS từng chữ cái** — chỗ đọc sai thì thu giọng người thật). Nhập Cấp 3 **sau** khi Cấp 1–2 đã có người học.
5b. Chạy migration `009_reading.sql`, rồi nhập `cap4-ga-trong-doc-hieu.csv` (nhập sau Cấp 3). File có cột `choices`/`answer` cho câu hỏi đọc hiểu; app kiểm tra và báo lỗi nếu câu hỏi thiếu đáp án.
7. Mỗi lần sửa file CSV, chạy `node tests/curriculum.test.mjs` để kiểm lỗi (trùng emoji trong bài, thiếu nghĩa, khớp dữ liệu mẫu).

Nội dung mới: dùng nút **"Sao chép câu lệnh cho AI"** ở tab Nhập CSV, dán vào AI, tải kết quả, **kiểm tra** bằng chính tab đó rồi mới đưa người duyệt.

## 10. Nguồn

- Thông tư 28/2018/TT-BGDĐT (Chương trình tiếng Việt cho người Việt Nam ở nước ngoài):
  <https://luatvietnam.vn/giao-duc/thong-tu-28-2018-tt-bgddt-chuong-trinh-tieng-viet-cho-nguoi-viet-nam-o-nuoc-ngoai-169367-d1.html>
- "Chào tiếng Việt" — NXB Giáo dục Việt Nam: <https://www.nxbgd.vn/bai-viet/chao-tieng-viet-mot-cach-tiep-can-moi-trong-viec-day-tieng-viet-cho-tre-em-o-nuoc-ngoai>
- Sách "Chào tiếng Việt" cấp độ 1 và 2 (Uỷ ban Nhà nước về người Việt Nam ở nước ngoài): <https://scov.gov.vn/su-kien/day-va-hoc-tieng-viet/nam-2023/sach-chao-tieng-viet-cap-do-1-va-2-danh-cho-tre-em-viet-nam-o-nuoc-ngoai-dat-giai-a.html>
- Ra mắt chương trình dạy tiếng Việt cho trẻ em Việt ở nước ngoài (Tuổi Trẻ, 2023): <https://tuoitre.vn/ra-mat-chuong-trinh-day-hoc-tieng-viet-cho-tre-em-viet-o-nuoc-ngoai-20230331182454809.htm>
- Chương trình GDPT 2018 môn Ngữ văn (Bộ GD&ĐT): <https://dienbien.edu.vn/uploads/doi-moi-chuong-trinh-gdpt/2ct_ngu-van.pdf>
- Khung năng lực tiếng Việt cho người nước ngoài (TT 17/2015/TT-BGDĐT): <https://luatvietnam.vn/giao-duc/thong-tu-17-2015-tt-bgddt-bo-giao-duc-va-dao-tao-97909-d1.html>
- Teaching Vietnamese as a Heritage Language (Vietnam Social Sciences Review): <https://vjol.info.vn/index.php/VSS/article/download/127331/104427/>
- Developing Lesson Plans for Vietnamese Students in the Heritage Language context (ERIC): <https://files.eric.ed.gov/fulltext/EJ1066282.pdf>
