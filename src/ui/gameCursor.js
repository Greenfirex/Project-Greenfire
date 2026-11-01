// Vlastní fantasy kurzor s rukou, mečem, sekerou a krumpáčem; v Možnostech se dá vypnout.
const IMAGE_DIR = 'assets/ui/cursors/';
const FILES = {
  ui: 'ui.png',
  attack: 'attack.png',
  chop: 'chop.png',
  mine: 'mine.png',
};
const HOTSPOTS = {
  ui: [0.28, 0.04],
  attack: [0.5, 0],
  chop: [0.82, 0.15],
  mine: [0.12, 0.12],
};
const SIZE = 26;

function isUiTarget(target) {
  return Boolean(target && target.closest && target.closest('#hud-layer, .options-panel'));
}

export default class GameCursor {

  constructor() {
    this.root = null;
    this.image = null;
    this.gameState = 'default';
    this.enabled = true;
    this.state = null;
    this.uiHover = false;
    this.pressed = false;
    this.visible = false;
    this.x = 0;
    this.y = 0;
    this.frame = 0;
    this.finePointer = typeof window !== 'undefined'
      && window.matchMedia
      && window.matchMedia('(pointer: fine)').matches;
    if (!this.finePointer) return;
    this.mount();
  }

  mount() {
    if (!document.body) return;
    const root = document.createElement('div');
    root.className = 'game-cursor';
    root.setAttribute('aria-hidden', 'true');
    root.style.width = `${SIZE}px`;
    root.style.height = `${SIZE}px`;
    root.innerHTML = '<img class="game-cursor__image" alt="" draggable="false" />';
    document.body.appendChild(root);
    this.root = root;
    this.image = root.querySelector('.game-cursor__image');
    window.addEventListener('pointermove', this.onMove, { passive: true });
    window.addEventListener('pointerdown', this.onDown, { passive: true });
    window.addEventListener('pointerup', this.onUp, { passive: true });
    window.addEventListener('pointercancel', this.onUp, { passive: true });
    window.addEventListener('blur', this.onLeave);
    document.documentElement.addEventListener('pointerleave', this.onLeave);
    this.refresh();
  }

  setState(state) {
    if (state !== 'default' && !FILES[state]) return;
    if (this.gameState === state) return;
    this.gameState = state;
    this.refresh();
  }

  setEnabled(enabled) {
    const next = Boolean(enabled);
    if (this.enabled === next) return;
    this.enabled = next;
    this.refresh();
  }

  refresh() {
    if (!this.root) return;
    const state = this.enabled
      ? (this.uiHover || this.gameState === 'default' ? 'ui' : this.gameState)
      : 'default';
    const active = this.enabled && this.visible && state !== 'default';
    if (this.state !== state) {
      this.state = state;
      this.root.dataset.state = state;
      if (active) this.image.src = IMAGE_DIR + FILES[state];
      else this.image.removeAttribute('src');
    } else if (active && !this.image.getAttribute('src')) {
      this.image.src = IMAGE_DIR + FILES[state];
    }
    document.body.classList.toggle('has-custom-cursor', active);
    this.root.classList.toggle('is-visible', active);
    this.root.classList.toggle('is-pressed', this.pressed);
  }

  schedule() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.render();
    });
  }

  render() {
    if (!this.root) return;
    const hotspot = HOTSPOTS[this.state] || [0.5, 0.5];
    const left = this.x - SIZE * hotspot[0];
    const top = this.y - SIZE * hotspot[1];
    this.root.style.transform = `translate3d(${left}px, ${top}px, 0)`;
  }

  onMove = (event) => {
    if (event.pointerType === 'touch') return;
    this.x = event.clientX;
    this.y = event.clientY;
    const uiHover = isUiTarget(document.elementFromPoint(this.x, this.y));
    if (uiHover !== this.uiHover) {
      this.uiHover = uiHover;
      this.refresh();
    }
    this.visible = true;
    this.refresh();
    this.schedule();
  };

  onDown = (event) => {
    if (event.pointerType === 'touch') return;
    this.x = event.clientX;
    this.y = event.clientY;
    this.uiHover = isUiTarget(document.elementFromPoint(this.x, this.y));
    this.pressed = true;
    this.visible = true;
    this.refresh();
    this.schedule();
  };

  onUp = (event) => {
    if (event.pointerType === 'touch') return;
    this.pressed = false;
    this.refresh();
  };

  onLeave = () => {
    this.visible = false;
    this.pressed = false;
    this.refresh();
  };

  destroy() {
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
    window.removeEventListener('blur', this.onLeave);
    document.documentElement.removeEventListener('pointerleave', this.onLeave);
    document.body.classList.remove('has-custom-cursor');
    if (this.root) this.root.remove();
    this.root = null;
  }
}