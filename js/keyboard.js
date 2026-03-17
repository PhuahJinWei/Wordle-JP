import { FLICK_GROUPS, FLICK_GRID } from './kana.js';

const FLICK_THRESHOLD = 30;    // px — minimum distance for a flick gesture
const TAP_CYCLE_TIMEOUT = 700; // ms — window for tap-cycling through a group
const DIRECTIONS = ['center', 'left', 'up', 'right', 'down'];

export class Keyboard {
  constructor(containerEl, toggleEl) {
    this.container = containerEl;
    this.toggleEl = toggleEl;
    this.mainEl = document.querySelector('.main');
    this.visible = false;

    // Flick state
    this.popupEl = null;

    // Tap-cycle state
    this.lastTapKey = null;
    this.lastTapTime = 0;
    this.cycleIndex = 0;
    this.cycleTimer = null;
    this.pendingChar = null;

    // Callbacks (set by consumer)
    this.onChar = null;
    this.onReplaceChar = null;
    this.onDakutenCycle = null;
    this.onDelete = null;
    this.onEnter = null;
  }

  init() {
    this.container.innerHTML = '';
    this.container.classList.add('flick-keyboard');

    // Reusable popup element — appended to body so it's never clipped by overflow:hidden
    this.popupEl = document.createElement('div');
    this.popupEl.className = 'flick-popup hidden';
    document.body.appendChild(this.popupEl);

    // Build grid from layout definition
    for (let row = 0; row < FLICK_GRID.length; row++) {
      for (let col = 0; col < FLICK_GRID[row].length; col++) {
        const cell = FLICK_GRID[row][col];
        if (cell === null) continue; // spanned by enter

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'flick-key';
        btn.style.gridRow = `${row + 1}`;
        btn.style.gridColumn = `${col + 1}`;

        switch (cell.type) {
          case 'group':
            btn.textContent = cell.key;
            btn.classList.add('flick-key--group');
            btn.dataset.group = cell.key;
            this._bindGroupKey(btn, cell.key);
            break;

          case 'backspace':
            btn.textContent = '\u232B'; // ⌫
            btn.classList.add('flick-key--backspace');
            btn.addEventListener('click', (e) => {
              e.preventDefault();
              this._confirmPending();
              this.onDelete?.();
            });
            break;

          case 'enter':
            btn.textContent = '確定';
            btn.classList.add('flick-key--enter');
            if (cell.rowSpan) btn.style.gridRow = `${row + 1} / span ${cell.rowSpan}`;
            btn.addEventListener('click', (e) => {
              e.preventDefault();
              this._confirmPending();
              this.onEnter?.();
            });
            break;

          case 'dakuten':
            btn.textContent = '゛゜';
            btn.classList.add('flick-key--dakuten');
            btn.addEventListener('click', (e) => {
              e.preventDefault();
              this._handleDakuten();
            });
            break;

          case 'empty':
            btn.classList.add('flick-key--empty');
            btn.disabled = true;
            break;
        }

        this.container.appendChild(btn);
      }
    }

    // Toggle button
    this.toggleEl?.addEventListener('click', () => this.toggle());

    // Show keyboard by default
    this.show();
  }

  // === Visibility ===

  show() {
    this.visible = true;
    this.container.style.height = this.container.scrollHeight + 'px';
    this.container.classList.add('keyboard-visible');
    this.container.classList.remove('keyboard-hidden');
    this.mainEl?.classList.remove('grid-shifted');
  }

  hide() {
    this._confirmPending();
    this.visible = false;
    this.container.style.height = '0px';
    this.container.classList.remove('keyboard-visible');
    this.container.classList.add('keyboard-hidden');
    this.mainEl?.classList.add('grid-shifted');
  }

  toggle() {
    this.visible ? this.hide() : this.show();
  }

  // === Group key binding (flick + tap-cycle) ===

  _bindGroupKey(el, groupKey) {
    let startX, startY, isTouchActive = false;

    const onStart = (x, y, e) => {
      e.preventDefault();
      startX = x;
      startY = y;
      isTouchActive = true;
      el.classList.add('flick-key--active');
      this._showPopup(el, groupKey, 'center');
    };

    const onMove = (x, y) => {
      if (!isTouchActive) return;
      this._updatePopupHighlight(this._getDirection(startX, startY, x, y));
    };

    const onEnd = (x, y) => {
      if (!isTouchActive) return;
      isTouchActive = false;
      el.classList.remove('flick-key--active');

      const dir = this._getDirection(startX, startY, x, y);
      const dist = Math.hypot(x - startX, y - startY);
      this._hidePopup();

      if (dist < FLICK_THRESHOLD) {
        this._handleTapCycle(groupKey);
      } else {
        this._confirmPending();
        const char = FLICK_GROUPS[groupKey]?.[DIRECTIONS.indexOf(dir)];
        if (char) this.onChar?.(char);
      }
    };

    // Touch events
    el.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      onStart(t.clientX, t.clientY, e);
    }, { passive: false });

    el.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      onMove(t.clientX, t.clientY);
    }, { passive: false });

    el.addEventListener('touchend', (e) => {
      const t = e.changedTouches[0];
      onEnd(t.clientX, t.clientY);
    });

    el.addEventListener('touchcancel', () => {
      isTouchActive = false;
      el.classList.remove('flick-key--active');
      this._hidePopup();
    });

    // Mouse fallback (desktop)
    el.addEventListener('mousedown', (e) => {
      onStart(e.clientX, e.clientY, e);
      const moveHandler = (e2) => onMove(e2.clientX, e2.clientY);
      const upHandler = (e2) => {
        onEnd(e2.clientX, e2.clientY);
        document.removeEventListener('mousemove', moveHandler);
        document.removeEventListener('mouseup', upHandler);
      };
      document.addEventListener('mousemove', moveHandler);
      document.addEventListener('mouseup', upHandler);
    });
  }

  // === Direction calculation ===

  _getDirection(sx, sy, ex, ey) {
    const dx = ex - sx;
    const dy = ey - sy;
    if (Math.hypot(dx, dy) < FLICK_THRESHOLD) return 'center';
    return Math.abs(dx) > Math.abs(dy)
      ? (dx < 0 ? 'left' : 'right')
      : (dy < 0 ? 'up' : 'down');
  }

  // === Popup ===

  _showPopup(keyEl, groupKey, highlightDir) {
    const chars = FLICK_GROUPS[groupKey];
    if (!chars) return;

    this.popupEl.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      const label = document.createElement('span');
      label.className = `flick-popup__label flick-popup__label--${DIRECTIONS[i]}`;
      label.textContent = chars[i] || '';
      if (!chars[i]) label.classList.add('flick-popup__label--empty');
      if (DIRECTIONS[i] === highlightDir) label.classList.add('flick-popup__label--active');
      this.popupEl.appendChild(label);
    }

    // Position centered on the key using viewport coordinates (popup is position:fixed)
    const rect = keyEl.getBoundingClientRect();
    this.popupEl.style.left = (rect.left + rect.width / 2) + 'px';
    this.popupEl.style.top = (rect.top + rect.height / 2) + 'px';
    this.popupEl.classList.remove('hidden');
  }

  _updatePopupHighlight(dir) {
    for (const label of this.popupEl.querySelectorAll('.flick-popup__label')) {
      label.classList.remove('flick-popup__label--active');
    }
    this.popupEl.querySelector(`.flick-popup__label--${dir}`)
      ?.classList.add('flick-popup__label--active');
  }

  _hidePopup() {
    this.popupEl.classList.add('hidden');
  }

  // === Tap-cycle ===

  _handleTapCycle(groupKey) {
    const now = Date.now();
    const validChars = FLICK_GROUPS[groupKey].filter(c => c !== null);

    if (groupKey === this.lastTapKey && (now - this.lastTapTime) < TAP_CYCLE_TIMEOUT) {
      // Same key tapped again — cycle to next character
      this.cycleIndex = (this.cycleIndex + 1) % validChars.length;
      this.pendingChar = validChars[this.cycleIndex];
      this.onReplaceChar?.(this.pendingChar);
    } else {
      // New key or timeout — confirm previous, start fresh
      this._confirmPending();
      this.cycleIndex = 0;
      this.pendingChar = validChars[0];
      this.onChar?.(this.pendingChar);
    }

    this.lastTapKey = groupKey;
    this.lastTapTime = now;

    clearTimeout(this.cycleTimer);
    this.cycleTimer = setTimeout(() => this._confirmPending(), TAP_CYCLE_TIMEOUT);
  }

  _confirmPending() {
    clearTimeout(this.cycleTimer);
    this.pendingChar = null;
    this.lastTapKey = null;
    this.lastTapTime = 0;
    this.cycleIndex = 0;
  }

  // === Dakuten ===

  _handleDakuten() {
    this._confirmPending();
    this.onDakutenCycle?.();
  }

  reset() {
    this._confirmPending();
  }
}
