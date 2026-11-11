// Okno bestiáře — seznam všech tvorů ve hře a to, co o nich hráč díky zabitím ví.
// Dostane hotové záznamy od scény a jen je vykreslí; nepotkaný tvor zůstane skrytý.
import WindowFrame from './windowFrame.js';

export default class BestiaryWindow {

  constructor() {
    this.frame = new WindowFrame({
      id: 'hud-bestiary',
      className: 'bestiary-window',
      title: 'Bestiář',
      closeTitle: 'Zavřít (B)',
    });
    this.listEl = null;
    this.lastSignature = '';
    this.onClose = null;
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
    this.listEl = document.createElement('div');
    this.listEl.className = 'bestiary-list';
    this.frame.body.appendChild(this.listEl);
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
    const list = Array.isArray(entries) ? entries : [];
    const signature = JSON.stringify(list);
    if (signature === this.lastSignature) return;
    this.lastSignature = signature;
    this.listEl.replaceChildren(...list.map((entry) => this.card(entry)));
  }

  card(entry) {
    const card = document.createElement('div');
    card.className = entry.known ? 'bestiary-card' : 'bestiary-card is-unknown';
    const head = document.createElement('div');
    head.className = 'bestiary-card__head';
    const title = document.createElement('strong');
    title.textContent = entry.known ? entry.title : '???';
    const kills = document.createElement('span');
    kills.textContent = entry.known ? `Zabito: ${entry.kills}` : 'Zatím neznámý tvor';
    head.append(title, kills);
    card.appendChild(head);
    if (!entry.known) return card;
    const tiers = document.createElement('div');
    tiers.className = 'bestiary-card__tiers';
    for (const tier of entry.tiers || []) {
      const column = document.createElement('div');
      column.className = 'bestiary-tier';
      const label = document.createElement('span');
      label.className = 'bestiary-tier__label';
      label.textContent = tier.label;
      column.appendChild(label);
      for (const row of tier.rows || []) {
        const line = document.createElement('div');
        line.className = row.locked ? 'hud-row is-locked' : 'hud-row';
        const name = document.createElement('span');
        name.textContent = row.label;
        const value = document.createElement('strong');
        value.textContent = row.value;
        line.append(name, value);
        column.appendChild(line);
      }
      tiers.appendChild(column);
    }
    card.appendChild(tiers);
    return card;
  }
}
