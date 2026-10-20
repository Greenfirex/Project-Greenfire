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
    this.tickCount = 0;
    this.speed = 1;
    this.halted = false;
    this.subscribers = [];
    this.onTick = null;
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
    this.tickCount += 1;
    for (const fn of this.subscribers) fn(TICK_SECONDS, this.time);
    if (this.onTick) this.onTick(this.time);
  }
}
