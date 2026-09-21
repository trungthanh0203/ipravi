import * as api from "./api.js";
import { nativeLang } from "./media.js";

// Ngữ cảnh chạy 1 hoạt động (bài học hoặc luyện tập): hộp vẽ, danh sách mục, cách ghi tiến độ. Các trò chỉ dùng ctx nên không biết mình đang ở đâu.
// progress: Map item_id → hàng child_progress (cập nhật sau mỗi lần ghi). onRecord(itemId, correct): móc để gom mục sai (luyện tập).
export function makeCtx({ box, account, child, items, questions = [], progress, setProgress, onRecord }) {
  return {
    box, account, child, items, questions,
    config: {},
    lang: nativeLang(), // ngôn ngữ bản ngữ của bé (trò "hiểu nghĩa")
    setProgress,
    record: (itemId, correct) => {
      onRecord?.(itemId, correct);
      api.saveAnswer(child.id, itemId, correct, progress.get(itemId)).then((row) => progress.set(itemId, row));
    },
    savePron: (itemId, score, text, detail) => api.savePronunciation(child.id, itemId, score, text, detail),
  };
}
