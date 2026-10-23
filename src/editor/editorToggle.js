// Tlačítko nahoře uprostřed — otevře a zavře editor mapy.
// Jen hlásí kliknutí scéně, stav editoru si drží scéna.
export default class EditorToggle {

  constructor() {
    this.root = null;
    this.btn = null;
    this.active = false;
    this.onToggle = null;
  }

  mount() {
    if (this.root) return this.root;
    const root = document.createElement('div');
    root.className = 'dev-bar';
    root.innerHTML = `<button type="button" class="dev-bar__btn" title="Editor mapy (F1)">🧱 Editor</button>`;
    document.getElementById('hud-layer').appendChild(root);
    this.root = root;
    this.btn = root.querySelector('.dev-bar__btn');
    this.btn.addEventListener('click', () => {
      if (this.onToggle) this.onToggle();
    });
    this.refresh();
    return root;
  }

  setActive(active) {
    this.active = Boolean(active);
    this.refresh();
  }

  refresh() {
    if (this.btn) this.btn.classList.toggle('is-open', this.active);
  }
}
