// DOM HUD — panely s ovládáním a stavem. Nad canvasem, do scény sahá jen callbacky.
export default class Hud {

  constructor() {
    this.layer = document.getElementById('hud-layer');
    this.helpEl = null;
    this.statusEl = null;
    this.machineEl = null;
    this.countEl = null;
    this.cellEl = null;
    this.underEl = null;
    this.onSave = null;
    this.onLoad = null;
    this.onToggleMachine = null;
  }

  mount() {
    this.helpEl = document.createElement('div');
    this.helpEl.className = 'hud-panel';
    this.helpEl.id = 'hud-help';
    this.helpEl.innerHTML = `
      <h2>Ovládání</h2>
      <div class="hud-row"><span>Rotace kamery</span><strong>tažení myší</strong></div>
      <div class="hud-row"><span>Zoom</span><strong>kolečko</strong></div>
      <div class="hud-row"><span>Stavět</span><strong>klik na zem</strong></div>
      <div class="hud-row"><span>Změna stroje</span><span class="hud-key">M</span></div>
      <div class="hud-row"><span>Otočit stroj</span><span class="hud-key">R</span></div>
      <div class="hud-row"><span>Bourat</span><strong>pravé tlačítko ×2</strong></div>
      <div class="hud-row"><span>Zrušit výběr</span><span class="hud-key">Esc</span></div>
      <div class="hud-row"><span>Uložit</span><span class="hud-key">F5</span></div>
      <div class="hud-row"><span>Načíst</span><span class="hud-key">F9</span></div>
      <div class="hud-hint">Bourání je dvoukrokové: první pravé tlačítko stroj označí, druhé ho zbourá.</div>
    `;
    this.layer.appendChild(this.helpEl);

    this.statusEl = document.createElement('div');
    this.statusEl.className = 'hud-panel';
    this.statusEl.id = 'hud-status';
    this.statusEl.innerHTML = `
      <h2>Stavba</h2>
      <div class="hud-row"><span>Stroj</span><strong id="hud-machine">—</strong></div>
      <div class="hud-row"><span>Postaveno</span><strong id="hud-count">0</strong></div>
      <div class="hud-row"><span>Buňka</span><strong id="hud-cell">—</strong></div>
      <div class="hud-row"><span>Výška</span><strong id="hud-height">—</strong></div>
      <div class="hud-row"><span>Pod kurzorem</span><strong id="hud-under">—</strong></div>
      <div class="hud-hint" id="hud-savehint">Uložení: žádné</div>
    `;
    this.layer.appendChild(this.statusEl);

    this.machineEl = this.statusEl.querySelector('#hud-machine');
    this.countEl = this.statusEl.querySelector('#hud-count');
    this.cellEl = this.statusEl.querySelector('#hud-cell');
    this.heightEl = this.statusEl.querySelector('#hud-height');
    this.underEl = this.statusEl.querySelector('#hud-under');
    this.saveHintEl = this.statusEl.querySelector('#hud-savehint');
  }

  setMachine(name) {
    if (this.machineEl) this.machineEl.textContent = name;
  }

  setCount(count) {
    if (this.countEl) this.countEl.textContent = String(count);
  }

  setCell(cx, cz, valid) {
    if (!this.cellEl) return;
    if (cx === null) {
      this.cellEl.textContent = '—';
      return;
    }
    const mark = valid ? '' : ' ✕';
    this.cellEl.textContent = `${cx}, ${cz}${mark}`;
  }

  setHeight(metres) {
    if (!this.heightEl) return;
    if (metres === null || metres === undefined) {
      this.heightEl.textContent = '—';
      return;
    }
    this.heightEl.textContent = `${metres.toFixed(1)} m`;
  }

  setCellOccupied(text) {
    if (this.underEl) this.underEl.textContent = text || '—';
  }

  setSaveHint(text) {
    if (this.saveHintEl) this.saveHintEl.textContent = text;
  }
}