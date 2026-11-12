// Část vodního systému: vodopády — padající clona, pěna pod ní a mlha tam, kde řeka spadne přes útes.
// Patří k WaterSystem (sdílí jeho this); jen ho dělí, aby hlavní soubor zůstal přehledný.
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import { CELL_SIZE } from '../../utils/gridMath.js';
import { fireParticleTexture } from '../../effects/fireParticles.js';
import { createWaterfallMaterial } from './waterfallShader.js';
import { WATER_SINK, FLOW_TIME_WRAP } from './waterSettings.js';

const FALL_SPAN = 0.9;
const FALL_ROWS = 10;
const FALL_COLUMN = 0.5;
const FALL_OUT = 0.2;
const FALL_LEAN = 0.35;
const FALL_LEAN_PER_METER = 0.06;
const POOL_LENGTH = 2.4;
const POOL_WIDEN = 1.3;
const POOL_IMPACT = 0.35;
const POOL_LIFT = 0.03;
const MIST_CAPACITY = 140;
const MIST_RATE = 6;

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

    const cols = Math.max(2, Math.ceil(width / FALL_COLUMN));
    const positions = [];
    const uvs = [];
    for (let row = 0; row <= FALL_ROWS; row += 1) {
      const t = row / FALL_ROWS;
      const forward = FALL_OUT + lean * t * t;
      for (let col = 0; col <= cols; col += 1) {
        const s = col / cols;
        const [x, z] = at(forward, (s - 0.5) * width);
        positions.push(x, top - length * t, z);
        uvs.push(s * width, length * t);
      }
    }
    const curtain = gridMesh(`waterfall${index}`, this.s, positions, uvs, cols, FALL_ROWS);
    const curtainMaterial = createWaterfallMaterial(this.s, {
      waterColor: colors.shallowColor, foamColor: colors.foamColor, width, length, pool: false,
    });
    curtain.material = curtainMaterial;

    const impact = FALL_OUT + lean;
    const poolWidth = width * POOL_WIDEN;
    const start = Math.max(0.05, impact - POOL_LENGTH * POOL_IMPACT);
    const poolPositions = [];
    const poolUvs = [];
    for (const forward of [start, start + POOL_LENGTH]) {
      for (const across of [-poolWidth / 2, poolWidth / 2]) {
        const [x, z] = at(forward, across);
        poolPositions.push(x, bottom + POOL_LIFT, z);
        poolUvs.push(across, forward - start);
      }
    }
    const pool = gridMesh(`waterfallPool${index}`, this.s, poolPositions, poolUvs, 1, 1);
    const poolMaterial = createWaterfallMaterial(this.s, {
      waterColor: colors.shallowColor, foamColor: colors.foamColor, width: poolWidth, length: POOL_LENGTH, pool: true,
    });
    pool.material = poolMaterial;

    const [mistX, mistZ] = at(impact, 0);
    const mist = new ParticleSystem(`waterfallMist${index}`, MIST_CAPACITY, this.s);
    if (!this.mistTexture) this.mistTexture = fireParticleTexture(this.s, 'waterfallMistDot');
    mist.particleTexture = this.mistTexture;
    mist.emitter = new Vector3(mistX, bottom + 0.1, mistZ);
    mist.minEmitBox = new Vector3(-width * 0.4, 0, -width * 0.4);
    mist.maxEmitBox = new Vector3(width * 0.4, 0.3, width * 0.4);
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
    if (!this.hidden) mist.start();
    curtain.setEnabled(!this.hidden);
    pool.setEnabled(!this.hidden);
    return { curtain, pool, curtainMaterial, poolMaterial, mist };
  },

  showFalls(visible) {
    for (const fall of this.falls) {
      fall.curtain.setEnabled(visible);
      fall.pool.setEnabled(visible);
      if (visible) fall.mist.start();
      else fall.mist.stop();
    }
  },

  updateFalls() {
    const time = this.time % FLOW_TIME_WRAP;
    for (const fall of this.falls) {
      for (const material of [fall.curtainMaterial, fall.poolMaterial]) {
        material.setFloat('fallTime', time);
        material.setFloat('dayness', this.dayness);
      }
    }
  },

  fallMeshes() {
    const list = [];
    for (const fall of this.falls) list.push(fall.curtain, fall.pool);
    return list;
  },
};
