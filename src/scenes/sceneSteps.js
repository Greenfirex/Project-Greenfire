// Část herní scény: kroky hráče a tvorů — zvuk podle povrchu, šplouchnutí ve vodě, stopy
// a rozstřik písku, když se tvor zahrabává nebo vyhrabává.
// Patří ke GameScene (sdílí její this); jen ji dělí, aby hlavní soubor zůstal přehledný.
import { worldToCell } from '../utils/gridMath.js';
import { WATER_STEP_DEPTH } from './sceneSettings.js';

const FOOTPRINT_WATER_DEPTH = 0.35;

function surfaceStepSound(key) {
  const name = String(key || '').toLowerCase();
  if (/wood|plank|bridge|deck|board/.test(name)) return 'stepWood';
  if (/path|stone|rock|cobble|brick|tile|pavement|gravel/.test(name)) return 'stepStone';
  if (/sand/.test(name)) return 'stepSand';
  return 'stepGrass';
}

export default {
  onPlayerStep(x, z, sprint) {
    const onBridge = this.terrainSystem && this.terrainSystem.bridgeDeckAt(x, z) !== null;
    const inWater = !onBridge && this.waterDepthNowAt(x, z) > WATER_STEP_DEPTH;
    const key = this.groundKeyAt(worldToCell(x), worldToCell(z));
    this.audioSystem.play(inWater ? 'stepWater' : surfaceStepSound(key), { gain: sprint ? 1.35 : 1 });
  },

  groundKeyAt(cx, cz) {
    const buildingKey = this.buildingSystem.floorKeyAt(cx, cz) || '';
    const pathKey = this.decoSystem.surfaceKeyAt(cx, cz) || '';
    const floorKey = this.terrainSystem.floorKeyAt ? this.terrainSystem.floorKeyAt(cx, cz) : null;
    return buildingKey || pathKey || floorKey || '';
  },

  onCreatureStep(creature, step) {
    if (!creature || !creature.type) return;
    const footprint = creature.type.footprint || {};
    const tierScale = creature.tier && Number.isFinite(creature.tier.scale) ? creature.tier.scale : 1;
    const scale = (Number.isFinite(footprint.scale) ? footprint.scale : 0.85) * tierScale;
    const angle = creature.holder && Number.isFinite(creature.holder.rotation.y)
      ? creature.holder.rotation.y
      : (Number.isFinite(creature.renderFacing) ? creature.renderFacing : (Number.isFinite(creature.facing) ? creature.facing : 0)) + (creature.type.yawOffset || 0);
    const kind = footprint.kind || 'turtle';
    const feet = Array.isArray(footprint.feet) ? footprint.feet : null;
    if (feet && feet.length) {
      const order = Array.isArray(footprint.order) && footprint.order.length
        ? footprint.order
        : feet.map((_, index) => index);
      const foot = feet[order[step % order.length]];
      if (!foot) return;
      const lateral = (Number(foot.side) || 0) * tierScale;
      const forward = (Number(foot.forward) || 0) * tierScale;
      const x = creature.x + Math.cos(angle) * lateral + Math.sin(angle) * forward;
      const z = creature.z - Math.sin(angle) * lateral + Math.cos(angle) * forward;
      this.footfall(x, z, angle, scale, kind, 0.45 + scale);
      return;
    }
    const offset = Number.isFinite(footprint.offset) ? footprint.offset : 0.22;
    const direction = step % 2 === 0 ? 1 : -1;
    const x = creature.x + Math.cos(angle + Math.PI / 2) * offset * tierScale * direction;
    const z = creature.z + Math.sin(angle + Math.PI / 2) * offset * tierScale * direction;
    this.footfall(x, z, angle, scale, kind, 0.45 + scale);
  },

  onCreatureDig(creature) {
    if (!creature || !Number.isFinite(creature.x) || !Number.isFinite(creature.z)) return;
    const tierScale = creature.tier && Number.isFinite(creature.tier.scale) ? creature.tier.scale : 1;
    const y = this.creatureSystem.groundAt(creature.x, creature.z, creature.level);
    this.sandBursts.burst(creature.x, y, creature.z, tierScale, creature.emergeSeconds);
  },

  footfall(x, z, angle, scale, kind, strength = 1) {
    this.stepSplash(x, z, strength);
    this.spawnFootprint(x, z, angle, scale, kind);
  },

  stepSplash(x, z, strength) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    if (this.terrainSystem && this.terrainSystem.bridgeDeckAt(x, z) !== null) return;
    if (this.waterDepthNowAt(x, z) <= WATER_STEP_DEPTH) return;
    this.waterSystem.splash(x, z, strength);
  },

  spawnFootprint(x, z, angle, scale, kind = 'human') {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    if (this.terrainSystem && this.terrainSystem.bridgeDeckAt(x, z) !== null) return;
    const cx = worldToCell(x);
    const cz = worldToCell(z);
    const key = this.groundKeyAt(cx, cz);
    if (!/sand/i.test(key)) return;
    const depth = this.waterDepthNowAt(x, z);
    if (depth > FOOTPRINT_WATER_DEPTH) return;
    const y = this.terrainSystem.walkHeightAt(x, z) + 0.025;
    this.footprintSystem.spawn({ x, y, z, angle, scale, kind, wet: depth > WATER_STEP_DEPTH });
  },
};
