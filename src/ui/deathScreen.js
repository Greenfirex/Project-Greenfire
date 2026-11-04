// Okno smrti — ztmaví hru, napíše Zemřel jsi a nechá hráče kliknout na Respawn.
// Drží jen otevřený stav; oživení postavy má na starost scéna.
export default class DeathScreen {

  constructor() {
    this.root = null;
    this.button = null;
    this.onRespawn = null;
    this.open = false;
  }

  mount() {
    if (this.root) return this.root;
    const root = document.createElement('div');
    root.className = 'death-screen';
    root.innerHTML = `
      <div class="death-card">
        <div class="death-card__title">Zemřel jsi</div>
        <button type="button" class="death-card__respawn">Respawn</button>
      </div>
    `;
    document.getElementById('hud-layer').appendChild(root);
    this.root = root;
    this.button = root.querySelector('.death-card__respawn');
    this.button.addEventListener('click', () => {
      if (this.onRespawn) this.onRespawn();
    });
    return root;
  }

  show() {
    this.mount();
    this.open = true;
    this.root.classList.add('is-open');
    if (this.button) this.button.focus();
  }

  hide() {
    this.open = false;
    if (this.button) this.button.blur();
    if (this.root) this.root.classList.remove('is-open');
  }
}
