// Ztmavení obrazovky přes hru — nápis PAUZA, tlačítko Pokračovat a stav herního času.
// Jen zobrazuje stav a hlásí kliknutí; zastavení hry má na starost scéna.
export default class PauseScreen {

  constructor() {
    this.root = null;
    this.onResume = null;
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
        <button type="button" class="pause-card__resume">Pokračovat</button>
        <div class="pause-card__keys"><span class="hud-key">P</span> pokračovat</div>
      </div>
    `;
    document.getElementById('hud-layer').appendChild(root);
    this.root = root;
    this.speedEl = root.querySelector('.pause-card__speed strong');
    root.querySelector('.pause-card__resume').addEventListener('click', () => {
      if (this.onResume) this.onResume();
    });
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

