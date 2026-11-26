// Část herní scény: přežití — hlad, žízeň a jejich efekty na postavě, a pití z jezera nebo řeky.
// Patří ke GameScene (sdílí její this); jen ji dělí, aby hlavní soubor zůstal přehledný.
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { PLAYER_BASE } from '../data/catalogs/player.js';
import { EFFECTS } from '../data/catalogs/effects.js';
import { WATER_STEP_DEPTH } from './sceneSettings.js';

const DRINK_REACH = 8;
const DRINK_WET_DEPTH = 0.03;
const DRINK_PROBE_STEP = 0.1;
const DRINK_STAND_BACK = 0.15;
const DRINK_HAND_AHEAD = 0.85;
const DRINK_HAND_LIMIT = 1.2;
const DRINK_ARRIVE_SLACK = 0.6;
const DRINK_SPLASH = 0.6;

export default {
  tickSurvival(dt) {
    if (!this.loaded || this.dying) return;
    this.survival.tick(dt, this.playerSystem.sprinting);
    const { drainPerSecond } = this.survival.mods();
    if (drainPerSecond <= 0 || !this.playerStats.drain(drainPerSecond * dt)) return;
    if (this.playerStats.health <= 0) this.onPlayerDeath(false);
  },

  applyEffects() {
    this.playerStats.setModifiers(this.survival.mods());
    this.effectsBar.set(this.survival.effects.map((key) => ({ key, ...EFFECTS[key] })));
    this.refreshProgress();
  },

  drinkTarget(cell) {
    const root = this.playerSystem.root;
    if (!cell || !cell.point || !root || this.playerSystem.level !== 0) return null;
    const { x, z } = cell.point;
    if (this.waterDepthAt(x, z) <= DRINK_WET_DEPTH) return null;
    const inReach = Math.hypot(root.position.x - x, root.position.z - z) <= DRINK_REACH;
    if (!this.waterSystem.bodyAt(x, z)) return { x, z, sea: true, detail: 'Mořská voda', inReach };
    return { x, z, detail: 'Napít se', inReach };
  },

  drinkSpot(x, z) {
    const from = this.playerSystem.root.position;
    const away = Math.hypot(from.x - x, from.z - z);
    if (away < 1e-3) return null;
    const dirX = (from.x - x) / away;
    const dirZ = (from.z - z) / away;
    let shore = null;
    if (this.waterDepthAt(from.x, from.z) > WATER_STEP_DEPTH && this.waterSystem.bodyAt(from.x, from.z)) shore = 0;
    for (let along = DRINK_PROBE_STEP; shore === null && along <= away; along += DRINK_PROBE_STEP) {
      const px = x + dirX * along;
      const pz = z + dirZ * along;
      if (this.waterDepthAt(px, pz) <= WATER_STEP_DEPTH && this.isWalkableAt(px, pz, 0)) shore = along;
    }
    if (shore === null) return null;
    const standAt = shore === 0 ? away : Math.min(away, shore + DRINK_STAND_BACK);
    const stand = { x: x + dirX * standAt, z: z + dirZ * standAt };
    let reach = DRINK_HAND_AHEAD;
    while (reach < DRINK_HAND_LIMIT && this.waterDepthAt(stand.x - dirX * reach, stand.z - dirZ * reach) <= DRINK_WET_DEPTH) reach += DRINK_PROBE_STEP;
    const handX = stand.x - dirX * reach;
    const handZ = stand.z - dirZ * reach;
    return { stand, water: new Vector3(handX, this.waterSystem.surfaceHeightAt(handX, handZ), handZ) };
  },

  startDrink(target) {
    if (target.sea) {
      this.log.add('Mořská voda se pít nedá. Najdi jezero nebo řeku.', 'info');
      return true;
    }
    if (this.drink || this.meal) return false;
    const spot = this.drinkSpot(target.x, target.z);
    if (!spot) return false;
    this.sheathWeapon('instant');
    this.drink = { spot, started: false, sipped: false };
    this.playerSystem.walkTo(spot.stand.x, spot.stand.z, () => this.kneelToDrink());
    return true;
  },

  kneelToDrink() {
    const drink = this.drink;
    const root = this.playerSystem.root;
    if (!drink || !root) return;
    const { stand, water } = drink.spot;
    const far = Math.hypot(root.position.x - stand.x, root.position.z - stand.z) > DRINK_ARRIVE_SLACK;
    if (far || !this.playerSystem.drink(water)) {
      this.drink = null;
      return;
    }
    drink.started = true;
  },

  splashDrink() {
    const water = this.drink ? this.drink.spot.water : null;
    if (!water) return;
    this.waterSystem.splash(water.x, water.z, DRINK_SPLASH);
    this.audioSystem.play('stepWater');
  },

  sipWater() {
    if (!this.drink) return;
    this.drink.sipped = true;
    this.survival.feed(0, PLAYER_BASE.drink.thirst);
  },

  updateDrink() {
    const drink = this.drink;
    if (!drink) return;
    if (!drink.started) {
      if (!this.playerSystem.autoWalk || this.dying) this.drink = null;
      return;
    }
    if (this.playerSystem.drinking()) return;
    if (drink.sipped) this.log.add('Napil ses', 'action');
    this.drink = null;
  },
};
