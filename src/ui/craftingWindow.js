// Okno výroby — zatím jen prázdný panel, recepty a výroba přibudou později.
// Otevírá se tlačítkem Výroba v dolní liště nebo klávesou V.
import WindowFrame from './windowFrame.js';

export default class CraftingWindow {

  constructor() {
    this.frame = new WindowFrame({
      id: 'hud-crafting',
      className: 'craft-window',
      title: 'Výroba',
      closeTitle: 'Zavřít (V)',
    });
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
    if (this.frame.body.childElementCount) return root;
    const hint = document.createElement('div');
    hint.className = 'craft-placeholder';
    hint.textContent = 'Výroba se teprve připravuje.';
    this.frame.body.appendChild(hint);
    return root;
  }

  show() {
    this.mount();
    this.frame.show();
  }

  close() {
    this.frame.close();
  }
}
