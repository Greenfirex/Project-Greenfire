// Zvuky hry — načte je jednou při startu a přehrává náhodné varianty bez vrstvení přes sebe.
// Zvlášť k tomu drží zvuk lesa na pozadí, který se plynule přeladí mezi dnem a nocí.
import { ASSET_DIRS } from '../data/catalogs/assetPaths.js';

const CLIPS = {
  chop: ['chop_1', 'chop_3'],
  mine: ['mine_1', 'mine_2', 'mine_4', 'mine_5'],
  bare: ['chop_2', 'mine_3'],
  pickup: ['pickup_1.wav'],
  fall: ['chop_2', 'mine_5'],
  stepGrass: ['dirtstep_1', 'dirtstep_2', 'dirtstep_3'],
  stepWood: ['woodstep_1', 'woodstep_2', 'woodstep_3'],
  stepStone: ['stonestep_1', 'stonestep_2', 'stonestep_3'],
  stepWater: ['waterstep_1', 'waterstep_2', 'waterstep_3', 'waterstep_4', 'waterstep_5'],
  ignite: ['ignite_1', 'ignite_2'],
  turtleHiss: ['turtle_hiss_1.wav'],
  turtleBite: ['turtle_bite_1.wav', 'turtle_bite_2.wav', 'turtle_bite_3.wav'],
  turtleGrowl: ['turtle_growl_1.wav'],
};

const VOICES = {
  chop: { volume: 0.5, voices: 3, pitch: 0.06 },
  mine: { volume: 0.42, voices: 3, pitch: 0.05 },
  bare: { volume: 0.34, voices: 2, pitch: 0.08 },
  pickup: { volume: 0.38, voices: 1, pitch: 0.05 },
  fall: { volume: 0.36, voices: 2, pitch: 0.04 },
  stepGrass: { volume: 0.07, voices: 3, pitch: 0.08 },
  stepWood: { volume: 0.08, voices: 3, pitch: 0.08 },
  stepStone: { volume: 0.08, voices: 3, pitch: 0.08 },
  stepWater: { volume: 0.09, voices: 5, pitch: 0.08 },
  ignite: { volume: 0.6, voices: 2, pitch: 0.05 },
  turtleHiss: { volume: 0.5, voices: 1, pitch: 0.04 },
  turtleBite: { volume: 0.55, voices: 3, pitch: 0.06 },
  turtleGrowl: { volume: 0.45, voices: 1, pitch: 0.05 },
};

const AMBIENT_LAYERS = ['forest_day', 'forest_night'];
const AMBIENT_FADE_SECONDS = 6;
const AMBIENT_LEVEL = 0.25;

const FIRE_LOOP = 'torch_loop';
const FIRE_FADE_SECONDS = 0.5;
const FIRE_HEARING = 12;
const FIRE_LEVELS = [0.3, 0.2, 0.12, 0.05];

const SHORE_LAYER = 'sea';
const SHORE_FADE_SECONDS = 2;
const SHORE_LEVEL = 0.35;
const SHORE_NEAR = 3;
const SHORE_FAR = 26;
const FOREST_DUCK = 0.7;

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
    this.shore = null;
    this.shoreMix = 0;
    this.shoreTarget = 0;
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
    this.resumeShore();
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
        const name = names[i % names.length];
        const file = name.includes('.') ? name : `${name}.ogg`;
        this.fetchClip(`${ASSET_DIRS.audio}${file}`, (buffer) => { pool[i] = buffer; });
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
    } catch (error) {
      console.warn(`[audio] Klip se nenačetl: ${url} — ${error && error.message ? error.message : error}`);
    }
  }

  disable() {
    this.available = false;
    this.buffers = {};
    this.stopAmbient();
    this.stopShore();
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

  setShoreDistance(distance) {
    const value = Number.isFinite(distance) ? Math.max(0, distance) : Infinity;
    let target = 0;
    if (value <= SHORE_NEAR) target = 1;
    else if (value < SHORE_FAR) target = 1 - (value - SHORE_NEAR) / (SHORE_FAR - SHORE_NEAR);
    this.shoreTarget = target;
    if (target <= 0) return;
    this.ensureShore();
    this.resumeShore();
  }

  ensureShore() {
    if (!this.ctx || this.shore) return;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.master || this.ctx.destination);
    this.shore = { gain, source: null, buffer: null };
    this.fetchClip(`${ASSET_DIRS.audio}${SHORE_LAYER}.ogg`, (buffer) => {
      if (!this.shore) return;
      this.shore.buffer = buffer;
      this.resumeShore();
    });
  }

  resumeShore() {
    if (!this.shore || !this.shore.buffer || this.shore.source) return;
    if (!this.ctx || this.ctx.state === 'suspended') return;
    if (this.shoreTarget <= 0) return;
    const source = this.ctx.createBufferSource();
    source.buffer = this.shore.buffer;
    source.loop = true;
    source.connect(this.shore.gain);
    source.start();
    this.shore.source = source;
    this.applyShoreGain();
  }

  stopShore() {
    if (!this.shore) return;
    if (this.shore.source) this.shore.source.stop();
    this.shore.source = null;
  }

  applyShoreGain() {
    if (!this.shore || !this.ctx) return;
    const level = this.ambientVolume * SHORE_LEVEL * this.shoreMix;
    this.shore.gain.gain.setTargetAtTime(level, this.ctx.currentTime, SHORE_FADE_SECONDS / 3);
  }

  setMasterVolume(value) {
    this.masterVolume = Math.max(0, Math.min(1, value));
    if (this.master) this.master.gain.value = this.masterVolume;
  }

  setAmbientVolume(value) {
    this.ambientVolume = Math.max(0, Math.min(1, value));
    this.applyLayerGains();
    this.applyShoreGain();
  }

  setDayness(dayness) {
    const t = Math.max(0, Math.min(1, dayness));
    this.ambientTarget = { forest_day: t, forest_night: 1 - t };
  }

  applyLayerGains() {
    if (!this.ambient || !this.ctx) return;
    const duck = 1 - FOREST_DUCK * Math.sqrt(this.shoreMix);
    const level = this.ambientVolume * this.ambientBoost * duck;
    const smoothing = this.shoreMix > 0 ? SHORE_FADE_SECONDS : AMBIENT_FADE_SECONDS;
    for (const key of AMBIENT_LAYERS) {
      const layer = this.ambient[key];
      if (!layer) continue;
      layer.gain.gain.setTargetAtTime(this.ambientMix[key] * level, this.ctx.currentTime, smoothing / 3);
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
    const shoreDiff = this.shoreTarget - this.shoreMix;
    if (Math.abs(shoreDiff) < 0.005) {
      if (shoreDiff !== 0) {
        this.shoreMix = this.shoreTarget;
        this.applyShoreGain();
        changed = true;
      }
    } else {
      this.shoreMix += shoreDiff * Math.min(1, dt / SHORE_FADE_SECONDS);
      this.applyShoreGain();
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
