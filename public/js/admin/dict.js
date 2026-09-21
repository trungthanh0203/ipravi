// Từ điển khởi đầu cho "Thêm nhanh": chữ Việt → [emoji, nghĩa Đức, nghĩa Anh]. CHỈ dùng khi từ chưa có trong CSDL (từ đã có được ưu tiên).
// Không phải bản dịch tự động: đây là những từ/cụm từ thông dụng của giáo trình, do người soạn viết tay. Từ không có ở đây thì để trống bản dịch
// cho admin điền (app KHÔNG gọi dịch vụ AI/dịch máy). Thêm từ mới vào đây nếu muốn "Thêm nhanh" biết thêm. Test: tests/autofill.test.mjs.
// Khoá bỏ từ loại đầu (con/quả/cái…) vẫn tra được: gõ "chó" ra "con chó".
export const DICT = {
  // Con vật
  "con chó": ["🐶", "Hund", "dog"], "con mèo": ["🐱", "Katze", "cat"], "con gà": ["🐔", "Huhn", "chicken"], "con vịt": ["🦆", "Ente", "duck"],
  "con bò": ["🐮", "Kuh", "cow"], "con heo": ["🐷", "Schwein", "pig"], "con ngựa": ["🐴", "Pferd", "horse"], "con voi": ["🐘", "Elefant", "elephant"],
  "con hổ": ["🐯", "Tiger", "tiger"], "con sư tử": ["🦁", "Löwe", "lion"], "con khỉ": ["🐵", "Affe", "monkey"], "con thỏ": ["🐰", "Hase", "rabbit"],
  "con cá": ["🐟", "Fisch", "fish"], "con chim": ["🐦", "Vogel", "bird"], "con bướm": ["🦋", "Schmetterling", "butterfly"], "con ong": ["🐝", "Biene", "bee"],
  "con rùa": ["🐢", "Schildkröte", "turtle"], "con ếch": ["🐸", "Frosch", "frog"], "con rắn": ["🐍", "Schlange", "snake"], "con cua": ["🦀", "Krabbe", "crab"],
  "con gấu": ["🐻", "Bär", "bear"], "con hươu cao cổ": ["🦒", "Giraffe", "giraffe"], "con cừu": ["🐑", "Schaf", "sheep"], "con dê": ["🐐", "Ziege", "goat"],
  "con chuột": ["🐭", "Maus", "mouse"], "con kiến": ["🐜", "Ameise", "ant"], "con cá heo": ["🐬", "Delfin", "dolphin"], "con cá mập": ["🦈", "Hai", "shark"],
  "con tôm": ["🦐", "Garnele", "shrimp"], "con ốc sên": ["🐌", "Schnecke", "snail"], "con nhện": ["🕷️", "Spinne", "spider"], "con ngỗng": ["🦢", "Gans", "goose"],
  "con cáo": ["🦊", "Fuchs", "fox"], "con sói": ["🐺", "Wolf", "wolf"], "con gấu trúc": ["🐼", "Panda", "panda"], "con cá sấu": ["🐊", "Krokodil", "crocodile"],
  // Trái cây, đồ ăn
  "quả táo": ["🍎", "Apfel", "apple"], "quả chuối": ["🍌", "Banane", "banana"], "quả cam": ["🍊", "Orange", "orange"], "quả xoài": ["🥭", "Mango", "mango"],
  "quả dưa hấu": ["🍉", "Wassermelone", "watermelon"], "quả nho": ["🍇", "Weintraube", "grape"], "quả dâu": ["🍓", "Erdbeere", "strawberry"], "quả lê": ["🍐", "Birne", "pear"],
  "quả đào": ["🍑", "Pfirsich", "peach"], "quả dứa": ["🍍", "Ananas", "pineapple"], "quả chanh": ["🍋", "Zitrone", "lemon"], "quả dừa": ["🥥", "Kokosnuss", "coconut"],
  "quả cà chua": ["🍅", "Tomate", "tomato"], "quả bơ": ["🥑", "Avocado", "avocado"], "quả cherry": ["🍒", "Kirsche", "cherry"],
  "cơm": ["🍚", "Reis", "rice"], "phở": ["🍜", "Nudelsuppe", "noodle soup"], "bánh mì": ["🥖", "Brot", "bread"], "trứng": ["🥚", "Ei", "egg"], "sữa": ["🥛", "Milch", "milk"],
  "nước": ["💧", "Wasser", "water"], "kẹo": ["🍬", "Bonbon", "candy"], "kem": ["🍦", "Eis", "ice cream"], "thịt": ["🥩", "Fleisch", "meat"], "rau": ["🥬", "Gemüse", "vegetables"],
  "canh": ["🍲", "Suppe", "soup"], "cà rốt": ["🥕", "Karotte", "carrot"], "khoai tây": ["🥔", "Kartoffel", "potato"], "bắp": ["🌽", "Mais", "corn"], "bánh": ["🥮", "Kuchen", "cake"],
  "nước cam": ["🧃", "Orangensaft", "orange juice"], "trà": ["🍵", "Tee", "tea"], "pho mát": ["🧀", "Käse", "cheese"], "bánh quy": ["🍪", "Keks", "cookie"],
  // Gia đình, cơ thể
  "ông": ["👴", "Opa", "grandpa"], "bà": ["👵", "Oma", "grandma"], "bố": ["👨", "Papa", "dad"], "mẹ": ["👩", "Mama", "mom"], "em bé": ["👶", "Baby", "baby"],
  "anh trai": ["👦", "großer Bruder", "older brother"], "chị gái": ["👧", "große Schwester", "older sister"], "cô giáo": ["👩‍🏫", "Lehrerin", "teacher"], "bác sĩ": ["👨‍⚕️", "Arzt", "doctor"],
  "mắt": ["👁️", "Auge", "eye"], "mũi": ["👃", "Nase", "nose"], "miệng": ["👄", "Mund", "mouth"], "tai": ["👂", "Ohr", "ear"], "tay": ["✋", "Hand", "hand"], "chân": ["🦶", "Fuß", "foot"],
  "răng": ["🦷", "Zahn", "tooth"], "lưỡi": ["👅", "Zunge", "tongue"], "tóc": ["💇", "Haare", "hair"], "trái tim": ["💖", "Herz", "heart"],
  // Thiên nhiên, thời tiết
  "mặt trời": ["☀️", "Sonne", "sun"], "mặt trăng": ["🌙", "Mond", "moon"], "ngôi sao": ["⭐", "Stern", "star"], "mây": ["☁️", "Wolke", "cloud"], "mưa": ["🌧️", "Regen", "rain"],
  "gió": ["💨", "Wind", "wind"], "cây": ["🌳", "Baum", "tree"], "hoa": ["🌸", "Blume", "flower"], "lá": ["🍃", "Blatt", "leaf"], "núi": ["⛰️", "Berg", "mountain"],
  "biển": ["🌊", "Meer", "sea"], "lửa": ["🔥", "Feuer", "fire"], "tuyết": ["❄️", "Schnee", "snow"], "cầu vồng": ["🌈", "Regenbogen", "rainbow"], "sấm sét": ["⚡", "Blitz", "lightning"],
  "trời nắng": ["🌞", "sonnig", "sunny"], "trời lạnh": ["🥶", "kalt", "cold"], "trời nóng": ["🥵", "heiß", "hot"],
  // Đồ vật, phương tiện, quần áo
  "nhà": ["🏠", "Haus", "house"], "cửa": ["🚪", "Tür", "door"], "ghế": ["🪑", "Stuhl", "chair"], "giường": ["🛏️", "Bett", "bed"], "đèn": ["💡", "Lampe", "lamp"],
  "sách": ["📚", "Buch", "book"], "bút chì": ["✏️", "Bleistift", "pencil"], "cặp sách": ["🎒", "Schulranzen", "schoolbag"], "đồng hồ": ["⏰", "Uhr", "clock"],
  "điện thoại": ["📱", "Handy", "phone"], "ti vi": ["📺", "Fernseher", "TV"], "cái kéo": ["✂️", "Schere", "scissors"], "chìa khoá": ["🔑", "Schlüssel", "key"],
  "xe đạp": ["🚲", "Fahrrad", "bicycle"], "xe hơi": ["🚗", "Auto", "car"], "xe buýt": ["🚌", "Bus", "bus"], "máy bay": ["✈️", "Flugzeug", "airplane"],
  "tàu hoả": ["🚆", "Zug", "train"], "tàu thuỷ": ["🚢", "Schiff", "ship"], "xe máy": ["🛵", "Motorroller", "scooter"], "xe cứu hoả": ["🚒", "Feuerwehrauto", "fire truck"],
  "áo": ["👕", "Hemd", "shirt"], "quần": ["👖", "Hose", "pants"], "mũ": ["🎩", "Hut", "hat"], "giày": ["👟", "Schuh", "shoe"], "váy": ["👗", "Kleid", "dress"], "tất": ["🧦", "Socken", "socks"],
  "quả bóng": ["⚽", "Ball", "ball"], "búp bê": ["🪆", "Puppe", "doll"], "gấu bông": ["🧸", "Teddybär", "teddy bear"], "diều": ["🪁", "Drachen", "kite"], "quà": ["🎁", "Geschenk", "present"],
  "bánh sinh nhật": ["🎂", "Geburtstagskuchen", "birthday cake"], "đàn": ["🎻", "Geige", "violin"], "trống": ["🥁", "Trommel", "drum"],
  // Màu sắc
  "màu đỏ": ["🔴", "rot", "red"], "màu xanh dương": ["🔵", "blau", "blue"], "màu xanh lá": ["🟢", "grün", "green"], "màu vàng": ["🟡", "gelb", "yellow"], "màu cam": ["🟠", "orange", "orange"],
  "màu tím": ["🟣", "lila", "purple"], "màu đen": ["⚫", "schwarz", "black"], "màu trắng": ["⚪", "weiß", "white"], "màu nâu": ["🟤", "braun", "brown"],
  // Số đếm
  "một": ["1️⃣", "eins", "one"], "hai": ["2️⃣", "zwei", "two"], "ba": ["3️⃣", "drei", "three"], "bốn": ["4️⃣", "vier", "four"], "năm": ["5️⃣", "fünf", "five"],
  "sáu": ["6️⃣", "sechs", "six"], "bảy": ["7️⃣", "sieben", "seven"], "tám": ["8️⃣", "acht", "eight"], "chín": ["9️⃣", "neun", "nine"], "mười": ["🔟", "zehn", "ten"],
  // Cảm xúc, lời chào, hoạt động
  "vui": ["😄", "fröhlich", "happy"], "buồn": ["😢", "traurig", "sad"], "giận": ["😠", "wütend", "angry"], "sợ": ["😨", "ängstlich", "scared"], "ngạc nhiên": ["😲", "überrascht", "surprised"],
  "yêu": ["❤️", "Liebe", "love"], "mệt": ["😫", "müde", "tired"], "đói": ["😋", "hungrig", "hungry"], "xin chào": ["👋", "Hallo", "hello"], "cảm ơn": ["🙏", "Danke", "thank you"],
  "xin lỗi": ["🙇", "Entschuldigung", "sorry"], "tạm biệt": ["🖐️", "Tschüss", "goodbye"], "chúc ngủ ngon": ["🌙", "Gute Nacht", "good night"], "chúc mừng sinh nhật": ["🎂", "Alles Gute zum Geburtstag", "happy birthday"],
  "ăn": ["🍚", "essen", "eat"], "uống": ["🥤", "trinken", "drink"], "ngủ": ["😴", "schlafen", "sleep"], "chạy": ["🏃", "rennen", "run"], "đi": ["🚶", "gehen", "walk"], "hát": ["🎤", "singen", "sing"],
  "múa": ["💃", "tanzen", "dance"], "đọc": ["📖", "lesen", "read"], "viết": ["✍️", "schreiben", "write"], "vẽ": ["🎨", "malen", "paint"], "tắm": ["🛁", "baden", "bathe"], "rửa tay": ["🧼", "Hände waschen", "wash hands"],
};
