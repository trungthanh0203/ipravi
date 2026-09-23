-- 004_unit_descriptions.sql — nội dung diễn giải cho MỌI chủ đề của giáo trình hiện có trong giao-trinh/csv/ (44 chủ đề),
-- hiện ngay dưới tên chủ đề ở màn danh sách bài (child/pages/child-home.js, showLessons). Cần migration 021 (cột units.description).
-- Chạy TAY trong SQL Editor (Supabase), sau khi đã nhập đủ 5 file CSV giáo trình. Chạy lại nhiều lần không hại.
-- Chỉ BỔ SUNG: chủ đề nào đã có description (sửa tay trong khu admin) thì GIỮ NGUYÊN, không bị ghi đè.
-- Khớp theo tên chủ đề; chủ đề không có trong CSDL (chưa nhập CSV) thì bỏ qua, không báo lỗi.

begin;

update public.units u set description = v.description
from (values

  -- ---- Cấp 2 · Từ vựng cơ bản (cap1-trung-tu-vung.csv) ----
  ('Chào hỏi và lễ phép', 'Chủ đề dạy bé những câu chào hỏi và lời lễ phép đầu tiên.'),
  ('Gia đình', 'Chủ đề dạy bé từ vựng về các thành viên trong gia đình.'),
  ('Cơ thể', 'Chủ đề dạy bé tên gọi các bộ phận trên cơ thể.'),
  ('Con vật', 'Chủ đề dạy bé tên gọi những con vật quen thuộc quanh nhà và ở sở thú.'),
  ('Màu sắc', 'Chủ đề dạy bé tên các màu sắc và hình khối cơ bản.'),
  ('Số đếm', 'Chủ đề dạy bé đếm số từ một đến mười.'),
  ('Ăn uống', 'Chủ đề dạy bé từ vựng về bữa cơm, đồ uống và bánh kẹo.'),
  ('Trái cây', 'Chủ đề dạy bé tên gọi những loại trái cây quen thuộc.'),
  ('Đồ chơi và đồ dùng học tập', 'Chủ đề dạy bé tên gọi đồ chơi và đồ dùng học tập thường dùng.'),
  ('Ngôi nhà', 'Chủ đề dạy bé từ vựng về các phòng và đồ vật trong nhà.'),
  ('Thiên nhiên và thời tiết', 'Chủ đề dạy bé từ vựng về thời tiết và cảnh vật trong thiên nhiên.'),
  ('Quần áo và xe cộ', 'Chủ đề dạy bé tên gọi quần áo và các phương tiện đi lại.'),
  ('Việc hằng ngày và cảm xúc', 'Chủ đề dạy bé từ vựng về việc làm hằng ngày và cách gọi tên cảm xúc.'),
  ('Tết và Việt Nam', 'Chủ đề dạy bé về ngày Tết và những điều quen thuộc của Việt Nam.'),
  ('Giờ giấc', 'Chủ đề dạy bé nhận biết các buổi trong ngày và cách xem giờ đơn giản.'),
  ('Thứ trong tuần', 'Chủ đề dạy bé gọi tên bảy ngày trong tuần và các mốc hôm qua, hôm nay, ngày mai.'),
  ('Vị trí', 'Chủ đề dạy bé các từ chỉ vị trí như trên, dưới, trong, ngoài.'),

  -- ---- Cấp 3 · Câu ngắn (cap2-ga-con-cau-ngan.csv) ----
  ('Lễ phép với người thân', 'Chủ đề dạy bé nói những câu lễ phép, chào hỏi và cảm ơn với người thân.'),
  ('Gia đình của con', 'Chủ đề dạy bé nói những câu ngắn giới thiệu về gia đình mình.'),
  ('Con cần gì', 'Chủ đề dạy bé nói những câu ngắn khi cần điều gì đó.'),
  ('Bữa ăn', 'Chủ đề dạy bé nói những câu ngắn lễ phép trong bữa ăn.'),
  ('Ở trường', 'Chủ đề dạy bé nói những câu ngắn về một ngày đi học.'),
  ('Tiếng kêu và thời tiết', 'Chủ đề dạy bé nói những câu ngắn về tiếng kêu con vật và thời tiết.'),
  ('Tết và lễ hội', 'Chủ đề dạy bé nói những câu ngắn về không khí ngày Tết và lễ hội.'),
  ('Cảm xúc và lễ phép', 'Chủ đề dạy bé nói những câu ngắn diễn tả cảm xúc và cư xử lễ phép.'),
  ('Sự việc theo thời gian', 'Chủ đề dạy bé nói câu theo ba thì: việc đã làm, đang làm và sẽ làm.'),

  -- ---- Cấp 1 · Học vần (cap3-ga-choai-hoc-van.csv) ----
  ('Sáu thanh điệu', 'Chủ đề giúp bé nghe và nhận ra 6 thanh điệu của tiếng Việt: ngang, sắc, huyền, hỏi, ngã, nặng.'),
  ('Chữ cái', 'Chủ đề giúp bé làm quen mặt chữ và cách đọc 29 chữ cái tiếng Việt theo từng nhóm.'),
  ('Chữ hoa', 'Chủ đề giúp bé nhận biết và ghép chữ hoa tương ứng với chữ thường đã học.'),
  ('Ghép âm với nguyên âm', 'Chủ đề giúp bé tập ghép phụ âm với nguyên âm để đọc thành vần đơn giản.'),
  ('Vần có âm cuối', 'Chủ đề giúp bé đọc các vần có âm cuối thường gặp trong tiếng Việt.'),
  ('Nguyên âm đôi', 'Chủ đề giúp bé đọc các vần có nguyên âm đôi như ia, uô, ươ.'),
  ('Phụ âm ghép và chính tả', 'Chủ đề giúp bé phân biệt các âm dễ nhầm lẫn khi viết như ch/tr, kh/gh/ngh.'),
  ('Đọc từ và câu ngắn', 'Chủ đề giúp bé ghép những gì đã học để đọc từ và câu ngắn quen thuộc trong đời sống.'),

  -- ---- Cấp 4 · Đọc hiểu (cap4-ga-trong-doc-hieu.csv) ----
  ('Đọc đoạn văn ngắn', 'Chủ đề giúp bé đọc hiểu những đoạn văn ngắn về cuộc sống hằng ngày.'),
  ('Truyện cổ tích và truyền thuyết', 'Chủ đề giúp bé đọc hiểu những câu chuyện cổ tích và truyền thuyết quen thuộc của Việt Nam.'),
  ('Ca dao, tục ngữ và đồng dao', 'Chủ đề giúp bé đọc và tìm hiểu ý nghĩa những câu ca dao, tục ngữ, đồng dao quen thuộc.'),
  ('Viết đúng chính tả', 'Chủ đề giúp bé luyện viết đúng chính tả, dấu câu và viết hoa đúng chỗ.'),
  ('Từ chỉ hoạt động và đặc điểm', 'Chủ đề giúp bé nhận biết và dùng từ chỉ hoạt động, từ chỉ đặc điểm khi đặt câu.'),
  ('Kể chuyện theo tranh', 'Chủ đề giúp bé sắp xếp câu để kể lại một câu chuyện theo tranh.'),

  -- ---- Chủ đề hội thoại (hoi-thoai-giao-tiep.csv, 4 cấp) ----
  ('Chủ đề hội thoại cấp 1', 'Chủ đề giúp bé nghe và tập nói những câu hội thoại đơn giản đầu tiên.'),
  ('Chủ đề hội thoại cấp 2', 'Chủ đề giúp bé nghe và tập nói những câu hội thoại quen thuộc trong đời sống.'),
  ('Chủ đề hội thoại cấp 3', 'Chủ đề giúp bé nghe và tập nói những câu hội thoại lễ phép trong nhiều tình huống.'),
  ('Chủ đề hội thoại cấp 4', 'Chủ đề giúp bé nghe và tập nói khi kể lại những câu chuyện đã đọc.')

) as v(title_vi, description)
where u.title_vi = v.title_vi and not u.hidden and u.description is null;

commit;

-- Kiểm tra: số chủ đề đã có diễn giải
select count(*) as chu_de_co_dien_giai from public.units where description is not null;
