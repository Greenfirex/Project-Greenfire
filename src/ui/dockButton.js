// Samostatný panel v dolní liště — tlačítko s ikonou, které otevírá okno.
// Jen hlásí kliknutí scéně; stav otevřeného okna si drží scéna.
export default class DockButton {

  constructor({ icon, label, title, slot }) {
    this.icon = icon;
    this.label = label;
    this.title = title;
    this.slot = slot || 'panel';
    this.btn = null;
    this.onClick = null;
  }

  mount() {
    if (this.btn) return this.btn;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `dock-panel dock-panel--${this.slot}`;
    btn.title = this.title;
    btn.innerHTML = `<span class="dock-panel__icon">${this.icon}</span><span class="dock-panel__name">${this.label}</span>`;
    btn.addEventListener('mousedown', (evt) => evt.preventDefault());
    btn.addEventListener('click', () => {
      if (this.onClick) this.onClick();
    });
    const host = document.getElementById('hud-dock') || document.getElementById('hud-layer');
    host.appendChild(btn);
    this.btn = btn;
    return btn;
  }

  setActive(open) {
    if (this.btn) this.btn.classList.toggle('is-active', Boolean(open));
  }
}
