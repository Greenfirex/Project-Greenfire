// Ikony nad tvorem — vykřičník a otazníky, kreslené v kódu.
// Destička je vždy otočená ke kameře, svítí vlastní barvou a je vždy vidět.
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import '@babylonjs/core/Meshes/Builders/planeBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Color3 } from '@babylonjs/core/Maths/math.color';

const TEXTURE_SIZE = 128;
const OUTLINE = 'rgba(18, 14, 6, 0.9)';
const FILL = '#ffffff';
const cache = new WeakMap();

function emptyTexture(scene, name) {
  const texture = new DynamicTexture(name, { width: TEXTURE_SIZE, height: TEXTURE_SIZE }, scene, true);
  const context = texture.getContext();
  context.clearRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  return { texture, context };
}

function finish(texture) {
  texture.hasAlpha = true;
  texture.update();
  return texture;
}

function drawBang(scene) {
  const { texture, context } = emptyTexture(scene, 'creatureMarkBang');
  const middle = TEXTURE_SIZE / 2;
  context.font = 'bold 104px Arial';
  context.lineWidth = 18;
  context.strokeStyle = OUTLINE;
  context.strokeText('!', middle, middle + 6);
  context.fillStyle = FILL;
  context.fillText('!', middle, middle + 6);
  return finish(texture);
}

function drawDoubt(scene) {
  const { texture, context } = emptyTexture(scene, 'creatureMarkDoubt');
  const glyphs = [
    { size: 62, x: 40, y: 52 },
    { size: 46, x: 78, y: 44 },
    { size: 32, x: 106, y: 76 },
  ];
  for (const glyph of glyphs) {
    context.font = `bold ${glyph.size}px Arial`;
    context.lineWidth = 12;
    context.strokeStyle = OUTLINE;
    context.strokeText('?', glyph.x, glyph.y);
    context.fillStyle = FILL;
    context.fillText('?', glyph.x, glyph.y);
  }
  return finish(texture);
}

function texturesFor(scene) {
  let cached = cache.get(scene);
  if (!cached) {
    cached = { bang: drawBang(scene), doubt: drawDoubt(scene) };
    cache.set(scene, cached);
  }
  return cached;
}

export function createCreatureMarker(scene, size = 0.42) {
  const textures = texturesFor(scene);
  const plane = MeshBuilder.CreatePlane('creatureMark', { size }, scene);
  const material = new StandardMaterial('creatureMarkMat', scene);
  material.emissiveTexture = textures.bang;
  material.opacityTexture = textures.bang;
  material.emissiveColor = new Color3(1, 1, 1);
  material.diffuseColor = new Color3(0, 0, 0);
  material.specularColor = new Color3(0, 0, 0);
  material.disableLighting = true;
  material.fogEnabled = false;
  material.backFaceCulling = false;
  material.disableDepthWrite = true;
  plane.material = material;
  plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
  plane.isPickable = false;
  plane.receiveShadows = false;
  plane.renderingGroupId = 1;
  plane.setEnabled(false);
  return plane;
}

export function setMarkerIcon(plane, scene, icon) {
  if (!plane || !plane.material) return;
  const textures = texturesFor(scene);
  const texture = icon === 'doubt' ? textures.doubt : textures.bang;
  if (plane.material.emissiveTexture === texture) return;
  plane.material.emissiveTexture = texture;
  plane.material.opacityTexture = texture;
}
