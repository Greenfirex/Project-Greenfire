// Ztmavení obrazovky přes hru — nápis PAUZA, Pokračovat, uložení, načtení, možnosti, ovládání, editor mapy,
// návrat do menu a stav herního času.
// Jen zobrazuje stav a hlásí kliknutí; zastavení hry má na starost scéna.
export default class PauseScreen {

  constructor() {
    this.root = null;
    this.onResume = null;
    this.onSave = null;
    this.onLoad = null;
    this.onOptions = null;
    this.onHelp = null;
    this.onEditor = null;
    this.onMenu = null;
    this.speedEl = null;
    this.lastSpeed = '';
  }

  mount() {
    if (this.root) return this.root;
    const root = document.createElement('div');
    root.className = 'pause-screen';
    root.innerHTML = `
      <div class="pause-card">
        <div class="pause-card__title">Pauza</div>
        <div class="pause-card__speed">Rychlost času: <strong>1×</strong></div>
        <button type="button" class="pause-card__resume" data-action="resume">Pokračovat</button>
        <button type="button" class="pause-card__resume" data-action="save">Uložit hru</button>
        <button type="button" class="pause-card__resume" data-action="load">Načíst hru</button>
        <button type="button" class="pause-card__resume" data-action="options">Možnosti</button>
        <button type="button" class="pause-card__resume" data-action="help">Ovládání</button>
        <button type="button" class="pause-card__resume" data-action="editor">Editor mapy</button>
        <button type="button" class="pause-card__resume" data-action="menu">Do hlavního menu</button>
        <div class="pause-card__keys"><span class="hud-key">Esc</span> nebo <span class="hud-key">P</span> pokračovat</div>
      </div>
    `;
    document.getElementById('hud-layer').appendChild(root);
    this.root = root;
    this.speedEl = root.querySelector('.pause-card__speed strong');
    const handlers = {
      resume: () => this.onResume,
      save: () => this.onSave,
      load: () => this.onLoad,
      options: () => this.onOptions,
      help: () => this.onHelp,
      editor: () => this.onEditor,
      menu: () => this.onMenu,
    };
    for (const btn of root.querySelectorAll('button[data-action]')) {
      btn.addEventListener('click', () => {
        const action = handlers[btn.dataset.action]();
        if (action) action();
      });
    }
    return root;
  }

  show() {
    this.mount();
    if (this.lastSpeed) this.speedEl.textContent = this.lastSpeed;
    this.root.classList.add('is-open');
  }

  hide() {
    if (this.root) this.root.classList.remove('is-open');
  }

  setSpeed(speed) {
    this.lastSpeed = `${speed}×`;
    if (this.speedEl) this.speedEl.textContent = this.lastSpeed;
  }
}

