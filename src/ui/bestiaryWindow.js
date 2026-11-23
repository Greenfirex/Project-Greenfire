// Okno bestiáře jako kniha — vlevo seznam tvorů, vpravo stránka vybraného tvora s obrázkem,
// popisem, výskytem, kořistí a statistikami. Dostane hotové záznamy od scény a jen je vykreslí.
// Ve vývojové verzi má přepínač, který odemkne vše a obarví každou fázi odemčení.
import WindowFrame from './windowFrame.js';
import { UNLOCK_STAGES } from '../systems/creatures/bestiarySystem.js';

const DEBUG = import.meta.env.DEV;

function killWord(count) {
  if (count === 1) return 'zabití';
  return 'zabitích';
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export default class BestiaryWindow {

  constructor() {
    this.frame = new WindowFrame({
      id: 'hud-bestiary',
      className: 'bestiary-window',
      title: 'Bestiář',
      closeTitle: 'Zavřít (B)',
    });
    this.listEl = null;
    this.pageEl = null;
    this.debugEl = null;
    this.entries = [];
    this.selected = null;
    this.tierIndex = null;
    this.revealAll = false;
    this.lastSignature = '';
    this.onClose = null;
    this.onRevealAll = null;
    this.frame.onClose = () => {
      if (this.onClose) this.onClose();
    };
  }

  get open() {
    return this.frame.open;
  }

  mount() {
    const root = this.frame.mount();
    if (this.listEl) return root;
    const book = element('div', 'bestiary-book');
    this.listEl = element('div', 'bestiary-index');
    this.pageEl = element('div', 'bestiary-page');
    book.append(this.listEl, this.pageEl);
    this.frame.body.appendChild(book);
    if (DEBUG) {
      this.debugEl = element('div', 'bestiary-debug');
      this.frame.body.appendChild(this.debugEl);
    }
    return root;
  }

  show() {
    this.mount();
    this.frame.show();
  }

  close() {
    this.frame.close();
  }

  update(entries) {
    this.mount();
    this.entries = Array.isArray(entries) ? entries : [];
    const signature = JSON.stringify([this.entries, this.selected, this.tierIndex, this.revealAll]);
    if (signature === this.lastSignature) return;
    this.lastSignature = signature;
    this.render();
  }

  select(key) {
    if (this.selected === key) return;
    this.selected = key;
    this.update(this.entries);
  }

  render() {
    const known = this.entries.filter((entry) => entry.known);
    if (!known.some((entry) => entry.key === this.selected)) this.selected = known.length ? known[0].key : null;
    this.root().classList.toggle('is-debug', this.revealAll);
    this.listEl.replaceChildren(...this.entries.map((entry) => this.indexRow(entry)));
    const entry = known.find((item) => item.key === this.selected);
    this.pageEl.replaceChildren(...(entry ? this.page(entry) : [element('p', 'bestiary-page__empty', 'Zatím jsi žádného tvora neulovil.')]));
    if (this.debugEl) this.renderDebug();
  }

  root() {
    return this.frame.root;
  }

  indexRow(entry) {
    const row = element('button', 'bestiary-index__row');
    row.type = 'button';
    if (!entry.known) {
      row.classList.add('is-unknown');
      row.disabled = true;
      row.append(element('span', '', '???'));
      return row;
    }
    row.classList.toggle('is-active', entry.key === this.selected);
    row.append(element('span', '', entry.title), element('span', 'bestiary-index__kills', `×${entry.kills}`));
    row.addEventListener('click', () => this.select(entry.key));
    return row;
  }

  staged(node, stage) {
    node.dataset.stage = String(Math.max(0, UNLOCK_STAGES.indexOf(stage)));
    return node;
  }

  lockedText(stage) {
    return `??? (odemkne se po ${stage} ${killWord(stage)})`;
  }

  page(entry) {
    const head = element('div', 'bestiary-page__head');
    head.append(this.portrait(entry.portrait), this.titleBlock(entry));
    const parts = [head];
    parts.push(this.section('Popis', entry.summary));
    parts.push(this.section('Kde žije', entry.habitat));
    parts.push(this.section('Kořist', entry.loot));
    parts.push(this.section('Poznámky lovce', entry.notes));
    parts.push(this.stats(entry));
    return parts;
  }

  portrait(part) {
    const frame = this.staged(element('div', 'bestiary-portrait'), part.stage);
    if (!part.value) {
      frame.append(element('span', 'bestiary-portrait__empty', '?'));
      return frame;
    }
    const image = element('img');
    image.alt = '';
    image.src = part.value;
    image.addEventListener('error', () => image.replaceWith(element('span', 'bestiary-portrait__empty', '?')));
    frame.appendChild(image);
    return frame;
  }

  titleBlock(entry) {
    const block = element('div', 'bestiary-page__title');
    block.append(element('strong', '', entry.title), element('span', '', `Zabito: ${entry.kills}`));
    const next = UNLOCK_STAGES.find((stage) => stage > entry.kills);
    const level = UNLOCK_STAGES.filter((stage) => stage <= entry.kills).length;
    const stars = element('span', 'bestiary-page__stars', `${'★'.repeat(level)}${'☆'.repeat(UNLOCK_STAGES.length - level)}`);
    stars.title = next ? `Další zápis po ${next} ${killWord(next)}` : 'Víš o něm všechno';
    block.appendChild(stars);
    return block;
  }

  section(label, part) {
    const box = this.staged(element('div', 'bestiary-section'), part.stage);
    box.append(element('span', 'bestiary-section__label', label));
    const text = element('p', part.value ? '' : 'is-locked', part.value || this.lockedText(part.stage));
    box.appendChild(text);
    return box;
  }

  stats(entry) {
    const box = element('div', 'bestiary-stats');
    const tiers = entry.tiers || [];
    if (!tiers.length) return box;
    const index = Number.isInteger(this.tierIndex) && tiers[this.tierIndex] ? this.tierIndex : Math.min(1, tiers.length - 1);
    const tabs = element('div', 'bestiary-stats__tabs');
    tabs.append(element('span', 'bestiary-section__label', 'Statistiky'));
    tiers.forEach((tier, tierIndex) => {
      const tab = element('button', tierIndex === index ? 'bestiary-tab is-active' : 'bestiary-tab', tier.label);
      tab.type = 'button';
      tab.addEventListener('click', () => {
        this.tierIndex = tierIndex;
        this.update(this.entries);
      });
      tabs.appendChild(tab);
    });
    box.appendChild(tabs);
    const tier = tiers[index];
    const grid = element('div', 'bestiary-stats__grid');
    for (const row of tier.rows || []) {
      const line = this.staged(element('div', row.locked ? 'hud-row is-locked' : 'hud-row'), row.stage);
      line.append(element('span', '', row.label), element('strong', '', row.value));
      grid.appendChild(line);
    }
    box.appendChild(grid);
    box.appendChild(this.resistances(tier.resistances));
    return box;
  }

  resistances(part) {
    const box = this.staged(element('div', 'bestiary-resists'), part.stage);
    box.append(element('span', 'bestiary-resists__label', 'Odolnosti'));
    if (!part.value) {
      box.append(element('span', 'is-locked', this.lockedText(part.stage)));
      return box;
    }
    if (!part.value.length) {
      box.append(element('span', '', 'žádné zvláštní'));
      return box;
    }
    for (const resist of part.value) {
      const chip = element('span', resist.value > 0 ? 'bestiary-chip is-strong' : 'bestiary-chip is-weak',
        `${resist.icon} ${resist.label} ${resist.value > 0 ? '+' : '−'}${Math.abs(resist.value)} %`);
      chip.title = resist.value > 0 ? 'Tohle poškození mu ubližuje méně' : 'Tohle poškození mu ubližuje víc';
      box.appendChild(chip);
    }
    return box;
  }

  renderDebug() {
    const toggle = element('label', 'bestiary-debug__toggle');
    const box = element('input');
    box.type = 'checkbox';
    box.checked = this.revealAll;
    box.addEventListener('change', () => {
      this.revealAll = box.checked;
      if (this.onRevealAll) this.onRevealAll(this.revealAll);
    });
    toggle.append(box, element('span', '', 'Ladění: odemknout vše'));
    const parts = [toggle];
    if (this.revealAll) {
      const legend = element('div', 'bestiary-debug__legend');
      for (const stage of UNLOCK_STAGES) {
        legend.appendChild(this.staged(element('span', 'bestiary-debug__stage', `${stage} ${killWord(stage)}`), stage));
      }
      parts.push(legend);
    }
    this.debugEl.replaceChildren(...parts);
  }
}
