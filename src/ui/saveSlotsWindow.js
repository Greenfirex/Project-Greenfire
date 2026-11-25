// Okno s pozicemi pro uložení — seznam pozic s názvem, datem a úrovní, tlačítka Uložit/Načíst, Přejmenovat a Smazat.
// Řádky dostane hotové od scény a kliknutí jí hlásí callbacky; samo nic neukládá.
import WindowFrame from './windowFrame.js';

const TITLES = { save: 'Uložit hru', load: 'Načíst hru' };

export default class SaveSlotsWindow {

  constructor() {
    this.frame = new WindowFrame({
      id: 'save-slots',
      className: 'save-slots-window',
      title: TITLES.load,
    });
    this.mode = 'load';
    this.onPick = null;
    this.onRename = null;
    this.onDelete = null;
  }

  get open() {
    return this.frame.open;
  }

  mount() {
    if (this.frame.root) return this.frame.root;
    const root = this.frame.mount();
    this.frame.body.addEventListener('click', (evt) => {
      const btn = evt.target.closest('button[data-act]');
      if (!btn || btn.disabled) return;
      const slot = btn.dataset.slot;
      if (btn.dataset.act === 'pick' && this.onPick) this.onPick(this.mode, slot);
      if (btn.dataset.act === 'rename' && this.onRename) this.onRename(slot);
      if (btn.dataset.act === 'delete' && this.onDelete) this.onDelete(slot);
    });
    return root;
  }

  show(mode, rows) {
    this.mode = mode;
    this.mount();
    this.frame.setTitle(TITLES[mode] || TITLES.load);
    this.render(rows);
    this.frame.show();
  }

  render(rows) {
    const body = this.frame.body;
    if (!body) return;
    body.textContent = '';
    for (const row of rows) body.appendChild(this.buildRow(row));
  }

  close() {
    this.frame.close();
  }

  buildRow(row) {
    const el = document.createElement('div');
    el.className = `save-slot${row.empty ? ' is-empty' : ''}`;
    const info = document.createElement('div');
    info.className = 'save-slot__info';
    const label = document.createElement('div');
    label.className = 'save-slot__label';
    label.textContent = row.label;
    const name = document.createElement('div');
    name.className = 'save-slot__name';
    name.textContent = row.empty ? 'Prázdná pozice' : row.name;
    const detail = document.createElement('div');
    detail.className = 'save-slot__detail';
    detail.textContent = row.detail || '';
    info.append(label, name, detail);
    const actions = document.createElement('div');
    actions.className = 'save-slot__actions';
    const pickLabel = this.mode === 'save' ? (row.empty ? 'Uložit' : 'Přepsat') : 'Načíst';
    actions.appendChild(this.button(pickLabel, 'pick', row.slot, this.mode === 'load' && row.empty));
    if (row.renamable) actions.appendChild(this.button('Přejmenovat', 'rename', row.slot, row.empty));
    actions.appendChild(this.button('Smazat', 'delete', row.slot, row.empty));
    el.append(info, actions);
    return el;
  }

  button(text, act, slot, disabled) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `save-slot__btn save-slot__btn--${act}`;
    btn.textContent = text;
    btn.dataset.act = act;
    btn.dataset.slot = slot;
    btn.disabled = Boolean(disabled);
    return btn;
  }
}
