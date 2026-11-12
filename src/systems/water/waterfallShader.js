// Program pro vodopád — svislá clona s pruhy stékajícími dolů a vířící pěna na hladině pod ní.
// Clona i pěna mají souřadnice v metrech: napříč vodopádem a ve směru pádu.
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { Effect } from '@babylonjs/core/Materials/effect';
import { REVEAL_UNIFORMS, REVEAL_UNIFORM_NAMES, REVEAL_SAMPLER, REVEAL_SIGHT_SAMPLER, revealBlock } from '../../utils/revealGlsl.js';
import { REVEAL_WATER } from './waterShader.js';

const VERTEX = `
precision highp float;

attribute vec3 position;
attribute vec2 uv;

uniform mat4 viewProjection;

varying vec2 vUV;
varying vec3 vPosition;

void main(void) {
  vUV = uv;
  vPosition = position;
  gl_Position = viewProjection * vec4(position, 1.0);
}
`;

const FRAGMENT = `
precision highp float;

uniform float fallTime;
uniform float fallWidth;
uniform float fallLength;
uniform float pool;
uniform float dayness;
uniform vec3 waterColor;
uniform vec3 foamColor;
${REVEAL_UNIFORMS}

varying vec2 vUV;
varying vec3 vPosition;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void main(void) {
  vec3 color;
  float alpha;
  if (pool < 0.5) {
    float across = vUV.x;
    float down = vUV.y;
    float coarse = noise(vec2(across * 3.2, down * 0.55 - fallTime * 2.4));
    float fine = noise(vec2(across * 9.0 + 3.1, down * 1.3 - fallTime * 4.2));
    float sheet = coarse * 0.6 + fine * 0.4;
    float sides = smoothstep(0.0, 0.3, across) * smoothstep(0.0, 0.3, fallWidth - across);
    float lip = smoothstep(0.0, 0.2, down);
    float splash = smoothstep(fallLength - 1.2, fallLength, down);
    float white = clamp(smoothstep(0.42, 0.85, sheet) + splash * 0.6, 0.0, 1.0);
    color = mix(waterColor, foamColor, 0.15 + white * 0.8);
    alpha = (0.5 + 0.45 * sheet) * sides * mix(0.75, 1.0, lip);
    alpha = max(alpha, splash * 0.85 * sides);
  } else {
    vec2 q = vUV;
    float reach = length(vec2(q.x / (fallWidth * 0.5), (q.y - fallLength * 0.35) / (fallLength * 0.65)));
    float churn = noise(q * 2.2 + vec2(fallTime * 0.7, -fallTime * 1.1)) * 0.6 + noise(q * 5.0 - fallTime * 1.7) * 0.4;
    float foam = (1.0 - smoothstep(0.35, 1.0, reach)) * smoothstep(0.25, 0.75, churn + (1.0 - reach) * 0.45);
    color = foamColor;
    alpha = foam * 0.9;
  }
  color *= 0.45 + 0.55 * dayness;
  ${revealBlock('color', 'vPosition', REVEAL_WATER)}
  gl_FragColor = vec4(color, alpha);
}
`;

let registered = false;

function registerShaders() {
  if (registered) return;
  registered = true;
  Effect.ShadersStore.waterfallVertexShader = VERTEX;
  Effect.ShadersStore.waterfallFragmentShader = FRAGMENT;
}

export function createWaterfallMaterial(scene, { waterColor, foamColor, width, length, pool }) {
  registerShaders();
  const material = new ShaderMaterial(pool ? 'waterfallPoolMat' : 'waterfallMat', scene, { vertex: 'waterfall', fragment: 'waterfall' }, {
    attributes: ['position', 'uv'],
    samplers: [REVEAL_SAMPLER, REVEAL_SIGHT_SAMPLER],
    uniforms: [
      'viewProjection', 'fallTime', 'fallWidth', 'fallLength', 'pool', 'dayness', 'waterColor', 'foamColor',
      ...REVEAL_UNIFORM_NAMES,
    ],
  });
  material.backFaceCulling = false;
  material.alpha = 0.999;
  material.disableDepthWrite = true;
  material.setFloat('fallTime', 0);
  material.setFloat('fallWidth', width);
  material.setFloat('fallLength', length);
  material.setFloat('pool', pool ? 1 : 0);
  material.setFloat('dayness', 1);
  material.setColor3('waterColor', waterColor);
  material.setColor3('foamColor', foamColor);
  return material;
}
