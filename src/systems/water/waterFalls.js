// Část vodního systému: vodopády — padající clona, pěna pod ní a mlha tam, kde řeka spadne přes útes.
// Clona se přelévá přes hranu obloukem jako jazyk; mlha a kapky sílí, když proud zrovna zesílí.
// Patří k WaterSystem (sdílí jeho this); jen ho dělí, aby hlavní soubor zůstal přehledný.
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import { CELL_SIZE } from '../../utils/gridMath.js';
import { fireParticleTexture } from '../../effects/fireParticles.js';
import { createWaterfallMaterial, fallFlight, surgeAt, LIP_REACH } from './waterfallShader.js';
import { WATER_SINK, FLOW_TIME_WRAP } from './waterSettings.js';

const FALL_SPAN = 1;
const FALL_ROWS = 14;
const FALL_SPREAD = 0.25;
const FALL_WAIST = 0.04;
const FALL_BULGE = 0.15;
const FALL_TONGUE = 0.45;
const LIP_BULGE = 0.06;
const FALL_OUT = 0.2;
const LIP_ROWS = [[FALL_OUT - LIP_REACH, 0.01], [0.05, 0]];
const FALL_COLUMN = 0.3;
const TWO_PI = Math.PI * 2;
const FALL_LEAN = 0.35;
const FALL_LEAN_PER_METER = 0.06;
const POOL_LENGTH = 2.4;
const POOL_WIDEN = 1.3;
const POOL_IMPACT = 0.35;
const POOL_LIFT = 0.03;
const MIST_CAPACITY = 140;
const MIST_RATE = 6;
const SPRAY_CAPACITY = 160;
const SPRAY_RATE = 14;
const PLUNGE_REACH = 4;
const PLUNGE_CORE = 0.8;
const PLUNGE_SPEED = 1.4;
const PLUNGE_LEVEL_GAP = 0.3;

function gridMesh(name, scene, positions, uvs, cols, rows) {
  const indices = [];
  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < cols; i += 1) {
      const a = j * (cols + 1) + i;
      const b = a + 1;
      const c = a + cols + 2;
      const d = a + cols + 1;
      indices.push(a, c, b, a, d, c);
    }
  }
  const mesh = new Mesh(name, scene);
  const data = new VertexData();
  data.positions = positions;
  data.uvs = uvs;
  data.indices = indices;
  data.applyToMesh(mesh);
  mesh.isPickable = false;
  mesh.alphaIndex = 3;
  return mesh;
}

export default {
  buildFalls(falls) {
    this.clearFalls();
    for (const fall of falls || []) this.falls.push(this.buildFall(fall, this.falls.length));
  },

  clearFalls() {
    for (const fall of this.falls) {
      for (const mesh of [fall.curtain, fall.pool]) {
        if (!mesh.isDisposed()) mesh.dispose(false, false);
      }
      fall.curtainMaterial.dispose(false, false);
      fall.poolMaterial.dispose(false, false);
      fall.mist.dispose(false);
      fall.spray.dispose(false);
    }
    this.falls = [];
  },

  buildFall(fall, index) {
    const half = CELL_SIZE / 2;
    const sideX = -fall.dz;
    const sideZ = fall.dx;
    const lipX = fall.cx * CELL_SIZE + fall.dx * half;
    const lipZ = fall.cz * CELL_SIZE + fall.dz * half;
    const at = (forward, across) => [lipX + fall.dx * forward + sideX * across, lipZ + fall.dz * forward + sideZ * across];
    const width = fall.width * CELL_SIZE * FALL_SPAN;
    const top = fall.top - WATER_SINK;
    const bottom = fall.bottom - WATER_SINK;
    const length = top - bottom;
    const lean = FALL_LEAN + FALL_LEAN_PER_METER * length;
    const colors = this.colorOptions();

    const seed = (((fall.cx * 12.9898 + fall.cz * 78.233) % TWO_PI) + TWO_PI) % TWO_PI;
    const cols = Math.max(2, Math.ceil(width / FALL_COLUMN));
    const positions = [];
    const uvs = [];
    const addRow = (forwardAt, y, down, rowWidth) => {
      for (let col = 0; col <= cols; col += 1) {
        const s = col / cols;
        const [x, z] = at(forwardAt(1 - (2 * s - 1) ** 2), (s - 0.5) * rowWidth);
        positions.push(x, y, z);
        uvs.push(s, down);
      }
    };
    for (const [forward, drop] of LIP_ROWS) addRow((arch) => forward + arch * LIP_BULGE * Math.max(0, forward) / FALL_OUT, top + drop, forward - FALL_OUT, width);
    for (let row = 0; row <= FALL_ROWS; row += 1) {
      const t = row / FALL_ROWS;
      const rowWidth = width * (1 + FALL_SPREAD * t - FALL_WAIST * Math.sin(Math.PI * Math.min(1, t * 1.6)));
      const forwardAt = (arch) => FALL_OUT + arch * (LIP_BULGE + FALL_BULGE * Math.min(1, t * 4)) + lean * t * t * (1 - FALL_TONGUE * (1 - arch));
      addRow(forwardAt, top - length * t, length * t, rowWidth);
    }
    const curtain = gridMesh(`waterfall${index}`, this.s, positions, uvs, cols, FALL_ROWS + LIP_ROWS.length);
    const curtainMaterial = createWaterfallMaterial(this.s, {
      waterColor: colors.shallowColor, foamColor: colors.foamColor, width, length, drop: length, spread: FALL_SPREAD,
      dirX: fall.dx, dirZ: fall.dz, seed, pool: false,
    });
    curtain.material = curtainMaterial;

    const impact = FALL_OUT + LIP_BULGE + FALL_BULGE + lean;
    const poolWidth = width * (1 + FALL_SPREAD) * POOL_WIDEN;
    const poolLength = Math.min(POOL_LENGTH, impact + CELL_SIZE * 0.9);
    const start = Math.max(0.05, impact - poolLength * POOL_IMPACT);
    const poolPositions = [];
    const poolUvs = [];
    for (const forward of [start, start + poolLength]) {
      for (const across of [-poolWidth / 2, poolWidth / 2]) {
        const [x, z] = at(forward, across);
        poolPositions.push(x, bottom + POOL_LIFT, z);
        poolUvs.push(across, forward - start);
      }
    }
    const pool = gridMesh(`waterfallPool${index}`, this.s, poolPositions, poolUvs, 1, 1);
    const poolMaterial = createWaterfallMaterial(this.s, {
      waterColor: colors.shallowColor, foamColor: colors.foamColor, width: poolWidth, length: poolLength, drop: length,
      impact: impact - start, dirX: fall.dx, dirZ: fall.dz, seed, pool: true,
    });
    pool.material = poolMaterial;

    const [mistX, mistZ] = at(impact, 0);
    if (!this.mistTexture) this.mistTexture = fireParticleTexture(this.s, 'waterfallMistDot');
    const impactBox = (height) => [new Vector3(-width * 0.4, 0, -width * 0.4), new Vector3(width * 0.4, height, width * 0.4)];
    const mist = new ParticleSystem(`waterfallMist${index}`, MIST_CAPACITY, this.s);
    mist.particleTexture = this.mistTexture;
    mist.emitter = new Vector3(mistX, bottom + 0.1, mistZ);
    [mist.minEmitBox, mist.maxEmitBox] = impactBox(0.3);
    mist.color1 = new Color4(1, 1, 1, 0.32);
    mist.color2 = new Color4(0.85, 0.95, 1, 0.22);
    mist.colorDead = new Color4(1, 1, 1, 0);
    mist.minSize = 0.4;
    mist.maxSize = 1.1;
    mist.minLifeTime = 0.8;
    mist.maxLifeTime = 1.8;
    mist.emitRate = MIST_RATE * length * fall.width;
    mist.minEmitPower = 0.4;
    mist.maxEmitPower = 1.2;
    mist.direction1 = new Vector3(fall.dx * 0.6 - 0.4, 1, fall.dz * 0.6 - 0.4);
    mist.direction2 = new Vector3(fall.dx * 0.6 + 0.4, 1.6, fall.dz * 0.6 + 0.4);
    mist.gravity = new Vector3(0, -0.6, 0);
    mist.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    mist.updateSpeed = 0.01;

    const spray = new ParticleSystem(`waterfallSpray${index}`, SPRAY_CAPACITY, this.s);
    spray.particleTexture = this.mistTexture;
    spray.emitter = new Vector3(mistX, bottom + 0.05, mistZ);
    [spray.minEmitBox, spray.maxEmitBox] = impactBox(0.1);
    spray.color1 = new Color4(1, 1, 1, 0.75);
    spray.color2 = new Color4(0.85, 0.95, 1, 0.55);
    spray.colorDead = new Color4(1, 1, 1, 0);
    spray.minSize = 0.05;
    spray.maxSize = 0.14;
    spray.minLifeTime = 0.35;
    spray.maxLifeTime = 0.75;
    spray.emitRate = SPRAY_RATE * Math.min(length, 4) * fall.width;
    spray.minEmitPower = 1.2;
    spray.maxEmitPower = 2.4;
    spray.direction1 = new Vector3(fall.dx * 0.8 - 0.7, 1.6, fall.dz * 0.8 - 0.7);
    spray.direction2 = new Vector3(fall.dx * 1.4 + 0.7, 2.6, fall.dz * 1.4 + 0.7);
    spray.gravity = new Vector3(0, -9.8, 0);
    spray.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    spray.updateSpeed = 0.01;

    if (!this.hidden) {
      mist.start();
      spray.start();
    }
    curtain.setEnabled(!this.hidden);
    pool.setEnabled(!this.hidden);
    return {
      curtain, pool, curtainMaterial, poolMaterial, mist, spray,
      x: lipX, z: lipZ, halfWidth: width / 2, impactX: mistX, impactZ: mistZ, level: fall.bottom,
      seed, landing: fallFlight(length), mistRate: mist.emitRate, sprayRate: spray.emitRate,
    };
  },

  addPlungeFlow(flows, vertex, x, z, level) {
    for (const fall of this.falls) {
      if (Math.abs(level - fall.level) > PLUNGE_LEVEL_GAP) continue;
      const outX = x - fall.impactX;
      const outZ = z - fall.impactZ;
      const distance = Math.hypot(outX, outZ);
      if (distance >= PLUNGE_REACH || distance < 1e-4) continue;
      const reach = 1 - distance / PLUNGE_REACH;
      const weight = reach * reach * (3 - 2 * reach);
      const speed = PLUNGE_SPEED * weight * Math.min(1, distance / PLUNGE_CORE) / distance;
      const at = vertex * 3;
      flows[at] = flows[at] * (1 - weight) + outX * speed;
      flows[at + 1] = flows[at + 1] * (1 - weight) + outZ * speed;
    }
  },

  fallDistanceAt(x, z) {
    let best = Infinity;
    for (const fall of this.falls) {
      best = Math.min(best, Math.max(0, Math.hypot(x - fall.x, z - fall.z) - fall.halfWidth));
    }
    return best;
  },

  showFalls(visible) {
    for (const fall of this.falls) {
      fall.curtain.setEnabled(visible);
      fall.pool.setEnabled(visible);
      for (const particles of [fall.mist, fall.spray]) {
        if (visible) particles.start();
        else particles.stop();
      }
    }
  },

  updateFalls() {
    const time = this.time % FLOW_TIME_WRAP;
    const sun = this.sunLight;
    for (const fall of this.falls) {
      const surge = surgeAt(fall.landing - time, fall.seed);
      fall.mist.emitRate = fall.mistRate * (0.7 + 0.8 * surge);
      fall.spray.emitRate = fall.sprayRate * (0.5 + 1.5 * surge);
      for (const material of [fall.curtainMaterial, fall.poolMaterial]) {
        material.setFloat('fallTime', time);
        material.setFloat('dayness', this.dayness);
        if (sun) {
          material.setColor3('sunColor', sun.diffuse);
          material.setFloat('sunIntensity', sun.intensity);
        }
      }
    }
  },

  fallMeshes() {
    const list = [];
    for (const fall of this.falls) list.push(fall.curtain, fall.pool);
    return list;
  },
};
