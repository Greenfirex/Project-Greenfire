// Program pro vodopád — clona z jemných vláken stékajících dolů a vířící pěna s vlnkami na hladině pod ní.
// Clona se lehce kývá, má roztřepené okraje a čas od času jí proteče silnější vlna, která dole víc zpění hladinu.
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { Effect } from '@babylonjs/core/Materials/effect';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector2 } from '@babylonjs/core/Maths/math.vector';
import { glslFloat } from '../../utils/waterWaves.js';
import { REVEAL_UNIFORMS, REVEAL_UNIFORM_NAMES, REVEAL_SAMPLER, REVEAL_SIGHT_SAMPLER, revealBlock } from '../../utils/revealGlsl.js';
import { FIRE_LIGHTS, FIRE_UNIFORM_NAMES, FIRE_SAMPLERS } from '../../utils/fireGlsl.js';
import { REVEAL_WATER } from './waterShader.js';

const START_SPEED = 1.6;
const FALL_PULL = 5;
const SURGE_RATE = 0.9;
const SURGE_FROM = 0.62;
const SURGE_FULL = 0.92;
const SWAY = 0.12;
const SURGE_REACH = 0.18;
const GLASS_DROP = 0.9;
export const LIP_REACH = 0.6;

export function fallFlight(drop) {
  return (Math.sqrt(START_SPEED * START_SPEED + 2 * FALL_PULL * Math.max(drop, 0)) - START_SPEED) / FALL_PULL;
}

export function surgeAt(along, seed) {
  const x = along * SURGE_RATE + seed;
  const wave = 0.5 + 0.5 * (0.6 * Math.sin(x) + 0.4 * Math.sin(2.31 * x + 1.7));
  const t = Math.min(1, Math.max(0, (wave - SURGE_FROM) / (SURGE_FULL - SURGE_FROM)));
  return t * t * (3 - 2 * t);
}

const SHARED = `
uniform float fallTime;
uniform float fallDrop;
uniform float fallSeed;

float flightAt(float down) {
  float drop = max(down, 0.0);
  float flight = (sqrt(${glslFloat(START_SPEED * START_SPEED)} + ${glslFloat(2 * FALL_PULL)} * drop) - ${glslFloat(START_SPEED)}) / ${glslFloat(FALL_PULL)};
  return mix(down / ${glslFloat(START_SPEED)}, flight, step(0.0, down));
}

float surgeAt(float along) {
  float x = along * ${glslFloat(SURGE_RATE)} + fallSeed;
  float wave = 0.5 + 0.5 * (0.6 * sin(x) + 0.4 * sin(2.31 * x + 1.7));
  return smoothstep(${glslFloat(SURGE_FROM)}, ${glslFloat(SURGE_FULL)}, wave);
}
`;

const VERTEX = `
precision highp float;

attribute vec3 position;
attribute vec2 uv;

uniform mat4 viewProjection;
uniform float pool;
uniform vec2 fallDir;
${SHARED}

varying vec2 vUV;
varying vec3 vPosition;

void main(void) {
  vUV = uv;
  vec3 p = position;
  if (pool < 0.5) {
    float t = clamp(uv.y / max(fallDrop, 0.01), 0.0, 1.0);
    float sway = sin(fallTime * 0.8 + fallSeed + t * 2.5) * 0.6 + sin(fallTime * 1.7 + fallSeed * 2.0 + t * 4.0) * 0.4;
    float surge = surgeAt(flightAt(uv.y) - fallTime);
    vec2 side = vec2(-fallDir.y, fallDir.x);
    p.xz += fallDir * (sway * ${glslFloat(SWAY)} * t * t + surge * ${glslFloat(SURGE_REACH)} * t);
    p.xz += side * (sin(fallTime * 0.6 + fallSeed * 3.0 + t * 1.5) * ${glslFloat(SWAY * 0.5)} * t * t);
  }
  vPosition = p;
  gl_Position = viewProjection * vec4(p, 1.0);
}
`;

const FRAGMENT = `
precision highp float;

uniform float fallWidth;
uniform float fallLength;
uniform float fallSpread;
uniform float fallImpact;
uniform float pool;
uniform float dayness;
uniform vec3 sunColor;
uniform float sunIntensity;
uniform vec3 waterColor;
uniform vec3 foamColor;
${SHARED}
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
    float along = flightAt(down) - fallTime;
    float surge = surgeAt(along);
    float threads = fbm(vec2(across * 2.6, along * 0.9)) * 0.55
      + fbm(vec2(across * 7.5 + 4.1, along * 2.0)) * 0.3
      + noise(vec2(across * 18.0, along * 4.5)) * 0.15;
    float wobbleLeft = fbm(vec2(along * 0.8, 3.1));
    float wobbleRight = fbm(vec2(along * 0.8, 9.7));
    float glass = 1.0 - smoothstep(0.0, ${glslFloat(GLASS_DROP)}, down);
    float loose = 0.15 + 0.85 * smoothstep(0.0, ${glslFloat(GLASS_DROP)}, down);
    float edgeLeft = max(0.02, (0.1 + 0.35 * wobbleLeft * (0.4 + t) - surge * 0.12) * loose);
    float edgeRight = max(0.02, (0.1 + 0.35 * wobbleRight * (0.4 + t) - surge * 0.12) * loose);
    float soft = 0.25 * loose;
    float sides = smoothstep(edgeLeft, edgeLeft + soft, across) * smoothstep(edgeRight, edgeRight + soft, width - across);
    float gaps = smoothstep(0.22, 0.5, threads + 0.25 * (1.0 - t) + surge * 0.3);
    float lip = smoothstep(${glslFloat(-LIP_REACH)}, ${glslFloat(-LIP_REACH * 0.3)}, down);
    float foot = smoothstep(fallLength - 0.7, fallLength, down);
    float white = clamp(smoothstep(0.45, 0.8, threads) * (0.5 + 0.5 * t) + foot * 0.3 + surge * 0.35, 0.0, 1.0);
    color = mix(waterColor, foamColor, mix(0.18 + white * 0.75, 0.22 + 0.3 * threads, glass));
    float strands = clamp((0.45 + 0.5 * threads) * (0.85 + 0.3 * surge), 0.0, 1.0) * gaps;
    alpha = mix(strands, 0.6 + 0.25 * threads, glass) * sides * lip * (1.0 - foot * 0.85);
  } else {
    vec2 q = vUV;
    float surge = surgeAt(flightAt(fallDrop) - fallTime);
    float behind = step(q.y, fallImpact);
    float reachForward = max(mix(fallLength - fallImpact, fallImpact, behind), 0.01);
    float r = length(vec2(q.x / (fallWidth * 0.5), (q.y - fallImpact) / reachForward));
    float ragged = r + (fbm(q * 1.6 + vec2(fallTime * 0.12, -fallTime * 0.08)) - 0.5) * 0.5 - surge * 0.12;
    float churn = fbm(q * 2.4 + vec2(fallTime * 0.6, -fallTime * 0.9)) * 0.6 + fbm(q * 5.5 - fallTime * 1.5) * 0.4;
    float core = (1.0 - smoothstep(0.08, 0.42, ragged)) * (0.6 + 0.4 * churn);
    float patches = smoothstep(0.5 + ragged * 0.3, 0.72 + ragged * 0.2, churn) * (1.0 - smoothstep(0.4, 0.8, ragged));
    float rings = pow(0.5 + 0.5 * sin(ragged * 22.0 - fallTime * 4.5), 8.0) * smoothstep(0.32, 0.5, ragged) * (1.0 - smoothstep(0.55, 0.85, ragged));
    color = foamColor;
    alpha = clamp(max(core, patches) * 0.92 + rings * (0.2 + 0.15 * surge), 0.0, 1.0) * (1.0 - smoothstep(0.7, 0.95, r));
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

export function createWaterfallMaterial(scene, {
  waterColor, foamColor, width, length, drop, spread = 0, impact = 0, dirX, dirZ, seed, pool,
}) {
  registerShaders();
  const material = new ShaderMaterial(pool ? 'waterfallPoolMat' : 'waterfallMat', scene, { vertex: 'waterfall', fragment: 'waterfall' }, {
    attributes: ['position', 'uv'],
    samplers: [REVEAL_SAMPLER, REVEAL_SIGHT_SAMPLER, ...FIRE_SAMPLERS],
    uniforms: [
      'viewProjection', 'fallTime', 'fallWidth', 'fallLength', 'fallDrop', 'fallSpread', 'fallImpact', 'fallDir', 'fallSeed',
      'pool', 'dayness', 'sunColor', 'sunIntensity', 'waterColor', 'foamColor',
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
  material.setFloat('fallDrop', drop);
  material.setFloat('fallSpread', spread);
  material.setFloat('fallImpact', impact);
  material.setVector2('fallDir', new Vector2(dirX, dirZ));
  material.setFloat('fallSeed', seed);
  material.setFloat('pool', pool ? 1 : 0);
  material.setFloat('dayness', 1);
  material.setColor3('sunColor', new Color3(1, 0.95, 0.86));
  material.setFloat('sunIntensity', 1);
  material.setColor3('waterColor', waterColor);
  material.setColor3('foamColor', foamColor);
  return material;
}
