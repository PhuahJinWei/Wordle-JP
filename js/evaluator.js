import { getGroup } from './kana.js';

/**
 * Evaluate a guess against the answer using 4-pass algorithm.
 *
 * Priority: correct (green) > present (yellow) > close (blue) > absent (gray)
 * Each answer position is consumed only once across all passes.
 *
 * @param {string[]} guess - Array of hiragana characters
 * @param {string[]} answer - Array of hiragana characters
 * @returns {string[]} Array of states: 'correct' | 'present' | 'close' | 'absent'
 */
export function evaluate(guess, answer) {
  const n = guess.length;
  const result = new Array(n).fill(null);
  const answerUsed = new Array(n).fill(false);

  // Pass 1: Exact matches (green)
  for (let i = 0; i < n; i++) {
    if (guess[i] === answer[i]) {
      result[i] = 'correct';
      answerUsed[i] = true;
    }
  }

  // Pass 2: Right character, wrong position (yellow)
  for (let i = 0; i < n; i++) {
    if (result[i] !== null) continue;
    for (let j = 0; j < n; j++) {
      if (answerUsed[j]) continue;
      if (guess[i] === answer[j]) {
        result[i] = 'present';
        answerUsed[j] = true;
        break;
      }
    }
  }

  // Pass 3: Same consonant group (blue)
  for (let i = 0; i < n; i++) {
    if (result[i] !== null) continue;
    const guessGroup = getGroup(guess[i]);
    if (!guessGroup) continue;
    for (let j = 0; j < n; j++) {
      if (answerUsed[j]) continue;
      if (getGroup(answer[j]) === guessGroup) {
        result[i] = 'close';
        answerUsed[j] = true;
        break;
      }
    }
  }

  // Pass 4: Everything else is absent (gray)
  for (let i = 0; i < n; i++) {
    if (result[i] === null) {
      result[i] = 'absent';
    }
  }

  return result;
}
