// Okno deníku — zatím jen prázdný panel, zápisky a úkoly přibudou později.
// Otevírá se tlačítkem Deník v dolní liště nebo klávesou J.
import WindowFrame from './windowFrame.js';

export default class JournalWindow {

  constructor() {
    this.frame = new WindowFrame({
      id: 'hud-journal',
      className: 'journal-window',
      title: 'Deník',
      closeTitle: 'Zavřít (J)',
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
    hint.className = 'journal-placeholder';
    hint.textContent = 'Deník se teprve připravuje.';
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
