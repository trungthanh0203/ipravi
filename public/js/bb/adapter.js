import { formatSegments } from "./format.js";
import { nextBox, dueAfter } from "./srs.js";

// Chuyển nội dung "Tiếng Việt Bài Bản" (bb_vocab/dialogue/grammar/phonics + đoạn đọc/nghe) sang HÌNH DẠNG MỤC của khu Trẻ em
// ({ id, item_type, text_vi, translations:[{lang,meaning}], content_audio:[…], unit_id, level, … }) để dùng NGUYÊN các trò
// Luyện tập của khu Trẻ em (child/runners.js, pools.js, practice-core.js — toàn hàm thuần chỉ cần hình dạng mục này).
// Hàm thuần — test ở tests/bb.test.mjs. Khác biệt cố ý:
//   · `id` là SỐ ghép (loại×1e9 + id dòng×100 + chỉ số con) để không trùng giữa các bảng bb_*; `src` giữ nguồn thật.
//   · `level` LUÔN = 2 (đúng cho cổng lọc sortable() của khu Trẻ em); cấp thật của Bài Bản để ở `bbLevel`.
//   · Chưa có hình → `emoji`/`image_path` rỗng, nên các trò cần hình (nghe-chọn-hình, ghép cặp, phân loại…) tự mờ.
const TYPE_BASE = { vocab: 1, dialogue: 2, grammar: 3, phonics: 4, story: 5, question: 6 };
export const idOf = (type, rowId, sub = 0) => TYPE_BASE[type] * 1e9 + Number(rowId) * 100 + sub;

// Bỏ ký hiệu **đậm**/*nghiêng*/!!đỏ!!/`khối` và xuống dòng của markdown-lite (bb/format.js) → chữ thường để chơi.
export const plainText = (s) => formatSegments(s).map((line) => line.map((seg) => seg.text).join("")).join(" ").replace(/\s+/g, " ").trim();

export const translationsOf = (map) => Object.entries(map ?? {}).filter(([, v]) => v).map(([lang, meaning]) => ({ lang, meaning }));
export const audioRows = (path) => (path ? [{ lang: "vi", speed: "normal", source: "human", voice_kind: "adult", file_path: path }] : []);

const base = (type, rowId, sub, where, extra) => ({
  id: idOf(type, rowId, sub), emoji: null, image_path: null, translations: [], content_audio: [],
  unit_id: where.unit?.id ?? null, level: 2, bbLevel: where.bbLevel ?? null, unit: where.unit ?? null,
  src: { type, id: rowId }, ...extra,
});

export function vocabItem(r, where) {
  const single = !/\s/.test(r.word_vi);
  const kind = r.say_vi && [...r.word_vi].length <= 2 ? "letter" : single ? "word" : "phrase";
  return base("vocab", r.id, 0, where, {
    item_type: kind, text_vi: r.word_vi, say_vi: r.say_vi ?? null, image_path: r.image_path ?? null,
    translations: translationsOf(r.meaning), content_audio: audioRows(r.audio_path),
  });
}

export const dialogueItem = (r, where) => base("dialogue", r.id, 0, where, {
  item_type: "sentence", text_vi: plainText(r.line_vi), translations: translationsOf(r.line_tr), content_audio: audioRows(r.audio_path), speaker: r.speaker,
});

// Mỗi câu ví dụ của 1 điểm ngữ pháp = 1 mục câu (CÙNG tiến độ với điểm ngữ pháp đó). Bỏ câu quá dài (không chơi được).
export function grammarItems(g, where) {
  return (g.examples ?? []).map((ex, i) => ({ ex, i })).filter(({ ex }) => plainText(ex.vi) && plainText(ex.vi).length <= 160)
    .map(({ ex, i }) => base("grammar", g.id, i, where, {
      item_type: "sentence", text_vi: plainText(ex.vi), translations: translationsOf(ex.tr),
    }));
}

// Cặp âm: 2 âm = mục "syllable" (có audio riêng); các ví dụ "cha - tra" tách thành từng từ riêng (không có audio, TTS trình duyệt).
export function phonicsItems(p, where) {
  const out = [];
  [[p.sound_a, p.audio_a_path], [p.sound_b, p.audio_b_path]].forEach(([text, path], i) => {
    if (text) out.push(base("phonics", p.id, i, where, { item_type: "syllable", text_vi: text, content_audio: audioRows(path) }));
  });
  const words = [...new Set((p.examples ?? []).flatMap((e) => String(e).split(/\s*[-–,;·/]\s*/)).map((w) => w.trim()).filter(Boolean))];
  words.slice(0, 90).forEach((w, k) => out.push(base("phonics", p.id, 2 + k, where, { item_type: /\s/.test(w) ? "phrase" : "word", text_vi: w })));
  return out;
}

const sentences = (text) => String(text ?? "").split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);

// Đoạn đọc/nghe → "bài kể chuyện" của khu Trẻ em: mục = từng CÂU của đoạn (phát bằng TTS trình duyệt), câu hỏi = trắc nghiệm.
export function storyOf(passage, questions, where) {
  const items = sentences(passage.passage_vi).map((s, i, all) => base("story", passage.id, i, where, {
    item_type: "story", text_vi: s, content_audio: all.length === 1 ? audioRows(passage.audio_path) : [],
  }));
  const qs = questions.map((q) => base("question", q.id, 0, where, {
    item_type: "question", text_vi: q.question_vi, extra: { choices: q.choices ?? [], answer: q.answer },
  }));
  return { lessonId: idOf("story", passage.id), unitId: where.unit?.id ?? null, level: where.bbLevel ?? null, itemIds: items.map((i) => i.id), questionIds: qs.map((q) => q.id), items, questions: qs };
}

// Nhiều dòng hội thoại CÙNG 1 chặng → "bài giao tiếp" (dòng lẻ = hệ thống nói, dòng chẵn = người học đọc, xem child/activities/dialogue.js).
export function dialogueLessonOf(stepId, lines, where) {
  const items = lines.map((r) => dialogueItem(r, where));
  return { lessonId: idOf("dialogue", stepId), unitId: where.unit?.id ?? null, level: where.bbLevel ?? null, itemIds: items.map((i) => i.id), questionIds: [], items };
}

// ---- Tiến độ theo mục: dùng lại bb_srs_state (hộp Leitner) — hộp ≈ mức thuộc; (số lần ôn − số lần đúng) ≈ số lần sai ----
export const progressRow = (s) => ({ mastery: s.box ?? 1, wrong_count: Math.max(0, (s.reviewed_count ?? 0) - (s.correct_count ?? 0)), last_seen_at: s.updated_at ?? null });

export function progressMap(srsRows, items) {
  const by = new Map((srsRows ?? []).map((s) => [`${s.item_type}:${s.item_id}`, s]));
  const out = new Map();
  for (const it of items) {
    const s = by.get(`${it.src.type}:${it.src.id}`);
    if (s) out.set(it.id, progressRow(s));
  }
  return out;
}

// Ghi 1 đáp án: trả hàng bb_srs_state mới (hộp tăng khi đúng, về 1 khi sai) — hàm thuần, nơi gọi tự UPSERT.
export function srsAfter(prev, ok, now = new Date()) {
  const box = nextBox(prev?.box ?? 1, ok);
  return {
    box, due_at: dueAfter(box, now).toISOString(),
    reviewed_count: (prev?.reviewed_count ?? 0) + 1, correct_count: (prev?.correct_count ?? 0) + (ok ? 1 : 0),
    updated_at: now.toISOString(),
  };
}

// Phạm vi ôn: { type: 'all' } | { type:'level', level: <id cấp Bài Bản> } | { type:'unit', unitId } | { type:'weak' }.
export const isWeakRow = (p) => Boolean(p) && (p.wrong_count ?? 0) > 0 && (p.mastery ?? 0) < 3;
export function scopeBb(catalog, scope, progress = new Map()) {
  switch (scope?.type) {
    case "level": return catalog.filter((i) => i.bbLevel === scope.level);
    case "unit": return catalog.filter((i) => i.unit_id === scope.unitId);
    case "weak": return catalog.filter((i) => isWeakRow(progress.get(i.id)));
    default: return catalog;
  }
}

// Ghép MỌI thứ Luyện tập cần từ nội dung đã học (done, api.loadDoneContent) + cấu trúc cấp/chủ đề (st, api.loadStructure):
// catalog (mục rời), byId (cả mục của đoạn/câu hỏi), progress, 3 nguồn "bài" (đọc nhớ/nghe nhớ/hội thoại) + danh sách cấp.
export function buildPracticeData(done, st) {
  const lessonOf = new Map(st.lessons.map((l) => [l.id, l]));
  const unitOf = new Map(st.units.map((u) => [u.id, u]));
  const stepOf = new Map(done.steps.map((s) => [s.id, s]));
  const whereOf = (stepId) => {
    const unit = unitOf.get(lessonOf.get(stepOf.get(stepId)?.lesson_id)?.unit_id);
    return { unit: unit ? { id: unit.id, title_vi: unit.title_vi, emoji: unit.emoji ?? null } : null, bbLevel: unit?.level_id ?? null };
  };
  const catalog = [
    ...done.vocab.map((r) => vocabItem(r, whereOf(r.step_id))),
    ...done.dialogue.map((r) => dialogueItem(r, whereOf(r.step_id))),
    ...done.grammar.flatMap((r) => grammarItems(r, whereOf(r.step_id))),
    ...done.phonics.flatMap((r) => phonicsItems(r, whereOf(r.step_id))),
  ];
  const byId = new Map(catalog.map((i) => [i.id, i]));

  const storiesFrom = (passages, questions) => passages.map((p) => {
    const qs = questions.filter((q) => q.passage_id === p.id).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    return qs.length ? storyOf(p, qs, whereOf(p.step_id)) : null;
  }).filter((g) => g && g.itemIds.length >= 1);
  const readStories = storiesFrom(done.reading, st.readingQuestions);
  const listenOnly = storiesFrom(done.listening, st.listeningQuestions);
  for (const g of [...readStories, ...listenOnly]) for (const it of [...g.items, ...g.questions]) byId.set(it.id, it);

  const linesByStep = new Map();
  for (const r of done.dialogue) { if (!linesByStep.has(r.step_id)) linesByStep.set(r.step_id, []); linesByStep.get(r.step_id).push(r); }
  const dialogueLessons = [...linesByStep].map(([stepId, rows]) =>
    dialogueLessonOf(stepId, rows.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)), whereOf(stepId))).filter((g) => g.itemIds.length >= 4);
  for (const g of dialogueLessons) for (const it of g.items) byId.set(it.id, it);

  const levelIds = new Set([...catalog, ...readStories, ...listenOnly].map((x) => x.bbLevel ?? x.level));
  const levels = st.levels.filter((l) => levelIds.has(l.id)).sort((a, b) => a.id - b.id);
  return {
    catalog, byId, progress: progressMap(done.srs, catalog), storyLessons: readStories, listenLessons: [...listenOnly, ...readStories],
    dialogueLessons, levels, units: new Map(st.units.map((u) => [u.id, { id: u.id, title_vi: u.title_vi, emoji: u.emoji ?? null }])), srsPrev: new Map(done.srs.map((s) => [`${s.item_type}:${s.item_id}`, s])),
  };
}
