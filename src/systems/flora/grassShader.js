// Vlastní program pro trávu — textura z modelu, ohýbání ve větru a ztmavení u země.
// Stébla jednoho trsu se ohýbají podle výšky, každý trs má nepatrně jiný odstín.
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { Effect } from '@babylonjs/core/Materials/effect';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { WAVE_TIME_WRAP } from '../../utils/waterWaves.js';
import { REVEAL_UNIFORMS, REVEAL_UNIFORM_NAMES, REVEAL_SAMPLER, REVEAL_SIGHT_SAMPLER, revealBlock } from '../../utils/revealGlsl.js';

const VERTEX = `
precision highp float;

attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
attribute vec4 world0;
attribute vec4 world1;
attribute vec4 world2;
attribute vec4 world3;

uniform mat4 viewProjection;
uniform float grassTime;
uniform float clumpHeight;

varying vec2 vUV;
varying vec3 vNormal;
varying vec3 vRoot;
varying float vHeight;

void main(void) {
  mat4 finalWorld = mat4(world0, world1, world2, world3);
  vec3 worldPos = (finalWorld * vec4(position, 1.0)).xyz;
  vec3 rootPos = (finalWorld * vec4(0.0, 0.0, 0.0, 1.0)).xyz;

  float h = clamp(position.y / max(clumpHeight, 0.001), 0.0, 1.0);
  float flex = h * h;
  float phase = rootPos.x * 0.55 + rootPos.z * 0.42;

  float gust = sin(grassTime * 0.8 + phase * 0.35);
  vec3 push = vec3(0.0);
  push.x = sin(grassTime * 1.6 + phase) * 0.55 + sin(grassTime * 3.4 + phase * 2.1) * 0.2;
  push.z = cos(grassTime * 1.25 + phase * 1.4) * 0.45 + cos(grassTime * 2.9 + phase * 0.7) * 0.15;
  push *= 0.28 * (0.7 + 0.3 * gust);
  push.y = -dot(push.xz, push.xz) * 0.6;
  worldPos += push * flex * clumpHeight;

  vec3 bladeNormal = mat3(finalWorld) * normal;
  vNormal = normalize(bladeNormal + vec3(push.x, 1.0, push.z) * 1.4);

  vUV = uv;
  vRoot = rootPos;
  vHeight = h;
  gl_Position = viewProjection * vec4(worldPos, 1.0);
}
`;

const FRAGMENT = `
precision highp float;

uniform sampler2D diffuseSampler;
uniform vec3 baseTint;
uniform vec3 lightDir;
uniform float dayness;
uniform float uvFlip;
uniform float uvScale;
uniform float patchPick;
uniform float groundMode;
uniform float groundTile;
${REVEAL_UNIFORMS}

varying vec2 vUV;
varying vec3 vNormal;
varying vec3 vRoot;
varying float vHeight;

void main(void) {
  vec3 color;
  if (groundMode > 0.5) {
    color = texture2D(diffuseSampler, vRoot.xz / groundTile).rgb * baseTint;
  } else {
    vec2 uv = vUV * uvScale;
    if (patchPick > 0.5) {
      vec2 cell = floor(vRoot.xz * 24.0);
      float pick1 = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
      float pick2 = fract(sin(dot(cell + 7.13, vec2(39.346, 11.135))) * 24634.6345);
      uv += vec2(pick1, pick2);
    }
    if (uvFlip > 0.5) uv.y = 1.0 - uv.y;
    color = texture2D(diffuseSampler, uv).rgb * baseTint;
  }

  float blade = fract(sin(dot(floor(vRoot.xz * 24.0), vec2(12.9898, 78.233))) * 43758.5453);
  color *= 0.9 + blade * 0.2;
  color *= mix(0.55, 1.0, smoothstep(0.0, 0.22, vHeight));
  color *= mix(1.0, 1.18, smoothstep(0.5, 1.0, vHeight));

  float daylight = 0.24 + 0.76 * dayness;
  color *= daylight;

  vec3 n = normalize(vNormal);
  float wrap = clamp(dot(n, lightDir) * 0.5 + 0.5, 0.0, 1.0);
  color *= 0.62 + wrap * 0.62 * dayness;

  ${revealBlock('color', 'vRoot', { above: '1.0', hide: '1.0', keep: '0.0', inside: '0.0', restore: '1.0' })}
  gl_FragColor = vec4(color, 1.0);
}
`;

let registered = false;

function registerShaders() {
  if (registered) return;
  registered = true;
  Effect.ShadersStore.grassVertexShader = VERTEX;
  Effect.ShadersStore.grassFragmentShader = FRAGMENT;
}

export function createGrassMaterial(scene, options) {
  registerShaders();
  const material = new ShaderMaterial(options.name || 'wildGrassMat', scene, { vertex: 'grass', fragment: 'grass' }, {
    attributes: ['position', 'normal', 'uv', 'world0', 'world1', 'world2', 'world3'],
    uniforms: ['viewProjection', 'grassTime', 'clumpHeight', 'baseTint', 'lightDir', 'dayness', 'uvFlip', 'uvScale', 'patchPick', 'groundMode', 'groundTile', ...REVEAL_UNIFORM_NAMES],
    samplers: ['diffuseSampler', REVEAL_SAMPLER, REVEAL_SIGHT_SAMPLER],
  });
  const tint = options.tint || [1, 1, 1];
  const uvScale = Number(options.uvScale) || 1;
  material.backFaceCulling = false;
  material.setFloat('grassTime', 0);
  material.setFloat('clumpHeight', options.height || 0.5);
  material.setColor3('baseTint', new Color3(tint[0], tint[1], tint[2]));
  material.setVector3('lightDir', options.lightDir);
  material.setFloat('dayness', 1);
  material.setFloat('uvFlip', options.texture && options.texture.invertY ? 1 : 0);
  material.setFloat('uvScale', uvScale);
  material.setFloat('patchPick', options.patchPick ? 1 : 0);
  material.setFloat('groundMode', options.groundTile ? 1 : 0);
  material.setFloat('groundTile', options.groundTile || 1);
  if (options.texture) material.setTexture('diffuseSampler', options.texture);
  return material;
}

export function tickGrass(material, seconds) {
  material.setFloat('grassTime', seconds % WAVE_TIME_WRAP);
}
