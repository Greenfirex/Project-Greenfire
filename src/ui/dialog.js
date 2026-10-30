// Okno nad hrou — potvrzení ano/ne i prostá hláška s tlačítkem OK.
// Drží jen otevřený stav; co se má stát po potvrzení, dostane callbackem.
export default class Dialog {

  constructor() {
    this.root = null;
    this.titleEl = null;
    this.textEl = null;
    this.okBtn = null;
    this.cancelBtn = null;
    this.onConfirm = null;
    this.open = false;
  }

  mount() {
    if (this.root) return this.root;
    const root = document.createElement('div');
    root.className = 'confirm-screen';
    root.innerHTML = `
      <div class="confirm-card">
        <div class="confirm-card__title"></div>
        <div class="confirm-card__text"></div>
        <div class="confirm-card__actions">
          <button type="button" class="confirm-card__btn confirm-card__btn--cancel"></button>
          <button type="button" class="confirm-card__btn confirm-card__btn--ok"></button>
        </div>
      </div>
    `;
    document.getElementById('hud-layer').appendChild(root);
    this.root = root;
    this.titleEl = root.querySelector('.confirm-card__title');
    this.textEl = root.querySelector('.confirm-card__text');
    this.okBtn = root.querySelector('.confirm-card__btn--ok');
    this.cancelBtn = root.querySelector('.confirm-card__btn--cancel');
    this.okBtn.addEventListener('click', () => this.confirm());
    this.cancelBtn.addEventListener('click', () => this.close());
    root.addEventListener('pointerdown', (evt) => {
      if (evt.target === root) this.close();
    });
    return root;
  }

  ask(options = {}) {
    this.show(options, true);
  }

  tell(options = {}) {
    this.show(options, false);
  }

  show(options, withCancel) {
    this.mount();
    this.titleEl.textContent = options.title || (withCancel ? 'Potvrdit?' : 'Hlášení');
    this.textEl.textContent = options.text || '';
    this.okBtn.textContent = options.confirmLabel || (withCancel ? 'Potvrdit' : 'OK');
    this.cancelBtn.textContent = options.cancelLabel || 'Zrušit';
    this.cancelBtn.hidden = !withCancel;
    this.onConfirm = options.onConfirm || null;
    this.open = true;
    this.root.classList.add('is-open');
    this.okBtn.focus();
  }

  close() {
    this.open = false;
    this.onConfirm = null;
    if (this.okBtn) this.okBtn.blur();
    if (this.root) this.root.classList.remove('is-open');
  }

  confirm() {
    const action = this.onConfirm;
    this.close();
    if (action) action();
  }

  handleKey(evt) {
    if (!this.open) return false;
    if (evt.key === 'Enter') {
      this.confirm();
      return true;
    }
    if (evt.key === 'Escape') {
      this.close();
      return true;
    }
    return false;
  }
}
