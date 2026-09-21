import * as listenPick from "./activities/listen-pick.js";
import * as match from "./activities/match.js";
import * as listenRepeat from "./activities/listen-repeat.js";
import * as phonics from "./activities/phonics.js";
import * as reading from "./activities/reading.js";
import * as spell from "./activities/spell.js";
import * as casing from "./activities/casing.js";
import * as trace from "./activities/trace.js";
import * as games from "./activities/games.js";

// Mọi dạng hoạt động chạy được: run(ctx) → { correct, total }. Dùng chung cho bài học (lesson.js) và Luyện tập (practice.js).
// Thêm dạng mới: viết file trong ./activities/, thêm 1 dòng ở đây, vị từ lọc mục ở pools.js, kỹ năng ở skills.js (+ skill_of trong SQL).
export const RUNNERS = {
  listen_pick: listenPick.run,
  listen_pick_text: listenPick.runText,
  match: match.run,
  listen_repeat: listenRepeat.run,
  listen_pick_tone: phonics.runTone,
  build_syllable: phonics.runBuild,
  fill_letter: phonics.runFill,
  read_pick: phonics.runRead,
  order_words: phonics.runOrder,
  read_quiz: reading.runQuiz,
  fill_word: reading.runFillWord,
  write_check: reading.runWriteCheck,
  spell_word: reading.runSpell,
  order_story: reading.runStory,
  spell_along: spell.runSpellAlong,
  match_case: casing.runMatchCase,
  pick_case: casing.runPickCase,
  fix_capital: casing.runFixCapital,
  trace: trace.runTrace,
  // Chỉ có ở Luyện tập (không nằm trong bảng activities của bài học)
  meaning_pick: games.runMeaning,
  memory_flip: games.runMemory,
  sort_unit: games.runSort,
  pick_spelling: games.runSpelling,
  tone_pair: games.runTonePair,
};
