// DOM HUD — panely s ovládáním a stavem. Nad canvasem, do scény sahá jen callbacky.
// Tlačítka vlevo nahoře jsou sbalená pod jedním tlačítkem Menu; po volbě nebo kliknutí jinam se sbalí.
import { SIM_SPEEDS } from '../systems/core/simSystem.js';

export default class Hud {

  constructor() {
    this.layer = document.getElementById('hud-layer');
    this.menuEl = null;
    this.menuToggle = null;
    this.menuOpen = false;
    this.barEl = null;
    this.helpToggle = null;
    this.saveBtn = null;
    this.loadBtn = null;
    this.helpOpen = false;
    this.helpEl = null;
    this.clockEl = null;
    this.clockTimeEl = null;
    this.clockPhaseEl = null;
    this.clockSpeedEl = null;
    this.speedBtns = new Map();
    this.onSave = null;
    this.onLoad = null;
    this.onSpeed = null;
  }

  mount() {
    this.menuEl = document.createElement('div');
    this.menuEl.className = 'hud-menu';
    this.layer.appendChild(this.menuEl);

    this.menuToggle = document.createElement('button');
    this.menuToggle.type = 'button';
    this.menuToggle.className = 'hud-bar__btn hud-menu__toggle';
    this.menuToggle.title = 'Menu';
    this.menuToggle.textContent = '☰ Menu';
    this.menuToggle.addEventListener('mousedown', (evt) => evt.preventDefault());
    this.menuToggle.addEventListener('click', () => this.setMenuOpen(!this.menuOpen));
    this.menuEl.appendChild(this.menuToggle);

    this.barEl = document.createElement('div');
    this.barEl.className = 'hud-bar';
    this.barEl.id = 'hud-bar';
    this.barEl.addEventListener('click', (evt) => {
      if (evt.target.closest('.hud-bar__btn')) this.setMenuOpen(false);
    });
    this.menuEl.appendChild(this.barEl);
    document.addEventListener('pointerdown', (evt) => {
      if (this.menuOpen && !this.menuEl.contains(evt.target)) this.setMenuOpen(false);
    }, true);

    this.helpToggle = document.createElement('button');
    this.helpToggle.type = 'button';
    this.helpToggle.className = 'hud-bar__btn hud-bar__btn--help';
    this.helpToggle.title = 'Nápověda (F1)';
    this.helpToggle.textContent = '❔ Ovládání';
    this.helpToggle.addEventListener('click', () => this.toggleHelp());
    this.barEl.appendChild(this.helpToggle);

    this.saveBtn = this.createBarButton('💾 Uložit', 'Uložit hru do pozice (rychlé uložení: F5)', 'save', () => {
      if (this.onSave) this.onSave();
    });
    this.loadBtn = this.createBarButton('📂 Načíst', 'Načíst uloženou hru (rychlé načtení: F9)', 'load', () => {
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
      <div class="hud-row"><span>Tasit / zandat zbraň</span><span class="hud-key">X</span></div>
      <div class="hud-row"><span>Zapálit táborák</span><span class="hud-key">E</span></div>
      <div class="hud-row"><span>Mřížka</span><span class="hud-key">G</span></div>
      <div class="hud-row"><span>Posunout čas</span><span class="hud-key">N</span></div>
      <div class="hud-row"><span>Editor mapy</span><span class="hud-key">F2</span></div>
      <div class="hud-row"><span>Zrušit výběr</span><span class="hud-key">Esc</span></div>
      <div class="hud-row"><span>Rychlé uložení</span><span class="hud-key">F5</span></div>
      <div class="hud-row"><span>Rychlé načtení</span><span class="hud-key">F9</span></div>
      <div class="hud-row"><span>Možnosti</span><span class="hud-key">O</span></div>
      <div class="hud-row"><span>Inventář / postava</span><span class="hud-key">I</span> <span class="hud-key">C</span></div>
      <div class="hud-row"><span>Pauza / pokračovat</span><span class="hud-key">P</span></div>
      <div class="hud-row"><span>Skrýt nápovědu</span><span class="hud-key">F1</span></div>
    `;
    this.layer.appendChild(this.helpEl);

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
    for (const speed of SIM_SPEEDS) {
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

  setMenuOpen(open) {
    this.menuOpen = Boolean(open);
    this.menuEl.classList.toggle('is-open', this.menuOpen);
    this.menuToggle.classList.toggle('is-open', this.menuOpen);
  }

  toggleHelp() {
    this.setHelpOpen(!this.helpOpen);
  }

  setHelpOpen(open) {
    this.helpOpen = Boolean(open);
    if (this.helpEl) this.helpEl.classList.toggle('is-open', this.helpOpen);
    if (this.helpToggle) this.helpToggle.classList.toggle('is-open', this.helpOpen);
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