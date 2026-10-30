// DOM HUD — panely s ovládáním a stavem. Nad canvasem, do scény sahá jen callbacky.
const SPEEDS = [1, 2, 5, 10];

export default class Hud {

  constructor() {
    this.layer = document.getElementById('hud-layer');
    this.barEl = null;
    this.helpToggle = null;
    this.saveBtn = null;
    this.loadBtn = null;
    this.helpOpen = false;
    this.helpEl = null;
    this.statusEl = null;
    this.machineEl = null;
    this.countEl = null;
    this.cellEl = null;
    this.underEl = null;
    this.reasonEl = null;
    this.clockEl = null;
    this.clockTimeEl = null;
    this.clockPhaseEl = null;
    this.clockSpeedEl = null;
    this.speedBtns = new Map();
    this.onSave = null;
    this.onLoad = null;
    this.onToggleMachine = null;
    this.onSpeed = null;
  }

  mount() {
    this.barEl = document.createElement('div');
    this.barEl.className = 'hud-bar';
    this.barEl.id = 'hud-bar';
    this.layer.appendChild(this.barEl);

    this.helpToggle = document.createElement('button');
    this.helpToggle.type = 'button';
    this.helpToggle.className = 'hud-bar__btn hud-bar__btn--help';
    this.helpToggle.title = 'Nápověda (F1)';
    this.helpToggle.textContent = '❔ Ovládání';
    this.helpToggle.addEventListener('click', () => this.toggleHelp());
    this.barEl.appendChild(this.helpToggle);

    this.saveBtn = this.createBarButton('💾 Uložit', 'Uložit hru (F5)', 'save', () => {
      if (this.onSave) this.onSave();
    });
    this.loadBtn = this.createBarButton('📂 Načíst', 'Načíst uloženou hru (F9)', 'load', () => {
      if (this.onLoad) this.onLoad();
    });

    this.helpEl = document.createElement('div');
    this.helpEl.className = 'hud-panel';
    this.helpEl.id = 'hud-help';
    this.helpEl.innerHTML = `
      <h2>Ovládání</h2>
      <div class="hud-row"><span>Rotace kamery</span><strong>tažení myší</strong></div>
      <div class="hud-row"><span>Zoom</span><strong>kolečko</strong></div>
      <div class="hud-row"><span>Nástroj v ruce</span><span class="hud-key">1</span>–<span class="hud-key">5</span></div>
      <div class="hud-row"><span>Postavit</span><strong>klik na zem s plánem</strong></div>
      <div class="hud-row"><span>Dosah stavby</span><strong>2 buňky</strong></div>
      <div class="hud-row"><span>Změna stroje</span><span class="hud-key">M</span></div>
      <div class="hud-row"><span>Otočit stroj</span><span class="hud-key">R</span></div>
      <div class="hud-row"><span>Bourat</span><strong>pravé tlačítko ×2</strong></div>
      <div class="hud-row"><span>Zapálit táborák</span><span class="hud-key">E</span></div>
      <div class="hud-row"><span>Mřížka</span><span class="hud-key">G</span></div>
      <div class="hud-row"><span>Přesunout den</span><span class="hud-key">N</span></div>
      <div class="hud-row"><span>Editor mapy</span><span class="hud-key">F2</span></div>
      <div class="hud-row"><span>Zrušit výběr</span><span class="hud-key">Esc</span></div>
      <div class="hud-row"><span>Uložit</span><span class="hud-key">F5</span></div>
      <div class="hud-row"><span>Načíst</span><span class="hud-key">F9</span></div>
      <div class="hud-row"><span>Možnosti</span><span class="hud-key">O</span></div>
      <div class="hud-row"><span>Pauza / pokračovat</span><span class="hud-key">P</span></div>
      <div class="hud-row"><span>Skrýt nápovědu</span><span class="hud-key">F1</span></div>
      <div class="hud-hint">Stavět a bourat lze jen s plánem v ruce. Bourání je dvoukrokové: první pravé tlačítko stroj označí, druhé ho zbourá.</div>
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
      <div class="hud-row"><span>Důvod</span><strong id="hud-reason">—</strong></div>
      <div class="hud-hint" id="hud-savehint">Uložení: žádné</div>
    `;
    this.layer.appendChild(this.statusEl);

    this.machineEl = this.statusEl.querySelector('#hud-machine');
    this.countEl = this.statusEl.querySelector('#hud-count');
    this.cellEl = this.statusEl.querySelector('#hud-cell');
    this.heightEl = this.statusEl.querySelector('#hud-height');
    this.underEl = this.statusEl.querySelector('#hud-under');
    this.reasonEl = this.statusEl.querySelector('#hud-reason');
    this.saveHintEl = this.statusEl.querySelector('#hud-savehint');

    this.clockEl = document.createElement('div');
    this.clockEl.className = 'hud-panel';
    this.clockEl.id = 'hud-clock';
    this.clockEl.innerHTML = `
      <div class="hud-clock__time" id="hud-clock-time">--:--</div>
      <div class="hud-clock__meta">
        <span id="hud-clock-phase">—</span>
        <span id="hud-clock-speed">1×</span>
      </div>
      <div class="hud-clock__speeds" id="hud-clock-speeds"></div>
      <div class="hud-clock__flash" id="hud-clock-flash"></div>
    `;
    this.layer.appendChild(this.clockEl);

    const speedHost = this.clockEl.querySelector('#hud-clock-speeds');
    for (const speed of SPEEDS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = `${speed}×`;
      btn.addEventListener('click', () => {
        if (this.onSpeed) this.onSpeed(speed);
      });
      speedHost.appendChild(btn);
      this.speedBtns.set(speed, btn);
    }

    this.clockTimeEl = this.clockEl.querySelector('#hud-clock-time');
    this.clockPhaseEl = this.clockEl.querySelector('#hud-clock-phase');
    this.clockSpeedEl = this.clockEl.querySelector('#hud-clock-speed');
    this.clockFlashEl = this.clockEl.querySelector('#hud-clock-flash');
    this.clockFlashTimer = 0;
  }

  setMachine(name) {
    if (this.machineEl) this.machineEl.textContent = name;
  }

  createBarButton(label, title, slot, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `hud-bar__btn hud-bar__btn--${slot}`;
    btn.title = title;
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    this.barEl.appendChild(btn);
    return btn;
  }

  toggleHelp() {
    this.setHelpOpen(!this.helpOpen);
  }

  setHelpOpen(open) {
    this.helpOpen = Boolean(open);
    if (this.helpEl) this.helpEl.classList.toggle('is-open', this.helpOpen);
    if (this.helpToggle) this.helpToggle.classList.toggle('is-open', this.helpOpen);
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

  setBuildReason(text) {
    if (this.reasonEl) this.reasonEl.textContent = text || '—';
  }

  setSaveHint(text) {
    if (this.saveHintEl) this.saveHintEl.textContent = text;
  }

  setStatusVisible(visible) {
    if (this.statusEl) this.statusEl.classList.toggle('is-open', visible);
  }

  isStatusOpen() {
    return Boolean(this.statusEl && this.statusEl.classList.contains('is-open'));
  }

  setClockText(text) {
    if (!this.clockTimeEl || this.clockTimeEl.textContent === text) return;
    this.clockTimeEl.textContent = text;
  }

  setClockPhase(text) {
    if (!this.clockPhaseEl || this.clockPhaseEl.textContent === text) return;
    this.clockPhaseEl.textContent = text;
  }

  setClockSpeed(paused, speed) {
    if (!this.clockSpeedEl) return;
    const text = paused ? 'Pauza' : `${speed}×`;
    if (this.clockSpeedEl.textContent !== text) this.clockSpeedEl.textContent = text;
    this.clockEl.classList.toggle('is-paused', paused);
    for (const [value, btn] of this.speedBtns) {
      btn.classList.toggle('is-active', value === speed);
    }
  }

  flashClock(text) {
    if (!this.clockFlashEl) return;
    this.clockFlashEl.textContent = text;
    this.clockEl.classList.add('is-flashing');
    clearTimeout(this.clockFlashTimer);
    this.clockFlashTimer = setTimeout(() => {
      this.clockEl.classList.remove('is-flashing');
    }, 1800);
  }
}