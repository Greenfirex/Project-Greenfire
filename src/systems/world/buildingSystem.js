// Stavby ve světě — z mapy a katalogu staveb postaví prkennou podlahu s lemem z trámů.
// Stěny, dveře a střecha přibudou podle plánu v DEV.md; výšku země mu dodá scéna.
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector4 } from '@babylonjs/core/Maths/math.vector';
import { CELL_SIZE, cellKey } from '../../utils/gridMath.js';
import { getBuilding, buildingSize, buildingCells } from '../../data/catalogs/buildings.js';

const GROUND_SAMPLE = 0.5;
const SKIRT_DEPTH = 0.3;

function faceUvs(width, height, depth, tile) {
  const side = (a, b) => new Vector4(0, 0, a / tile, b / tile);
  return [
    side(width, height),
    side(width, height),
    side(depth, height),
    side(depth, height),
    side(width, depth),
    side(width, depth),
  ];
}

export default class BuildingSystem {

  constructor(scene) {
    this.s = scene;
    this.meshes = [];
    this.materials = new Map();
    this.floorKeys = new Map();
    this.groundHeightAt = null;
  }

  clear() {
    for (const mesh of this.meshes) {
      if (mesh && !mesh.isDisposed()) mesh.dispose(false, false);
    }
    this.meshes = [];
    this.floorKeys.clear();
  }

  build(layout) {
    this.clear();
    for (const entry of (layout && layout.buildings) || []) this.buildOne(entry);
  }

  floorKeyAt(cx, cz) {
    return this.floorKeys.get(cellKey(cx, cz)) || null;
  }

  materialFor(name, floor, tint) {
    if (this.materials.has(name)) return this.materials.get(name);
    const material = new StandardMaterial(name, this.s);
    const texture = new Texture(floor.texture, this.s);
    texture.wrapU = Texture.WRAP_ADDRESSMODE;
    texture.wrapV = Texture.WRAP_ADDRESSMODE;
    texture.anisotropicFilteringLevel = 4;
    material.diffuseTexture = texture;
    material.diffuseColor = new Color3(tint[0], tint[1], tint[2]);
    material.specularColor = new Color3(0.03, 0.03, 0.03);
    this.materials.set(name, material);
    return material;
  }

  groundSpan(x0, x1, z0, z1) {
    let low = Infinity;
    let high = -Infinity;
    for (let x = x0; x <= x1 + 1e-6; x += GROUND_SAMPLE) {
      for (let z = z0; z <= z1 + 1e-6; z += GROUND_SAMPLE) {
        const y = this.groundHeightAt ? this.groundHeightAt(x, z) : 0;
        if (!Number.isFinite(y)) continue;
        low = Math.min(low, y);
        high = Math.max(high, y);
      }
    }
    return Number.isFinite(low) ? { low, high } : { low: 0, high: 0 };
  }

  buildOne(entry) {
    const def = getBuilding(entry && entry.key);
    const size = buildingSize(entry);
    if (!def || !size || !def.floor) return;
    const floor = def.floor;
    const half = CELL_SIZE / 2;
    const x0 = entry.cx * CELL_SIZE - half;
    const z0 = entry.cz * CELL_SIZE - half;
    const width = size.width * CELL_SIZE;
    const depth = size.depth * CELL_SIZE;
    const ground = this.groundSpan(x0, x0 + width, z0, z0 + depth);
    const top = ground.high + floor.lift;
    const bottom = ground.low - SKIRT_DEPTH;
    const deckMat = this.materialFor(`buildingFloorMat_${entry.key}`, floor, floor.tint);
    const beamMat = this.materialFor(`buildingBeamMat_${entry.key}`, floor, floor.beamTint);
    const name = `building_${entry.key}_${entry.cx}_${entry.cz}`;

    const deckHeight = top - bottom;
    this.addBox(`${name}_floor`, deckMat, floor.tile, width, deckHeight, depth, x0 + width / 2, bottom + deckHeight / 2, z0 + depth / 2);

    const beam = floor.beam;
    const beamHeight = deckHeight + floor.beamLift;
    const beamY = bottom + beamHeight / 2;
    for (const z of [z0, z0 + depth]) {
      this.addBox(`${name}_beamX`, beamMat, floor.tile, width + beam, beamHeight, beam, x0 + width / 2, beamY, z);
    }
    for (const x of [x0, x0 + width]) {
      this.addBox(`${name}_beamZ`, beamMat, floor.tile, beam, beamHeight, depth + beam, x, beamY, z0 + depth / 2);
    }

    for (const [cx, cz] of buildingCells(entry)) this.floorKeys.set(cellKey(cx, cz), floor.stepKey);
  }

  addBox(name, material, tile, width, height, depth, x, y, z) {
    const mesh = CreateBox(name, { width, height, depth, faceUV: faceUvs(width, height, depth, tile), wrap: true }, this.s);
    mesh.position.set(x, y, z);
    mesh.material = material;
    mesh.isPickable = false;
    mesh.receiveShadows = true;
    mesh.metadata = { building: true };
    this.meshes.push(mesh);
    return mesh;
  }
}
