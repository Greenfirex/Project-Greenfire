// Simulace hry — pevný tik 10× za sekundu, nezávislý na snímcích.
// Mechaniky se hlásí přes subscribe(); simulace o jejich obsahu nic neví.
const TICK_SECONDS = 0.1;
const MAX_TICKS_PER_FRAME = 5;
const SPEEDS = [1, 2, 5, 10];

export default class SimSystem {

  constructor(scene) {
    this.s = scene;
    this.acc = 0;
    this.time = 0;
    this.speed = 1;
    this.halted = false;
    this.subscribers = [];
  }

  subscribe(fn) {
    if (typeof fn === 'function') this.subscribers.push(fn);
  }

  setSpeed(value) {
    const speed = Number(value);
    this.speed = SPEEDS.includes(speed) ? speed : 1;
    this.acc = 0;
  }

  setHalted(on) {
    this.halted = Boolean(on);
    this.acc = 0;
  }

  resetAccumulator() {
    this.acc = 0;
  }

  serialize() {
    return { time: this.time, speed: this.speed };
  }

  apply(data) {
    const time = data && typeof data.time === 'number' && Number.isFinite(data.time) && data.time >= 0 ? data.time : 0;
    this.time = time;
    this.setSpeed(data && data.speed !== undefined ? data.speed : 1);
  }

  defaultState() {
    return { time: 0, speed: 1 };
  }

  update(deltaSeconds) {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;
    if (this.halted) return;
    this.acc += deltaSeconds * this.speed;
    let ticks = 0;
    while (this.acc >= TICK_SECONDS && ticks < MAX_TICKS_PER_FRAME) {
      this.acc -= TICK_SECONDS;
      ticks += 1;
      this.runTick();
    }
    if (ticks >= MAX_TICKS_PER_FRAME) this.acc = 0;
  }

  runTick() {
    this.time += TICK_SECONDS;
    for (const fn of this.subscribers) fn(TICK_SECONDS, this.time);
  }
}
