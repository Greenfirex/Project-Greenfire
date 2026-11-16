// Okno postavy a batohu — výbava a staty vlevo, batoh uprostřed, detail předmětu vpravo.
// Jen zobrazuje a hlásí callbacky; co hráč nese a má na sobě, drží systémy scény.
import WindowFrame from './windowFrame.js';
import { EQUIP_SLOTS, ITEM_TYPES, ITEM_TAG_LABELS, itemTags, itemWeapon, itemWeight, toolForItem } from '../data/catalogs/items.js';
import { DAMAGE_GROUPS, DAMAGE_TYPES, DAMAGE_TYPE_KEYS } from '../data/catalogs/damage.js';
import { PLAYER_STAT_INFO } from '../data/catalogs/statInfo.js';
import { damageText } from '../utils/combatRoll.js';
import { weaponBlows } from '../utils/weaponBlows.js';
import { fillIcon, fillItemIcon, itemIconElement } from './itemIcons.js';
import { wearDragType, SLOT_DRAG_TYPE, BAG_DRAG_TYPE, HAND_DRAG_TYPE, BAR_DRAG_TYPE } from './dragTypes.js';

const COMPARED_STATS = ['attack', 'defense', 'armor', 'damage'];

function statScore(value) {
  if (Array.isArray(value)) return (Number(value[0]) + Number(value[1])) / 2;
  return Number(value) || 0;
}

function statText(value) {
  if (Array.isArray(value)) return damageText(value);
  return value === undefined || value === null || value === '' ? '—' : String(value);
}

function kilos(value) {
  return (Number(value) || 0).toLocaleString('cs-CZ', { maximumFractionDigits: 2 });
}

function decimal(value) {
  return (Number(value) || 0).toLocaleString('cs-CZ', { maximumFractionDigits: 1 });
}

export default class CharacterPanel {

  constructor() {
    this.frame = new WindowFrame({
      id: 'hud-character-panel',
      className: 'character-panel',
      title: 'Postava a batoh',
      closeTitle: 'Zavřít (I / C)',
    });
    this.itemsEl = null;
    this.detailEl = null;
    this.summaryEl = null;
    this.healthFill = null;
    this.healthValue = null;
    this.staminaFill = null;
    this.staminaValue = null;
    this.valueEls = new Map();
    this.slotEls = new Map();
    this.portraitCanvas = null;
    this.equipped = {};
    this.hoverKey = null;
    this.hoverAmount = 0;
    this.hoverStat = null;
    this.hoverWorn = false;
    this.preview = null;
    this.characterData = null;
    this.lastInventorySignature = '';
    this.lastCharacterSignature = '';
    this.onClose = null;
    this.onEquip = null;
    this.onUse = null;
    this.onUnequip = null;
    this.onMove = null;
    this.onClearBar = null;
    this.onPreview = null;
    this.onGrab = null;
    this.frame.onClose = () => {
      if (this.onClose) this.onClose();
    };
  }

  get open() {
    return this.frame.open;
  }

  mount() {
    const root = this.frame.mount();
    if (this.itemsEl) return root;
    const layout = document.createElement('div');
    layout.className = 'character-panel__layout';
    layout.innerHTML = `
      <section class="character-panel__sheet">
        <span class="character-panel__heading">Výbava</span>
        <div class="equip-doll"></div>
        <div class="character-panel__section">
          <span class="character-panel__heading">Stav</span>
          <div class="stat-bar stat-bar--health" data-stat="health">
            <span class="stat-bar__label">Zdraví</span>
            <span class="stat-bar__track"><span class="stat-bar__fill"></span></span>
            <span class="stat-bar__value">—</span>
          </div>
          <div class="stat-bar stat-bar--stamina" data-stat="stamina">
            <span class="stat-bar__label">Výdrž</span>
            <span class="stat-bar__track"><span class="stat-bar__fill"></span></span>
            <span class="stat-bar__value">—</span>
          </div>
        </div>
        <div class="character-panel__section">
          <span class="character-panel__heading">Boj</span>
          <div class="character-panel__combat">
            <span class="character-panel__chip" data-stat="defense"><span>Obrana</span><strong>—</strong></span>
            <span class="character-panel__chip" data-stat="attack"><span>Útok</span><strong>—</strong></span>
            <span class="character-panel__chip" data-stat="armor"><span>Zbroj</span><strong>—</strong></span>
            <span class="character-panel__chip" data-stat="damage"><span>Rána</span><strong>—</strong></span>
          </div>
        </div>
        <div class="character-panel__section">
          <span class="character-panel__heading">Resisty</span>
          <div class="resist-grid"></div>
        </div>
      </section>
      <section class="character-panel__bag">
        <div class="character-panel__bag-head">
          <span class="character-panel__heading">Batoh</span>
          <span class="character-panel__summary">—</span>
        </div>
        <div class="inv-grid"></div>
      </section>
      <aside class="inv-detail character-panel__detail"></aside>
    `;
    this.frame.body.appendChild(layout);
    this.mountParts(layout);
    this.clearDetail();
    return root;
  }

  mountParts(layout) {
    const doll = layout.querySelector('.equip-doll');
    doll.append(
      this.slotColumn(EQUIP_SLOTS.slice(0, 3)),
      this.portrait(),
      this.slotColumn(EQUIP_SLOTS.slice(3)),
    );

    this.healthFill = layout.querySelector('.stat-bar--health .stat-bar__fill');
    this.healthValue = layout.querySelector('.stat-bar--health .stat-bar__value');
    this.staminaFill = layout.querySelector('.stat-bar--stamina .stat-bar__fill');
    this.staminaValue = layout.querySelector('.stat-bar--stamina .stat-bar__value');

    for (const node of layout.querySelectorAll('[data-stat]')) {
      const target = node.querySelector('strong');
      if (target) this.valueEls.set(node.dataset.stat, target);
    }

    const resistGrid = layout.querySelector('.resist-grid');
    for (const group of DAMAGE_GROUPS) {
      const column = document.createElement('div');
      column.className = 'resist-col';
      const heading = document.createElement('span');
      heading.className = 'resist-col__head';
      heading.textContent = group.label;
      column.appendChild(heading);
      for (const typeKey of group.types) {
        const line = document.createElement('div');
        line.className = 'character-panel__row';
        const label = document.createElement('span');
        label.textContent = DAMAGE_TYPES[typeKey].short;
        const value = document.createElement('strong');
        value.textContent = '0 %';
        line.dataset.stat = typeKey;
        line.append(label, value);
        column.appendChild(line);
        this.valueEls.set(typeKey, value);
      }
      resistGrid.appendChild(column);
    }

    for (const node of layout.querySelectorAll('[data-stat]')) {
      node.addEventListener('pointerenter', () => this.showStatDetail(node.dataset.stat));
      node.addEventListener('pointerleave', () => this.clearStatDetail());
    }

    this.summaryEl = layout.querySelector('.character-panel__summary');
    this.itemsEl = layout.querySelector('.inv-grid');
    this.detailEl = layout.querySelector('.character-panel__detail');
    this.itemsEl.addEventListener('pointerleave', () => this.clearDetail());
    this.watchGridDrop(this.itemsEl);
  }

  slotColumn(slots) {
    const column = document.createElement('div');
    column.className = 'equip-col';
    for (const slot of slots) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'equip-slot is-empty';
      btn.title = slot.label;
      btn.dataset.slot = slot.key;
      const icon = document.createElement('span');
      icon.className = 'equip-slot__icon';
      icon.textContent = slot.icon;
      const name = document.createElement('span');
      name.className = 'equip-slot__name';
      name.textContent = slot.label;
      btn.append(icon, name);
      this.watchSlot(btn, slot);
      btn.addEventListener('pointerenter', () => {
        const itemKey = this.equipped[slot.key];
        if (itemKey) this.showDetail(itemKey, 1, true);
        else if (slot.key === 'weapon') this.showUnarmedDetail();
      });
      btn.addEventListener('pointerleave', () => {
        if (this.hoverWorn) this.clearDetail();
      });
      const takeOff = (evt) => {
        evt.preventDefault();
        if (this.equipped[slot.key] && this.onUnequip) this.onUnequip(slot.key);
      };
      btn.addEventListener('contextmenu', takeOff);
      btn.addEventListener('dblclick', takeOff);
      this.slotEls.set(slot.key, { btn, icon, name, slot });
      column.appendChild(btn);
    }
    this.paintSlots();
    return column;
  }

  portrait() {
    const box = document.createElement('div');
    box.className = 'equip-preview';
    this.portraitCanvas = document.createElement('canvas');
    this.portraitCanvas.className = 'equip-preview__canvas';
    box.appendChild(this.portraitCanvas);
    return box;
  }

  watchSlot(btn, slot) {
    const wanted = wearDragType(slot.key);
    btn.addEventListener('dragover', (evt) => {
      if (!evt.dataTransfer.types.includes(wanted)) return;
      evt.preventDefault();
      btn.classList.add('is-drop');
    });
    btn.addEventListener('dragleave', () => btn.classList.remove('is-drop'));
    btn.addEventListener('drop', (evt) => {
      btn.classList.remove('is-drop');
      const itemKey = evt.dataTransfer.getData(wanted);
      if (!itemKey) return;
      evt.preventDefault();
      if (this.onEquip) this.onEquip(itemKey, slot.key);
    });
    btn.addEventListener('dragstart', (evt) => {
      if (!this.equipped[slot.key]) {
        evt.preventDefault();
        return;
      }
      if (this.onGrab) this.onGrab();
      evt.dataTransfer.setData(SLOT_DRAG_TYPE, slot.key);
      evt.dataTransfer.effectAllowed = 'move';
    });
  }

  setEquipment(slots) {
    this.equipped = { ...(slots || {}) };
    this.paintSlots();
  }

  paintSlots() {
    for (const { btn, icon, name, slot } of this.slotEls.values()) {
      const itemKey = this.equipped[slot.key];
      const def = itemKey ? ITEM_TYPES[itemKey] : null;
      btn.classList.toggle('is-empty', !itemKey);
      btn.draggable = Boolean(itemKey);
      if (itemKey) {
        fillItemIcon(icon, itemKey);
      } else {
        fillIcon(icon, slot.image, slot.icon);
      }
      name.textContent = def ? def.displayName : slot.label;
      btn.title = def ? `${slot.label}: ${def.displayName} — pravý klik, dvojklik nebo přetažení do batohu sundá` : slot.label;
    }
  }

  watchGridDrop(target) {
    target.addEventListener('dragover', (evt) => {
      const types = evt.dataTransfer.types;
      if (!types.includes(SLOT_DRAG_TYPE) && !types.includes(BAR_DRAG_TYPE)) return;
      evt.preventDefault();
      target.classList.add('is-drop');
    });
    target.addEventListener('dragleave', () => target.classList.remove('is-drop'));
    target.addEventListener('drop', (evt) => {
      target.classList.remove('is-drop');
      const slot = evt.dataTransfer.getData(SLOT_DRAG_TYPE);
      const bar = evt.dataTransfer.getData(BAR_DRAG_TYPE);
      if (!slot && bar === '') return;
      evt.preventDefault();
      if (slot && this.onUnequip) this.onUnequip(slot);
      if (bar !== '' && this.onClearBar) this.onClearBar(Number(bar));
    });
  }

  watchMoveDrop(cell, index) {
    cell.addEventListener('dragover', (evt) => {
      if (!evt.dataTransfer.types.includes(BAG_DRAG_TYPE)) return;
      evt.preventDefault();
      cell.classList.add('is-drop');
    });
    cell.addEventListener('dragleave', () => cell.classList.remove('is-drop'));
    cell.addEventListener('drop', (evt) => {
      cell.classList.remove('is-drop');
      const from = evt.dataTransfer.getData(BAG_DRAG_TYPE);
      if (from === '') return;
      evt.preventDefault();
      if (this.onMove) this.onMove(Number(from), index);
    });
  }

  show() {
    this.mount();
    this.frame.show();
  }

  close() {
    this.frame.close();
  }

  showDetail(key, amount, worn = false) {
    this.hoverKey = key;
    this.hoverAmount = amount;
    this.hoverWorn = worn;
    const def = ITEM_TYPES[key];
    this.markSlot(!worn && def ? def.slot : null);
    this.setPreview(!worn && this.onPreview ? this.onPreview(key) : null);
    if (!this.hoverStat) this.renderItemDetail(key, amount, worn);
  }

  markSlot(slotKey) {
    for (const { btn, slot } of this.slotEls.values()) btn.classList.toggle('is-target', slot.key === slotKey);
  }

  renderItemDetail(key, amount, worn = false) {
    if (!this.detailEl) return;
    const def = ITEM_TYPES[key] || null;
    this.detailEl.innerHTML = '';
    const icon = itemIconElement(key, 'inv-detail__icon');
    const name = document.createElement('div');
    name.className = 'inv-detail__name';
    name.textContent = def ? def.displayName : key;
    const badges = document.createElement('div');
    badges.className = 'inv-detail__badges';
    const tags = itemTags(key);
    if (tags.length) {
      for (const tag of tags) badges.appendChild(this.badge(tag.label));
    } else {
      badges.appendChild(this.badge('Předmět'));
    }
    const slot = def && def.slot ? EQUIP_SLOTS.find((entry) => entry.key === def.slot) : null;
    if (slot) badges.appendChild(this.badge(slot.label));
    this.detailEl.append(icon, name, badges);
    if (def && def.description) {
      const description = document.createElement('div');
      description.className = 'inv-detail__description';
      description.textContent = def.description;
      this.detailEl.appendChild(description);
    }
    const weapon = itemWeapon(key);
    if (weapon) {
      this.detailHeading(ITEM_TAG_LABELS.weapon);
      const type = weapon.damageType ? DAMAGE_TYPES[weapon.damageType] : null;
      if (type) this.detailRow('Typ poškození', type.short);
      this.detailRow('Útok', `+${Number(weapon.attack) || 0}`);
      this.blowSections(weapon);
    }
    const bonus = Object.entries((def && def.bonus) || {}).filter(([, value]) => Number.isFinite(value) && value !== 0);
    if (bonus.length) {
      this.detailHeading(ITEM_TAG_LABELS[def.kind] || 'Výbava');
      for (const [stat, value] of bonus) {
        const info = PLAYER_STAT_INFO[stat];
        this.detailRow(info ? info.label : stat, `${value > 0 ? '+' : ''}${value}`);
      }
    }
    const weight = itemWeight(key);
    if (worn) {
      this.detailHeading('Nasazeno');
      this.detailRow('Váha', `${kilos(weight)} kg`);
    } else {
      this.detailHeading('V batohu');
      this.detailRow('Neseš', `${amount} ks`);
      if (def && Number.isFinite(def.stackSize) && def.stackSize > 0) {
        this.detailRow('Stoh', `${def.stackSize} ks`);
        this.stackBar(amount, def.stackSize);
      }
      this.detailRow('Váha', amount > 1 ? `${kilos(weight)} kg / ks · ${kilos(weight * amount)} kg` : `${kilos(weight)} kg`);
    }
    const hint = document.createElement('div');
    hint.className = 'inv-detail__actions';
    hint.textContent = worn ? 'Pravý klik, dvojklik nebo přetažení do batohu sundá.' : this.usageHint(key, def);
    this.detailEl.appendChild(hint);
  }

  showUnarmedDetail() {
    this.hoverKey = null;
    this.hoverAmount = 0;
    this.hoverWorn = true;
    this.markSlot(null);
    this.setPreview(null);
    if (this.hoverStat || !this.detailEl) return;
    this.detailEl.innerHTML = '';
    const icon = document.createElement('div');
    icon.className = 'inv-detail__icon';
    icon.textContent = '✊';
    const name = document.createElement('div');
    name.className = 'inv-detail__name';
    name.textContent = 'Bez zbraně';
    const description = document.createElement('div');
    description.className = 'inv-detail__description';
    description.textContent = 'Bez nasazené zbraně se bojuje pěstmi a kopy.';
    this.detailEl.append(icon, name, description);
    this.blowSections(null);
    const hint = document.createElement('div');
    hint.className = 'inv-detail__actions';
    hint.textContent = 'Přetáhni sem zbraň z batohu pro nasazení.';
    this.detailEl.appendChild(hint);
  }

  blowSections(weapon) {
    const { primary, secondary } = weaponBlows(weapon);
    this.detailHeading('Primární rána · levé tlačítko');
    this.blowRows(primary);
    this.detailHeading('Sekundární rána · pravé tlačítko');
    this.blowRows(secondary);
  }

  blowRows(blow) {
    this.detailRow('Poškození', damageText(blow.damage));
    this.detailRow('Dosah', `${decimal(blow.reach)} m`);
    this.detailRow('Úhel', `${Math.round(blow.arc)}°`);
    this.detailRow('Prodleva', `${decimal(blow.cooldown)} s`);
    this.detailRow('Výdrž', String(Math.round(blow.cost)));
  }

  showStatDetail(key) {
    this.hoverStat = key;
    this.renderStatDetail(key);
  }

  clearStatDetail() {
    this.hoverStat = null;
    if (this.hoverKey) this.renderItemDetail(this.hoverKey, this.hoverAmount, this.hoverWorn);
    else this.renderHint();
  }

  renderStatDetail(key) {
    if (!this.detailEl) return;
    const info = PLAYER_STAT_INFO[key] || DAMAGE_TYPES[key];
    if (!info) return;
    this.detailEl.innerHTML = '';
    const icon = document.createElement('div');
    icon.className = 'inv-detail__icon';
    icon.textContent = info.icon || '◆';
    const name = document.createElement('div');
    name.className = 'inv-detail__name';
    name.textContent = info.label;
    const value = document.createElement('div');
    value.className = 'inv-detail__stat-value';
    value.textContent = this.statValueText(key);
    const description = document.createElement('div');
    description.className = 'inv-detail__description';
    description.textContent = info.description || info.text || '';
    this.detailEl.append(icon, name, value, description);
  }

  statValueText(key) {
    const data = this.characterData || {};
    if (key === 'health' || key === 'stamina') {
      const maxKey = key === 'health' ? 'maxHealth' : 'maxStamina';
      const current = Number.isFinite(data[key]) ? Math.ceil(data[key]) : 0;
      const max = Number.isFinite(data[maxKey]) ? Math.round(data[maxKey]) : 0;
      return `${current} / ${max}`;
    }
    if (key === 'damage') return statText(data.damage);
    if (Object.hasOwn(PLAYER_STAT_INFO, key)) {
      const value = data[key];
      return value === undefined || value === null ? '—' : String(value);
    }
    const resist = Number(data.resistances && data.resistances[key]);
    return `${Math.round(Number.isFinite(resist) ? resist : 0)} %`;
  }

  badge(text) {
    const span = document.createElement('span');
    span.className = 'inv-detail__badge';
    span.textContent = text;
    return span;
  }

  usageHint(key, def) {
    if (def && def.slot) return 'Pravý klik nebo dvojklik nasadí, jde i přetáhnout na postavu.';
    if (toolForItem(key)) return 'Pravý klik nebo dvojklik dá na lištu dole (nebo z ní sundá), jde i přetáhnout.';
    return 'Přetáhni na jiné políčko pro přesun.';
  }

  stackBar(amount, stackSize) {
    const bar = document.createElement('div');
    bar.className = 'inv-detail__stack';
    const track = document.createElement('span');
    track.className = 'inv-detail__stack-track';
    const fill = document.createElement('span');
    fill.className = 'inv-detail__stack-fill';
    fill.style.width = `${Math.max(0, Math.min(100, (amount / stackSize) * 100))}%`;
    track.appendChild(fill);
    bar.appendChild(track);
    this.detailEl.appendChild(bar);
  }

  detailHeading(text) {
    const heading = document.createElement('div');
    heading.className = 'inv-detail__heading';
    heading.textContent = text;
    this.detailEl.appendChild(heading);
  }

  detailRow(label, value) {
    const row = document.createElement('div');
    row.className = 'inv-detail__row';
    const left = document.createElement('span');
    left.textContent = label;
    const right = document.createElement('strong');
    right.textContent = value;
    row.append(left, right);
    this.detailEl.appendChild(row);
  }

  renderHint() {
    if (!this.detailEl) return;
    this.detailEl.innerHTML = '';
    const hint = document.createElement('div');
    hint.className = 'inv-detail__hint';
    hint.textContent = 'Najeď na předmět nebo stat';
    this.detailEl.appendChild(hint);
  }

  clearDetail() {
    this.hoverKey = null;
    this.hoverAmount = 0;
    this.hoverWorn = false;
    this.markSlot(null);
    this.setPreview(null);
    if (!this.hoverStat) this.renderHint();
  }

  emptyCell(index) {
    const cell = document.createElement('div');
    cell.className = 'bag-cell is-empty';
    cell.innerHTML = '<span class="bag-cell__icon"></span>';
    this.watchMoveDrop(cell, index);
    return cell;
  }

  itemCell(key, amount, index) {
    const def = ITEM_TYPES[key] || null;
    const label = def ? def.displayName : key;
    const cell = document.createElement('div');
    cell.className = `bag-cell is-${def ? def.kind : 'item'}`;
    cell.draggable = true;
    const icon = itemIconElement(key, 'bag-cell__icon');
    const count = document.createElement('span');
    count.className = 'bag-cell__count';
    count.textContent = String(amount);
    cell.append(icon, count);
    cell.addEventListener('pointerenter', () => this.showDetail(key, amount));
    const use = (evt) => {
      evt.preventDefault();
      if (this.onUse) this.onUse(key);
    };
    cell.addEventListener('contextmenu', use);
    cell.addEventListener('dblclick', use);
    const slot = def ? def.slot : null;
    const tool = toolForItem(key);
    cell.title = `${label} × ${amount}`;
    if (slot) cell.title = `${label} — pravý klik nebo dvojklik nasadí`;
    else if (tool) cell.title = `${label} — pravý klik nebo dvojklik dá na lištu (nebo z ní sundá)`;
    cell.addEventListener('dragstart', (evt) => {
      if (this.onGrab) this.onGrab();
      evt.dataTransfer.setData(BAG_DRAG_TYPE, String(index));
      if (slot) evt.dataTransfer.setData(wearDragType(slot), key);
      if (tool) evt.dataTransfer.setData(HAND_DRAG_TYPE, tool);
      evt.dataTransfer.effectAllowed = 'move';
    });
    this.watchMoveDrop(cell, index);
    return cell;
  }

  updateInventory(inventory, load) {
    this.mount();
    const layout = inventory ? inventory.layout() : [];
    const signature = layout.map((entry) => (entry ? entry.join(':') : '')).join(',');
    const used = layout.filter(Boolean).length;
    if (this.summaryEl) {
      const weight = load ? load.weight : 0;
      const capacity = load ? load.capacity : 0;
      this.summaryEl.textContent = `${used} / ${layout.length} políček · ${kilos(weight)} / ${kilos(capacity)} kg`;
      this.summaryEl.classList.toggle('is-over', capacity > 0 && weight > capacity);
    }
    if (signature === this.lastInventorySignature) return;
    this.lastInventorySignature = signature;

    this.itemsEl.innerHTML = '';
    layout.forEach((entry, index) => {
      this.itemsEl.appendChild(entry ? this.itemCell(entry[0], entry[1], index) : this.emptyCell(index));
    });
    if (this.hoverKey && !this.hoverWorn) {
      const still = layout.find((entry) => entry && entry[0] === this.hoverKey);
      if (still) this.showDetail(still[0], still[1]);
      else this.clearDetail();
    }
  }

  updateCharacter(data) {
    this.mount();
    const source = data || {};
    this.characterData = source;
    const barValue = (value) => (Number.isFinite(value) ? Math.ceil(value) : value);
    const resistances = source.resistances || {};
    const signature = [
      barValue(source.health), source.maxHealth, barValue(source.stamina), source.maxStamina,
      source.attack, source.defense, source.armor, source.damage,
      ...DAMAGE_TYPE_KEYS.map((key) => resistances[key]),
    ].map((value) => String(value ?? '')).join('|');
    if (signature === this.lastCharacterSignature) return;
    this.lastCharacterSignature = signature;

    this.setBar(this.healthFill, this.healthValue, source.health, source.maxHealth);
    this.setBar(this.staminaFill, this.staminaValue, source.stamina, source.maxStamina);
    this.paintStats();
    for (const key of DAMAGE_TYPE_KEYS) {
      const value = Number(resistances[key]);
      this.setValue(key, `${Math.round(Number.isFinite(value) ? value : 0)} %`);
    }
    if (this.hoverStat) this.renderStatDetail(this.hoverStat);
  }

  setPreview(stats) {
    this.preview = stats || null;
    this.paintStats();
  }

  paintStats() {
    const data = this.characterData || {};
    const preview = this.preview || {};
    for (const key of COMPARED_STATS) {
      const el = this.valueEls.get(key);
      if (!el) continue;
      const now = data[key];
      const next = preview[key];
      const change = next === undefined || now === undefined ? 0 : Math.sign(statScore(next) - statScore(now));
      el.textContent = statText(change ? next : now);
      el.classList.toggle('is-up', change > 0);
      el.classList.toggle('is-down', change < 0);
    }
  }

  setBar(fill, valueEl, value, max) {
    if (!fill || !valueEl) return;
    const top = Number.isFinite(max) && max > 0 ? max : 1;
    const current = Number.isFinite(value) ? Math.max(0, Math.min(top, value)) : 0;
    fill.style.width = `${(current / top) * 100}%`;
    valueEl.textContent = `${Math.ceil(current)} / ${Math.round(top)}`;
  }

  setValue(key, value) {
    const el = this.valueEls.get(key);
    if (!el) return;
    el.textContent = value === undefined || value === null || value === '' ? '—' : String(value);
  }
}
