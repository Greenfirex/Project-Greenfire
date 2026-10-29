// Vlastní program pro vodu — vlny, odlesk slunce, odraz okolí, barva podle hloubky a pěna.
// Počítá se směrem pohledu orthografické kamery, takže je stabilní z každého úhlu.
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { Effect } from '@babylonjs/core/Materials/effect';
import { Vector3, Matrix } from '@babylonjs/core/Maths/math.vector';
import { WAVE_TIME_WRAP, swellGlsl, swellSlopeGlsl, waveDriftGlsl, waveAmpGlsl } from '../utils/waterWaves.js';
import { causticGlsl } from '../utils/waterCaustics.js';

const swashPhaseGlsl = `
float swashPhase(vec2 p, float time) {
  float drift = noise(p * 0.16 + vec2(time * 0.07, -time * 0.05));
  return sin(time * 0.9 + drift * 6.2831 + p.x * 0.22 + p.y * 0.18);
}
`;

const WAVE = `
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

float seaHeight(float waveDist, float time) {
  return ${swellGlsl()};
}

vec2 swellSlope(float waveDist, vec2 dir, float time) {
  return ${swellSlopeGlsl()};
}

${swashPhaseGlsl}

${causticGlsl()}
`;
const VERTEX = `
precision highp float;

attribute vec3 position;
attribute vec2 waveDir;
attribute float waveDist;
attribute float waveAmp;

uniform mat4 viewProjection;
uniform float waterTime;
${WAVE}
varying vec3 vPosition;
varying float vSwash;
varying vec2 vWaveDir;

void main(void) {
  vSwash = swashPhase(position.xz, waterTime);
  float rise = seaHeight(waveDist, waterTime) * waveAmp;
  vec3 world = vec3(position.x, position.y + rise, position.z);
  vWaveDir = waveDir;
  vPosition = world;
  gl_Position = viewProjection * vec4(world, 1.0);
}
`;

const FRAGMENT = `
precision highp float;

uniform float waterTime;
uniform vec3 sunDir;
uniform vec3 sunColor;
uniform float sunIntensity;
uniform vec3 skyColor;
uniform vec3 cameraDir;
uniform vec3 shallowColor;
uniform vec3 deepColor;
uniform vec3 foamColor;
uniform float dayness;
uniform float maxDepth;
uniform float waterLevel;
uniform sampler2D depthMap;
uniform sampler2D bumpDetail;
uniform sampler2D waveDistMap;
uniform float waterDetail;
uniform vec2 depthOrigin;
uniform vec2 depthScale;
uniform float depthRange;
uniform sampler2D reflectionSampler;
uniform mat4 reflectionViewProjection;

varying vec3 vPosition;
varying float vSwash;
varying vec2 vWaveDir;
${WAVE}
${waveDriftGlsl()}

vec2 bumpSlope(vec2 p, vec2 flow) {
  vec2 fine = texture2D(bumpDetail, p * 0.42 - flow * 0.42).xy * 2.0 - 1.0;
  vec2 mid = texture2D(bumpDetail, p * 0.17 - flow * 0.2125 + vec2(0.37, 0.61)).xy * 2.0 - 1.0;
  return (fine * 0.11 + mid * 0.07) * waterDetail;
}

void main(void) {
  vec2 p = vPosition.xz;
  vec2 depthUv = (p - depthOrigin) * depthScale;
  float rawDrop = (texture2D(depthMap, clamp(depthUv, vec2(0.0), vec2(1.0))).r - 0.5) * 2.0 * depthRange;
  float depth = max(rawDrop, 0.0);
  float wet = vPosition.y - waterLevel + rawDrop;
  float waveDist = texture2D(waveDistMap, clamp(depthUv, vec2(0.0), vec2(1.0))).r;

  vec2 flow = waveDriftShift(waterTime);
  float amp = ${waveAmpGlsl('depth', 'maxDepth')};
  vec2 slope = bumpSlope(p, flow) + swellSlope(waveDist, vWaveDir, waterTime) * amp;
  float slopeSize = length(slope);
  vec3 normal = normalize(vec3(-slope.x, 1.0, -slope.y));
  vec3 viewDir = normalize(cameraDir);

  float sun = max(dot(normal, sunDir), 0.0);
  float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);

  float t = clamp(depth / maxDepth, 0.0, 1.0);
  vec3 transmittance = exp(-depth * vec3(1.05, 0.42, 0.26));
  vec3 base = shallowColor * transmittance + deepColor * (1.0 - transmittance);

  vec3 reflectedDir = reflect(-viewDir, normal);
  float upness = clamp(reflectedDir.y, 0.0, 1.0);
  vec3 skyReflect = mix(skyColor * 0.5, skyColor * 0.9, smoothstep(0.1, 0.85, upness));
  vec4 reflectionPos = reflectionViewProjection * vec4(vPosition, 1.0);
  vec2 reflectionUv = reflectionPos.xy / max(abs(reflectionPos.w), 1e-4) * 0.5 + 0.5;
  reflectionUv += slope * 0.04;
  vec2 blurOffset = vec2(clamp(0.0015 + slopeSize * 0.035, 0.0, 0.012));
  blurOffset.y *= 0.6;
  vec3 reflected = texture2D(reflectionSampler, clamp(reflectionUv + blurOffset, vec2(0.002), vec2(0.998))).rgb
    + texture2D(reflectionSampler, clamp(reflectionUv - blurOffset, vec2(0.002), vec2(0.998))).rgb;
  reflected *= 0.5;
  reflected = mix(reflected, skyReflect, 0.15);

  float mirror = clamp(0.36 + fresnel * 1.2, 0.0, 0.88);
  mirror *= (0.55 + 0.45 * smoothstep(0.1, 1.0, depth)) * (0.55 + 0.45 * dayness);

  float daylight = 0.55 + 0.45 * dayness;
  vec3 ambient = vec3(0.16, 0.22, 0.26) * daylight;
  vec3 color = base * (ambient + sunColor * sunIntensity * (0.35 + sun * 0.85));
  color += deepColor * 0.25;
  color = mix(color, reflected, mirror);
  color *= 1.0 + slopeSize * 0.9;
  vec3 halfDir = normalize(sunDir + viewDir + vec3(0.0, 1e-4, 0.0));
  float glint = pow(max(dot(normal, halfDir), 0.0), 160.0);
  color += sunColor * glint * sunIntensity * (1.8 * dayness);
  float caustic = causticPattern(p, vec2(0.8, 0.6), waterTime);
  caustic *= (1.0 - smoothstep(0.0, 1.0, depth)) * (0.30 + 0.70 * dayness);
  color += sunColor * caustic * sunIntensity * 0.04;

  float crestNoise = noise(p * 0.045 + vec2(waterTime * 0.02, -waterTime * 0.017));
  float crest = smoothstep(0.06, 0.55, slopeSize) * (0.4 + 0.9 * crestNoise);
  color = mix(color, shallowColor * 1.15 + 0.02, crest * 0.16);

  float n1 = noise(p * 0.90 + vec2(waterTime * 0.25, waterTime * 0.20));
  float n2 = noise(p * 2.30 - vec2(waterTime * 0.40, waterTime * 0.30));
  float lace = noise(p * 3.60 + vec2(waterTime * 0.55, -waterTime * 0.45));
  float foamNoise = n1 * 0.62 + n2 * 0.38;
  float foamBand = (1.0 - smoothstep(0.03, 0.24, wet)) * smoothstep(-0.02, 0.03, wet);
  float foam = foamBand * smoothstep(0.48, 0.76, foamNoise + 0.20);
  foam = smoothstep(0.20, 0.55, foam);
  float seaCrest = seaHeight(waveDist, waterTime) * amp / 0.33;
  float breaker = smoothstep(0.40, 0.88, seaCrest) * smoothstep(0.06, 0.24, depth) * (1.0 - smoothstep(0.5, 1.3, depth));
  float wakeCrest = seaHeight(waveDist + 0.9, waterTime) * amp / 0.33;
  float wake = smoothstep(0.30, 0.80, wakeCrest) * smoothstep(0.10, 0.35, depth) * (1.0 - smoothstep(0.9, 2.0, depth)) * 0.6;
  foam = max(foam, breaker * 0.85);
  foam = max(foam, wake);
  foam *= mix(0.55, 1.0, 1.0 - smoothstep(0.0, 0.12, abs(lace - 0.5)));
  foam *= mix(0.35, 1.0, 1.0 - smoothstep(-0.7, 0.2, vSwash));
  float shoreCut = smoothstep(-0.03, 0.06, rawDrop);
  float visible = smoothstep(0.0, 0.22, wet) * shoreCut;
  foam *= smoothstep(0.015, 0.12, wet);
  float foamAmount = clamp(foam * 0.8 * shoreCut, 0.0, 1.0);
  color = mix(color, foamColor * (0.4 + 0.6 * dayness), foamAmount);

  float alpha = mix(0.4, 0.94, t) * visible;
  alpha = max(alpha, foamAmount * 0.72);
  gl_FragColor = vec4(color, alpha);
}
`;

const SIDE_VERTEX = `
precision highp float;

attribute vec3 position;
attribute vec2 uv;
attribute float waveDist;
attribute float waveAmp;

uniform mat4 viewProjection;
uniform float waterTime;
${WAVE}
varying vec2 vUV;
varying vec3 vPosition;

void main(void) {
  vec3 pos = position;
  if (uv.y < 0.5) {
    pos.y += seaHeight(waveDist, waterTime) * waveAmp;
  }
  vUV = uv;
  vPosition = pos;
  gl_Position = viewProjection * vec4(pos, 1.0);
}
`;

const SIDE_FRAGMENT = `
precision highp float;

uniform vec3 surfaceColor;
uniform vec3 deepColor;
uniform vec3 foamColor;
uniform float dayness;

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
  float t = clamp(vUV.y, 0.0, 1.0);
  vec3 color = mix(surfaceColor, deepColor, t);
  float pattern = noise(vec2(vPosition.x * 0.9, vPosition.z * 0.9));
  float foam = (1.0 - smoothstep(0.03, 0.18, t)) * (0.35 + 0.65 * pattern);
  color = mix(color, foamColor, clamp(foam, 0.0, 1.0) * 0.45);
  color *= 0.45 + 0.55 * dayness;
  gl_FragColor = vec4(color, 0.94);
}
`;

let registered = false;

function registerShaders() {
  if (registered) return;
  registered = true;
  Effect.ShadersStore.waterVertexShader = VERTEX;
  Effect.ShadersStore.waterFragmentShader = FRAGMENT;
  Effect.ShadersStore.waterSideVertexShader = SIDE_VERTEX;
  Effect.ShadersStore.waterSideFragmentShader = SIDE_FRAGMENT;
}

export function createWaterMaterial(scene, options) {
  registerShaders();
  const material = new ShaderMaterial('waterSurfaceMat', scene, { vertex: 'water', fragment: 'water' }, {
    attributes: ['position', 'waveDir', 'waveDist', 'waveAmp'],
    uniforms: [
      'viewProjection', 'waterTime', 'sunDir', 'sunColor', 'sunIntensity', 'skyColor',
      'cameraDir', 'shallowColor', 'deepColor', 'foamColor', 'dayness', 'maxDepth',
      'reflectionSampler', 'reflectionViewProjection', 'waterLevel',
      'depthMap', 'bumpDetail', 'waterDetail', 'waveDistMap', 'depthOrigin', 'depthScale', 'depthRange',
    ],
  });
  material.backFaceCulling = false;
  material.alpha = 0.999;
  material.setFloat('waterTime', 0);
  material.setMatrix('reflectionViewProjection', Matrix.Identity());
  material.setVector3('sunDir', new Vector3(0.35, 0.8, 0.45).normalize());
  material.setColor3('sunColor', options.sunColor);
  material.setFloat('sunIntensity', 1);
  material.setColor3('skyColor', options.skyColor);
  material.setVector3('cameraDir', new Vector3(0, 1, 0));
  material.setColor3('shallowColor', options.shallowColor);
  material.setColor3('deepColor', options.deepColor);
  material.setColor3('foamColor', options.foamColor);
  material.setFloat('dayness', 1);
  material.setFloat('maxDepth', options.maxDepth);
  material.setFloat('waterLevel', 0);
  material.setFloat('waterDetail', 1);
  return material;
}

export function createWaterSideMaterial(scene, options) {
  registerShaders();
  const material = new ShaderMaterial('waterSideMat', scene, { vertex: 'waterSide', fragment: 'waterSide' }, {
    attributes: ['position', 'uv', 'waveDist', 'waveAmp'],
    uniforms: ['viewProjection', 'waterTime', 'surfaceColor', 'deepColor', 'foamColor', 'dayness'],
  });
  material.backFaceCulling = false;
  material.alpha = 0.999;
  material.setFloat('waterTime', 0);
  material.setColor3('surfaceColor', options.shallowColor);
  material.setColor3('deepColor', options.deepColor);
  material.setColor3('foamColor', options.foamColor);
  material.setFloat('dayness', 1);
  return material;
}

export function tickWater(material, seconds) {
  material.setFloat('waterTime', seconds % WAVE_TIME_WRAP);
}

