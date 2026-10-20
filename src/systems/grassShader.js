// Vlastní program pro grafiku, který kreslí trávu: stéblo se ohne ve větru,
// tmavne u země, světlá ke špičce a každé stéblo má nepatrně jiný odstín.
// Nepoužívá Babyloní materiály — má svůj vlastní, takže si hlídá všechno sám.
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { Effect } from '@babylonjs/core/Materials/effect';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';

const LIGHT_DIR = new Vector3(0.35, 1, 0.25).normalize();

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
uniform float grassHeight;

varying vec3 vPosition;
varying vec3 vNormal;
varying vec3 vRoot;
varying float vHeight;

void main(void) {
  mat4 finalWorld = mat4(world0, world1, world2, world3);
  vec3 worldPos = (finalWorld * vec4(position, 1.0)).xyz;
  vec3 rootPos = (finalWorld * vec4(0.0, 0.0, 0.0, 1.0)).xyz;

  float h = clamp(uv.y, 0.0, 1.0);
  float flex = h * h;
  float phase = rootPos.x * 0.55 + rootPos.z * 0.42;

  float gust = sin(grassTime * 0.8 + phase * 0.35);
  vec3 push = vec3(0.0);
  push.x = sin(grassTime * 1.6 + phase) * 0.55 + sin(grassTime * 3.4 + phase * 2.1) * 0.2;
  push.z = cos(grassTime * 1.25 + phase * 1.4) * 0.45 + cos(grassTime * 2.9 + phase * 0.7) * 0.15;
  push *= 0.28 * (0.7 + 0.3 * gust);
  push.y = -dot(push.xz, push.xz) * 0.6;
  worldPos += push * flex * grassHeight;

  vec3 bladeNormal = mat3(finalWorld) * normal;
  vNormal = normalize(bladeNormal + vec3(push.x, 1.0, push.z) * 2.2);

  vPosition = worldPos;
  vRoot = rootPos;
  vHeight = h;
  gl_Position = viewProjection * vec4(worldPos, 1.0);
}
`;

const FRAGMENT = `
precision highp float;

uniform vec3 baseColor;
uniform vec3 grassRoot;
uniform vec3 lightDir;

varying vec3 vPosition;
varying vec3 vNormal;
varying vec3 vRoot;
varying float vHeight;

void main(void) {
  float blade = fract(sin(dot(floor(vRoot.xz * 24.0), vec2(12.9898, 78.233))) * 43758.5453);
  float patchMix = sin(vRoot.x * 0.35 + blade * 6.2831) * cos(vRoot.z * 0.29 - blade * 3.1);

  vec3 tip = vec3(baseColor.r * 1.3 + 0.04, baseColor.g * 1.18 + 0.06, baseColor.b * 0.95);
  tip *= 0.9 + patchMix * 0.18 + blade * 0.16;

  vec3 color = mix(grassRoot, tip, pow(vHeight, 1.25));
  color *= mix(0.4, 1.0, smoothstep(0.0, 0.35, vHeight));

  vec3 n = normalize(vNormal);
  float face = dot(n, lightDir);
  float wrap = clamp(face * 0.5 + 0.5, 0.0, 1.0);
  color *= 0.72 + wrap * 0.5;

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
  const material = new ShaderMaterial('wildGrassMat', scene, { vertex: 'grass', fragment: 'grass' }, {
    attributes: ['position', 'normal', 'uv', 'world0', 'world1', 'world2', 'world3'],
    uniforms: ['viewProjection', 'grassTime', 'grassHeight', 'baseColor', 'grassRoot', 'lightDir'],
  });
  material.backFaceCulling = false;
  material.setFloat('grassTime', 0);
  material.setFloat('grassHeight', options.height);
  material.setColor3('baseColor', options.base);
  material.setColor3('grassRoot', options.root);
  material.setVector3('lightDir', LIGHT_DIR);
  return material;
}

export function tickGrass(material, seconds) {
  material.setFloat('grassTime', seconds % 3600);
}
