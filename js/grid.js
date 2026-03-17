/**
 * Grid renderer — creates and updates the game tile grid.
 */
export class Grid {
  constructor(containerEl) {
    this.container = containerEl;
    this.tiles = [];       // 2D array: tiles[row][col]
    this.wordLength = 0;
    this.maxGuesses = 0;
    this.onTileClick = null; // (row, col) => void
  }

  /** Initialize the grid for a new game. */
  init(wordLength, maxGuesses) {
    this.wordLength = wordLength;
    this.maxGuesses = maxGuesses;
    this.tiles = [];
    this.container.innerHTML = '';
    this.container.style.setProperty('--word-length', wordLength);
    this.container.style.setProperty('--max-guesses', maxGuesses);
    this._computeTileSize();
    this._addRow(); // Start with 1 row; more added after each guess
  }

  /** Add the next row if the game is still going. */
  addNextRow() {
    if (this.tiles.length < this.maxGuesses) {
      this._addRow();
    }
  }

  /** Update current input row with typed characters and cursor position. */
  updateInput(rowIndex, chars, cursorPosition) {
    if (rowIndex >= this.tiles.length) return;
    const row = this.tiles[rowIndex];
    const cursor = cursorPosition ?? chars.length;

    for (let col = 0; col < this.wordLength; col++) {
      const tile = row[col];
      const char = chars[col];
      tile.textContent = char ?? '';
      tile.classList.toggle('filled', char != null);
      tile.classList.toggle('active', col === cursor);
      tile.classList.add('input-row');
    }
  }

  /** Clear active/input-row indicators from a row (called when guess is submitted). */
  clearActive(rowIndex) {
    if (rowIndex >= this.tiles.length) return;
    for (const tile of this.tiles[rowIndex]) {
      tile.classList.remove('active', 'input-row');
    }
  }

  /**
   * Reveal a submitted guess with staggered flip animations.
   * @returns {Promise} Resolves when all animations complete.
   */
  revealGuess(rowIndex, chars, results) {
    if (rowIndex >= this.maxGuesses) return Promise.resolve();

    const row = this.tiles[rowIndex];
    const FLIP_DURATION = 400;
    const STAGGER = 200;

    return new Promise(resolve => {
      for (let col = 0; col < this.wordLength; col++) {
        const tile = row[col];
        const delay = col * STAGGER;

        setTimeout(() => {
          tile.classList.add('revealing');

          // At flip midpoint, swap in the result color
          setTimeout(() => {
            tile.textContent = chars[col];
            tile.classList.remove('filled', 'revealing');
            tile.classList.add(`tile--${results[col]}`, 'revealed');
          }, FLIP_DURATION / 2);
        }, delay);
      }

      setTimeout(resolve, (this.wordLength - 1) * STAGGER + FLIP_DURATION);
    });
  }

  /** Shake the current row (invalid input feedback). */
  shakeRow(rowIndex) {
    if (rowIndex >= this.maxGuesses) return;
    for (const tile of this.tiles[rowIndex]) {
      tile.classList.add('shake');
      tile.addEventListener('animationend', () => tile.classList.remove('shake'), { once: true });
    }
  }

  /** Bounce tiles on win (staggered). */
  bounceRow(rowIndex) {
    if (rowIndex >= this.maxGuesses) return;
    this.tiles[rowIndex].forEach((tile, col) => {
      setTimeout(() => tile.classList.add('bounce'), col * 100);
    });
  }

  // === Private ===

  /** Create and append a single row of tiles. */
  _addRow() {
    const rowIndex = this.tiles.length;
    const rowTiles = [];

    for (let col = 0; col < this.wordLength; col++) {
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.dataset.row = rowIndex;
      tile.dataset.col = col;
      tile.addEventListener('click', () => this.onTileClick?.(rowIndex, col));
      this.container.appendChild(tile);
      rowTiles.push(tile);
    }

    this.tiles.push(rowTiles);
  }

  /** Update the --word-length CSS variable (tile size is handled by CSS clamp). */
  _computeTileSize() {
    // Tile size is set via CSS: clamp(40px, calc((100vw - 48px) / word-length), 56px)
    // No JS override needed — keeps tiles consistent across all devices.
  }
}
