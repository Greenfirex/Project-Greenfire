// Zvuky hry — načte je jednou při startu a přehrává náhodné varianty bez vrstvení přes sebe.
// Zvlášť k tomu drží zvuk lesa na pozadí, který se plynule přeladí mezi dnem a nocí.
import { ASSET_DIRS } from '../data/catalogs/assetPaths.js';

const CLIPS = {
  chop: ['chop_1', 'chop_3'],
  mine: ['mine_1', 'mine_2', 'mine_4', 'mine_5'],
  bare: ['chop_2', 'mine_3'],
  fall: ['chop_2', 'mine_5'],
  stepGrass: ['dirtstep_1', 'dirtstep_2', 'dirtstep_3'],
  stepWood: ['woodstep_1', 'woodstep_2', 'woodstep_3'],
  stepStone: ['stonestep_1', 'stonestep_2', 'stonestep_3'],
  ignite: ['ignite_1', 'ignite_2'],
};

const VOICES = {
  chop: { volume: 0.5, voices: 3, pitch: 0.06 },
  mine: { volume: 0.42, voices: 3, pitch: 0.05 },
  bare: { volume: 0.34, voices: 2, pitch: 0.08 },
  fall: { volume: 0.36, voices: 2, pitch: 0.04 },
  stepGrass: { volume: 0.07, voices: 3, pitch: 0.08 },
  stepWood: { volume: 0.08, voices: 3, pitch: 0.08 },
  stepStone: { volume: 0.08, voices: 3, pitch: 0.08 },
  ignite: { volume: 0.6, voices: 2, pitch: 0.05 },
};

const AMBIENT_LAYERS = ['forest_day', 'forest_night'];
const AMBIENT_FADE_SECONDS = 6;
const AMBIENT_LEVEL = 0.25;

const FIRE_LOOP = 'torch_loop';
const FIRE_FADE_SECONDS = 0.5;
const FIRE_HEARING = 12;
const FIRE_LEVELS = [0.3, 0.2, 0.12, 0.05];

export default class AudioSystem {

  constructor(scene) {
    this.s = scene;
    this.ctx = null;
    this.buffers = {};
    this.cursors = {};
    this.available = true;
    this.master = null;
    this.masterVolume = 1;
    this.ambient = null;
    this.ambientVolume = 0;
    this.ambientBoost = AMBIENT_LEVEL;
    this.ambientMix = { forest_day: 1, forest_night: 0 };
    this.ambientTarget = { forest_day: 1, forest_night: 0 };
    this.fire = null;
    this.fireOn = false;
    this.fireDistance = Infinity;
  }

  unlock() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) {
      this.disable();
      return;
    }
    if (!this.ctx) {
      try {
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.masterVolume;
        this.master.connect(this.ctx.destination);
      } catch {
        this.disable();
        return;
      }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.resumeAmbient();
    this.resumeFire();
  }

  load() {
    this.unlock();
    if (!this.ctx) return;
    for (const [key, names] of Object.entries(CLIPS)) {
      const cfg = VOICES[key];
      const pool = new Array(cfg.voices).fill(null);
      this.buffers[key] = pool;
      this.cursors[key] = 0;
      for (let i = 0; i < cfg.voices; i += 1) {
        const url = `${ASSET_DIRS.audio}${names[i % names.length]}.ogg`;
        this.fetchClip(url, (buffer) => { pool[i] = buffer; });
      }
    }
    this.startAmbient();
  }

  async fetchClip(url, onDone) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(String(response.status));
      const data = await response.arrayBuffer();
      const buffer = await this.ctx.decodeAudioData(data);
      if (onDone) onDone(buffer);
    } catch {
      this.disable();
    }
  }

  disable() {
    this.available = false;
    this.buffers = {};
    this.stopAmbient();
    this.fire = null;
  }

  startAmbient() {
    if (!this.ctx || this.ambient) return;
    this.ambient = {};
    for (const key of AMBIENT_LAYERS) {
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      gain.connect(this.master);
      this.ambient[key] = { gain, source: null, buffer: null };
      this.fetchClip(`${ASSET_DIRS.audio}${key}.ogg`, (buffer) => this.playLayer(key, buffer));
    }
    this.resumeAmbient();
  }

  resumeAmbient() {
    if (!this.ambient) return;
    for (const key of AMBIENT_LAYERS) {
      const layer = this.ambient[key];
      if (layer && !layer.source && layer.buffer) this.playLayer(key, layer.buffer);
    }
  }

  playLayer(key, buffer) {
    const layer = this.ambient && this.ambient[key];
    if (!layer || !this.ctx || layer.source) return;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(layer.gain);
    source.start();
    layer.source = source;
    layer.buffer = buffer;
    this.applyLayerGains();
  }

  stopAmbient() {
    if (!this.ambient) return;
    for (const layer of Object.values(this.ambient)) {
      if (layer.source) layer.source.stop();
      layer.source = null;
    }
    this.ambient = null;
  }

  setFire(burning, distance) {
    const on = Boolean(burning);
    if (on !== this.fireOn) {
      this.fireOn = on;
      if (on && this.s.engine) this.s.engine.unlockAudio();
    }
    this.fireDistance = Number.isFinite(distance) ? distance : Infinity;
    if (!on && !this.fire) return;
    if (!this.fire) {
      this.startFire();
      return;
    }
    if (on && !this.fire.source && this.fire.buffer && this.ctx.state !== 'suspended') {
      this.playFire(this.fire.buffer);
    }
    this.applyFireGain();
  }

  fireLevel() {
    if (!this.fireOn) return 0;
    const step = Math.min(FIRE_LEVELS.length - 1, Math.floor(this.fireDistance / (FIRE_HEARING / FIRE_LEVELS.length)));
    return Math.max(0, FIRE_LEVELS[step]);
  }

  startFire() {
    if (!this.ctx || this.fire) return;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.master || this.ctx.destination);
    this.fire = { gain, source: null, buffer: null };
    this.fetchClip(`${ASSET_DIRS.audio}${FIRE_LOOP}.ogg`, (buffer) => this.playFire(buffer));
  }

  playFire(buffer) {
    if (!this.fire || !this.ctx || this.fire.source) return;
    if (!this.fireOn) return;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(this.fire.gain);
    source.start();
    this.fire.source = source;
    this.fire.buffer = buffer;
    this.applyFireGain();
  }

  resumeFire() {
    if (!this.fire || !this.fireOn || this.fire.source || !this.fire.buffer) return;
    if (this.ctx.state === 'suspended') return;
    this.playFire(this.fire.buffer);
  }

  applyFireGain() {
    if (!this.fire || !this.ctx) return;
    this.fire.gain.gain.setTargetAtTime(this.fireLevel(), this.ctx.currentTime, FIRE_FADE_SECONDS / 3);
  }

  setMasterVolume(value) {
    this.masterVolume = Math.max(0, Math.min(1, value));
    if (this.master) this.master.gain.value = this.masterVolume;
  }

  setAmbientVolume(value) {
    this.ambientVolume = Math.max(0, Math.min(1, value));
    this.applyLayerGains();
  }

  setDayness(dayness) {
    const t = Math.max(0, Math.min(1, dayness));
    this.ambientTarget = { forest_day: t, forest_night: 1 - t };
  }

  applyLayerGains() {
    if (!this.ambient || !this.ctx) return;
    const level = this.ambientVolume * this.ambientBoost;
    for (const key of AMBIENT_LAYERS) {
      const layer = this.ambient[key];
      if (!layer) continue;
      layer.gain.gain.setTargetAtTime(this.ambientMix[key] * level, this.ctx.currentTime, AMBIENT_FADE_SECONDS / 3);
    }
  }

  update(dt) {
    if (!this.ambient) return;
    const step = Math.min(1, dt / AMBIENT_FADE_SECONDS);
    let changed = false;
    for (const key of AMBIENT_LAYERS) {
      const diff = this.ambientTarget[key] - this.ambientMix[key];
      if (Math.abs(diff) < 0.005) {
        this.ambientMix[key] = this.ambientTarget[key];
        continue;
      }
      this.ambientMix[key] += diff * step;
      changed = true;
    }
    if (changed) this.applyLayerGains();
  }

  play(key, options = {}) {
    if (!this.available || !this.ctx) return;
    const pool = this.buffers[key];
    if (!pool) return;
    const cfg = VOICES[key];
    const index = this.cursors[key] % pool.length;
    this.cursors[key] = (this.cursors[key] + 1) % pool.length;
    const buffer = pool[index];
    if (!buffer) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const gain = this.ctx.createGain();
    gain.gain.value = cfg.volume * (options.gain || 1);
    gain.connect(this.master || this.ctx.destination);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = 1 + (Math.random() * 2 - 1) * cfg.pitch;
    source.connect(gain);
    source.onended = () => gain.disconnect();
    source.start();
  }
}
