// Vlastní program pro vodu — vlny, odlesk slunce, odraz okolí, barva podle hloubky a pěna.
// Vlny se počítají ze vzdálenosti od břehu, takže hřebeny jdou na každé straně k ostrovu.
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { Effect } from '@babylonjs/core/Materials/effect';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Vector2, Vector3, Matrix } from '@babylonjs/core/Maths/math.vector';
import {
  WAVE_TIME_WRAP, WAVE_CREST_SCALE, WAVE_REACH, CRASH_LIFT, SHORE_FOAM_WIDTH, SHORE_BREATH,
  FOAM_SWING, SHORE_SWING,
  waveAmpGlsl, waveFieldGlsl, rippleSlopeGlsl, rippleWarpGlsl, glslFloat,
} from '../utils/waterWaves.js';

const FOAM_DIR = 'assets/nature/textures/';
const FOAM_FILES = {
  fineColor: `${FOAM_DIR}foam_fine_color.jpg`,
  fineOpacity: `${FOAM_DIR}foam_fine_opacity.jpg`,
  fineNormal: `${FOAM_DIR}foam_fine_normal.jpg`,
  coarseColor: `${FOAM_DIR}foam_coarse_color.jpg`,
  coarseOpacity: `${FOAM_DIR}foam_coarse_opacity.jpg`,
};
const foamTextures = new WeakMap();

function foamTextureSet(scene) {
  const cached = foamTextures.get(scene);
  if (cached) return cached;
  const load = (url, normal) => {
    const texture = new Texture(url, scene);
    texture.wrapU = Texture.WRAP_ADDRESSMODE;
    texture.wrapV = Texture.WRAP_ADDRESSMODE;
    texture.anisotropicFilteringLevel = 4;
    if (normal) texture.gammaSpace = false;
    return texture;
  };
  const set = {
    fineColor: load(FOAM_FILES.fineColor, false),
    fineOpacity: load(FOAM_FILES.fineOpacity, false),
    fineNormal: load(FOAM_FILES.fineNormal, true),
    coarseColor: load(FOAM_FILES.coarseColor, false),
    coarseOpacity: load(FOAM_FILES.coarseOpacity, false),
  };
  foamTextures.set(scene, set);
  return set;
}

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
${waveFieldGlsl()}
`;

const VERTEX = `
precision highp float;

attribute vec3 position;
attribute float waveDist;
attribute float waveAmp;
attribute vec2 waveDir;
attribute float waveCliff;

uniform mat4 viewProjection;
uniform float waterTime;
${WAVE}
varying vec3 vPosition;
varying float vDist;
varying vec2 vDir;

void main(void) {
  float d = max(waveDist, 0.0);
  float cliff = clamp(waveCliff, 0.0, 1.0);
  float swell = swellAt(d, position.xz, waterTime);
  float rise = swell * waveAmp * shoalWithCliff(d, cliff);
  float wall = (1.0 - smoothstep(0.5, 4.5, d)) * smoothstep(1.5, 2.1, waveAmp);
  rise += wall * max(swell, 0.0) * ${glslFloat(CRASH_LIFT)} * (0.3 + 0.7 * cliff);
  vec3 world = vec3(position.x, position.y + rise, position.z);
  vPosition = world;
  vDist = d;
  vDir = waveDir;
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
uniform float waterDetail;
uniform float detailPixel;
uniform sampler2D depthMap;
uniform vec2 depthOrigin;
uniform vec2 depthScale;
uniform float depthRange;
uniform sampler2D reflectionSampler;
uniform mat4 reflectionViewProjection;
uniform vec2 foamDir;
uniform sampler2D foamFineColor;
uniform sampler2D foamFineOpacity;
uniform sampler2D foamFineNormal;
uniform sampler2D foamCoarseColor;
uniform sampler2D foamCoarseOpacity;

varying vec3 vPosition;
varying float vDist;
varying vec2 vDir;
${WAVE}
vec2 hashGradient(vec2 p) {
  vec2 g = vec2(hash(p * 1.37), hash(p * 1.37 + vec2(19.7, 7.3))) * 2.0 - 1.0;
  return g / max(length(g), 1e-4);
}

float rippleNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = dot(hashGradient(i), f);
  float b = dot(hashGradient(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));
  float c = dot(hashGradient(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0));
  float d = dot(hashGradient(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float detailWeight(float metres) {
  return smoothstep(3.0, 9.0, metres / max(detailPixel, 1e-5));
}

float rippleWeight(float metres) {
  return smoothstep(18.0, 40.0, metres / max(detailPixel, 1e-5));
}

vec2 ripplePhaseDir(vec2 dir, vec2 perp, float angle) {
  return -(dir * cos(angle) + perp * sin(angle));
}

vec2 rippleTerm(vec2 p, float time, vec2 dir, float k, float omega, float phase, float slope, float metres) {
  return dir * (slope * cos(dot(p, dir) * k + omega * time + phase)) * rippleWeight(metres);
}

${rippleWarpGlsl()}

vec2 rippleSlope(vec2 p, float time, vec2 dir, vec2 perp) {
  vec2 g = vec2(0.0);
${rippleSlopeGlsl()}
  return g;
}

vec2 bumpSlope(vec2 p, vec2 warp, float time, vec2 dir, vec2 perp) {
  return rippleSlope(p + warp * 1.2 + rippleWarp(p), time, dir, perp) * waterDetail;
}

void main(void) {
  vec2 p = vPosition.xz;
  vec2 depthUv = (p - depthOrigin) * depthScale;
  vec4 depthSample = texture2D(depthMap, clamp(depthUv, vec2(0.0), vec2(1.0)));
  float rawDrop = (depthSample.r - 0.5) * 2.0 * depthRange;
  float cliff = clamp(depthSample.g, 0.0, 1.0);
  float depth = max(rawDrop, 0.0);
  float wet = vPosition.y - waterLevel + rawDrop;
  float d = max(vDist, 0.0);
  float cliffFill = cliff * (1.0 - smoothstep(0.0, 1.6, d));
  depth = max(depth, cliffFill * 1.5);
  wet = max(wet, cliffFill * 0.5);

  float amp = ${waveAmpGlsl('depth', 'maxDepth')};
  float shoal = shoalWithCliff(d, cliff);
  float swell = swellAt(d, p, waterTime);
  vec2 grad = clamp(vDir, vec2(-2.0), vec2(2.0));
  vec2 bigSlope = grad * (swellSlopeAt(d, p, waterTime) * amp * shoal);
  vec2 toward = -normalize(grad + vec2(1e-5, 1e-5));
  vec2 blendDir = foamDir * 0.65 + toward * 0.35;
  vec2 rippleBase = length(blendDir) > 0.2 ? normalize(blendDir) : foamDir;
  vec2 ripplePerp = vec2(-rippleBase.y, rippleBase.x);
  float swash = swashAt(d, p, waterTime);
  float shoreRise = clamp(swell / ${glslFloat(WAVE_REACH)}, -1.0, 1.0);
  vec2 drifts = foamDrift(foamDir, waterTime) + foamDir * (shoreRise * ${glslFloat(FOAM_SWING)});

  vec2 surfaceWarp = vec2(
    noise(p * 0.045 + vec2(11.3, 5.7)),
    noise(p * 0.045 + vec2(-7.9, 19.1))
  ) - 0.5;
  vec2 detailSlope = bumpSlope(p, surfaceWarp, waterTime, rippleBase, ripplePerp);
  vec2 slope = detailSlope + bigSlope;
  float waveSlope = length(bigSlope);
  vec3 normal = normalize(vec3(-slope.x, 1.0, -slope.y));
  vec3 waveNormal = normalize(vec3(-bigSlope.x, 1.0, -bigSlope.y));
  vec3 shadeNormal = normalize(mix(waveNormal, normal, 0.55));
  vec3 viewDir = normalize(cameraDir);

  float sun = max(dot(shadeNormal, sunDir), 0.0);
  float fresnel = pow(1.0 - max(dot(waveNormal, viewDir), 0.0), 5.0);
  float daylight = 0.55 + 0.45 * dayness;

  float t = clamp(depth / maxDepth, 0.0, 1.0);
  vec3 scatter = 1.0 - exp(-depth * vec3(1.2, 0.5, 0.32));
  vec3 base = mix(shallowColor, deepColor, clamp(scatter.r, 0.0, 1.0));

  vec3 ambient = vec3(0.1, 0.15, 0.18) * daylight;
  vec3 color = base * (ambient + sunColor * sunIntensity * (0.34 + sun * 0.66));

  vec4 reflectionPos = reflectionViewProjection * vec4(vPosition, 1.0);
  vec2 reflectionUv = reflectionPos.xy / max(abs(reflectionPos.w), 1e-4) * 0.5 + 0.5;
  reflectionUv += bigSlope * 0.02;
  vec2 blurOffset = vec2(clamp(0.001 + waveSlope * 0.01, 0.0, 0.004));
  blurOffset.y *= 0.6;
  vec3 reflected = texture2D(reflectionSampler, clamp(reflectionUv + blurOffset, vec2(0.002), vec2(0.998))).rgb
    + texture2D(reflectionSampler, clamp(reflectionUv - blurOffset, vec2(0.002), vec2(0.998))).rgb;
  reflected *= 0.5;
  reflected = mix(reflected, skyColor, 0.08);

  float mirror = clamp(0.08 + 0.45 * fresnel + 0.28 * waveSlope, 0.0, 0.55);
  mirror *= (0.5 + 0.5 * smoothstep(0.0, 0.9, depth)) * (0.6 + 0.4 * dayness);
  color = mix(color, reflected, mirror);

  float crestNoise = noise(p * 0.045 + vec2(waterTime * 0.02, -waterTime * 0.015));
  float crest = smoothstep(0.05, 0.22, waveSlope) * (0.4 + 0.9 * crestNoise);
  color = mix(color, shallowColor * 1.05 + 0.02, crest * 0.1);

  vec3 halfDir = normalize(sunDir + viewDir + vec3(0.0, 1e-4, 0.0));
  float facing = max(dot(normal, halfDir), 0.0);
  float sheen = pow(facing, 26.0) * 0.1;
  float sparkleNoise = clamp(rippleNoise(p * 0.35 + waterTime * 0.02) * 1.4 + 0.5, 0.0, 1.0);
  float sparkle = pow(facing, 48.0) * sparkleNoise * 0.2 * rippleWeight(2.8);
  color += sunColor * (sheen + sparkle) * sunIntensity * dayness * 0.35;

  mat2 turnFine = mat2(0.98, -0.19, 0.19, 0.98);
  mat2 turnMid = mat2(0.82, -0.57, 0.57, 0.82);
  mat2 turnChop = mat2(0.55, 0.83, -0.83, 0.55);
  vec2 uvFine = turnFine * p * 0.19 + surfaceWarp * 1.2 - drifts * 0.19;
  vec2 uvMid = turnMid * p * 0.08 + surfaceWarp * 2.1 + vec2(0.37, 0.19) - drifts * 0.08;
  vec2 uvChop = turnChop * p * 0.43 + surfaceWarp * 0.6 + vec2(0.61, 0.43) - drifts * 0.43;
  float fineWeight = detailWeight(0.2);
  float chopWeight = detailWeight(0.1);
  vec3 fineColor = texture2D(foamFineColor, uvFine).rgb;
  vec3 coarseColor = texture2D(foamCoarseColor, uvMid).rgb;
  vec3 chopColor = texture2D(foamFineColor, uvChop).rgb;
  float fineAlpha = texture2D(foamFineOpacity, uvFine).r;
  float coarseAlpha = texture2D(foamCoarseOpacity, uvMid).r;
  float chopAlpha = texture2D(foamFineOpacity, uvChop).r;
  vec3 fineNormal = texture2D(foamFineNormal, uvFine * 1.31).xyz * 2.0 - 1.0;
  float texFoam = clamp(fineAlpha * 0.7 * fineWeight + coarseAlpha * 0.55 + chopAlpha * 0.35 * chopWeight, 0.0, 1.0);
  vec3 foamTexel = fineColor * 0.55 + coarseColor * 0.45 + chopColor * 0.25;
  float foamLift = 0.78 + 0.44 * clamp(fineNormal.y * 0.5 + 0.5, 0.0, 1.0);
  float patchNoise = rippleNoise(p * 0.075 + drifts * 0.06) * 1.6 + 0.5;
  float gateNoise = rippleNoise(p * 0.1 + drifts * 0.09) * 1.6 + 0.5;
  float foamPatch = smoothstep(0.22, 0.78, patchNoise);

  float seaCrest = swell / ${glslFloat(WAVE_CREST_SCALE)};
  float crestGate = 0.1 + 0.35 * gateNoise;
  float crestShape = smoothstep(crestGate, crestGate + 0.22, seaCrest);

  float shoreBreath = rippleNoise(p * ${glslFloat(SHORE_BREATH.scale)} + waterTime * ${glslFloat(SHORE_BREATH.speed)}) * ${glslFloat(SHORE_BREATH.amount)};
  float dShore = max(0.0, d - shoreBreath);
  float shoreWidth = ${glslFloat(SHORE_FOAM_WIDTH)} * (0.6 + 0.8 * swash);
  float shoreBand = 1.0 - smoothstep(0.0, shoreWidth, dShore);
  float shoreLace = shoreBand * (0.85 + 0.6 * foamPatch) * (0.65 + 0.35 * swash) * (1.0 - 0.9 * cliff);
  float shallowFoam = (1.0 - smoothstep(0.03, 0.5, rawDrop + shoreRise * ${glslFloat(SHORE_SWING)})) * (0.45 + 0.85 * foamPatch) * (0.6 + 0.4 * swash);

  float breaker = crestShape * (1.0 - smoothstep(2.5, 10.0, d)) * (0.2 + 0.9 * foamPatch);
  float whitecap = crestShape * smoothstep(10.0, 26.0, d) * 0.08 * foamPatch;
  float cliffReach = 1.0 - smoothstep(0.0, 2.2 + 2.6 * cliff, d);
  float crash = cliff * cliffReach * (0.35 + 0.95 * crestShape) * (0.45 + 0.75 * foamPatch);

  float foam = max(max(max(shoreLace, breaker), max(crash, whitecap)), shallowFoam);
  foam *= mix(0.6, 1.0, texFoam);
  float shoreCut = smoothstep(-0.015, 0.02, rawDrop);
  float visible = max(smoothstep(-0.02, 0.04, wet) * shoreCut, cliffFill);
  foam *= smoothstep(0.0, 0.03, wet) * max(shoreCut, cliffFill);
  float foamAmount = clamp(foam, 0.0, 1.0);
  vec3 foamTint = foamColor * foamTexel * foamLift * (0.5 + 0.6 * dayness);
  color = mix(color, foamTint, foamAmount);
  color += foamColor * crash * 0.1 * dayness;

  float alpha = mix(0.62, 0.96, t) * visible;
  alpha = max(alpha, mix(foamAmount * 0.5, 0.96, foamAmount * foamAmount));
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
    float d = max(waveDist, 0.0);
    pos.y += swellAt(d, position.xz, waterTime) * shoalAt(d) * waveAmp;
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
uniform float waterTime;

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
  float pattern = noise(vec2(vPosition.x * 0.7, vPosition.z * 0.7 - waterTime * 0.05));
  float foam = (1.0 - smoothstep(0.02, 0.22, t)) * (0.3 + 0.7 * pattern);
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
    attributes: ['position', 'waveDist', 'waveAmp', 'waveDir', 'waveCliff'],
    uniforms: [
      'viewProjection', 'waterTime', 'sunDir', 'sunColor', 'sunIntensity', 'skyColor',
      'cameraDir', 'shallowColor', 'deepColor', 'foamColor', 'dayness', 'maxDepth',
      'reflectionSampler', 'reflectionViewProjection', 'waterLevel',
      'depthMap', 'waterDetail', 'detailPixel', 'depthOrigin', 'depthScale', 'depthRange', 'foamDir',
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
  material.setFloat('detailPixel', 0.02);
  material.setVector2('foamDir', new Vector2(0, -1));
  const foam = foamTextureSet(scene);
  material.setTexture('foamFineColor', foam.fineColor);
  material.setTexture('foamFineOpacity', foam.fineOpacity);
  material.setTexture('foamFineNormal', foam.fineNormal);
  material.setTexture('foamCoarseColor', foam.coarseColor);
  material.setTexture('foamCoarseOpacity', foam.coarseOpacity);
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

