// Plovoucí čísla nad postavami — dostane obrazové souřadnice, text a případně menší poznámku (pohlcené poškození),
// číslo nechá vyplout a zmizet.
// O scéně neví nic; kam číslo patří, počítá hra a posílá hotovou pozici.
const LIFETIME = 900;
const RISE = 46;
const DRIFT = 14;

export default class FloatingNumbers {

  constructor() {
    this.layer = null;
  }

  mount() {
    if (this.layer) return this.layer;
    this.layer = document.getElementById('hud-layer') || document.body;
    return this.layer;
  }

  spawn(point, text, kind, note = null) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
    const layer = this.mount();
    const el = document.createElement('div');
    el.className = kind ? `hud-float hud-float--${kind}` : 'hud-float';
    el.textContent = String(text);
    if (note) {
      const small = document.createElement('span');
      small.className = 'hud-float__note';
      small.textContent = String(note);
      el.appendChild(small);
    }
    el.style.left = `${point.x}px`;
    el.style.top = `${point.y}px`;
    layer.appendChild(el);
    const drift = (Math.random() * 2 - 1) * DRIFT;
    if (typeof el.animate === 'function') {
      const animation = el.animate([
        { transform: 'translate(-50%, -50%) scale(0.8)', opacity: 0 },
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 1, offset: 0.18 },
        { transform: `translate(calc(-50% + ${drift}px), calc(-50% - ${RISE}px)) scale(1)`, opacity: 0 },
      ], { duration: LIFETIME, easing: 'ease-out' });
      animation.onfinish = () => this.remove(el);
      return el;
    }
    setTimeout(() => this.remove(el), LIFETIME);
    return el;
  }

  remove(el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  clear() {
    if (!this.layer) return;
    for (const el of Array.from(this.layer.querySelectorAll('.hud-float'))) this.remove(el);
  }
}
