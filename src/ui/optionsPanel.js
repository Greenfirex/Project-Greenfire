// DOM panel Možnosti — tři záložky (obraz a výkon, zvuk, hra); volby posílá scéně přes jediný callback.
import { makeDraggable } from './draggable.js';
import { OPTION_DEFAULTS, PRESET_OPTIONS } from '../data/catalogs/optionsSchema.js';

const TABS = [
  { key: 'view', label: 'Obraz a výkon' },
  { key: 'sound', label: 'Zvuk' },
  { key: 'game', label: 'Hra' },
];

const PRESETS = [
  { value: 'high', label: 'Vysoká', title: 'Plná kvalita, plné stíny, hustá tráva' },
  { value: 'balanced', label: 'Vyvážená', title: 'Střední kvalita, jednoduché stíny, střední tráva' },
  { value: 'eco', label: 'Úsporná', title: 'Nízká kvalita, bez stínů, trávy a odrazů, 30 snímků' },
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
  { value: 'low', label: 'Řídká', title: 'Nejřidší tráva pro slabé počítače' },
  { value: 'medium', label: 'Střední', title: 'Řidší tráva pro slabší počítače' },
  { value: 'high', label: 'Hustá', title: 'Plná tráva, doporučeno' },
];

const SHADOW_LEVELS = [
  { value: 'off', label: 'Vypnuté', title: 'Žádné stíny, nejrychlejší' },
  { value: 'simple', label: 'Jednoduché', title: 'Hrubší stíny pro slabší počítače' },
  { value: 'full', label: 'Plné', title: 'Ostré a měkce zakončené stíny' },
];

const FERN_MODES = [
  { value: 'light', label: 'Lehká', title: 'Kapradina s 437 trojúhelníky, doporučeno' },
  { value: 'detail', label: 'Detailní', title: 'Kapradina s 7 581 trojúhelníky, jen na vyzkoušení' },
];

const ITEMS = [
  { kind: 'choice', key: 'quality', tab: 'view', label: 'Kvalita obrazu', note: 'Nižší kvalita zmenší rozlišení a zjednoduší vodu a odrazy, obraz bude měkčí.', options: QUALITIES },
  { kind: 'choice', key: 'grass', tab: 'view', label: 'Hustota trávy', note: 'Jak hustě se kreslí tráva, kterou namaluješ štětcem. Na mapě zůstane pořád.', options: GRASS_LEVELS },
  { kind: 'choice', key: 'grassFern', tab: 'view', label: 'Kapradina', note: 'Lehká je na hraní, detailní je jen na porovnání vzhledu a výkonu.', options: FERN_MODES },
  { kind: 'toggle', key: 'groundBlend', tab: 'view', label: 'Zem ze tří textur', note: 'Trávu na zemi míchají tři textury do velkých skvrn. Vypnutí ušetří výkon.' },
  { kind: 'choice', key: 'fpsCap', tab: 'view', label: 'Omezit snímky', note: 'Nižší číslo = chladnější počítač.', options: FPS_OPTIONS, numeric: true },
  { kind: 'choice', key: 'shadows', tab: 'view', label: 'Stíny', note: 'Stíny patří k tomu, co hru zpomaluje nejvíc. Bez nich bude krajina plošší.', options: SHADOW_LEVELS },
  { kind: 'toggle', key: 'reflections', tab: 'view', label: 'Odrazy ve vodě', note: 'Stromy a břehy se zrcadlí na hladině. Vypnutí hodně ušetří, voda odráží jen oblohu.' },
  { kind: 'toggle', key: 'fireGlow', tab: 'view', label: 'Záře ohně', note: 'Měkká záře kolem plamenů. Oheň svítí do okolí i bez ní. Šetří jen ve chvíli, kdy něco hoří.' },
  { kind: 'toggle', key: 'waterDetail', tab: 'view', label: 'Čeření vody', note: 'Jemné vlnky na hladině. Vypnutí ušetří výkon, hladina bude hladší.' },
  { kind: 'toggle', key: 'autoTune', tab: 'view', label: 'Automatická úprava výkonu', note: 'Při poklesu snímků hra sama sníží rozlišení, nejvýš na 70 %. Při limitu 30 snímků nepracuje.' },
  { kind: 'volume', key: 'sfxVolume', tab: 'sound', label: 'Zvuky hry', note: 'Sekání, kroky, těžba a padající stromy.' },
  { kind: 'volume', key: 'ambientVolume', tab: 'sound', label: 'Zvuky prostředí', note: 'Hučení lesa (ve dne jiné než v noci) a příboj u vody.' },
  { kind: 'volume', key: 'musicVolume', tab: 'sound', label: 'Hudba', note: 'Ostrovní hudba na pozadí. Skladby se střídají náhodně.' },
  { kind: 'toggle', key: 'footprints', tab: 'game', label: 'Stopy ve písku', note: 'Otisky kroků na písku a v hlíně.' },
  { kind: 'toggle', key: 'dayCycle', tab: 'game', label: 'Denní cyklus', note: 'Zastavení nechá slunce stát na aktuálním času.' },
  { kind: 'toggle', key: 'highlights', tab: 'game', label: 'Zvýrazňování pod myší', note: 'Kroužky pod stromy a rudou při najetí myší.' },
  { kind: 'toggle', key: 'customCursor', tab: 'game', label: 'Vlastní kurzor', note: 'Fantasy ruka a nástroje místo systémové šipky. Vypnutím vrátíš šipku Windows.' },
  { kind: 'toggle', key: 'cameraShake', tab: 'game', label: 'Třes kamery', note: 'Kamera se otřese, když dostaneš zásah.' },
  { kind: 'toggle', key: 'damageFlash', tab: 'game', label: 'Červené bliknutí', note: 'Záblesk po okrajích obrazovky při zásahu.' },
  { kind: 'toggle', key: 'floatingNumbers', tab: 'game', label: 'Plovoucí čísla', note: 'Poškození vypluje nad postavou a zmizí.' },
  { kind: 'toggle', key: 'lookAtPointer', tab: 'game', label: 'Otáčení za myší', note: 'Ve stoje se postava dívá tam, kde máš kurzor.' },
];

function clampPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

export default class OptionsPanel {

  constructor() {
    this.root = null;
    this.button = null;
    this.values = { ...OPTION_DEFAULTS };
    this.onChange = null;
    this.tab = TABS[0].key;
  }

  mount() {
    if (this.root) return this.root;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'hud-bar__btn hud-bar__btn--options';
    button.title = 'Možnosti (O)';
    button.textContent = '⚙ Možnosti';
    button.addEventListener('mousedown', (evt) => evt.preventDefault());
    const host = document.getElementById('hud-bar') || document.body;
    host.appendChild(button);
    button.addEventListener('click', () => this.toggle());
    this.button = button;

    const root = document.createElement('div');
    root.className = 'options-panel';
    root.innerHTML = `
      <div class="options-panel__head">
        <span class="options-panel__title">Možnosti</span>
        <button type="button" class="options-panel__close" title="Zavřít (O)">×</button>
      </div>
      <div class="options-panel__tabs"></div>
      <div class="options-panel__body"></div>
    `;
    document.body.appendChild(root);
    this.root = root;
    makeDraggable(root);

    root.querySelector('.options-panel__close').addEventListener('click', () => this.hide());

    const tabs = root.querySelector('.options-panel__tabs');
    const body = root.querySelector('.options-panel__body');
    for (const tab of TABS) {
      const tabButton = document.createElement('button');
      tabButton.type = 'button';
      tabButton.dataset.tab = tab.key;
      tabButton.textContent = tab.label;
      tabButton.addEventListener('click', () => this.showTab(tab.key));
      tabs.appendChild(tabButton);

      const panel = document.createElement('div');
      panel.className = 'options-panel__tab';
      panel.dataset.panel = tab.key;
      body.appendChild(panel);
      if (tab.key === 'view') this.buildPresets(panel);
      this.buildItems(panel, tab.key);
      this.buildReset(panel, tab.key);
    }

    this.showTab(this.tab);
    this.render();
    return root;
  }

  buildPresets(panel) {
    const presets = document.createElement('div');
    presets.className = 'options-panel__presets';
    for (const preset of PRESETS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.preset = preset.value;
      btn.textContent = preset.label;
      btn.title = preset.title;
      btn.addEventListener('click', () => this.patch(PRESET_OPTIONS[preset.value]));
      presets.appendChild(btn);
    }
    panel.appendChild(presets);
  }

  buildItems(panel, tabKey) {
    let group = null;
    let groupKind = null;
    for (const item of ITEMS) {
      if (item.tab !== tabKey) continue;
      if (item.kind === 'choice') {
        this.buildChoice(panel, item);
        group = null;
        groupKind = null;
        continue;
      }
      if (groupKind !== item.kind) {
        group = document.createElement('div');
        group.className = item.kind === 'toggle' ? 'options-panel__toggles' : 'options-panel__volumes';
        panel.appendChild(group);
        groupKind = item.kind;
      }
      if (item.kind === 'toggle') this.buildToggle(group, item);
      else this.buildVolume(group, item);
    }
  }

  buildChoice(panel, item) {
    const row = document.createElement('div');
    row.className = 'options-panel__row';
    row.innerHTML = `<span class="options-panel__label">${item.label}</span><div class="options-panel__choices" data-group="${item.key}"></div>`;
    panel.appendChild(row);
    const note = document.createElement('small');
    note.className = 'options-panel__note';
    note.textContent = item.note;
    panel.appendChild(note);
    const host = row.querySelector(`[data-group="${item.key}"]`);
    for (const option of item.options) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.value = option.value;
      btn.textContent = option.label;
      if (option.title) btn.title = option.title;
      btn.addEventListener('click', () => {
        this.patch({ [item.key]: item.numeric ? Number(option.value) : option.value });
      });
      host.appendChild(btn);
    }
  }

  buildToggle(host, item) {
    const row = document.createElement('label');
    row.className = 'options-panel__toggle';
    row.innerHTML = `
      <input type="checkbox" data-toggle="${item.key}">
      <span class="options-panel__toggle-text">
        <span>${item.label}</span>
        <small>${item.note}</small>
      </span>
    `;
    const input = row.querySelector('input');
    input.addEventListener('change', () => this.patch({ [item.key]: input.checked }));
    host.appendChild(row);
  }

  buildVolume(host, item) {
    const row = document.createElement('label');
    row.className = 'options-panel__volume';
    row.innerHTML = `
      <span class="options-panel__volume-head">
        <span class="options-panel__label">${item.label}</span>
        <span class="options-panel__volume-value" data-value="${item.key}"></span>
      </span>
      <input type="range" min="0" max="100" step="5" data-volume="${item.key}">
      <small class="options-panel__sound-note">${item.note}</small>
    `;
    const input = row.querySelector('input');
    input.addEventListener('input', () => this.patch({ [item.key]: Number(input.value) }));
    host.appendChild(row);
  }

  buildReset(panel, tabKey) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'options-panel__reset';
    btn.textContent = 'Obnovit výchozí';
    btn.title = 'Vrátí výchozí hodnoty jen v této záložce';
    btn.addEventListener('click', () => this.resetTab(tabKey));
    panel.appendChild(btn);
  }

  showTab(key) {
    this.tab = key;
    if (!this.root) return;
    for (const btn of this.root.querySelectorAll('[data-tab]')) {
      btn.classList.toggle('is-active', btn.dataset.tab === key);
    }
    for (const panel of this.root.querySelectorAll('[data-panel]')) {
      panel.classList.toggle('is-active', panel.dataset.panel === key);
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

  patch(changes) {
    this.values = { ...this.values, ...changes };
    this.render();
    if (this.onChange) this.onChange({ ...this.values });
  }

  resetTab(tabKey) {
    const changes = {};
    for (const item of ITEMS) {
      if (item.tab !== tabKey) continue;
      changes[item.key] = OPTION_DEFAULTS[item.key];
    }
    this.patch(changes);
  }

  render() {
    if (!this.root) return;
    for (const item of ITEMS) {
      if (item.kind === 'choice') {
        for (const btn of this.root.querySelectorAll(`[data-group="${item.key}"] button`)) {
          btn.classList.toggle('is-active', String(this.values[item.key]) === btn.dataset.value);
        }
        continue;
      }
      if (item.kind === 'toggle') {
        for (const input of this.root.querySelectorAll(`[data-toggle="${item.key}"]`)) {
          input.checked = Boolean(this.values[item.key]);
        }
        continue;
      }
      for (const input of this.root.querySelectorAll(`[data-volume="${item.key}"]`)) {
        const value = clampPercent(this.values[item.key]);
        input.value = String(value);
        input.style.setProperty('--fill', `${value}%`);
        const label = this.root.querySelector(`[data-value="${item.key}"]`);
        if (label) label.textContent = `${value} %`;
      }
    }
    for (const btn of this.root.querySelectorAll('[data-preset]')) {
      const preset = PRESET_OPTIONS[btn.dataset.preset];
      const matches = preset && Object.entries(preset).every(([key, value]) => this.values[key] === value);
      btn.classList.toggle('is-active', Boolean(matches));
    }
  }
}

