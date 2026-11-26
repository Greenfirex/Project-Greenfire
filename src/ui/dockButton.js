// Tlačítko okna ve svislém pruhu u pravého okraje — ikona s písmenem klávesy v rohu; jméno ukáže při najetí.
// Jen hlásí kliknutí scéně; stav otevřeného okna si drží scéna.
function panelStrip() {
  let strip = document.getElementById('hud-panels');
  if (!strip) {
    strip = document.createElement('div');
    strip.className = 'hud-panels';
    strip.id = 'hud-panels';
    (document.getElementById('hud-layer') || document.body).appendChild(strip);
  }
  return strip;
}

export default class DockButton {

  constructor({ icon, label, key, slot }) {
    this.icon = icon;
    this.label = label;
    this.key = key || '';
    this.slot = slot || 'panel';
    this.btn = null;
    this.onClick = null;
  }

  mount() {
    if (this.btn) return this.btn;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `dock-panel dock-panel--${this.slot}`;
    btn.title = this.key ? `${this.label} (${this.key})` : this.label;
    btn.innerHTML = `<span class="dock-panel__icon">${this.icon}</span><span class="dock-panel__key">${this.key}</span>`;
    btn.addEventListener('mousedown', (evt) => evt.preventDefault());
    btn.addEventListener('click', () => {
      if (this.onClick) this.onClick();
    });
    panelStrip().appendChild(btn);
    this.btn = btn;
    return btn;
  }

  setActive(open) {
    if (this.btn) this.btn.classList.toggle('is-active', Boolean(open));
  }
}
