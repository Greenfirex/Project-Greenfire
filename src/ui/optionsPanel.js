// DOM panel Možnosti — přepínače výkonu a chování hry; volby posílá scéně přes jediný callback.
import { makeDraggable } from './draggable.js';
import { OPTION_DEFAULTS, PRESET_OPTIONS } from '../data/catalogs/optionsSchema.js';

const TOGGLES = [
  { key: 'shadows', label: 'Stíny', note: 'Vypnutí nejvíc zrychlí hru, krajina bude plošší.' },
  { key: 'fireGlow', label: 'Záře ohně', note: 'Oheň a pochodně svítí do okolí. Vypnutí ušetří výkon.' },
  { key: 'highlights', label: 'Zvýrazňování pod myší', note: 'Kroužky pod stromy a rudou při najetí myší.' },
  { key: 'dayCycle', label: 'Denní cyklus', note: 'Zastavení nechá slunce stát na aktuálním času.' },
  { key: 'autoTune', label: 'Automatická úprava výkonu', note: 'Při poklesu snímků hra sama sníží rozlišení.' },
];

const QUALITIES = [
  { value: 'high', label: 'Vysoká' },
  { value: 'medium', label: 'Střední' },
  { value: 'low', label: 'Nízká' },
];

const FPS_OPTIONS = [
  { value: '0', label: 'Bez omezení' },
  { value: '60', label: '60' },
  { value: '30', label: '30' },
];

const GRASS_LEVELS = [
  { value: 'off', label: 'Vypnutá', title: 'Namalovaná tráva se nekreslí' },
  { value: 'medium', label: 'Střední', title: 'Řidší tráva pro slabší počítače' },
  { value: 'high', label: 'Hustá', title: 'Plná tráva, doporučeno' },
];

function clampPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

const VOLUMES = [
  { key: 'sfxVolume', label: 'Zvuky hry', note: 'Sekání, kroky, těžba a padající stromy.' },
  { key: 'ambientVolume', label: 'Zvuky prostředí', note: 'Hučení lesa (ve dne jiné než v noci) a příboj u vody.' },
];

const PRESETS = [
  { value: 'high', label: 'Vysoká', title: 'Plná kvalita, stíny a zvýrazňování' },
  { value: 'balanced', label: 'Vyvážená', title: 'Střední kvalita a 60 snímků' },
  { value: 'eco', label: 'Úsporná', title: 'Nízká kvalita, bez stínů a kroužků' },
];

export default class OptionsPanel {

  constructor() {
    this.root = null;
    this.button = null;
    this.values = { ...OPTION_DEFAULTS };
    this.onChange = null;
  }

  mount() {
    if (this.root) return this.root;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'options-toggle';
    button.title = 'Možnosti (O)';
    button.textContent = '⚙ Možnosti';
    button.addEventListener('mousedown', (evt) => evt.preventDefault());
    document.body.appendChild(button);
    button.addEventListener('click', () => this.toggle());
    this.button = button;

    const root = document.createElement('div');
    root.className = 'options-panel';
    root.innerHTML = `
      <div class="options-panel__head">
        <span class="options-panel__title">Možnosti</span>
        <button type="button" class="options-panel__close" title="Zavřít (O)">×</button>
      </div>
      <div class="options-panel__presets"></div>
      <div class="options-panel__row">
        <span class="options-panel__label">Kvalita obrazu</span>
        <div class="options-panel__choices" data-group="quality"></div>
      </div>
      <small class="options-panel__note">Nižší kvalita zmenší rozlišení, obraz bude měkčí.</small>
      <div class="options-panel__row">
        <span class="options-panel__label">Omezit snímky</span>
        <div class="options-panel__choices" data-group="fpsCap"></div>
      </div>
      <small class="options-panel__note">Nižší číslo = chladnější počítač.</small>
      <div class="options-panel__row">
        <span class="options-panel__label">Hustota trávy</span>
        <div class="options-panel__choices" data-group="grass"></div>
      </div>
      <small class="options-panel__note">Jak hustě se kreslí tráva, kterou namaluješ štětcem. Na mapě zůstane pořád.</small>
      <div class="options-panel__volumes"></div>
      <div class="options-panel__toggles"></div>
      <button type="button" class="options-panel__reset">Obnovit výchozí</button>
    `;
    document.body.appendChild(root);
    this.root = root;
    makeDraggable(root);

    root.querySelector('.options-panel__close').addEventListener('click', () => this.hide());
    root.querySelector('.options-panel__reset').addEventListener('click', () => this.setAll({ ...OPTION_DEFAULTS }));

    const presets = root.querySelector('.options-panel__presets');
    for (const preset of PRESETS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.preset = preset.value;
      btn.textContent = preset.label;
      btn.title = preset.title;
      btn.addEventListener('click', () => this.setAll({ ...OPTION_DEFAULTS, ...PRESET_OPTIONS[preset.value] }));
      presets.appendChild(btn);
    }

    this.buildChoices(root, 'quality', QUALITIES);
    this.buildChoices(root, 'fpsCap', FPS_OPTIONS);
    this.buildChoices(root, 'grass', GRASS_LEVELS);

    const volumes = root.querySelector('.options-panel__volumes');
    for (const volume of VOLUMES) {
      const row = document.createElement('label');
      row.className = 'options-panel__volume';
      row.innerHTML = `
        <span class="options-panel__volume-head">
          <span class="options-panel__label">${volume.label}</span>
          <span class="options-panel__volume-value" data-value="${volume.key}"></span>
        </span>
        <input type="range" min="0" max="100" step="5" data-volume="${volume.key}">
        <small class="options-panel__sound-note">${volume.note}</small>
      `;
      const input = row.querySelector('input');
      input.addEventListener('input', () => this.patch({ [volume.key]: Number(input.value) }));
      volumes.appendChild(row);
    }

    const toggles = root.querySelector('.options-panel__toggles');
    for (const toggle of TOGGLES) {
      const row = document.createElement('label');
      row.className = 'options-panel__toggle';
      row.innerHTML = `
        <input type="checkbox" data-toggle="${toggle.key}">
        <span class="options-panel__toggle-text">
          <span>${toggle.label}</span>
          <small>${toggle.note}</small>
        </span>
      `;
      const input = row.querySelector('input');
      input.addEventListener('change', () => this.patch({ [toggle.key]: input.checked }));
      toggles.appendChild(row);
    }

    this.render();
    return root;
  }

  buildChoices(root, group, items) {
    const host = root.querySelector(`[data-group="${group}"]`);
    for (const item of items) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.value = item.value;
      btn.textContent = item.label;
      btn.addEventListener('click', () => {
        this.patch({ [group]: group === 'fpsCap' ? Number(item.value) : item.value });
      });
      host.appendChild(btn);
    }
  }

  show() {
    if (!this.root) return;
    this.root.classList.add('is-open');
    if (this.button) this.button.classList.add('is-open');
  }

  hide() {
    if (!this.root) return;
    this.root.classList.remove('is-open');
    if (this.button) this.button.classList.remove('is-open');
  }

  setButtonVisible(visible) {
    if (!this.button) return;
    this.button.classList.toggle('is-hidden', !visible);
  }

  toggle() {
    if (this.root && this.root.classList.contains('is-open')) this.hide();
    else this.show();
  }

  setAll(values) {
    this.values = { ...OPTION_DEFAULTS, ...values };
    this.render();
    if (this.onChange) this.onChange({ ...this.values });
  }

  patch(changes) {
    this.values = { ...this.values, ...changes };
    this.render();
    if (this.onChange) this.onChange({ ...this.values });
  }

  render() {
    if (!this.root) return;
    for (const btn of this.root.querySelectorAll('[data-group="quality"] button')) {
      btn.classList.toggle('is-active', String(this.values.quality) === btn.dataset.value);
    }
    for (const btn of this.root.querySelectorAll('[data-group="fpsCap"] button')) {
      btn.classList.toggle('is-active', String(this.values.fpsCap) === btn.dataset.value);
    }
    for (const btn of this.root.querySelectorAll('[data-group="grass"] button')) {
      btn.classList.toggle('is-active', String(this.values.grass) === btn.dataset.value);
    }
    for (const input of this.root.querySelectorAll('[data-toggle]')) {
      input.checked = Boolean(this.values[input.dataset.toggle]);
    }
    for (const input of this.root.querySelectorAll('[data-volume]')) {
      const value = clampPercent(this.values[input.dataset.volume]);
      input.value = String(value);
      input.style.setProperty('--fill', `${value}%`);
      const label = this.root.querySelector(`[data-value="${input.dataset.volume}"]`);
      if (label) label.textContent = `${value} %`;
    }
    for (const btn of this.root.querySelectorAll('[data-preset]')) {
      const preset = PRESET_OPTIONS[btn.dataset.preset];
      const matches = preset && Object.entries(preset).every(([key, value]) => this.values[key] === value);
      btn.classList.toggle('is-active', Boolean(matches));
    }
  }
}
