// Popisky nové výšky na označených buňkách — DOM vrstva promítnutá do světa.
// Drží jen texty a jejich polohu na obrazovce, o výšky se stará editor.
export default class HeightLabels {

  constructor() {
    this.root = null;
    this.labels = [];
    this.items = [];
  }

  mount() {
    if (this.root) return this.root;
    const root = document.createElement('div');
    root.className = 'editor-height-labels';
    document.body.appendChild(root);
    this.root = root;
    return root;
  }

  show(items) {
    this.mount();
    this.items = Array.isArray(items) ? items : [];
    while (this.labels.length < this.items.length) {
      const label = document.createElement('div');
      label.className = 'editor-height-label';
      label.style.display = 'none';
      this.root.appendChild(label);
      this.labels.push(label);
    }
  }

  clear() {
    this.items = [];
    for (const label of this.labels) label.style.display = 'none';
  }

  update(project) {
    if (!this.items.length || typeof project !== 'function') {
      this.clear();
      return;
    }
    for (let index = 0; index < this.labels.length; index += 1) {
      const label = this.labels[index];
      const item = this.items[index];
      if (!item) {
        label.style.display = 'none';
        continue;
      }
      const point = project(item.x, item.y, item.z);
      if (!point) {
        label.style.display = 'none';
        continue;
      }
      const transform = `translate(-50%, -50%) translate(${Math.round(point.x)}px, ${Math.round(point.y)}px)`;
      if (label.style.transform !== transform) label.style.transform = transform;
      if (label.textContent !== item.text) label.textContent = item.text;
      const className = `editor-height-label is-${item.dir}`;
      if (label.className !== className) label.className = className;
      if (label.style.display !== 'block') label.style.display = 'block';
    }
  }
}