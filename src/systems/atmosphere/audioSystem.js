// Zvuky hry — načte je jednou při startu a přehrává náhodné varianty bez vrstvení přes sebe.
// Zvlášť k tomu drží zvuk lesa (den, noc, jeskyně), vodu podle vzdálenosti a občasné hlasy zvířat v pozadí.
// Venkovní zvuky jdou přes společný filtr, který je v úkrytu (stavba) ztiší a ztlumí jako přes zeď.
import { ASSET_DIRS } from '../../data/catalogs/assetPaths.js';

const CLIPS = {
  chop: ['gather/chop_1', 'gather/chop_3'],
  mine: ['gather/mine_1', 'gather/mine_2', 'gather/mine_4', 'gather/mine_5'],
  bare: ['gather/chop_2', 'gather/mine_3'],
  miss: ['combat/miss_1.ogg', 'combat/miss_2.ogg', 'combat/miss_3.ogg', 'combat/miss_4.ogg', 'combat/miss_5.ogg', 'combat/miss_6.ogg'],
  hurt: ['combat/hurt_1.ogg', 'combat/hurt_2.ogg', 'combat/hurt_3.ogg'],
  hurtCrit: ['combat/hurt_crit_1.ogg', 'combat/hurt_crit_2.ogg'],
  fall: ['gather/treefall_1.ogg', 'gather/treefall_2.ogg', 'gather/treefall_3.ogg'],
  hitPunch: ['combat/punch_1.ogg', 'combat/punch_2.ogg', 'combat/punch_3.ogg', 'combat/punch_4.ogg'],
  hitClub: ['combat/club_1.ogg', 'combat/club_2.ogg', 'combat/club_3.ogg', 'combat/club_4.ogg'],
  grunt: ['player/grunt_1.ogg', 'player/grunt_2.ogg', 'player/grunt_3.ogg', 'player/grunt_4.ogg'],
  playerHurt: ['player/player_hurt_1.ogg', 'player/player_hurt_2.ogg', 'player/player_hurt_3.ogg', 'player/player_hurt_4.ogg'],
  playerDeath: ['player/player_death_1.ogg', 'player/player_death_2.ogg'],
  outOfBreath: ['player/out_of_breath_1.ogg', 'player/out_of_breath_2.ogg'],
  wakeUp: ['player/wake_up_1.ogg'],
  stepGrass: ['steps/dirtstep_1', 'steps/dirtstep_2', 'steps/dirtstep_3'],
  stepWood: ['steps/woodstep_1', 'steps/woodstep_2', 'steps/woodstep_3'],
  stepStone: ['steps/stonestep_1', 'steps/stonestep_2', 'steps/stonestep_3'],
  stepSand: ['steps/sandstep_1.ogg', 'steps/sandstep_2.ogg', 'steps/sandstep_3.ogg', 'steps/sandstep_4.ogg'],
  stepWater: ['steps/waterstep_1', 'steps/waterstep_2', 'steps/waterstep_3', 'steps/waterstep_4', 'steps/waterstep_5'],
  ignite: ['fire/ignite_1', 'fire/ignite_2'],
  turtleAlert: ['creatures/turtle/turtle_alert_1.ogg', 'creatures/turtle/turtle_alert_2.ogg'],
  turtleCharge: ['creatures/turtle/turtle_charge_1.ogg', 'creatures/turtle/turtle_charge_2.ogg'],
  turtleBite: ['creatures/turtle/turtle_bite_1.ogg', 'creatures/turtle/turtle_bite_2.ogg', 'creatures/turtle/turtle_bite_3.ogg'],
  turtleSnapHiss: ['creatures/turtle/turtle_snap_hiss_1.ogg', 'creatures/turtle/turtle_snap_hiss_2.ogg', 'creatures/turtle/turtle_snap_hiss_3.ogg'],
  turtleHit: ['creatures/turtle/turtle_hit_1.ogg', 'creatures/turtle/turtle_hit_2.ogg', 'creatures/turtle/turtle_hit_3.ogg'],
  turtlePain: ['creatures/turtle/turtle_pain_1.ogg', 'creatures/turtle/turtle_pain_2.ogg', 'creatures/turtle/turtle_pain_3.ogg'],
  turtleDeath: ['creatures/turtle/turtle_death_1.ogg', 'creatures/turtle/turtle_death_2.ogg'],
  turtleIdle: ['creatures/turtle/turtle_idle_1.ogg', 'creatures/turtle/turtle_idle_2.ogg', 'creatures/turtle/turtle_idle_3.ogg', 'creatures/turtle/turtle_idle_4.ogg'],
  devilDig: ['creatures/devil/devil_dig_1.ogg', 'creatures/devil/devil_dig_2.ogg', 'creatures/devil/devil_dig_3.ogg'],
  devilBite: ['creatures/devil/devil_bite_1.ogg', 'creatures/devil/devil_bite_2.ogg', 'creatures/devil/devil_bite_3.ogg'],
  devilHit: ['creatures/devil/devil_hit_1.ogg', 'creatures/devil/devil_hit_2.ogg'],
  devilDeath: ['creatures/devil/devil_death_1.ogg'],
  devilGrowl: ['creatures/devil/devil_growl_1.ogg'],
  koaAlert: ['creatures/koa/koa_alert_1.ogg', 'creatures/koa/koa_alert_2.ogg'],
  koaGrowl: ['creatures/koa/koa_growl_1.ogg', 'creatures/koa/koa_growl_2.ogg'],
  koaBeak: ['creatures/koa/koa_bite_1.ogg', 'creatures/koa/koa_bite_2.ogg', 'creatures/koa/koa_bite_3.ogg'],
  koaClaws: ['creatures/koa/koa_claws_1.ogg', 'creatures/koa/koa_claws_2.ogg', 'creatures/koa/koa_claws_3.ogg', 'creatures/koa/koa_claws_4.ogg'],
  koaHit: ['creatures/koa/koa_hit_1.ogg', 'creatures/koa/koa_hit_2.ogg'],
  koaDeath: ['creatures/koa/koa_death_1.ogg', 'creatures/koa/koa_death_2.ogg'],
  koaChirp: ['creatures/koa/koa_chirp_1.ogg', 'creatures/koa/koa_chirp_2.ogg', 'creatures/koa/koa_chirp_3.ogg'],
  koaPeck: ['creatures/koa/koa_peck_1.ogg', 'creatures/koa/koa_peck_2.ogg'],
  grassRip: ['gather/grassrip_1.ogg', 'gather/grassrip_2.ogg'],
  pickShell: ['gather/pickup_shell_1.ogg', 'gather/pickup_shell_2.ogg'],
  pickCoconut: ['gather/pickup_coconut_1.ogg', 'gather/pickup_coconut_2.ogg'],
  chestOpen: ['loot/chest_open_1.ogg', 'loot/chest_open_2.ogg'],
  chestClose: ['loot/chest_close_1.ogg', 'loot/chest_close_2.ogg'],
  rummage: ['loot/rummage_1.ogg', 'loot/rummage_2.ogg', 'loot/rummage_3.ogg'],
  windowOpen: ['ui/window_open.ogg'],
  windowClose: ['ui/window_close.ogg'],
  itemGrab: ['ui/item_grab.ogg'],
  itemDrop: ['ui/item_drop.ogg'],
  equipCloth: ['ui/equip_cloth_1.ogg', 'ui/equip_cloth_2.ogg'],
  craft: ['ui/craft_1.ogg', 'ui/craft_2.ogg'],
  birdDay: ['ambient/life/bird_day_1.ogg', 'ambient/life/bird_day_2.ogg', 'ambient/life/bird_day_3.ogg', 'ambient/life/bird_day_4.ogg', 'ambient/life/bird_day_5.ogg'],
  cicadaDay: ['ambient/life/cicada_day_1.ogg', 'ambient/life/cicada_day_2.ogg'],
  cricketNight: ['ambient/life/cricket_night_1.ogg', 'ambient/life/cricket_night_2.ogg'],
  frogNight: ['ambient/life/frog_1.ogg', 'ambient/life/frog_2.ogg', 'ambient/life/frog_3.ogg'],
  caveDrip: ['ambient/life/cave_drip_1.ogg', 'ambient/life/cave_drip_2.ogg', 'ambient/life/cave_drip_3.ogg'],
  cavePebble: ['ambient/life/cave_pebble_1.ogg', 'ambient/life/cave_pebble_2.ogg'],
  toucan: ['ambient/life/toucan_1.ogg', 'ambient/life/toucan_2.ogg'],
  insectFlyby: ['ambient/life/insect_flyby_1.ogg', 'ambient/life/insect_flyby_2.ogg'],
  palmRustle: ['ambient/life/palm_rustle_1.ogg', 'ambient/life/palm_rustle_2.ogg', 'ambient/life/palm_rustle_3.ogg'],
  owlNight: ['ambient/life/owl_night_1.ogg', 'ambient/life/owl_night_2.ogg'],
  nightBird: ['ambient/life/nightbird_1.ogg', 'ambient/life/nightbird_2.ogg'],
  treeFrog: ['ambient/life/treefrog_night_1.ogg', 'ambient/life/treefrog_night_2.ogg'],
  surfRocks: ['ambient/life/surf_rocks_1.ogg', 'ambient/life/surf_rocks_2.ogg'],
  doorOpen: ['building/door_open_1.ogg', 'building/door_open_2.ogg'],
  doorClose: ['building/door_close_1.ogg', 'building/door_close_2.ogg', 'building/door_close_3.ogg'],
  plankCreak: ['building/plank_creak_1.ogg', 'building/plank_creak_2.ogg', 'building/plank_creak_3.ogg'],
  timberCreak: ['building/timber_creak_1.ogg', 'building/timber_creak_2.ogg', 'building/timber_creak_3.ogg'],
};

const VOICES = {
  chop: { volume: 0.5, voices: 3, pitch: 0.06 },
  mine: { volume: 0.42, voices: 3, pitch: 0.05 },
  bare: { volume: 0.34, voices: 2, pitch: 0.08 },
  miss: { volume: 0.45, voices: 6, pitch: 0.08 },
  hurt: { volume: 0.5, voices: 3, pitch: 0.06 },
  hurtCrit: { volume: 0.6, voices: 2, pitch: 0.05 },
  fall: { volume: 0.5, voices: 2, pitch: 0.04 },
  hitPunch: { volume: 0.55, voices: 3, pitch: 0.07 },
  hitClub: { volume: 0.55, voices: 3, pitch: 0.07 },
  grunt: { volume: 0.35, voices: 1, pitch: 0.05 },
  playerHurt: { volume: 0.45, voices: 1, pitch: 0.04 },
  playerDeath: { volume: 0.5, voices: 1, pitch: 0.02 },
  outOfBreath: { volume: 0.35, voices: 1, pitch: 0.03 },
  wakeUp: { volume: 0.4, voices: 1, pitch: 0.02 },
  stepGrass: { volume: 0.07, voices: 3, pitch: 0.08 },
  stepWood: { volume: 0.08, voices: 3, pitch: 0.08, with: 'plankCreak' },
  stepStone: { volume: 0.08, voices: 3, pitch: 0.08 },
  stepSand: { volume: 0.012, voices: 3, pitch: 0.08 },
  stepWater: { volume: 0.09, voices: 5, pitch: 0.08 },
  ignite: { volume: 0.6, voices: 2, pitch: 0.05 },
  turtleAlert: { volume: 0.45, voices: 2, pitch: 0.05, hearing: 18 },
  turtleCharge: { volume: 0.45, voices: 2, pitch: 0.05, hearing: 18 },
  turtleBite: { volume: 0.55, voices: 3, pitch: 0.06, hearing: 14, with: 'turtleSnapHiss' },
  turtleSnapHiss: { volume: 0.4, voices: 3, pitch: 0.06, hearing: 14 },
  turtleHit: { volume: 0.55, voices: 3, pitch: 0.06, hearing: 16, with: 'turtlePain' },
  turtlePain: { volume: 0.4, voices: 3, pitch: 0.06, hearing: 16 },
  turtleDeath: { volume: 0.45, voices: 2, pitch: 0.03, hearing: 18 },
  turtleIdle: { volume: 0.25, voices: 2, pitch: 0.08, hearing: 8 },
  devilDig: { volume: 0.5, voices: 3, pitch: 0.07 },
  devilBite: { volume: 0.6, voices: 3, pitch: 0.06 },
  devilHit: { volume: 0.55, voices: 2, pitch: 0.08 },
  devilDeath: { volume: 0.55, voices: 1, pitch: 0.03 },
  devilGrowl: { volume: 0.4, voices: 1, pitch: 0.05 },
  koaAlert: { volume: 0.4, voices: 2, pitch: 0.06, hearing: 20 },
  koaGrowl: { volume: 0.45, voices: 2, pitch: 0.05, hearing: 20 },
  koaBeak: { volume: 0.6, voices: 3, pitch: 0.06, hearing: 14 },
  koaClaws: { volume: 0.5, voices: 4, pitch: 0.08, hearing: 12 },
  koaHit: { volume: 0.45, voices: 2, pitch: 0.08, hearing: 16 },
  koaDeath: { volume: 0.45, voices: 2, pitch: 0.03, hearing: 18 },
  koaChirp: { volume: 0.3, voices: 3, pitch: 0.1, hearing: 16 },
  koaPeck: { volume: 0.3, voices: 2, pitch: 0.1, hearing: 7 },
  grassRip: { volume: 0.4, voices: 2, pitch: 0.08 },
  pickShell: { volume: 0.4, voices: 2, pitch: 0.08 },
  pickCoconut: { volume: 0.4, voices: 2, pitch: 0.06 },
  chestOpen: { volume: 0.45, voices: 2, pitch: 0.04 },
  chestClose: { volume: 0.45, voices: 2, pitch: 0.04 },
  rummage: { volume: 0.35, voices: 3, pitch: 0.06 },
  windowOpen: { volume: 0.1, voices: 1, pitch: 0.03 },
  windowClose: { volume: 0.1, voices: 1, pitch: 0.03 },
  itemGrab: { volume: 0.1, voices: 2, pitch: 0.06 },
  itemDrop: { volume: 0.1, voices: 2, pitch: 0.06 },
  equipCloth: { volume: 0.13, voices: 2, pitch: 0.05 },
  craft: { volume: 0.25, voices: 2, pitch: 0.05 },
  birdDay: { volume: 0.18, voices: 5, pitch: 0.08 },
  cicadaDay: { volume: 0.12, voices: 2, pitch: 0.06 },
  cricketNight: { volume: 0.12, voices: 2, pitch: 0.08 },
  frogNight: { volume: 0.18, voices: 3, pitch: 0.08 },
  caveDrip: { volume: 0.25, voices: 3, pitch: 0.12 },
  cavePebble: { volume: 0.2, voices: 2, pitch: 0.1 },
  toucan: { volume: 0.14, voices: 2, pitch: 0.06 },
  insectFlyby: { volume: 0.12, voices: 2, pitch: 0.1 },
  palmRustle: { volume: 0.16, voices: 3, pitch: 0.06 },
  owlNight: { volume: 0.14, voices: 2, pitch: 0.05 },
  nightBird: { volume: 0.12, voices: 2, pitch: 0.06 },
  treeFrog: { volume: 0.12, voices: 2, pitch: 0.08 },
  surfRocks: { volume: 0.22, voices: 2, pitch: 0.05 },
  doorOpen: { volume: 0.45, voices: 2, pitch: 0.05 },
  doorClose: { volume: 0.45, voices: 2, pitch: 0.05 },
  plankCreak: { volume: 0.1, voices: 3, pitch: 0.1, chance: 0.16 },
  timberCreak: { volume: 0.18, voices: 3, pitch: 0.06 },
};

const DEFAULT_HEARING = 22;
const SILENT_GAIN = 0.02;

const AMBIENT_LAYERS =['forest_day', 'forest_night', 'cave'];
const AMBIENT_FOLDER = 'ambient/';
const AMBIENT_FADE_SECONDS = 2;
const AMBIENT_LEVEL = 0.25;
const OUTDOOR_LAYERS = new Set(['forest_day', 'forest_night']);
const OPEN_CUTOFF = 20000;
const SHELTER_CUTOFF = 700;
const SHELTER_LEVEL = 0.55;
const SHELTER_SMOOTHING = 0.25;

const FIRE_LOOP = 'fire/campfire_loop';
const FIRE_FADE_SECONDS = 0.5;
const FIRE_HEARING = 12;
const FIRE_LEVELS = [0.3, 0.2, 0.12, 0.05];

const WATER_LOOPS = {
  sea: { file: 'ambient/sea', level: 0.35, near: 3, far: 26 },
  river: { file: 'ambient/river', level: 0.3, near: 1.5, far: 14 },
  waterfall: { file: 'ambient/waterfall', level: 0.45, near: 2, far: 24 },
  lake: { file: 'ambient/lake', level: 0.25, near: 1, far: 10 },
};
const WATER_FADE_SECONDS = 0.6;
const FOREST_DUCK = 0.7;

const LIFE_CALLS = [
  { key: 'birdDay', when: 'day', every: [6, 16] },
  { key: 'cicadaDay', when: 'day', every: [20, 45] },
  { key: 'cricketNight', when: 'night', every: [8, 20] },
  { key: 'frogNight', when: 'night', every: [5, 14], freshWater: 0.15 },
  { key: 'caveDrip', when: 'cave', every: [3, 9] },
  { key: 'cavePebble', when: 'cave', every: [14, 35] },
  { key: 'toucan', when: 'day', every: [25, 60] },
  { key: 'insectFlyby', when: 'day', every: [30, 75] },
  { key: 'palmRustle', when: ['day', 'night'], every: [15, 40] },
  { key: 'owlNight', when: 'night', every: [18, 45] },
  { key: 'nightBird', when: 'night', every: [25, 60] },
  { key: 'treeFrog', when: 'night', every: [10, 25] },
  { key: 'surfRocks', when: ['day', 'night'], every: [8, 20], sea: 0.2 },
  { key: 'timberCreak', when: 'shelter', every: [12, 30] },
];
const LIFE_PAN = 0.7;

const MUSIC_TRACKS = ['music/island_bamboo', 'music/island_drift', 'music/island_journey'];
const MUSIC_FADE_SECONDS = 3;
const MUSIC_LEVEL = 0.9;

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
    this.ambientMix = { forest_day: 1, forest_night: 0, cave: 0 };
    this.ambientTarget = { forest_day: 1, forest_night: 0, cave: 0 };
    this.dayT = 1;
    this.indoor = 0;
    this.sheltered = 0;
    this.outdoor = null;
    this.fire = null;
    this.fireOn = false;
    this.fireDistance = Infinity;
    this.water = {};
    this.lifeTimers = LIFE_CALLS.map((call) => between(call.every));
    this.music = null;
    this.musicVolume = 0;
    this.musicMix = 0;
    this.musicTrack = -1;
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
        this.outdoorFilter = this.ctx.createBiquadFilter();
        this.outdoorFilter.type = 'lowpass';
        this.outdoorFilter.connect(this.master);
        this.outdoor = this.ctx.createGain();
        this.outdoor.connect(this.outdoorFilter);
        this.applyShelter();
      } catch {
        this.disable();
        return;
      }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.resumeAmbient();
    this.resumeFire();
    this.resumeWater();
    this.resumeMusic();
  }

  load() {
    this.unlock();
    if (!this.ctx) return;
    for (const [key, names] of Object.entries(CLIPS)) {
      const cfg = VOICES[key];
      const count = Math.max(cfg.voices, names.length);
      const pool = new Array(count).fill(null);
      this.buffers[key] = pool;
      this.cursors[key] = 0;
      for (let i = 0; i < count; i += 1) {
        const name = names[i % names.length];
        const file = name.includes('.') ? name : `${name}.ogg`;
        this.fetchClip(`${ASSET_DIRS.audio}${file}`, (buffer) => { pool[i] = buffer; });
      }
    }
    this.startAmbient();
    this.startMusic();
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
    this.stopWater();
    this.stopMusic();
    this.fire = null;
  }

  startAmbient() {
    if (!this.ctx || this.ambient) return;
    this.ambient = {};
    for (const key of AMBIENT_LAYERS) {
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      gain.connect(OUTDOOR_LAYERS.has(key) ? this.outdoor : this.master);
      this.ambient[key] = { gain, source: null, buffer: null };
      this.fetchClip(`${ASSET_DIRS.audio}${AMBIENT_FOLDER}${key}.ogg`, (buffer) => this.playLayer(key, buffer));
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

  setWaterDistances(distances) {
    for (const [key, loop] of Object.entries(WATER_LOOPS)) {
      const value = distances && Number.isFinite(distances[key]) ? Math.max(0, distances[key]) : Infinity;
      let target = 0;
      if (value <= loop.near) target = 1;
      else if (value < loop.far) target = 1 - (value - loop.near) / (loop.far - loop.near);
      const water = this.water[key];
      if (water) water.target = target;
      if (target <= 0) continue;
      this.ensureWater(key);
      if (!this.water[key]) continue;
      this.water[key].target = target;
      this.resumeWater();
    }
  }

  ensureWater(key) {
    if (!this.ctx || this.water[key]) return;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.outdoor || this.ctx.destination);
    this.water[key] = { gain, source: null, buffer: null, mix: 0, target: 0 };
    this.fetchClip(`${ASSET_DIRS.audio}${WATER_LOOPS[key].file}.ogg`, (buffer) => {
      const water = this.water[key];
      if (!water) return;
      water.buffer = buffer;
      this.resumeWater();
    });
  }

  resumeWater() {
    if (!this.ctx || this.ctx.state === 'suspended') return;
    for (const [key, water] of Object.entries(this.water)) {
      if (!water.buffer || water.source || water.target <= 0) continue;
      const source = this.ctx.createBufferSource();
      source.buffer = water.buffer;
      source.loop = true;
      source.connect(water.gain);
      source.start();
      water.source = source;
      this.applyWaterGain(key);
    }
  }

  stopWater() {
    for (const water of Object.values(this.water)) {
      if (water.source) water.source.stop();
      water.source = null;
    }
  }

  applyWaterGain(key) {
    const water = this.water[key];
    if (!water || !this.ctx) return;
    const level = this.ambientVolume * WATER_LOOPS[key].level * water.mix;
    water.gain.gain.setTargetAtTime(level, this.ctx.currentTime, WATER_FADE_SECONDS / 3);
  }

  waterMix(keys = Object.keys(this.water)) {
    let mix = 0;
    for (const key of keys) mix = Math.max(mix, this.water[key] ? this.water[key].mix : 0);
    return mix;
  }

  musicLevel() {
    return this.musicVolume * this.masterVolume * MUSIC_LEVEL;
  }

  startMusic() {
    if (this.music || this.musicVolume <= 0) return;
    const element = document.createElement('audio');
    element.preload = 'auto';
    element.style.display = 'none';
    element.addEventListener('ended', () => this.playNextTrack());
    element.addEventListener('error', () => this.playNextTrack());
    document.body.appendChild(element);
    this.music = element;
    this.playNextTrack();
  }

  playNextTrack() {
    const element = this.music;
    if (!element || !MUSIC_TRACKS.length) return;
    const next = this.pickTrack();
    this.musicTrack = next;
    this.musicMix = 0;
    element.volume = 0;
    element.src = `${ASSET_DIRS.audio}${MUSIC_TRACKS[next]}.ogg`;
    const started = element.play();
    if (started && started.catch) started.catch(() => {});
  }

  pickTrack() {
    if (MUSIC_TRACKS.length < 2) return 0;
    let index = Math.floor(Math.random() * MUSIC_TRACKS.length);
    if (index === this.musicTrack) index = (index + 1) % MUSIC_TRACKS.length;
    return index;
  }

  resumeMusic() {
    if (!this.music) {
      this.startMusic();
      return;
    }
    if (!this.music.paused || !this.music.currentSrc) return;
    const started = this.music.play();
    if (started && started.catch) started.catch(() => {});
  }

  stopMusic() {
    const element = this.music;
    this.music = null;
    this.musicMix = 0;
    this.musicTrack = -1;
    if (!element) return;
    element.pause();
    element.removeAttribute('src');
    if (element.parentNode) element.parentNode.removeChild(element);
  }

  setMusicVolume(value) {
    this.musicVolume = Math.max(0, Math.min(1, value));
    if (this.musicVolume > 0 && !this.music) this.startMusic();
  }

  updateMusic(dt) {
    const element = this.music;
    if (!element) return;
    const left = Number.isFinite(element.duration) ? element.duration - element.currentTime : Infinity;
    const target = left <= MUSIC_FADE_SECONDS ? 0 : this.musicLevel();
    const step = dt / MUSIC_FADE_SECONDS;
    if (this.musicMix < target) this.musicMix = Math.min(target, this.musicMix + step);
    else if (this.musicMix > target) this.musicMix = Math.max(target, this.musicMix - step);
    const volume = Math.max(0, Math.min(1, this.musicMix));
    if (Math.abs(element.volume - volume) > 0.002) element.volume = volume;
  }

  setMasterVolume(value) {
    this.masterVolume = Math.max(0, Math.min(1, value));
    if (this.master) this.master.gain.value = this.masterVolume;
  }

  setAmbientVolume(value) {
    this.ambientVolume = Math.max(0, Math.min(1, value));
    this.applyLayerGains();
    for (const key of Object.keys(this.water)) this.applyWaterGain(key);
  }

  setDayness(dayness) {
    this.dayT = Math.max(0, Math.min(1, dayness));
    this.ambientTarget = this.ambientTargets();
  }

  setIndoor(indoor) {
    this.indoor = Math.max(0, Math.min(1, Number(indoor) || 0));
    this.ambientTarget = this.ambientTargets();
  }

  setSheltered(amount) {
    this.sheltered = Math.max(0, Math.min(1, Number(amount) || 0));
    this.applyShelter();
  }

  applyShelter() {
    if (!this.outdoor || !this.ctx) return;
    const cutoff = OPEN_CUTOFF * Math.pow(SHELTER_CUTOFF / OPEN_CUTOFF, this.sheltered);
    const level = 1 - (1 - SHELTER_LEVEL) * this.sheltered;
    this.outdoorFilter.frequency.setTargetAtTime(cutoff, this.ctx.currentTime, SHELTER_SMOOTHING);
    this.outdoor.gain.setTargetAtTime(level, this.ctx.currentTime, SHELTER_SMOOTHING);
  }

  ambientTargets() {
    const t = this.dayT;
    const out = 1 - this.indoor;
    return { forest_day: t * out, forest_night: (1 - t) * out, cave: this.indoor };
  }

  applyLayerGains() {
    if (!this.ambient || !this.ctx) return;
    const nearWater = this.waterMix();
    const duck = 1 - FOREST_DUCK * Math.sqrt(nearWater);
    const level = this.ambientVolume * this.ambientBoost * duck;
    const smoothing = nearWater > 0 ? WATER_FADE_SECONDS : AMBIENT_FADE_SECONDS;
    for (const key of AMBIENT_LAYERS) {
      const layer = this.ambient[key];
      if (!layer) continue;
      layer.gain.gain.setTargetAtTime(this.ambientMix[key] * level, this.ctx.currentTime, smoothing / 3);
    }
  }

  update(dt) {
    this.updateMusic(dt);
    this.updateLife(dt);
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
    for (const [key, water] of Object.entries(this.water)) {
      const diff = water.target - water.mix;
      if (diff === 0) continue;
      water.mix = Math.abs(diff) < 0.005 ? water.target : water.mix + diff * Math.min(1, dt / WATER_FADE_SECONDS);
      this.applyWaterGain(key);
      changed = true;
    }
    if (changed) this.applyLayerGains();
  }

  updateLife(dt) {
    if (!this.ctx || this.ambientVolume <= 0) return;
    const outside = this.indoor < 0.5;
    const when = !outside ? 'cave' : (this.dayT >= 0.5 ? 'day' : 'night');
    LIFE_CALLS.forEach((call, index) => {
      this.lifeTimers[index] -= dt;
      if (this.lifeTimers[index] > 0) return;
      this.lifeTimers[index] = between(call.every);
      const inside = call.when === 'shelter';
      if (inside ? this.sheltered < 0.5 : ![].concat(call.when).includes(when)) return;
      if (call.freshWater && this.waterMix(['river', 'lake']) < call.freshWater) return;
      if (call.sea && this.waterMix(['sea']) < call.sea) return;
      this.play(call.key, { gain: this.ambientVolume, pan: (Math.random() * 2 - 1) * LIFE_PAN, outdoor: !inside && call.when !== 'cave' });
    });
  }

  distanceGain(cfg, distance) {
    if (!Number.isFinite(distance)) return 1;
    const hearing = cfg.hearing || DEFAULT_HEARING;
    const near = Math.max(0, 1 - distance / hearing);
    return near * near;
  }

  play(key, options = {}) {
    if (!this.available || !this.ctx) return;
    const pool = this.buffers[key];
    if (!pool) return;
    const cfg = VOICES[key];
    if (cfg.with) this.play(cfg.with, options);
    const chance = Number.isFinite(options.chance) ? options.chance : cfg.chance;
    if (Number.isFinite(chance) && Math.random() > chance) return;
    const distanceGain = this.distanceGain(cfg, options.distance);
    if (distanceGain <= SILENT_GAIN) return;
    const index = this.cursors[key] % pool.length;
    this.cursors[key] = (this.cursors[key] + 1) % pool.length;
    const buffer = pool[index];
    if (!buffer) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const gain = this.ctx.createGain();
    gain.gain.value = cfg.volume * (options.gain || 1) * distanceGain;
    const panner = options.pan && this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    const out = (options.outdoor && this.outdoor) || this.master || this.ctx.destination;
    if (panner) {
      panner.pan.value = Math.max(-1, Math.min(1, options.pan));
      panner.connect(out);
      gain.connect(panner);
    } else {
      gain.connect(out);
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = 1 + (Math.random() * 2 - 1) * cfg.pitch;
    source.connect(gain);
    source.onended = () => {
      gain.disconnect();
      if (panner) panner.disconnect();
    };
    source.start();
  }
}

function between(range) {
  return range[0] + Math.random() * (range[1] - range[0]);
}
