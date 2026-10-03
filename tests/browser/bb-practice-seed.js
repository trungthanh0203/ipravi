// Dữ liệu giả để thử màn Luyện tập Bài Bản trong trình duyệt: node scripts/dev-server.mjs rồi (trên /app/)
//   const { setup } = await import('/__tests/bb-practice-seed.js'); await setup();
// → đăng nhập giả 1 người học đã xong 4 chặng (từ vựng/hội thoại/ngữ pháp/đọc) và mở sẵn màn "Luyện tập".
export async function setup() {
  const { installMock } = await import("/__tests/mock-sb.js");
  const { sb } = await import("/js/supabase.js");
  const { state } = await import("/js/state.js");
  const { render } = await import("/js/flow.js");
  sessionStorage.removeItem("tltv-bb-nav");
  const m = installMock(sb, {
    bb_levels: [{ id: 1, code: "A1", name_vi: "Sơ cấp 1", status: "approved", sort_order: 1 }],
    bb_units: [{ id: 1, level_id: 1, title_vi: "Chào hỏi", emoji: "👋", status: "approved", sort_order: 1 }],
    bb_lessons: [{ id: 1, unit_id: 1, title_vi: "Bài 1", lesson_type: "core", status: "approved", sort_order: 1 }],
    bb_lesson_steps: [
      { id: 1, lesson_id: 1, step_type: "vocab", status: "approved", sort_order: 1 },
      { id: 2, lesson_id: 1, step_type: "dialogue", status: "approved", sort_order: 2 },
      { id: 3, lesson_id: 1, step_type: "grammar", status: "approved", sort_order: 3 },
      { id: 4, lesson_id: 1, step_type: "reading", status: "approved", sort_order: 4 },
    ],
    bb_progress: [1, 2, 3, 4].map((i) => ({ child_id: "c1", step_id: i })),
    bb_vocab: ["chào", "cảm ơn", "xin lỗi", "tạm biệt", "bạn", "tôi"].map((w, i) => ({ id: i + 1, step_id: 1, word_vi: w, meaning: { de: "w" + i }, sort_order: i })),
    bb_dialogue_lines: [1, 2, 3, 4].map((i) => ({ id: i, step_id: 2, speaker: i % 2 ? "A" : "B", line_vi: "Câu số " + i + " nhé.", line_tr: {}, sort_order: i })),
    bb_grammar: [{ id: 1, step_id: 3, formula: "X là Y", examples: [{ vi: "Tôi **là** An." }, { vi: "Bạn là Bình nhé." }], sort_order: 1 }],
    bb_reading_passages: [{ id: 1, step_id: 4, passage_vi: "Tôi tên là An. Tôi là học sinh. Tôi học tiếng Việt." }],
    bb_reading_questions: [{ id: 1, passage_id: 1, question_vi: "Tôi tên gì?", choices: ["An", "Bình"], answer: 1, sort_order: 1 }],
    bb_srs_state: [], bb_practice_log: [],
  });
  window.__m = m;
  state.session = { user: { id: "p1" } };
  state.account = { id: "p1", role: "parent", pin_hash: "x", access_status: "trial", access_until: new Date(Date.now() + 5e8).toISOString(), content_language: "de", pronunciation_enabled: false };
  state.children = [{ id: "c1", parent_id: "p1", nickname: "Anna", avatar_id: "cat", profile_type: "learner" }];
  state.activeChildId = "c1";
  await render();
  [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Luyện tập")).click();
  await new Promise((r) => setTimeout(r, 500));
  return m;
}
