// Kompas — vodorovný pruh nahoře uprostřed se světovými stranami, posouvá se podle toho, kam míří kamera.
// Scéna mu jen posílá směr pohledu (0 = sever, kladně po směru hodin).
const PX_PER_DEGREE = 2;
const TICK_STEP = 15;
const POINTS = [
  [0, 'S'], [45, 'SV'], [90, 'V'], [135, 'JV'],
  [180, 'J'], [225, 'JZ'], [270, 'Z'], [315, 'SZ'],
];

export default class CompassBar {

  constructor() {
    this.root = null;
    this.track = null;
    this.shown = -1;
    this.visible = true;
  }

  mount() {
    if (this.root) return this.root;
    const root = document.createElement('div');
    root.className = 'hud-compass';
    root.id = 'hud-compass';
    const track = document.createElement('div');
    track.className = 'hud-compass__track';
    for (let deg = -360; deg < 720; deg += TICK_STEP) {
      const turn = ((deg % 360) + 360) % 360;
      const point = POINTS.find(([at]) => at === turn);
      const mark = document.createElement('span');
      mark.style.left = `${(deg + 360) * PX_PER_DEGREE}px`;
      if (point) {
        mark.className = `hud-compass__point${point[1].length === 1 ? ' is-main' : ''}${turn === 0 ? ' is-north' : ''}`;
        mark.textContent = point[1];
      } else {
        mark.className = 'hud-compass__tick';
      }
      track.appendChild(mark);
    }
    root.appendChild(track);
    const needle = document.createElement('div');
    needle.className = 'hud-compass__needle';
    root.appendChild(needle);
    (document.getElementById('hud-layer') || document.body).appendChild(root);
    this.root = root;
    this.track = track;
    return root;
  }

  setHeading(radians) {
    if (!this.track) return;
    const degrees = ((radians * 180 / Math.PI) % 360 + 360) % 360;
    const rounded = Math.round(degrees * 2) / 2;
    if (rounded === this.shown) return;
    this.shown = rounded;
    this.track.style.transform = `translateX(${-(rounded + 360) * PX_PER_DEGREE}px)`;
  }

  setVisible(visible) {
    const on = Boolean(visible);
    if (!this.root || on === this.visible) return;
    this.visible = on;
    this.root.classList.toggle('is-hidden', !on);
  }
}
