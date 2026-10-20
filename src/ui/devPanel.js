// Vývojářské nástroje — lišta nahoře uprostřed a panel s rychlostí času a pauzou času.
// Panel zůstává otevřený, dokud ho nezavřeš; o rychlosti jen hlásí scéně, sám čas nemění.
import { makeDraggable } from './draggable.js';

const SPEEDS = [1, 2, 5, 10];

export default class DevPanel {

  constructor() {
    this.bar = null;
    this.root = null;
    this.speedBtns = new Map();
    this.haltBtn = null;
    this.speed = 1;
    this.halted = false;
    this.onSpeed = null;
    this.onHalt = null;
    this.onToggleEditor = null;
  }

  mount() {
    if (this.root) return this.root;
    const bar = document.createElement('div');
    bar.className = 'dev-bar';
    bar.innerHTML = `
      <button type="button" class="dev-bar__btn" data-act="dev" title="Vývojářské nástroje (F2)">🐞 Nástroje</button>
      <button type="button" class="dev-bar__btn" data-act="editor" title="Editor mapy (F1)">🧱 Editor</button>
    `;
    document.getElementById('hud-layer').appendChild(bar);
    this.bar = bar;

    const root = document.createElement('div');
    root.className = 'dev-panel is-open';
    root.innerHTML = `
      <div class="dev-panel__head">
        <span class="dev-panel__title">Vývojářské nástroje</span>
        <button type="button" class="dev-panel__close" title="Skrýt (F2)">×</button>
      </div>
      <div class="dev-panel__row">
        <span class="dev-panel__label">Rychlost času</span>
        <div class="dev-panel__choices" data-group="speed"></div>
      </div>
      <div class="dev-panel__row">
        <span class="dev-panel__label">Zastavit jen čas</span>
        <button type="button" class="dev-panel__halt" data-act="halt"></button>
      </div>
      <div class="dev-panel__note">Hru pozastavíš klávesou <span class="hud-key">P</span>. Rychlost se neukládá, po startu je vždy 1×.</div>
    `;
    document.getElementById('hud-layer').appendChild(root);
    this.root = root;
    makeDraggable(root);

    const host = root.querySelector('[data-group="speed"]');
    for (const speed of SPEEDS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = `${speed}×`;
      btn.addEventListener('click', () => {
        if (this.onSpeed) this.onSpeed(speed);
      });
      host.appendChild(btn);
      this.speedBtns.set(speed, btn);
    }

    this.haltBtn = root.querySelector('[data-act="halt"]');
    this.haltBtn.addEventListener('click', () => {
      if (this.onHalt) this.onHalt(!this.halted);
    });

    root.querySelector('.dev-panel__close').addEventListener('click', () => this.hide());
    bar.querySelector('[data-act="dev"]').addEventListener('click', () => this.toggle());
    bar.querySelector('[data-act="editor"]').addEventListener('click', () => {
      if (this.onToggleEditor) this.onToggleEditor();
    });

    this.refresh();
    return root;
  }

  isOpen() {
    return Boolean(this.root && this.root.classList.contains('is-open'));
  }

  show() {
    this.mount();
    this.root.classList.add('is-open');
    this.syncBar();
    this.refresh();
  }

  hide() {
    if (!this.root) return;
    this.root.classList.remove('is-open');
    this.syncBar();
  }

  toggle() {
    if (this.isOpen()) this.hide();
    else this.show();
  }

  setSpeed(speed) {
    this.speed = speed;
    this.refresh();
  }

  setHalted(on) {
    this.halted = Boolean(on);
    this.refresh();
  }

  setEditorActive(active) {
    this.mount();
    const btn = this.bar.querySelector('[data-act="editor"]');
    if (btn) btn.classList.toggle('is-open', Boolean(active));
    const dev = this.bar.querySelector('[data-act="dev"]');
    if (dev) dev.classList.toggle('is-open', this.isOpen());
  }

  syncBar() {
    if (!this.bar) return;
    const dev = this.bar.querySelector('[data-act="dev"]');
    if (dev) dev.classList.toggle('is-open', this.isOpen());
  }

  refresh() {
    for (const [speed, btn] of this.speedBtns) {
      btn.classList.toggle('is-active', speed === this.speed);
    }
    if (this.haltBtn) {
      this.haltBtn.textContent = this.halted ? 'Čas stojí — pustit' : 'Zastavit čas';
      this.haltBtn.classList.toggle('is-active', this.halted);
    }
  }
}
