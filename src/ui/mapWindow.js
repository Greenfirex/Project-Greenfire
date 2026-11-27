// Okno mapy — starý pergamen v ozdobném rámečku, na něm jen prozkoumaná část ostrova, značky míst, křížky hráče a šipka.
// Kolečko přibližuje, tažení posouvá, pravé tlačítko dá nebo sebere křížek; scéně jen hlásí kliknutí.
import WindowFrame from './windowFrame.js';
import { ASSET_DIRS } from '../data/catalogs/assetPaths.js';
import { paintMap } from './mapPainter.js';

const SCALE_MIN = 2;
const SCALE_MAX = 28;
const SCALE_START = 8;
const ZOOM_STEP = 1.2;
const HOVER_REACH_PX = 14;
const ART_FILES = {
  paper: 'parchment.jpg',
  frame: 'frame.png',
  cabin: 'cabin.png',
  campfire: 'campfire.png',
  cave: 'cave.png',
  cross: 'cross.png',
};
const PAPER_FALLBACK = '#e6d3ab';
const MAP_INSET = 0.085;
const EDGE_BLUR_PX = 5;
const FADE_INSET = 0.1;
const FADE_BLUR = 0.025;
const WASH_ALPHA = 0.85;
const ICON_MIN = 18;
const ICON_MAX = 40;
const ICON_PER_CELL = 2.2;
const CABIN_OVERSIZE = 1.5;
const CROSS_SIZE = 20;
const ICON_FILTER = 'sepia(0.35) contrast(1.15)';
const ICON_ALPHA = 0.92;

function gridKey(grid, bounds) {
  let sum = 0;
  for (let i = 0; i < grid.kind.length; i++) {
    const lift = Number.isFinite(grid.lift[i]) ? grid.lift[i] : -999;
    const depth = Number.isFinite(grid.depth[i]) ? grid.depth[i] : 999;
    sum = (Math.imul(sum, 31) + grid.kind[i] * 7 + Math.round(lift * 4) * 13 + Math.round(depth * 20) + grid.hard[i] * 101) | 0;
  }
  return `${bounds.minCx},${bounds.maxCx},${bounds.minCz},${bounds.maxCz}|${grid.palette.map(String).join(';')}|${sum}`;
}

export default class MapWindow {

  constructor() {
    this.frame = new WindowFrame({
      id: 'hud-map',
      className: 'map-window',
      title: 'Mapa',
      closeTitle: 'Zavřít (M)',
    });
    this.onClose = null;
    this.onPinClick = null;
    this.frame.onClose = () => {
      if (this.onClose) this.onClose();
    };
    this.canvas = null;
    this.ctx = null;
    this.label = null;
    this.art = {};
    this.bounds = null;
    this.terrain = null;
    this.terrainKey = '';
    this.cols = 0;
    this.rows = 0;
    this.mask = null;
    this.sheet = null;
    this.layer = null;
    this.fade = null;
    this.markers = [];
    this.pins = [];
    this.player = null;
    this.scale = SCALE_START;
    this.centerCx = 0;
    this.centerCz = 0;
    this.drag = null;
    this.drawQueued = false;
  }

  get open() {
    return this.frame.open;
  }

  mount() {
    const root = this.frame.mount();
    if (this.canvas) return root;
    const view = document.createElement('div');
    view.className = 'map-view';
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'map-canvas';
    this.ctx = this.canvas.getContext('2d');
    this.label = document.createElement('div');
    this.label.className = 'map-label';
    view.appendChild(this.canvas);
    view.appendChild(this.label);
    const hint = document.createElement('div');
    hint.className = 'map-hint';
    hint.textContent = 'Kolečko: přiblížit · Tažení: posunout · Pravé tlačítko: dát nebo sebrat křížek';
    this.frame.body.appendChild(view);
    this.frame.body.appendChild(hint);
    this.loadArt();
    this.bindInput();
    new ResizeObserver(() => this.requestDraw()).observe(view);
    return root;
  }

  loadArt() {
    for (const [key, file] of Object.entries(ART_FILES)) {
      const image = new Image();
      image.onload = () => {
        this.art[key] = image;
        this.requestDraw();
      };
      image.src = `${ASSET_DIRS.mapArt}${file}`;
    }
  }

  bindInput() {
    const canvas = this.canvas;
    canvas.addEventListener('wheel', (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      const { x, y } = this.localPoint(evt);
      const before = this.toCell(x, y);
      const factor = evt.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      this.scale = Math.min(SCALE_MAX, Math.max(SCALE_MIN, this.scale * factor));
      const after = this.toCell(x, y);
      this.centerCx += before.cx - after.cx;
      this.centerCz += before.cz - after.cz;
      this.requestDraw();
    }, { passive: false });
    canvas.addEventListener('mousedown', (evt) => {
      evt.preventDefault();
      if (evt.button !== 0) return;
      this.drag = { x: evt.clientX, y: evt.clientY, cx: this.centerCx, cz: this.centerCz };
    });
    window.addEventListener('mousemove', (evt) => {
      if (!this.drag) return;
      const zoom = this.zoomFactor();
      this.centerCx = this.drag.cx - (evt.clientX - this.drag.x) / zoom / this.scale;
      this.centerCz = this.drag.cz + (evt.clientY - this.drag.y) / zoom / this.scale;
      this.requestDraw();
    });
    window.addEventListener('mouseup', () => {
      if (!this.drag) return;
      this.drag = null;
    });
    canvas.addEventListener('mousemove', (evt) => {
      if (!this.drag) this.showHover(this.localPoint(evt));
    });
    canvas.addEventListener('mouseleave', () => this.showHover(null));
    canvas.addEventListener('contextmenu', (evt) => {
      evt.preventDefault();
      const { x, y } = this.localPoint(evt);
      const cell = this.toCell(x, y);
      if (this.onPinClick) this.onPinClick(cell.cx, cell.cz, HOVER_REACH_PX / this.scale);
    });
  }

  zoomFactor() {
    const width = this.canvas.clientWidth;
    return width ? this.canvas.getBoundingClientRect().width / width : 1;
  }

  localPoint(evt) {
    const rect = this.canvas.getBoundingClientRect();
    const zoom = this.zoomFactor();
    return { x: (evt.clientX - rect.left) / zoom, y: (evt.clientY - rect.top) / zoom };
  }

  viewSize() {
    return { w: this.canvas.clientWidth, h: this.canvas.clientHeight };
  }

  toCell(x, y) {
    const { w, h } = this.viewSize();
    return { cx: this.centerCx + (x - w / 2) / this.scale, cz: this.centerCz - (y - h / 2) / this.scale };
  }

  toScreen(cx, cz) {
    const { w, h } = this.viewSize();
    return { x: w / 2 + (cx - this.centerCx) * this.scale, y: h / 2 - (cz - this.centerCz) * this.scale };
  }

  setTerrain(grid, bounds) {
    const key = gridKey(grid, bounds);
    if (key === this.terrainKey && this.terrain) return;
    this.terrainKey = key;
    this.bounds = { ...bounds };
    this.cols = grid.width;
    this.rows = grid.height;
    this.terrain = paintMap(grid);
    this.buildSheet();
  }

  setFog(seen, width, height) {
    if (!width || !height) {
      this.mask = null;
      this.buildSheet();
      return;
    }
    const mask = document.createElement('canvas');
    mask.width = width;
    mask.height = height;
    const ctx = mask.getContext('2d');
    const image = ctx.createImageData(width, height);
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const at = ((height - 1 - row) * width + col) * 4;
        image.data[at + 3] = seen[row * width + col] ? 255 : 0;
      }
    }
    ctx.putImageData(image, 0, 0);
    this.mask = mask;
    this.buildSheet();
  }

  buildSheet() {
    if (!this.terrain) {
      this.sheet = null;
      this.requestDraw();
      return;
    }
    const { width, height } = this.terrain;
    if (!this.sheet || this.sheet.width !== width || this.sheet.height !== height) {
      this.sheet = document.createElement('canvas');
      this.sheet.width = width;
      this.sheet.height = height;
    }
    const ctx = this.sheet.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    if (this.mask) {
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this.terrain, 0, 0, width, height);
      ctx.filter = `blur(${EDGE_BLUR_PX}px)`;
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(this.mask, 0, 0, width, height);
      ctx.restore();
    }
    this.requestDraw();
  }

  setMarkers(markers) {
    this.markers = markers || [];
    this.requestDraw();
  }

  setPins(pins) {
    this.pins = pins || [];
    this.requestDraw();
  }

  setPlayer(cx, cz, facing) {
    this.player = { cx, cz, facing };
    this.requestDraw();
  }

  centerOn(cx, cz) {
    this.centerCx = cx;
    this.centerCz = cz;
    this.requestDraw();
  }

  requestDraw() {
    if (this.drawQueued || !this.open) return;
    this.drawQueued = true;
    requestAnimationFrame(() => {
      this.drawQueued = false;
      this.draw();
    });
  }

  draw() {
    if (!this.canvas || !this.open) return;
    const { w, h } = this.viewSize();
    const dpr = (window.devicePixelRatio || 1) * this.zoomFactor();
    const width = Math.max(1, Math.round(w * dpr));
    const height = Math.max(1, Math.round(h * dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    if (this.art.paper) ctx.drawImage(this.art.paper, 0, 0, w, h);
    else {
      ctx.fillStyle = PAPER_FALLBACK;
      ctx.fillRect(0, 0, w, h);
    }
    if (this.sheet && this.bounds) this.drawWash(w, h, dpr);
    ctx.save();
    ctx.beginPath();
    ctx.rect(w * MAP_INSET, h * MAP_INSET, w * (1 - MAP_INSET * 2), h * (1 - MAP_INSET * 2));
    ctx.clip();
    for (const marker of this.markers) this.drawMarker(marker);
    for (const pin of this.pins) this.drawIcon('cross', pin.cx, pin.cz, CROSS_SIZE);
    if (this.player) this.drawPlayer(this.player);
    ctx.restore();
    if (this.art.frame) ctx.drawImage(this.art.frame, 0, 0, w, h);
  }

  drawWash(w, h, dpr) {
    const width = this.canvas.width;
    const height = this.canvas.height;
    if (!this.layer || this.layer.width !== width || this.layer.height !== height) {
      this.layer = document.createElement('canvas');
      this.layer.width = width;
      this.layer.height = height;
      this.fade = document.createElement('canvas');
      this.fade.width = width;
      this.fade.height = height;
      const fctx = this.fade.getContext('2d');
      fctx.filter = `blur(${Math.round(Math.min(width, height) * FADE_BLUR)}px)`;
      fctx.fillRect(width * FADE_INSET, height * FADE_INSET, width * (1 - FADE_INSET * 2), height * (1 - FADE_INSET * 2));
    }
    const lctx = this.layer.getContext('2d');
    lctx.setTransform(1, 0, 0, 1, 0, 0);
    lctx.globalCompositeOperation = 'source-over';
    lctx.clearRect(0, 0, width, height);
    lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lctx.imageSmoothingEnabled = true;
    const corner = this.toScreen(this.bounds.minCx - 0.5, this.bounds.maxCz + 0.5);
    lctx.drawImage(this.sheet, corner.x, corner.y, this.cols * this.scale, this.rows * this.scale);
    lctx.setTransform(1, 0, 0, 1, 0, 0);
    lctx.globalCompositeOperation = 'destination-in';
    lctx.drawImage(this.fade, 0, 0);
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = WASH_ALPHA;
    ctx.drawImage(this.layer, 0, 0);
    ctx.restore();
  }

  iconSize() {
    return Math.max(ICON_MIN, Math.min(ICON_MAX, this.scale * ICON_PER_CELL));
  }

  drawMarker(marker) {
    if (marker.kind === 'cabin') {
      const size = Math.max(ICON_MIN, Math.max(marker.width, marker.depth) * this.scale * CABIN_OVERSIZE);
      this.drawIcon('cabin', marker.cx, marker.cz, size);
      return;
    }
    this.drawIcon(marker.kind, marker.cx, marker.cz, this.iconSize());
  }

  drawIcon(key, cx, cz, size) {
    const image = this.art[key];
    if (!image) return;
    const { x, y } = this.toScreen(cx, cz);
    const ratio = image.width / image.height;
    const iw = ratio >= 1 ? size : size * ratio;
    const ih = ratio >= 1 ? size / ratio : size;
    const ctx = this.ctx;
    ctx.save();
    if (key !== 'cross') {
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = ICON_ALPHA;
      ctx.filter = ICON_FILTER;
    }
    ctx.drawImage(image, x - iw / 2, y - ih / 2, iw, ih);
    ctx.restore();
  }

  drawPlayer(player) {
    const ctx = this.ctx;
    const { x, y } = this.toScreen(player.cx, player.cz);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(player.facing);
    ctx.fillStyle = '#7a2418';
    ctx.strokeStyle = '#f4e8cc';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(7, 8);
    ctx.lineTo(0, 4);
    ctx.lineTo(-7, 8);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    ctx.restore();
  }

  showHover(point) {
    if (!this.label) return;
    let found = null;
    if (point) {
      let best = HOVER_REACH_PX * HOVER_REACH_PX;
      const items = [...this.markers, ...this.pins.map((pin) => ({ ...pin, label: 'Tvůj křížek' }))];
      for (const item of items) {
        const at = this.toScreen(item.cx, item.cz);
        const inside = item.width && Math.abs(point.x - at.x) <= item.width * this.scale / 2 && Math.abs(point.y - at.y) <= item.depth * this.scale / 2;
        const dist = inside ? best - 1 : (at.x - point.x) ** 2 + (at.y - point.y) ** 2;
        if (dist <= best) {
          best = dist;
          found = { label: item.label, x: at.x, y: at.y - (item.width ? item.depth * this.scale / 2 : HOVER_REACH_PX / 2) };
        }
      }
    }
    this.label.classList.toggle('is-shown', Boolean(found));
    if (!found) return;
    this.label.textContent = found.label;
    this.label.style.left = `${found.x}px`;
    this.label.style.top = `${found.y - 6}px`;
  }

  show() {
    this.mount();
    this.frame.show();
    this.requestDraw();
  }

  close() {
    this.frame.close();
  }
}
