// Část terénu: hmota skály — boky útesů a okraje mapy a body na hranách, kam se sází rostliny.
// Patří k TerrainSystem (sdílí jeho this); jen ho dělí, aby hlavní soubor zůstal přehledný.
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { CELL_SIZE } from '../../utils/gridMath.js';
import { buildRunVolumeBuckets } from './runVolume.js';
import { valueNoise, smoothstep } from '../../utils/noise.js';
import { SURFACE_SUB, SURFACE_CHUNK, WALL_TILE, SURFACE_VERTEX_TINT, pointId } from './terrainSettings.js';

const EDGE_ANCHOR_DEPTH = 0.4;
const SURFACE_DEPTH = 1;

function wallTint(x, y, z, t) {
  const grain = valueNoise(x * 0.37 + 4.1, z * 0.37 - 2.3);
  const stripe = 0.5 + 0.5 * Math.sin(y * 0.95 + grain * 3.1);
  const base = 0.66 + 0.34 * Math.pow(t, 0.62);
  const moss = smoothstep(0.70, 0.97, t + (grain - 0.5) * 0.18) * (0.35 + 0.65 * grain);
  const contact = 0.58 + 0.42 * smoothstep(0.02, 0.26, t);
  const shade = base * (0.86 + 0.16 * grain) * (0.90 + 0.14 * stripe) * contact;
  return {
    r: shade * (1 - 0.12 * moss),
    g: shade * (1 + 0.03 * moss),
    b: shade * (1 - 0.20 * moss),
    moss,
  };
}

export default {
  createVolumeMass(map) {
    const shade = { cave: 0.62, ceiling: 0.42 };
    const buckets = buildRunVolumeBuckets(this.layout || {}, {
      chunkSize: SURFACE_CHUNK,
      cellSize: CELL_SIZE,
      tileOf: (kind, name) => {
        if (kind === 'cliff') return WALL_TILE;
        const cfg = this.surfaceConfig(name);
        return (cfg && cfg.tile) || 1;
      },
      subdivisions: SURFACE_SUB,
      depth: SURFACE_DEPTH,
      styleOf: (cx, cz) => (this.field && this.field.cliffStyleAt ? this.field.cliffStyleAt(cx, cz) : null),
      surface: (gx, gz, cx, cz, dx, dz, fallback) => this.edgeHeightAt(gx, gz, cx, cz, dx, dz, fallback),
      hardEdge: (cx, cz, dx, dz) => (this.field && this.field.isHardEdge ? this.field.isHardEdge(cx, cz, dx, dz) : false),
      shiftAt: (gx, gz) => this.surfaceShiftAt(gx, gz),
    });
    for (const group of buckets) {
      if (!group.positions.length) continue;
      const total = group.positions.length / 3;
      const factor = Number.isFinite(shade[group.kind]) ? shade[group.kind] : 1;
      const colors = new Array(total * 4);
      const mosses = group.kind === 'cliff' ? new Array(total) : null;
      for (let i = 0; i < total; i += 1) {
        const px = group.positions[i * 3];
        const pz = group.positions[i * 3 + 2];
        const grain = 0.94 + 0.12 * valueNoise(px * 0.55 + 7.3, pz * 0.55 - 3.9);
        if (mosses) {
          const tint = wallTint(px, group.positions[i * 3 + 1], pz, group.shades[i] || 0);
          colors[i * 4] = tint.r * grain;
          colors[i * 4 + 1] = tint.g * grain;
          colors[i * 4 + 2] = tint.b * grain;
          colors[i * 4 + 3] = 1;
          mosses[i] = tint.moss;
        } else {
          colors[i * 4] = SURFACE_VERTEX_TINT[0] * factor * grain;
          colors[i * 4 + 1] = SURFACE_VERTEX_TINT[1] * factor * grain;
          colors[i * 4 + 2] = SURFACE_VERTEX_TINT[2] * factor * grain;
          colors[i * 4 + 3] = 1;
        }
      }
      const mesh = new Mesh(this.volumeMeshName(group), this.s);
      const data = new VertexData();
      data.positions = group.positions;
      data.indices = group.indices;
      data.uvs = group.uvs;
      data.colors = colors;
      data.normals = [];
      VertexData.ComputeNormals(group.positions, group.indices, data.normals);
      data.applyToMesh(mesh);
      if (group.kind === 'cliff') {
        const style = group.name === 'dirt' ? 'dirt' : 'stone';
        if (style === 'stone') mesh.setVerticesData('mossMask', new Float32Array(mosses), false, 1);
        mesh.material = this.cliffMaterialFor(style);
      } else if (group.kind === 'ceiling') {
        mesh.material = this.ceilingMaterialFor(group.name, map);
      } else if (group.kind === 'soil') {
        mesh.material = this.bandMaterialFor(group.name, map);
      } else {
        mesh.material = this.materialFor(group.name, map);
      }
      mesh.isPickable = false;
      mesh.receiveShadows = true;
      mesh.metadata = {
        volume: true,
        kind: group.kind,
        key: group.name,
        chunkX: group.chunkX,
        chunkZ: group.chunkZ,
      };
      this.surfaces.push(mesh);
    }
  },

  volumeMeshName(group) {
    const suffix = `c${group.chunkX}_${group.chunkZ}`;
    if (group.kind === 'ceiling') return `terrainCeiling_vol_${suffix}_${group.name}`;
    if (group.kind === 'cave') return `terrainCaveWall_vol_${suffix}_${group.name}`;
    if (group.kind === 'soil') return `terrainSoil_vol_${suffix}_${group.name}`;
    return `terrainVolume_${suffix}_${group.name}`;
  },

  createEdgeAnchors() {
    const field = this.field;
    if (!field || !field.heightAtCell || !this.shelfAnchors) return;
    const seen = new Set();
    const half = CELL_SIZE / 2;
    for (const [cx, cz] of this.realCells || []) {
      if (!this.floorKeyAt(cx, cz)) continue;
      const here = field.heightAtCell(cx, cz);
      if (!Number.isFinite(here)) continue;
      const x0 = cx * CELL_SIZE - half;
      const z0 = cz * CELL_SIZE - half;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!this.hardEdgeAt(cx, cz, dx, dz)) continue;
        const below = field.heightAtCell(cx + dx, cz + dz);
        if (below >= here - 0.001) continue;
        if (!this.floorKeyAt(cx + dx, cz + dz)) continue;
        const edgeId = `${Math.round((cx + dx * 0.5) * 4)},${Math.round((cz + dz * 0.5) * 4)}`;
        if (seen.has(edgeId)) continue;
        seen.add(edgeId);
        for (const step of [1, 3]) {
          const t = step / 4;
          const gx = dx !== 0 ? x0 + (dx > 0 ? CELL_SIZE : 0) : x0 + CELL_SIZE * t;
          const gz = dz !== 0 ? z0 + (dz > 0 ? CELL_SIZE : 0) : z0 + CELL_SIZE * t;
          const shift = this.surfaceShiftAt(gx, gz);
          const y = this.edgeHeightAt(gx, gz, cx, cz, dx, dz, here);
          if (!Number.isFinite(y)) continue;
          this.shelfAnchors.push({
            x: gx + (shift ? shift.x : 0),
            y,
            z: gz + (shift ? shift.z : 0),
            dirX: dx,
            dirZ: dz,
            depth: EDGE_ANCHOR_DEPTH,
            drop: here - below,
          });
        }
      }
    }
  },

  edgeHeightAt(gx, gz, cx, cz, dx, dz, fallback) {
    const field = this.field;
    if (!field || !field.heightAtSide) return fallback;
    const source = this.surfaceEdge.get(0);
    let height;
    if (source) {
      const id = pointId(gx, gz);
      const welded = source.weldedAt(id, cx, cz);
      if (welded !== null) height = welded;
      else if (source.cliffPoints.has(id)) height = source.heightOf({ gx, gz }, cx, cz);
      else height = field.heightAt(gx, gz);
    } else {
      height = field.heightAt(gx, gz);
    }
    return Number.isFinite(height) ? height : fallback;
  },
};
