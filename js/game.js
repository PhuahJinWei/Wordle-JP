import { evaluate } from './evaluator.js';
import { recordGame } from './storage.js';

export class Game {
  constructor(wordsByLength) {
    this.wordsByLength = wordsByLength;
    this.state = 'idle'; // idle | playing | won | lost
    this.answer = [];
    this.wordLength = 0;
    this.maxGuesses = 0;
    this.guesses = [];       // Array of { chars: string[], result: string[] }
    this.currentInput = [];  // Fixed-length array with null for empty slots
    this.cursorPosition = 0;
    this.onUpdate = null;    // (event, data) => void
  }

  /** Start a new game with a random word. */
  newGame() {
    const lengths = Object.keys(this.wordsByLength).map(Number);
    this.wordLength = lengths[Math.floor(Math.random() * lengths.length)];
    this.maxGuesses = this.wordLength + 4;

    const candidates = this.wordsByLength[String(this.wordLength)]
      .filter(w => [...w].length === this.wordLength);
    this.answer = [...candidates[Math.floor(Math.random() * candidates.length)]];

    this.guesses = [];
    this.currentInput = new Array(this.wordLength).fill(null);
    this.cursorPosition = 0;
    this.state = 'playing';

    this._emit('newGame', {
      wordLength: this.wordLength,
      maxGuesses: this.maxGuesses,
    });
  }

  /** Add a character at the current cursor position. */
  addChar(char) {
    if (this.state !== 'playing' || this.cursorPosition >= this.wordLength) return;
    this.currentInput[this.cursorPosition] = char;
    this.cursorPosition = Math.min(this.cursorPosition + 1, this.wordLength);
    this._emitInput();
  }

  /** Delete character at cursor, or move back and delete. */
  deleteChar() {
    if (this.state !== 'playing') return;

    if (this.cursorPosition < this.wordLength && this.currentInput[this.cursorPosition] !== null) {
      this.currentInput[this.cursorPosition] = null;
    } else if (this.cursorPosition > 0) {
      this.cursorPosition--;
      this.currentInput[this.cursorPosition] = null;
    } else {
      return;
    }
    this._emitInput();
  }

  /** Transform the character at or before cursor (for dakuten toggle). */
  modifyLastChar(transformFn) {
    if (this.state !== 'playing') return;

    let idx = -1;
    if (this.cursorPosition < this.wordLength && this.currentInput[this.cursorPosition] !== null) {
      idx = this.cursorPosition;
    } else if (this.cursorPosition > 0 && this.currentInput[this.cursorPosition - 1] !== null) {
      idx = this.cursorPosition - 1;
    }
    if (idx === -1) return;

    const transformed = transformFn(this.currentInput[idx]);
    if (transformed !== this.currentInput[idx]) {
      this.currentInput[idx] = transformed;
      this._emitInput();
    }
  }

  /** Move cursor to a specific column. */
  setCursorPosition(col) {
    if (this.state !== 'playing' || col < 0 || col >= this.wordLength) return;
    this.cursorPosition = col;
    this._emitInput();
  }

  /**
   * Submit the current guess.
   * @returns {boolean} Whether the submission was accepted.
   */
  submitGuess() {
    if (this.state !== 'playing') return false;

    if (this.currentInput.some(c => c === null)) {
      this._emit('error', { message: '文字が足りません' });
      return false;
    }

    const guess = [...this.currentInput];
    const result = evaluate(guess, this.answer);
    const guessData = { chars: guess, result };
    this.guesses.push(guessData);

    // Reset input for next row
    this.currentInput = new Array(this.wordLength).fill(null);
    this.cursorPosition = 0;

    const won = result.every(r => r === 'correct');
    const lost = !won && this.guesses.length >= this.maxGuesses;

    if (won) {
      this.state = 'won';
    } else if (lost) {
      this.state = 'lost';
    } else {
      // Pre-fill correct (green) positions in the next row
      for (let i = 0; i < result.length; i++) {
        if (result[i] === 'correct') this.currentInput[i] = guess[i];
      }
      const firstEmpty = this.currentInput.indexOf(null);
      this.cursorPosition = firstEmpty >= 0 ? firstEmpty : this.wordLength;
    }

    this._emit('guessSubmitted', {
      guess: guessData,
      guessIndex: this.guesses.length - 1,
    });

    if (won || lost) {
      this._emit('gameOver', {
        won,
        answer: this.answer.join(''),
        numGuesses: this.guesses.length,
        stats: recordGame(won, this.guesses.length),
      });
    }

    return true;
  }

  _emitInput() {
    this._emit('inputChanged', {
      input: [...this.currentInput],
      cursorPosition: this.cursorPosition,
    });
  }

  _emit(event, data) {
    this.onUpdate?.(event, data);
  }
}
