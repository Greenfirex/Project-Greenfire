// Tlačítko v horní liště — otevře a zavře editor mapy.
// Jen hlásí kliknutí scéně, stav editoru si drží scéna.
export default class EditorToggle {

  constructor() {
    this.root = null;
    this.btn = null;
    this.active = false;
    this.onToggle = null;
  }

  mount() {
    if (this.btn) return this.btn;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hud-bar__btn hud-bar__btn--editor';
    btn.title = 'Editor mapy (F2)';
    btn.textContent = '🧱 Editor';
    btn.addEventListener('click', () => {
      if (this.onToggle) this.onToggle();
    });
    const host = document.getElementById('hud-bar') || document.getElementById('hud-layer');
    host.appendChild(btn);
    this.root = btn;
    this.btn = btn;
    this.refresh();
    return btn;
  }

  setActive(active) {
    this.active = Boolean(active);
    this.refresh();
  }

  refresh() {
    if (this.btn) this.btn.classList.toggle('is-open', this.active);
  }
}
