// Program pro vodopád — clona z jemných vláken stékajících dolů a vířící pěna na hladině pod ní.
// Clona má roztřepené okraje, dole se rozšiřuje a místy se trhá; světlo bere ze slunce, denní doby a ohně.
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { Effect } from '@babylonjs/core/Materials/effect';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { REVEAL_UNIFORMS, REVEAL_UNIFORM_NAMES, REVEAL_SAMPLER, REVEAL_SIGHT_SAMPLER, revealBlock } from '../../utils/revealGlsl.js';
import { FIRE_LIGHTS, FIRE_UNIFORM_NAMES, FIRE_SAMPLERS } from '../../utils/fireGlsl.js';
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
uniform float fallSpread;
uniform float pool;
uniform float dayness;
uniform vec3 sunColor;
uniform float sunIntensity;
uniform vec3 waterColor;
uniform vec3 foamColor;
${REVEAL_UNIFORMS}
${FIRE_LIGHTS}

varying vec2 vUV;
varying vec3 vPosition;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float sum = noise(p) * 0.5;
  sum += noise(mat2(0.8, -0.6, 0.6, 0.8) * p * 2.03 + vec2(5.2, 1.3)) * 0.3;
  sum += noise(mat2(0.6, 0.8, -0.8, 0.6) * p * 4.01 + vec2(-3.7, 8.1)) * 0.2;
  return sum;
}

void main(void) {
  vec3 color;
  float alpha;
  if (pool < 0.5) {
    float down = vUV.y;
    float t = clamp(down / max(fallLength, 0.01), 0.0, 1.0);
    float width = fallWidth * (1.0 + fallSpread * t);
    float across = vUV.x * width;
    float speed = 2.2 + 2.6 * t;
    vec2 flow = vec2(across * 2.6, down * 0.32 - fallTime * speed * 0.32);
    float threads = fbm(flow) * 0.65 + fbm(vec2(across * 7.5 + 4.1, down * 0.7 - fallTime * speed * 0.7)) * 0.35;
    float wobbleLeft = fbm(vec2(down * 0.9 - fallTime * 1.4, 3.1));
    float wobbleRight = fbm(vec2(down * 0.9 - fallTime * 1.4, 9.7));
    float edgeLeft = 0.1 + 0.35 * wobbleLeft * (0.4 + t);
    float edgeRight = 0.1 + 0.35 * wobbleRight * (0.4 + t);
    float sides = smoothstep(edgeLeft, edgeLeft + 0.25, across) * smoothstep(edgeRight, edgeRight + 0.25, width - across);
    float gaps = smoothstep(0.22, 0.5, threads + 0.25 * (1.0 - t));
    float lip = smoothstep(-0.35, -0.05, down);
    float splash = smoothstep(fallLength - 1.0, fallLength, down);
    float white = clamp(smoothstep(0.45, 0.8, threads) * (0.5 + 0.5 * t) + splash * 0.7, 0.0, 1.0);
    color = mix(waterColor, foamColor, 0.18 + white * 0.75);
    alpha = (0.45 + 0.5 * threads) * sides * gaps * lip;
    alpha = max(alpha, splash * 0.8 * sides);
  } else {
    vec2 q = vUV;
    float wobble = (fbm(q * 0.9 + vec2(fallTime * 0.15, -fallTime * 0.1)) - 0.5) * 0.7;
    float reach = length(vec2(q.x / (fallWidth * 0.5), (q.y - fallLength * 0.35) / (fallLength * 0.65))) + wobble;
    float churn = fbm(q * 2.2 + vec2(fallTime * 0.7, -fallTime * 1.1)) * 0.6 + fbm(q * 5.0 - fallTime * 1.7) * 0.4;
    float foam = (1.0 - smoothstep(0.35, 1.0, reach)) * smoothstep(0.25, 0.7, churn + (1.0 - reach) * 0.5);
    color = foamColor;
    alpha = foam * 0.92;
  }
  float daylight = 0.55 + 0.45 * dayness;
  color *= vec3(0.16, 0.2, 0.24) * daylight + sunColor * sunIntensity * 0.75 + fireLightAt(vPosition, vec3(0.0, 1.0, 0.0), 1.0);
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

export function createWaterfallMaterial(scene, { waterColor, foamColor, width, length, spread = 0, pool }) {
  registerShaders();
  const material = new ShaderMaterial(pool ? 'waterfallPoolMat' : 'waterfallMat', scene, { vertex: 'waterfall', fragment: 'waterfall' }, {
    attributes: ['position', 'uv'],
    samplers: [REVEAL_SAMPLER, REVEAL_SIGHT_SAMPLER, ...FIRE_SAMPLERS],
    uniforms: [
      'viewProjection', 'fallTime', 'fallWidth', 'fallLength', 'fallSpread', 'pool', 'dayness',
      'sunColor', 'sunIntensity', 'waterColor', 'foamColor',
      ...REVEAL_UNIFORM_NAMES,
      ...FIRE_UNIFORM_NAMES,
    ],
  });
  material.backFaceCulling = false;
  material.alpha = 0.999;
  material.disableDepthWrite = true;
  material.setFloat('fallTime', 0);
  material.setFloat('fallWidth', width);
  material.setFloat('fallLength', length);
  material.setFloat('fallSpread', spread);
  material.setFloat('pool', pool ? 1 : 0);
  material.setFloat('dayness', 1);
  material.setColor3('sunColor', new Color3(1, 0.95, 0.86));
  material.setFloat('sunIntensity', 1);
  material.setColor3('waterColor', waterColor);
  material.setColor3('foamColor', foamColor);
  return material;
}
