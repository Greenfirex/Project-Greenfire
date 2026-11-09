// Malý ukazatel nahoře uprostřed obrazovky — hráč vidí, že se něco přepočítává a hra se nezasekla.
export default class BusyNotice {

  constructor() {
    this.element = null;
    this.running = 0;
  }

  show(text) {
    if (!this.element) {
      this.element = document.createElement('div');
      this.element.className = 'editor-busy';
      document.body.appendChild(this.element);
    }
    this.running += 1;
    this.element.textContent = text;
    this.element.classList.add('is-on');
  }

  hide() {
    this.running = Math.max(0, this.running - 1);
    if (!this.running && this.element) this.element.classList.remove('is-on');
  }
}
