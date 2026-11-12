// Část terénu: skalní mosty — plán mostu mezi břehy, jeho stavba a výška pochozí plochy.
// Patří k TerrainSystem (sdílí jeho this); jen ho dělí, aby hlavní soubor zůstal přehledný.
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { CELL_SIZE, worldToCellCoords } from '../../utils/gridMath.js';
import { buildBridge, deckHeightAt, bridgeSpan, bridgeCellOf, BRIDGE_BURIAL, BRIDGE_RISE } from '../../utils/bridgeShape.js';
import { DEFAULT_FLOOR } from '../../data/catalogs/decorations.js';
import { valueNoise, smoothstep } from '../../utils/noise.js';
import { SURFACE_SUB, WALL_TILE, SURFACE_VERTEX_TINT, pointId } from './terrainSettings.js';

function cliffTint(gx, gz, y, t, tone, push, rim) {
  const grain = valueNoise(gx * 0.37 + 4.1, gz * 0.37 - 2.3);
  const stripe = 0.5 + 0.5 * Math.sin(y * 0.95 + grain * 3.1);
  const base = 0.70 + (tone - 0.70) * Math.pow(t, 0.62);
  const moss = smoothstep(0.68, 0.95, t + (grain - 0.5) * 0.18) * (0.35 + 0.65 * grain);
  const contact = 0.62 + 0.38 * smoothstep(0.02, 0.26, t);
  const relief = 1 - 0.50 * Math.max(0, -push) + 0.14 * Math.max(0, push);
  const shade = base * (0.88 + 0.14 * grain) * (0.88 + 0.16 * stripe) * contact * relief;
  const lip = smoothstep(0.88, 1, t + (grain - 0.5) * 0.04) * 0.80;
  const r = shade * (1 - 0.10 * moss);
  const g = shade * (1 + 0.02 * moss);
  const b = shade * (1 - 0.16 * moss);
  return {
    r: r + (rim[0] - r) * lip,
    g: g + (rim[1] - g) * lip,
    b: b + (rim[2] - b) * lip,
    moss,
  };
}

export default {
  bridgePlansFor(map, keyAt, positionOf, weldedAt) {
    const records = this.layout && Array.isArray(this.layout.bridges) ? this.layout.bridges : [];
    const plans = [];
    for (const record of records) {
      const plan = this.bridgePlanFor(map, record, keyAt, positionOf, weldedAt);
      if (plan) plans.push(plan);
    }
    return plans;
  },

  bridgePlanFor(map, record, keyAt, positionOf, weldedAt) {
    const span = bridgeSpan(record);
    if (!span) return null;
    const { axis, from, to, center, vFrom, vTo } = span;
    const alongX = axis === 'x';
    const cellOf = (bankCell, vCell) => bridgeCellOf(span, bankCell, vCell);
    const samplesFor = (bankCell, uPlane) => {
      const samples = [];
      for (let vCell = vFrom; vCell <= vTo; vCell += 1) {
        const [cx, cz] = cellOf(bankCell, vCell);
        if (!keyAt(cx, cz)) return null;
        for (let i = 0; i <= SURFACE_SUB; i += 1) {
          const v = vCell * CELL_SIZE - CELL_SIZE / 2 + (CELL_SIZE * i) / SURFACE_SUB;
          const point = alongX ? { gx: uPlane, gz: v } : { gx: v, gz: uPlane };
          const pos = positionOf(point);
          const weldedValue = weldedAt(pointId(point.gx, point.gz), cx, cz);
          const y = weldedValue === null ? this.field.heightAtSide(pos.px, pos.pz, cx, cz) : weldedValue;
          samples.push({ u: alongX ? pos.px : pos.pz, v: alongX ? pos.pz : pos.px, y });
        }
      }
      return samples;
    };
    for (let vCell = vFrom; vCell <= vTo; vCell += 1) {
      for (let bankCell = from + 1; bankCell <= to - 1; bankCell += 1) {
        const [cx, cz] = cellOf(bankCell, vCell);
        if (!keyAt(cx, cz)) return null;
      }
    }
    const u0 = from * CELL_SIZE + CELL_SIZE / 2;
    const u1 = to * CELL_SIZE - CELL_SIZE / 2;
    const v0 = vFrom * CELL_SIZE - CELL_SIZE / 2;
    const v1 = vTo * CELL_SIZE + CELL_SIZE / 2;
    const bankA = samplesFor(from, u0);
    const bankB = samplesFor(to, u1);
    if (!bankA || !bankB) return null;
    let uMin = Infinity;
    let uMax = -Infinity;
    for (const sample of bankA) {
      if (sample.u < uMin) uMin = sample.u;
      if (sample.u > uMax) uMax = sample.u;
    }
    for (const sample of bankB) {
      if (sample.u < uMin) uMin = sample.u;
      if (sample.u > uMax) uMax = sample.u;
    }
    const mid = Math.floor((bankA.length - 1) / 2);
    let low = Infinity;
    for (const sample of bankA) low = Math.min(low, sample.y);
    for (const sample of bankB) low = Math.min(low, sample.y);
    const centerU = (u0 + u1) / 2;
    const centerV = (v0 + v1) / 2;
    const gapX = alongX ? centerU : centerV;
    const gapZ = alongX ? centerV : centerU;
    const gapGround = this.heightAt(gapX, gapZ);
    const gapCell = worldToCellCoords(gapX, gapZ);
    const waterLevel = this.waterAtCell(gapCell.cx, gapCell.cz);
    let springing = gapGround + 0.45;
    if (waterLevel !== null && gapGround < waterLevel) springing = waterLevel + 0.35;
    const deckMid = (bankA[mid].y + bankB[mid].y) / 2 + BRIDGE_RISE;
    springing = Math.min(springing, deckMid - 1.6);
    springing = Math.min(springing, low - 0.4);
    const opening = Math.max(0.9, deckMid - springing);
    const thickness = Math.min(4.2, Math.max(1.1, opening * 0.3));
    const crown = Math.max(springing + 0.2, low - thickness);
    const [bankAX, bankAZ] = cellOf(from, center);
    const [bankBX, bankBZ] = cellOf(to, center);
    const key = keyAt(bankAX, bankAZ) || DEFAULT_FLOOR;
    const cfg = this.surfaceConfig(key);
    const rimSource = this.surfaceColor(key, map);
    const plan = {
      axis,
      u0,
      u1,
      v0,
      v1,
      bankA,
      bankB,
      springing,
      crown,
      burial: BRIDGE_BURIAL,
      tile: (cfg && cfg.tile) || 1,
      wallTile: WALL_TILE,
      key,
      style: record.style === 'dirt' || record.style === 'stone'
        ? record.style
        : (this.field.cliffStyleAt(bankAX, bankAZ) === 'stone' || this.field.cliffStyleAt(bankBX, bankBZ) === 'stone' ? 'stone' : 'dirt'),
      rim: [rimSource.r * 0.5, rimSource.g * 0.66, rimSource.b * 0.4],
      groundAt: (x, z) => this.heightAt(x, z),
      rect: alongX
        ? { x0: uMin, x1: uMax, z0: v0, z1: v1 }
        : { x0: v0, x1: v1, z0: uMin, z1: uMax },
    };
    plan.deckAt = (x, z) => deckHeightAt(plan, alongX ? x : z, alongX ? z : x);
    return plan;
  },

  createBridges(map, blends) {
    for (let index = 0; index < this.bridges.length; index += 1) {
      const plan = this.bridges[index];
      const built = buildBridge({
        ...plan,
        tint: SURFACE_VERTEX_TINT,
        shade: (x, y, z, t) => cliffTint(x, z, y, t, 0.9, 0, plan.rim),
      });
      if (built.deck.positions.length) {
        const mesh = new Mesh(`terrainBridgeDeck_${index}`, this.s);
        const data = new VertexData();
        data.positions = built.deck.positions;
        data.indices = built.deck.indices;
        data.uvs = built.deck.uvs;
        data.colors = built.deck.colors;
        data.normals = [];
        VertexData.ComputeNormals(data.positions, data.indices, data.normals);
        data.applyToMesh(mesh);
        mesh.isPickable = false;
        mesh.receiveShadows = true;
        mesh.material = this.materialFor(plan.key, map, blends.get(plan.key));
        this.surfaces.push(mesh);
      }
      if (built.rock.positions.length) {
        const mesh = new Mesh(`terrainBridgeRock_${index}`, this.s);
        const data = new VertexData();
        data.positions = built.rock.positions;
        data.indices = built.rock.indices;
        data.uvs = built.rock.uvs;
        data.colors = built.rock.colors;
        data.normals = [];
        VertexData.ComputeNormals(data.positions, data.indices, data.normals);
        data.applyToMesh(mesh);
        mesh.setVerticesData('mossMask', new Float32Array(built.rock.moss), false, 1);
        mesh.isPickable = false;
        mesh.receiveShadows = true;
        mesh.metadata = { shadowAlways: true };
        mesh.material = this.cliffMaterialFor(plan.style);
        this.surfaces.push(mesh);
      }
    }
  },

  bridgeDeckAt(x, z) {
    for (const plan of this.bridges) {
      const rect = plan.rect;
      if (x < rect.x0 || x > rect.x1 || z < rect.z0 || z > rect.z1) continue;
      return plan.deckAt(x, z);
    }
    return null;
  },
};
