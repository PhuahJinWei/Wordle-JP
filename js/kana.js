/**
 * Hiragana data: consonant groups, dakuten/handakuten mappings,
 * and flick keyboard layout.
 */

// === Consonant groups ===
// Each group shares a consonant sound.
// Dakuten/handakuten variants belong to the same group as their base.

const GROUPS = {
  'あ': ['あ', 'い', 'う', 'え', 'お'],
  'か': ['か', 'き', 'く', 'け', 'こ', 'が', 'ぎ', 'ぐ', 'げ', 'ご'],
  'さ': ['さ', 'し', 'す', 'せ', 'そ', 'ざ', 'じ', 'ず', 'ぜ', 'ぞ'],
  'た': ['た', 'ち', 'つ', 'て', 'と', 'だ', 'ぢ', 'づ', 'で', 'ど'],
  'な': ['な', 'に', 'ぬ', 'ね', 'の'],
  'は': ['は', 'ひ', 'ふ', 'へ', 'ほ', 'ば', 'び', 'ぶ', 'べ', 'ぼ', 'ぱ', 'ぴ', 'ぷ', 'ぺ', 'ぽ'],
  'ま': ['ま', 'み', 'む', 'め', 'も'],
  'や': ['や', 'ゆ', 'よ'],
  'ら': ['ら', 'り', 'る', 'れ', 'ろ'],
  'わ': ['わ', 'を', 'ん'],
};

// Reverse lookup: char → group name
const charToGroup = new Map();
for (const [groupName, chars] of Object.entries(GROUPS)) {
  for (const ch of chars) {
    charToGroup.set(ch, groupName);
  }
}

// === Dakuten cycle ===
// Unified cycle map for the dakuten button:
//   か/さ/た rows: 2-way toggle (か↔が)
//   は row: 3-way cycle (は→ば→ぱ→は)

const CYCLE_MAP = new Map();

// 2-way dakuten toggles
const dakutenPairs = [
  ['か', 'が'], ['き', 'ぎ'], ['く', 'ぐ'], ['け', 'げ'], ['こ', 'ご'],
  ['さ', 'ざ'], ['し', 'じ'], ['す', 'ず'], ['せ', 'ぜ'], ['そ', 'ぞ'],
  ['た', 'だ'], ['ち', 'ぢ'], ['つ', 'づ'], ['て', 'で'], ['と', 'ど'],
];

for (const [base, dakuten] of dakutenPairs) {
  CYCLE_MAP.set(base, dakuten);
  CYCLE_MAP.set(dakuten, base);
}

// は row: 3-way cycle (は→ば→ぱ→は)
const haRow = [
  ['は', 'ば', 'ぱ'], ['ひ', 'び', 'ぴ'], ['ふ', 'ぶ', 'ぷ'],
  ['へ', 'べ', 'ぺ'], ['ほ', 'ぼ', 'ぽ'],
];

for (const [base, dakuten, handakuten] of haRow) {
  CYCLE_MAP.set(base, dakuten);
  CYCLE_MAP.set(dakuten, handakuten);
  CYCLE_MAP.set(handakuten, base);
}

// === Flick keyboard layout ===

// Group key → [center, left, up, right, down]
// Standard Japanese flick: center=あ段, left=い段, up=う段, right=え段, down=お段
export const FLICK_GROUPS = {
  'あ': ['あ', 'い', 'う', 'え', 'お'],
  'か': ['か', 'き', 'く', 'け', 'こ'],
  'さ': ['さ', 'し', 'す', 'せ', 'そ'],
  'た': ['た', 'ち', 'つ', 'て', 'と'],
  'な': ['な', 'に', 'ぬ', 'ね', 'の'],
  'は': ['は', 'ひ', 'ふ', 'へ', 'ほ'],
  'ま': ['ま', 'み', 'む', 'め', 'も'],
  'や': ['や', null, 'ゆ', 'よ', null],
  'ら': ['ら', 'り', 'る', 'れ', 'ろ'],
  'わ': ['わ', 'を', 'ん', null, null],
};

// 4×4 grid layout — type: 'group' | 'backspace' | 'enter' | 'dakuten' | 'empty'
// null cells are spanned by the enter button
export const FLICK_GRID = [
  [{ type: 'group', key: 'あ' }, { type: 'group', key: 'か' }, { type: 'group', key: 'さ' }, { type: 'backspace' }],
  [{ type: 'group', key: 'た' }, { type: 'group', key: 'な' }, { type: 'group', key: 'は' }, { type: 'enter', rowSpan: 3 }],
  [{ type: 'group', key: 'ま' }, { type: 'group', key: 'や' }, { type: 'group', key: 'ら' }, null],
  [{ type: 'dakuten' }, { type: 'group', key: 'わ' }, { type: 'empty' }, null],
];

// === Public API ===

/** Cycle through dakuten/handakuten: か→が→か, は→ば→ぱ→は */
export function cycleDakuten(char) {
  return CYCLE_MAP.get(char) ?? char;
}

/** Get the consonant group name for a hiragana character (e.g. 'か' for が). */
export function getGroup(char) {
  return charToGroup.get(char) ?? null;
}
