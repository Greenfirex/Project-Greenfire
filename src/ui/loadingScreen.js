// Obrazovka načítání — jeden souvislý pruh od 0 do 100 %, který se jen plní dopředu.
// Nahoře je splash obrázek, pod ním pruh s vtipnými popisky aktuální fáze.
const MIN_VISIBLE_MS = 600;
const MIN_AFTER_FIRST_MS = 300;
const FADE_MS = 400;
const ASSET_LANES = 4;
const SPLASH_URL = 'assets/ui/loading-screen-bg.jpg';

const ASSET_END = 25;
const MAP_END = 28;
const WORLD_START = MAP_END;
const WORLD_END = 95;
const FLOAT_START = WORLD_END;
const FLOAT_END = 100;

function releaseFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function shortName(url) {
  const parts = url.split('/');
  return parts[parts.length - 1] || url;
}

export default class LoadingScreen {

  constructor() {
    this.root = null;
    this.barEl = null;
    this.labelEl = null;
    this.detailEl = null;
    this.attachHandles = new Set();
    this.assetStep = null;
    this.stageStep = null;
    this.floatStep = null;
    this.stageClosed = 0;
    this.stageCount = 0;
    this.missing = 0;
    this.overall = 0;
    this.mapStep = null;
    this.startedAt = 0;
    this.lastProgressAt = 0;
    this.hideTimer = 0;
    this.onHiddenCallback = null;
  }

  mount() {
    if (this.root) return;
    const root = document.createElement('div');
    root.className = 'loading-screen';
    root.innerHTML = `
      <div class="loading-splash"></div>
      <div class="loading-box">
        <div class="loading-bar"><div class="loading-bar__fill"></div></div>
        <div class="loading-row">
          <span class="loading-label"></span>
        </div>
        <div class="loading-detail"></div>
      </div>
    `;
    document.getElementById('hud-layer').appendChild(root);
    this.root = root;
    this.barEl = root.querySelector('.loading-bar__fill');
    this.labelEl = root.querySelector('.loading-label');
    this.detailEl = root.querySelector('.loading-detail');
    const splash = root.querySelector('.loading-splash');
    splash.style.backgroundImage = `url('${SPLASH_URL}')`;
    this.startedAt = performance.now();
    this.lastProgressAt = this.startedAt;
    this.paint();
  }

  plan(count) {
    if (this.assetStep) return;
    this.assetStep = { label: 'Šourám modely ze sklepa…', total: Math.max(count, 1), done: 0, note: '' };
    this.mount();
    this.paint();
  }

  assetLoaded(total, done, url, failed) {
    const step = this.assetStep;
    if (!step) return;
    step.total = Math.max(total, 1);
    step.done = Math.min(done, step.total);
    if (failed) this.missing += 1;
    step.note = this.missing
      ? `${this.missing} modelů se nenačetlo — hra pokračuje bez nich`
      : step.done < step.total && url ? shortName(url) : '';
    if (step.done >= step.total) step.label = 'Modely jsou venku';
    this.setOverall(this.assetPercent());
    this.lastProgressAt = performance.now();
    this.paint();
  }

  endAssets() {
    const step = this.assetStep;
    if (step) step.note = this.missing ? `${this.missing} modelů se nenačetlo — hra pokračuje bez nich` : '';
    this.setOverall(Math.max(this.overall, ASSET_END));
    this.paint();
  }

  async runAssets(urls, load) {
    const queue = urls.slice();
    const total = queue.length;
    this.plan(total);
    let done = 0;
    let failed = 0;
    const worker = async () => {
      while (queue.length) {
        const url = queue.shift();
        const ok = await load(url);
        done += 1;
        if (!ok) failed += 1;
        this.assetLoaded(total, done, url, !ok);
        await releaseFrame();
      }
    };
    const lanes = [];
    for (let i = 0; i < ASSET_LANES; i += 1) lanes.push(worker());
    await Promise.all(lanes);
    this.endAssets();
    return { done, failed };
  }

  assetPercent() {
    const step = this.assetStep;
    if (!step) return 0;
    return Math.min(step.done / step.total, 1) * ASSET_END;
  }

  beginMap() {
    this.mapStep = { label: 'Rozvíjím mapu…', note: '' };
    this.setOverall(MAP_END);
    this.paint();
  }

  endMap() {
    this.mapStep = null;
    this.setOverall(MAP_END);
    this.paint();
  }

  beginWorld(count) {
    this.mount();
    this.stageCount = Math.max(count, 1);
    this.stageClosed = 0;
    this.setOverall(WORLD_START);
    if (this.hideTimer) this.cancelHide();
    this.paint();
  }

  openStage(label) {
    this.stageStep = { label: `${label}…`, done: 0, total: 1, note: '' };
    this.paint();
  }

  stageTotal(total) {
    if (!this.stageStep) return;
    this.stageStep.total = Math.max(total, 1);
  }

  stageProgress(count = 1) {
    const step = this.stageStep;
    if (!step || count <= 0) return;
    step.done += count;
    step.note = '';
    this.setOverall(this.worldPercent());
    this.lastProgressAt = performance.now();
    this.paint();
  }

  note(text) {
    const step = this.stageStep;
    if (!step) return;
    step.note = text || '';
    this.paint();
  }

  endStage() {
    this.stageClosed += 1;
    this.stageStep = null;
    this.setOverall(this.worldPercent());
    this.paint();
  }

  endWorld() {
    this.stageClosed = this.stageCount;
    this.stageStep = null;
    this.setOverall(WORLD_END);
    this.paint();
  }

  worldPercent() {
    const inside = this.stageStep ? Math.min(this.stageStep.done / this.stageStep.total, 1) : 0;
    const share = Math.min((this.stageClosed + inside) / this.stageCount, 1);
    return WORLD_START + share * (WORLD_END - WORLD_START);
  }

  beginFloat(label) {
    this.floatStep = { label, done: 0, total: 1, note: '' };
    this.lastProgressAt = performance.now();
    this.paint();
  }

  floatProgress(done, total = 1, label = null) {
    const step = this.floatStep;
    if (!step) return;
    step.total = Math.max(total, 1);
    step.done = Math.min(done, step.total);
    if (label) step.label = label;
    if (step.done >= step.total) step.note = '';
    this.setOverall(this.floatPercent());
    this.lastProgressAt = performance.now();
    this.paint();
  }

  endFloat() {
    this.floatStep = null;
    this.lastProgressAt = performance.now();
    this.paint();
  }

  floatPercent() {
    const floated = this.floatStep ? Math.min(this.floatStep.done / this.floatStep.total, 1) : 0;
    return FLOAT_START + floated * (FLOAT_END - FLOAT_START);
  }

  setOverall(value) {
    this.overall = Math.min(100, Math.max(this.overall, value));
  }

  get allDone() {
    if (this.assetStep && this.assetStep.done < this.assetStep.total) return false;
    return !this.floatStep && !this.mapStep && this.stageClosed >= this.stageCount;
  }

  get pending() {
    return this.attachHandles.size;
  }

  percent() {
    return this.overall;
  }

  attach(count = 1) {
    this.mount();
    if (count <= 0) return null;
    const handle = { count, opened: false, released: false };
    this.attachHandles.add(handle);
    this.paint();
    if (this.hideTimer) this.cancelHide();
    return handle;
  }

  cancelHide() {
    clearTimeout(this.hideTimer);
    this.hideTimer = 0;
    if (this.root) this.root.classList.remove('is-hidden');
  }

  detach(handle) {
    if (!handle) return;
    if (!this.attachHandles.delete(handle)) return;
    handle.released = true;
    if (handle.resolve) {
      const resolve = handle.resolve;
      handle.resolve = null;
      resolve();
    }
    this.lastProgressAt = performance.now();
    this.paint();
  }

  wait(handle) {
    if (!handle || handle.opened) return Promise.resolve();
    handle.opened = true;
    if (handle.released) return Promise.resolve();
    return new Promise((resolve) => {
      handle.resolve = resolve;
    });
  }

  paint() {
    if (!this.root) return;
    const step = this.stageStep || this.floatStep || this.mapStep;
    this.barEl.style.width = `${this.percent()}%`;
    this.labelEl.textContent = step ? step.label : (this.assetStep ? this.assetStep.label : 'Chystám svět…');
    this.detailEl.textContent = step ? (step.note || '') : (this.assetStep ? this.assetStep.note || '' : '');
  }

  finish() {
    this.mount();
    if (this.hideTimer) return;
    this.setOverall(100);
    this.barEl.style.width = '100%';
    this.labelEl.textContent = 'Hotovo';
    this.detailEl.textContent = '';
    const now = performance.now();
    const wait = Math.max(MIN_VISIBLE_MS - (now - this.startedAt), MIN_AFTER_FIRST_MS - (now - this.lastProgressAt), 0);
    this.hideTimer = setTimeout(() => {
      if (!this.root) return;
      if (this.attachHandles.size) this.warnStillPending();
      this.root.classList.add('is-hidden');
      this.hideTimer = setTimeout(() => {
        if (!this.root) return;
        this.root.remove();
        this.root = null;
        this.onHidden();
      }, FADE_MS);
    }, wait);
  }

  warnStillPending() {
    console.warn(`[start] načítací obrazovka se zavírá, i když ${this.attachHandles.size} dílců nedoběhlo — hra pokračuje bez nich.`);
    this.attachHandles.clear();
  }

  onHidden() {
    if (this.onHiddenCallback) this.onHiddenCallback();
  }

  dispose() {
    clearTimeout(this.hideTimer);
    if (this.root) this.root.remove();
    this.root = null;
  }
}



