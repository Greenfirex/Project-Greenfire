// Skládá keře z geometrie v kódu — obal z průhledných karet a tmavé jádro uvnitř.
// Tvar (kopule, sloup, suknice, stěna, hrbolatý) určuje recept.
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Material } from '@babylonjs/core/Materials/material';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { createBuffer, pushVertex, buildMesh, mulberry32 } from './meshBuilder.js';
import { getBushRecipe } from '../data/catalogs/bushes.js';
import { ASSET_DIRS } from '../data/catalogs/assetPaths.js';
import TreeWindPlugin from '../systems/treeWindPlugin.js';

const templates = new WeakMap();
const textures = new WeakMap();
const CARD_SEGMENTS = 2;
const CARD_TAPER = 0.75;
const CARD_BEND = 0.1;
const CARD_CURL = 0.16;
const ALPHA_CUTOFF = 0.32;
// Ztmavení odspodu: keř tím dostane objem a neplete se se světlou zemí.
const SHADE_BASE = 0.6;
const SHADE_TOP = 1.05;
// instantiateModel každou šablonu zvětší na dvojnásobek (buňka má 2 m),
// takže se rozměry z receptu v metrech převádějí na jednotky šablony.
const TEMPLATE_UNITS = 0.5;
const RINGS = [
  { level: 0.16, share: 0.3, lean: 0.8, size: 1 },
  { level: 0.42, share: 0.27, lean: 0.5, size: 0.95 },
  { level: 0.66, share: 0.23, lean: 0.1, size: 0.9 },
  { level: 0.86, share: 0.2, lean: -0.35, size: 0.8 },
];
const SHAPES = {
  dome: { profile: (t) => Math.sqrt(Math.max(0.08, 1 - t * t)), lean: 1 },
  clump: { profile: (t) => Math.sqrt(Math.max(0.1, 1 - t * t)), lean: 0.95, lobe: 0.26 },
  column: { profile: (t) => 0.8 - 0.3 * t, lean: 0.4 },
  spread: { profile: (t) => 1 - 0.62 * t, lean: 1.3 },
  hedge: { profile: (t) => 0.96 - 0.16 * t, lean: 0.32 },
};
// Druhá, menší vrstva karet uvnitř obalu — přes listí pak není vidět skrz.
const INNER_LAYER = { share: 0.45, radius: 0.4, span: 0.2, size: 0.62, lean: 0.75 };
const INNER_CARDS = 4;
const TOP_CARDS = 2;

export function bushTemplate(scene, key) {
  let byKey = templates.get(scene);
  if (!byKey) {
    byKey = new Map();
    templates.set(scene, byKey);
  }
  const cached = byKey.get(key);
  if (cached && !cached.isDisposed()) return cached;
  const built = buildBush(scene, key, getBushRecipe(key));
  byKey.set(key, built);
  return built;
}

function buildBush(scene, key, recipe) {
  const rng = mulberry32(recipe.seed);
  const shape = SHAPES[recipe.shape] || SHAPES.dome;
  const height = Math.max(0.15, recipe.height * TEMPLATE_UNITS);
  const radiusX = Math.max(0.1, recipe.width * 0.5 * TEMPLATE_UNITS);
  const radiusZ = Math.max(0.1, (recipe.depth || recipe.width) * 0.5 * TEMPLATE_UNITS);
  const cardSize = recipe.cardSize * TEMPLATE_UNITS;
  const cards = Math.max(8, recipe.cards);
  const phase = rng() * Math.PI * 2;
  const buffer = createBuffer();

  const profileAt = (level, angle) => {
    let value = shape.profile(level);
    if (shape.lobe && recipe.lobes) {
      value *= 1 + shape.lobe * Math.sin(angle * recipe.lobes + phase);
    }
    return Math.max(0.08, value);
  };

  RINGS.forEach((ring) => {
    const count = Math.max(3, Math.round(cards * ring.share));
    const start = rng() * Math.PI * 2;
    for (let index = 0; index < count; index += 1) {
      const angle = start + (index / count) * Math.PI * 2 + (rng() - 0.5) * 0.35;
      addCard(buffer, rng, {
        height,
        angle,
        y: height * ring.level + (rng() - 0.5) * height * 0.08,
        radius: profileAt(ring.level, angle) * (0.78 + rng() * 0.22),
        radiusX,
        radiusZ,
        size: cardSize * ring.size * (0.88 + rng() * 0.24),
        lean: ring.lean * recipe.lean * shape.lean,
      });
    }
  });

  RINGS.forEach((ring) => {
    const count = Math.max(2, Math.round(cards * ring.share * INNER_LAYER.share * (recipe.inner || 1)));
    const start = rng() * Math.PI * 2;
    for (let index = 0; index < count; index += 1) {
      const angle = start + (index / count) * Math.PI * 2 + (rng() - 0.5) * 0.5;
      addCard(buffer, rng, {
        height,
        angle,
        y: height * ring.level + (rng() - 0.5) * height * 0.12,
        radius: profileAt(ring.level, angle) * (INNER_LAYER.radius + rng() * INNER_LAYER.span),
        radiusX,
        radiusZ,
        size: cardSize * ring.size * INNER_LAYER.size * (0.85 + rng() * 0.3),
        lean: ring.lean * recipe.lean * shape.lean * INNER_LAYER.lean,
      });
    }
  });

  for (let index = 0; index < INNER_CARDS; index += 1) {
    addCard(buffer, rng, {
      height,
      angle: (index / INNER_CARDS) * Math.PI * 2 + rng() * 0.6,
      y: height * (0.3 + rng() * 0.22),
      radius: 0.22 + rng() * 0.14,
      radiusX,
      radiusZ,
      size: cardSize * (0.72 + rng() * 0.2),
      lean: 0.15,
    });
  }

  for (let index = 0; index < TOP_CARDS; index += 1) {
    addCard(buffer, rng, {
      height,
      angle: rng() * Math.PI * 2,
      y: height * (0.86 + rng() * 0.06),
      radius: 0.05 + rng() * 0.1,
      radiusX,
      radiusZ,
      size: cardSize * (0.68 + rng() * 0.2),
      lean: -0.1,
    });
  }

  const root = new TransformNode(`tplBush_${key}`, scene);
  const leaves = buildMesh(scene, `bush_${key}_leaves`, buffer, bushMaterial(scene, key, recipe));
  leaves.parent = root;
  root.setEnabled(false);
  return root;
}

function addCard(buffer, rng, spec) {
  const cos = Math.cos(spec.angle);
  const sin = Math.sin(spec.angle);
  const outward = new Vector3(cos * spec.radiusZ, 0, sin * spec.radiusX).normalize();
  const base = new Vector3(cos * spec.radius * spec.radiusX, spec.y, sin * spec.radius * spec.radiusZ);
  const up = outward.scale(spec.lean).add(new Vector3(0, 1, 0)).normalize();
  const normal = outward.scale(0.35).add(new Vector3(0, 0.9, 0)).normalize();
  const right = new Vector3(-sin * spec.radiusX, 0, cos * spec.radiusZ).normalize();
  const roll = (rng() - 0.5) * 0.4;
  const side = right.scale(Math.cos(roll)).add(up.scale(Math.sin(roll)));
  const grid = [];
  for (let step = 0; step <= CARD_SEGMENTS; step += 1) {
    const t = step / CARD_SEGMENTS;
    const half = spec.size * 0.5 * (1 - CARD_TAPER * t);
    const center = base
      .add(up.scale(spec.size * t))
      .add(outward.scale(CARD_BEND * spec.size * t * t - CARD_CURL * spec.size * t * t * t));
    const shade = shadeAt(center.y, spec.height);
    const color = new Color3(shade, shade, shade);
    const row = [];
    row.push(pushVertex(buffer, center.subtract(side.scale(half)), normal, color, 0, t));
    row.push(pushVertex(buffer, center.add(side.scale(half)), normal, color, 1, t));
    grid.push(row);
  }
  for (let step = 0; step < grid.length - 1; step += 1) {
    const a = grid[step][0];
    const b = grid[step][1];
    const c = grid[step + 1][1];
    const d = grid[step + 1][0];
    buffer.indices.push(a, c, b, a, d, c);
  }
}

function shadeAt(y, height) {
  const total = Math.max(0.001, Number(height) || 0.001);
  const t = Math.min(1, Math.max(0, y / total));
  return SHADE_BASE + (SHADE_TOP - SHADE_BASE) * Math.pow(t, 0.75);
}

function bushMaterial(scene, key, recipe) {
  const material = new StandardMaterial(`bushLeaf_${key}`, scene);
  material.diffuseTexture = textureFor(scene, recipe.texture);
  material.diffuseColor = new Color3(recipe.tint[0], recipe.tint[1], recipe.tint[2]);
  material.specularColor = new Color3(0.02, 0.02, 0.02);
  material.useAlphaFromDiffuseTexture = true;
  material.transparencyMode = Material.MATERIAL_ALPHATEST;
  material.alphaCutOff = ALPHA_CUTOFF;
  material.backFaceCulling = false;
  material.twoSidedLighting = false;
  new TreeWindPlugin(material, {
    strength: recipe.height * 0.014,
    height: recipe.height * TEMPLATE_UNITS,
  });
  return material;
}

function textureFor(scene, file) {
  let byName = textures.get(scene);
  if (!byName) {
    byName = new Map();
    textures.set(scene, byName);
  }
  const existing = byName.get(file);
  if (existing) return existing;
  const texture = new Texture(`${ASSET_DIRS.textures}${file}`, scene);
  texture.wrapU = Texture.CLAMP_ADDRESSMODE;
  texture.wrapV = Texture.CLAMP_ADDRESSMODE;
  texture.anisotropicFilteringLevel = 8;
  texture.hasAlpha = true;
  byName.set(file, texture);
  return texture;
}
