// Okno s recepty — seznam receptů s cenou v surovinách a tlačítkem na výrobu; u právě vyráběného receptu běží ukazatel postupu.
// Stejné okno slouží pro Výrobu (klávesa V) i pro Vaření u ohně; liší se jen nadpisem a slovem na tlačítku.
// Co se vyrobí, řeší scéna přes onCraft.
import WindowFrame from './windowFrame.js';
import { itemIconElement } from './itemIcons.js';

export default class CraftingWindow {

  constructor({ id = 'hud-crafting', title = 'Výroba', closeTitle = 'Zavřít (V)', verb = 'Vyrobit', busyVerb = 'Vyrábím…' } = {}) {
    this.frame = new WindowFrame({
      id,
      className: 'craft-window',
      title,
      closeTitle,
    });
    this.verb = verb;
    this.busyVerb = busyVerb;
    this.recipes = [];
    this.bars = new Map();
    this.onClose = null;
    this.onCraft = null;
    this.frame.onClose = () => {
      if (this.onClose) this.onClose();
    };
  }

  get open() {
    return this.frame.open;
  }

  mount() {
    return this.frame.mount();
  }

  show() {
    this.mount();
    this.render();
    this.frame.show();
  }

  close() {
    this.frame.close();
  }

  setRecipes(recipes) {
    this.recipes = recipes || [];
    if (this.frame.body) this.render();
  }

  setProgress(key, progress) {
    const fill = this.bars.get(key);
    if (fill) fill.style.width = `${Math.round(progress * 100)}%`;
  }

  render() {
    const body = this.frame.body;
    this.bars.clear();
    if (!this.recipes.length) {
      const empty = document.createElement('div');
      empty.className = 'craft-empty';
      empty.textContent = 'Zatím neznáš žádný recept. Objeví se, až najdeš suroviny.';
      body.replaceChildren(empty);
      return;
    }
    body.replaceChildren(...this.recipes.map((recipe) => this.recipeRow(recipe)));
  }

  recipeRow(recipe) {
    const row = document.createElement('div');
    row.className = 'craft-recipe';
    const head = document.createElement('div');
    head.className = 'craft-recipe__head';
    head.appendChild(itemIconElement(recipe.key, 'craft-recipe__icon'));
    const name = document.createElement('span');
    name.className = 'craft-recipe__name';
    name.textContent = recipe.name;
    head.appendChild(name);
    row.appendChild(head);
    const cost = document.createElement('div');
    cost.className = 'craft-recipe__cost';
    for (const part of recipe.cost) {
      const item = document.createElement('span');
      item.className = `craft-cost${part.have >= part.need ? '' : ' is-missing'}`;
      item.title = part.name;
      item.appendChild(itemIconElement(part.key, 'craft-cost__icon'));
      const count = document.createElement('span');
      count.textContent = `${part.have}/${part.need}`;
      item.appendChild(count);
      cost.appendChild(item);
    }
    row.appendChild(cost);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'craft-recipe__make';
    button.textContent = recipe.busy ? this.busyVerb : this.verb;
    button.disabled = !recipe.ready;
    button.addEventListener('click', () => {
      if (recipe.ready && this.onCraft) this.onCraft(recipe.key);
    });
    row.appendChild(button);
    if (recipe.busy) {
      row.classList.add('is-busy');
      const bar = document.createElement('div');
      bar.className = 'craft-recipe__bar';
      const fill = document.createElement('div');
      fill.className = 'craft-recipe__fill';
      fill.style.width = `${Math.round(recipe.progress * 100)}%`;
      bar.appendChild(fill);
      row.appendChild(bar);
      this.bars.set(recipe.key, fill);
    }
    return row;
  }
}
