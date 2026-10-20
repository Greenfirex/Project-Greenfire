// Obrazovka načítání — jedna společná fronta kroků: modely, příprava hry a stavba světa.
// Ukazuje název běžícího kroku, postup uvnitř něj a celkový postup celé hry.
const MIN_VISIBLE_MS = 600;
const MIN_AFTER_FIRST_MS = 300;
const FADE_MS = 400;

export default class LoadingScreen {

  constructor() {
    this.root = null;
    this.barEl = null;
    this.labelEl = null;
    this.countEl = null;
    this.detailEl = null;
    this.attachHandles = new Set();
    this.steps = [];
    this.assetStep = null;
    this.stageIndex = -1;
    this.missing = 0;
    this.doneTotal = 0;
    this.allTotal = 0;
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
      <div class="loading-box">
        <div class="loading-title">Project Greenfactory</div>
        <div class="loading-bar"><div class="loading-bar__fill"></div></div>
        <div class="loading-row">
          <span class="loading-label">Připravuji svět…</span>
          <span class="loading-count"></span>
        </div>
        <div class="loading-detail"></div>
      </div>
    `;
    document.getElementById('hud-layer').appendChild(root);
    this.root = root;
    this.barEl = root.querySelector('.loading-bar__fill');
    this.labelEl = root.querySelector('.loading-label');
    this.countEl = root.querySelector('.loading-count');
    this.detailEl = root.querySelector('.loading-detail');
    this.startedAt = performance.now();
    this.lastProgressAt = this.startedAt;
    this.render();
  }

  plan(count) {
    this.assetStep = { label: 'Načítám modely…', total: Math.max(count, 1), done: 0, note: '', weight: 15 };
    this.steps.push(this.assetStep);
  }

  addStep(label, total = 1) {
    const step = { label, total, done: 0, note: '', weight: 1 };
    this.steps.push(step);
    this.recount();
    this.render();
    return step;
  }

  beginAssets(total) {
    this.mount();
    if (!this.assetStep) this.plan(total);
    this.plannedTotal = Math.max(this.plannedTotal || 0, 100);
    this.recount();
    if (this.hideTimer) this.cancelHide();
    this.render();
  }

  assetLoaded(total, done, url, failed) {
    const step = this.assetStep;
    if (!step) return;
    step.done = Math.min(done, step.total);
    step.label = done >= step.total ? 'Modely načteny' : 'Načítám modely…';
    if (failed) {
      this.missing += 1;
      step.note = `${this.missing} modelů se nenačetlo — hra pokračuje bez nich`;
    } else if (url && done < step.total) {
      step.note = shortName(url);
    }
    this.lastProgressAt = performance.now();
    this.recount();
    this.render();
  }

  endAssets() {
    const step = this.assetStep;
    if (step) step.note = this.missing ? `${this.missing} modelů se nenačetlo — hra pokračuje bez nich` : '';
    this.recount();
    this.render();
  }

  beginWorld(stages) {
    this.mount();
    const sum = stages.reduce((total, stage) => total + Math.max(stage.total, 1), 0);
    const share = sum > 0 ? 70 / sum : 0;
    for (const stage of stages) {
      const total = Math.max(stage.total, 1);
      this.steps.push({
        label: `${stage.label}…`,
        total,
        done: 0,
        note: '',
        world: true,
        weight: total * share,
      });
    }
    this.stageIndex = 0;
    this.recount();
    if (this.hideTimer) this.cancelHide();
    this.render();
  }

  stageProgress(count = 1) {
    const step = this.stage;
    if (!step) return;
    step.done = Math.min(step.done + count, step.total);
    this.lastProgressAt = performance.now();
    this.recount();
    this.render();
  }

  endStage() {
    const step = this.stage;
    if (!step) return;
    this.closeStep(step);
    this.stageIndex += 1;
    this.render();
  }

  closeWorldSteps() {
    for (const step of this.steps) {
      if (step.world) step.done = step.total;
    }
    this.stageIndex = -1;
    this.lastProgressAt = performance.now();
    this.recount();
    this.render();
  }

  closeStep(step) {
    if (!step) return;
    step.done = step.total;
    this.lastProgressAt = performance.now();
    this.recount();
    this.render();
  }

  closeAllSteps() {
    for (const step of this.steps) step.done = step.total;
    this.lastProgressAt = performance.now();
    this.recount();
    this.render();
  }

  stepDone(step) {
    this.closeStep(step);
  }

  get worldStart() {
    return this.steps.findIndex((step) => step.world === true);
  }

  get stage() {
    if (this.stageIndex < 0) return null;
    return this.steps[this.worldStart + this.stageIndex] || null;
  }

  get current() {
    return this.stage || this.steps.find((step) => step.done < step.total) || null;
  }

  recount() {
    let done = 0;
    for (const step of this.steps) {
      const weight = step.weight || 1;
      done += (Math.min(step.done, step.total) / step.total) * weight;
    }
    this.doneTotal = done;
    this.allTotal = Math.max(this.plannedTotal || 0, 100);
  }

  attach(count = 1) {
    this.mount();
    if (count <= 0) return null;
    const handle = { count, opened: false, released: false };
    this.attachHandles.add(handle);
    this.render();
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
    this.render();
  }

  wait(handle) {
    if (!handle || handle.opened) return Promise.resolve();
    handle.opened = true;
    if (handle.released) return Promise.resolve();
    return new Promise((resolve) => {
      handle.resolve = resolve;
    });
  }

  get pending() {
    return this.attachHandles.size;
  }

  render() {
    if (!this.root) return;
    const percent = this.allTotal > 0 ? Math.min(this.doneTotal / this.allTotal, 0.99) * 100 : 0;
    this.barEl.style.width = `${percent}%`;
    const step = this.current;
    const waiting = this.attachHandles.size > 0;
    if (step) {
      this.labelEl.textContent = step.label;
      this.countEl.textContent = step.total > 1 ? `${step.done} / ${step.total}` : '';
      this.detailEl.textContent = step.note || (waiting && step.world ? 'dočišťuji zbytek světa…' : '');
      return;
    }
    this.labelEl.textContent = this.allTotal > 0 ? 'Zbývá dopnout zbytek světa…' : 'Připravuji svět…';
    this.countEl.textContent = '';
    this.detailEl.textContent = waiting ? `hotovo z ${Math.round(percent)} %, čeká se na ${this.attachHandles.size} ${this.attachHandles.size === 1 ? 'krok' : 'kroky'}` : '';
  }

  renderComplete() {
    if (!this.root) return;
    this.barEl.style.width = '100%';
    this.labelEl.textContent = 'Hotovo';
    this.countEl.textContent = '';
    if (this.detailEl) this.detailEl.textContent = '';
  }

  finish() {
    this.mount();
    if (this.hideTimer) return;
    this.renderComplete();
    const now = performance.now();
    const sinceStart = now - this.startedAt;
    const sinceProgress = now - this.lastProgressAt;
    const wait = Math.max(MIN_VISIBLE_MS - sinceStart, MIN_AFTER_FIRST_MS - sinceProgress, 0);
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

function shortName(url) {
  const parts = url.split('/');
  return parts[parts.length - 1] || url;
}
