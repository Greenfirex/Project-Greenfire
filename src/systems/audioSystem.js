// Zvuky hry — načte je jednou při startu a přehrává náhodné varianty bez vrstvení přes sebe.
// Když prohlížeč zvuk odmítne (hra bez kliknutí), systém tiše mlčí a hra pokračuje.
import { ASSET_DIRS } from '../data/catalogs/assetPaths.js';

const CLIPS = {
  chop: ['chop_1', 'chop_3'],
  mine: ['mine_1', 'mine_2', 'mine_4', 'mine_5'],
  bare: ['chop_2', 'mine_3'],
  fall: ['chop_2', 'mine_5'],
  stepGrass: ['dirtstep_1', 'dirtstep_2', 'dirtstep_3'],
  stepWood: ['woodstep_1', 'woodstep_2', 'woodstep_3'],
  stepStone: ['stonestep_1', 'stonestep_2', 'stonestep_3'],
};

const VOICES = {
  chop: { volume: 0.5, voices: 3, pitch: 0.06 },
  mine: { volume: 0.42, voices: 3, pitch: 0.05 },
  bare: { volume: 0.34, voices: 2, pitch: 0.08 },
  fall: { volume: 0.36, voices: 2, pitch: 0.04 },
  stepGrass: { volume: 0.07, voices: 3, pitch: 0.08 },
  stepWood: { volume: 0.08, voices: 3, pitch: 0.08 },
  stepStone: { volume: 0.08, voices: 3, pitch: 0.08 },
};

export default class AudioSystem {

  constructor(scene) {
    this.s = scene;
    this.ctx = null;
    this.buffers = {};
    this.cursors = {};
    this.available = true;
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
      } catch {
        this.disable();
        return;
      }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
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
        this.fetchClip(key, names[i % names.length], i);
      }
    }
  }

  async fetchClip(key, name, index) {
    const pool = this.buffers[key];
    const url = `${ASSET_DIRS.audio}${name}.ogg`;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(String(response.status));
      const data = await response.arrayBuffer();
      const buffer = await this.ctx.decodeAudioData(data);
      if (pool) pool[index] = buffer;
    } catch {
      this.disable();
    }
  }

  disable() {
    this.available = false;
    this.buffers = {};
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
    gain.connect(this.ctx.destination);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = 1 + (Math.random() * 2 - 1) * cfg.pitch;
    source.connect(gain);
    source.onended = () => gain.disconnect();
    source.start();
  }
}
