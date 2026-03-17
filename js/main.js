import { Game } from './game.js';
import { Grid } from './grid.js';
import { Keyboard } from './keyboard.js';
import { cycleDakuten } from './kana.js';
import { loadStats } from './storage.js';

// === DOM references ===
const gridContainer = document.getElementById('game-grid');
const keyboardContainer = document.getElementById('keyboard');
const keyboardToggle = document.getElementById('btn-keyboard-toggle');
const lengthIndicator = document.getElementById('word-length-indicator');
const toastEl = document.getElementById('toast');
const modalOverlay = document.getElementById('modal-overlay');
const modalContent = document.getElementById('modal-content');

// === Components ===
const grid = new Grid(gridContainer);
const keyboard = new Keyboard(keyboardContainer, keyboardToggle);
let game = null;
let toastTimeout = null;

// === DOM helpers ===

/** Create an element with optional class, text, and children. */
function el(tag, className, textOrChildren) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (typeof textOrChildren === 'string') {
    node.textContent = textOrChildren;
  } else if (Array.isArray(textOrChildren)) {
    for (const child of textOrChildren) node.appendChild(child);
  }
  return node;
}

// === Initialization ===

async function init() {
  const res = await fetch('./data/words.json');
  const wordsByLength = await res.json();

  game = new Game(wordsByLength);
  keyboard.init();

  // Wire keyboard → game
  keyboard.onChar = (char) => game.addChar(char);
  keyboard.onReplaceChar = (char) => { game.deleteChar(); game.addChar(char); };
  keyboard.onDakutenCycle = () => game.modifyLastChar(cycleDakuten);
  keyboard.onDelete = () => game.deleteChar();
  keyboard.onEnter = () => game.submitGuess();

  // Wire tile click → cursor
  grid.onTileClick = (row, col) => {
    if (game.state === 'playing' && row === game.guesses.length) {
      game.setCursorPosition(col);
    }
  };

  // Wire game events → UI
  game.onUpdate = handleGameEvent;

  // Header buttons
  document.getElementById('btn-new-game').addEventListener('click', () => startNewGame());
  document.getElementById('btn-stats').addEventListener('click', () => showStatsModal());
  document.getElementById('btn-help').addEventListener('click', () => showHelpModal());

  // Close modal on backdrop click
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  startNewGame();
  showHelpModal();
}

function startNewGame() {
  closeModal();
  keyboard.reset();
  game.newGame();
}

// === Game event handler ===

function handleGameEvent(event, data) {
  switch (event) {
    case 'newGame':
      grid.init(data.wordLength, data.maxGuesses);
      lengthIndicator.textContent = `${data.wordLength}文字　1/${data.maxGuesses}回`;
      grid.updateInput(0, new Array(data.wordLength).fill(null), 0);
      break;

    case 'inputChanged':
      grid.updateInput(game.guesses.length, data.input, data.cursorPosition);
      break;

    case 'error':
      showToast(data.message);
      grid.shakeRow(game.guesses.length);
      break;

    case 'guessSubmitted': {
      const { guess, guessIndex } = data;
      grid.clearActive(guessIndex);
      grid.revealGuess(guessIndex, guess.chars, guess.result).then(() => {
        if (game.state === 'playing') {
          grid.addNextRow();
          lengthIndicator.textContent =
            `${game.wordLength}文字　${game.guesses.length + 1}/${game.maxGuesses}回`;
          grid.updateInput(game.guesses.length, game.currentInput, game.cursorPosition);
        }
      });
      break;
    }

    case 'gameOver': {
      const { won, answer, numGuesses, stats } = data;
      const delay = game.wordLength * 200 + 500;

      setTimeout(() => {
        if (won) {
          grid.bounceRow(game.guesses.length - 1);
          setTimeout(() => showGameOverModal(won, answer, numGuesses, stats), 600);
        } else {
          showGameOverModal(won, answer, numGuesses, stats);
        }
      }, delay);
      break;
    }
  }
}

// === Toast ===

function showToast(message, duration = 1500) {
  toastEl.textContent = message;
  toastEl.classList.remove('hidden');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toastEl.classList.add('hidden'), duration);
}

// === Modal system ===

function closeModal() {
  modalOverlay.classList.add('hidden');
}

/** Show modal with a DOM element (not raw HTML). */
function showModal(contentEl) {
  modalContent.innerHTML = '';
  modalContent.appendChild(contentEl);
  modalOverlay.classList.remove('hidden');
}

/** Build the stats row (shared by game-over and stats modals). */
function buildStatsRow(stats) {
  const winPct = stats.gamesPlayed > 0
    ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100)
    : 0;

  const items = [
    { value: stats.gamesPlayed, label: 'プレイ' },
    { value: winPct, label: '勝率%' },
    { value: stats.currentStreak, label: '連勝' },
    { value: stats.maxStreak, label: '最大連勝' },
  ];

  return el('div', 'stats-row', items.map(({ value, label }) =>
    el('div', 'stat-item', [
      el('div', 'stat-value', String(value)),
      el('div', 'stat-label', label),
    ])
  ));
}

/** Build the guess distribution chart. */
function buildDistribution(stats, highlightGuess = null) {
  const maxDist = Math.max(1, ...Object.values(stats.guessDistribution));
  const container = el('div', 'distribution');

  for (let i = 1; i <= 7; i++) {
    const count = stats.guessDistribution[i] || 0;
    const width = Math.max(8, (count / maxDist) * 100);

    const bar = el('div', 'dist-bar', String(count));
    bar.style.width = `${width}%`;
    if (i === highlightGuess) bar.classList.add('highlight');

    container.appendChild(el('div', 'dist-row', [
      el('span', 'dist-label', String(i)),
      bar,
    ]));
  }
  return container;
}

function showGameOverModal(won, answer, numGuesses, stats) {
  const title = won ? 'おめでとう！' : '残念...';
  const message = won ? `${numGuesses}回で正解！` : `答えは「${answer}」でした`;

  const statsRow = buildStatsRow(stats);
  statsRow.style.marginTop = '16px';

  const btn = el('button', 'modal-btn', 'もう一回');
  btn.addEventListener('click', () => startNewGame());

  const fragment = el('div', null, [
    el('div', 'modal-title', title),
    el('div', 'answer-reveal', answer),
    el('p', null, message),
    statsRow,
    buildDistribution(stats, won ? numGuesses : null),
    btn,
  ]);

  showModal(fragment);
}

function showStatsModal() {
  const stats = loadStats();

  showModal(el('div', null, [
    el('div', 'modal-title', '統計'),
    buildStatsRow(stats),
    buildDistribution(stats),
  ]));
}

function showHelpModal() {
  const content = el('div', null);

  // Title
  content.appendChild(el('div', 'modal-title', '遊び方'));

  const help = el('div', 'help-content');

  help.appendChild(el('p', null, 'ひらがなの単語を当てよう！'));
  help.appendChild(el('p', null, '文字数はランダムで3〜5文字。推測回数は文字数＋4回です。'));
  help.appendChild(el('h3', null, 'タイルの色'));

  const examples = [
    { char: 'か', cls: 'tile--correct', color: '緑', desc: '正しい文字、正しい位置' },
    { char: 'き', cls: 'tile--present', color: '黄', desc: '正しい文字、違う位置' },
    { char: 'く', cls: 'tile--close', color: '青', desc: '同じ行の文字（か行、さ行など）' },
    { char: 'む', cls: 'tile--absent', color: '灰', desc: '答えに含まれない文字' },
  ];

  for (const ex of examples) {
    const tile = el('div', `example-tile ${ex.cls}`, ex.char);
    help.appendChild(el('div', 'example-tiles', [tile]));

    const p = el('p', null);
    const strong = el('strong', null, ex.color);
    p.appendChild(strong);
    p.appendChild(document.createTextNode(`：${ex.desc}`));
    help.appendChild(p);

    if (ex.cls === 'tile--close') {
      const note = el('p', null,
        '例：答えに「か」がある時に「き」を入力すると青になります（同じか行）。濁音・半濁音も同じグループです（が＝か行、ぱ＝は行）。');
      note.style.fontSize = '0.8rem';
      note.style.color = '#888';
      help.appendChild(note);
    }
  }
  content.appendChild(help);
  showModal(content);
}

// === Prevent pinch-zoom (Safari ignores user-scalable=no in viewport meta) ===
document.addEventListener('touchmove', (e) => {
  if (e.touches.length > 1) e.preventDefault();
}, { passive: false });

// Double-tap zoom prevention via gesturestart
document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });

// === Start ===
init();
