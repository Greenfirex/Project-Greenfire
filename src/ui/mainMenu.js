// Hlavní menu na začátku hry — Pokračovat, Nová hra, Načíst hru a Možnosti nad pohyblivým pozadím.
// Jen zobrazuje a hlásí volbu; co se po ní stane, rozhoduje scéna přes callbacky.
export default class MainMenu {

  constructor() {
    this.root = null;
    this.continueBtn = null;
    this.continueNote = null;
    this.onContinue = null;
    this.onNewGame = null;
    this.onLoad = null;
    this.onOptions = null;
  }

  show(backdrop) {
    if (this.root) return;
    const root = document.createElement('div');
    root.className = 'main-menu';
    root.innerHTML = `
      <nav class="main-menu__nav">
        <button type="button" class="main-menu__btn" data-action="continue">Pokračovat</button>
        <div class="main-menu__note"></div>
        <button type="button" class="main-menu__btn" data-action="new">Nová hra</button>
        <button type="button" class="main-menu__btn" data-action="load">Načíst hru…</button>
        <button type="button" class="main-menu__btn" data-action="options">Možnosti</button>
      </nav>
    `;
    root.prepend(backdrop.mount());
    this.continueBtn = root.querySelector('[data-action="continue"]');
    this.continueNote = root.querySelector('.main-menu__note');
    root.querySelector('[data-action="continue"]').addEventListener('click', () => this.onContinue && this.onContinue());
    root.querySelector('[data-action="new"]').addEventListener('click', () => this.onNewGame && this.onNewGame());
    root.querySelector('[data-action="load"]').addEventListener('click', () => this.onLoad && this.onLoad());
    root.querySelector('[data-action="options"]').addEventListener('click', () => this.onOptions && this.onOptions());
    document.getElementById('hud-layer').appendChild(root);
    this.root = root;
  }

  setContinue(note) {
    if (!this.root) return;
    this.continueBtn.hidden = !note;
    this.continueNote.hidden = !note;
    this.continueNote.textContent = note || '';
    const first = note ? this.continueBtn : this.root.querySelector('[data-action="new"]');
    first.focus();
  }

  dispose() {
    if (this.root) this.root.remove();
    this.root = null;
  }
}
