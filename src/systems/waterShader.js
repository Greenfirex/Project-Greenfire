// Vlastní program pro vodu — vlny, odlesk slunce, odraz okolí, barva podle hloubky a pěna.
// Počítá se směrem pohledu orthografické kamery, takže je stabilní z každého úhlu.
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { Effect } from '@babylonjs/core/Materials/effect';
import { Vector3, Matrix } from '@babylonjs/core/Maths/math.vector';

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

vec2 rotateDir(vec2 direction, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec2(direction.x * c - direction.y * s, direction.x * s + direction.y * c);
}

vec2 seaDirection(vec2 baseDir, vec2 p, float time) {
  vec2 base = normalize(baseDir + vec2(1e-5));
  float wobble = (noise(p * 0.04 + vec2(time * 0.02, time * 0.01)) - 0.5) * 0.24;
  return rotateDir(base, wobble);
}

float seaPhase(vec2 p, vec2 dir, float wavelength, float speed, float time) {
  float k = 6.28318 / wavelength;
  return k * (dot(p, dir) - speed * time);
}

float seaHeight(vec2 p, vec2 dir, float time) {
  return sin(seaPhase(p, dir, 18.0, 1.2, time)) * 0.16
       + sin(seaPhase(p, dir, 11.0, 1.7, time)) * 0.11
       + sin(seaPhase(p, dir, 7.0, 2.3, time)) * 0.06;
}

float swell(vec2 p, vec2 dir, float time) {
  return seaHeight(p, dir, time);
}

vec2 swellSlope(vec2 p, vec2 dir, float time) {
  vec2 slope = dir * (6.28318 / 18.0) * 0.16 * cos(seaPhase(p, dir, 18.0, 1.2, time));
  slope += dir * (6.28318 / 11.0) * 0.11 * cos(seaPhase(p, dir, 11.0, 1.7, time));
  slope += dir * (6.28318 / 7.0) * 0.06 * cos(seaPhase(p, dir, 7.0, 2.3, time));
  return slope;
}

vec2 rippleSlope(vec2 p, vec2 dir, float time) {
  float mask = noise(p * 0.17 + vec2(time * 0.06, -time * 0.05));
  float gain = mix(0.7, 1.15, mask);
  vec2 fine = rotateDir(dir, 0.32);
  vec2 slope = dir * (6.28318 / 3.2) * 0.012 * cos(seaPhase(p, dir, 3.2, 0.9, time));
  slope += fine * (6.28318 / 1.8) * 0.007 * cos(seaPhase(p, fine, 1.8, 1.3, time));
  return slope * gain;
}

float swashPhase(vec2 p, float time) {
  float drift = noise(p * 0.16 + vec2(time * 0.07, -time * 0.05));
  return sin(time * 0.9 + drift * 6.2831 + p.x * 0.22 + p.y * 0.18);
}

`;
const VERTEX = `
precision highp float;

attribute vec3 position;

uniform mat4 viewProjection;
uniform float waterTime;
uniform vec2 seaDir;
${WAVE}
varying vec3 vPosition;
varying float vSwash;

void main(void) {
  vSwash = swashPhase(position.xz, waterTime);
  vec2 dir = seaDirection(seaDir, position.xz, waterTime);
  float rise = swell(position.xz, dir, waterTime);
  vec3 world = vec3(position.x, position.y + rise, position.z);
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
uniform vec2 seaDir;
uniform sampler2D depthMap;
uniform vec2 depthOrigin;
uniform vec2 depthScale;
uniform float depthRange;
uniform sampler2D reflectionSampler;
uniform mat4 reflectionViewProjection;

varying vec3 vPosition;
varying float vSwash;
${WAVE}

void main(void) {
  vec2 p = vPosition.xz;
  vec2 depthUv = (p - depthOrigin) * depthScale;
  float rawDrop = (texture2D(depthMap, clamp(depthUv, vec2(0.0), vec2(1.0))).r - 0.5) * 2.0 * depthRange;
  float depth = max(rawDrop, 0.0);
  float wet = vPosition.y - waterLevel + rawDrop;
  vec2 dir = seaDirection(seaDir, p, waterTime);

  vec2 ripple = rippleSlope(p, dir, waterTime);
  vec2 slope = ripple + swellSlope(p, dir, waterTime);
  float slopeSize = length(slope);
  vec3 normal = normalize(vec3(-slope.x, 1.0, -slope.y));
  vec3 viewDir = normalize(cameraDir);

  float sun = max(dot(normal, sunDir), 0.0);
  vec3 halfDir = sunDir + viewDir;
  float halfLen = length(halfDir);
  halfDir = halfLen > 0.0001 ? halfDir / halfLen : normal;
  float halfDot = max(dot(normal, halfDir), 0.0);
  float glitter = pow(halfDot, 700.0) * 5.0 * smoothstep(0.35, 0.75, noise(p * 3.6 + vec2(waterTime * 0.80, -waterTime * 0.65)));
  float spec = pow(halfDot, 420.0) * 1.1 + pow(halfDot, 60.0) * 0.35 + glitter;
  float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);

  float t = clamp(depth / maxDepth, 0.0, 1.0);
  vec3 transmittance = exp(-depth * vec3(1.05, 0.42, 0.26));
  vec3 base = shallowColor * transmittance + deepColor * (1.0 - transmittance);

  vec3 reflectedDir = reflect(-viewDir, normal);
  float upness = clamp(reflectedDir.y, 0.0, 1.0);
  vec3 skyReflect = mix(skyColor * 0.5, skyColor * 0.9, smoothstep(0.1, 0.85, upness));
  vec4 reflectionPos = reflectionViewProjection * vec4(vPosition, 1.0);
  vec2 reflectionUv = reflectionPos.xy / max(abs(reflectionPos.w), 1e-4) * 0.5 + 0.5;
  reflectionUv += slope * 0.10;
  vec3 reflected = texture2D(reflectionSampler, clamp(reflectionUv, vec2(0.002), vec2(0.998))).rgb;
  reflected = mix(reflected, skyReflect, 0.15);

  float mirror = clamp(0.40 + fresnel * 1.1, 0.0, 0.85);
  mirror *= (0.55 + 0.45 * smoothstep(0.1, 1.0, depth)) * (0.55 + 0.45 * dayness);

  float daylight = 0.55 + 0.45 * dayness;
  vec3 ambient = vec3(0.16, 0.22, 0.26) * daylight;
  vec3 color = base * (ambient + sunColor * sunIntensity * (0.35 + sun * 0.85));
  color += deepColor * 0.25;
  color = mix(color, reflected, mirror);
  color *= 1.0 + slopeSize * 0.9;
  float causticPhase = dot(p, dir) * 1.6 - waterTime * 0.9;
  float causticA = sin(causticPhase + noise(p * 0.55 + vec2(waterTime * 0.15, -waterTime * 0.12)) * 5.0);
  float causticB = sin(causticPhase * 1.7 + 2.1 + noise(p * 0.75 - vec2(waterTime * 0.11, waterTime * 0.16)) * 5.0);
  float caustic = pow(abs(causticA * causticB), 1.5);
  caustic *= (1.0 - smoothstep(0.0, 1.0, depth)) * (0.30 + 0.70 * dayness);
  color += sunColor * caustic * sunIntensity * 0.10;
  color += sunColor * spec * sunIntensity * 0.5;

  float crest = smoothstep(0.10, 0.35, slopeSize);
  color = mix(color, shallowColor * 1.15 + 0.02, crest * 0.22);

  float n1 = noise(p * 0.90 + vec2(waterTime * 0.25, waterTime * 0.20));
  float n2 = noise(p * 2.30 - vec2(waterTime * 0.40, waterTime * 0.30));
  float foamNoise = n1 * 0.62 + n2 * 0.38;
  float foamBand = (1.0 - smoothstep(0.02, 0.12, wet)) * smoothstep(-0.02, 0.02, wet);
  float foam = foamBand * smoothstep(0.42, 0.85, foamNoise + 0.20);
  foam = smoothstep(0.05, 0.60, foam);
  float seaCrest = seaHeight(p, dir, waterTime) / 0.33;
  float breaker = smoothstep(0.45, 0.92, seaCrest) * smoothstep(0.06, 0.22, depth) * (1.0 - smoothstep(0.45, 1.1, depth));
  foam = max(foam, breaker * 0.45);
  foam *= mix(0.35, 1.0, 1.0 - smoothstep(-0.7, 0.2, vSwash));
  float shoreCut = smoothstep(-0.03, 0.06, rawDrop);
  float visible = smoothstep(0.0, 0.22, wet) * shoreCut;
  foam *= smoothstep(0.015, 0.12, wet);
  color = mix(color, foamColor * (0.4 + 0.6 * dayness), foam * 0.55 * shoreCut);

  float alpha = mix(0.30, 0.9, t) * visible;
  alpha = max(alpha, foam * 0.5 * shoreCut);
  gl_FragColor = vec4(color, alpha);
}
`;

const SIDE_VERTEX = `
precision highp float;

attribute vec3 position;
attribute vec2 uv;

uniform mat4 viewProjection;
uniform float waterTime;
uniform vec2 seaDir;
${WAVE}
varying vec2 vUV;
varying vec3 vPosition;

void main(void) {
  vec3 pos = position;
  if (uv.y < 0.5) {
    vec2 dir = seaDirection(seaDir, pos.xz, waterTime);
    pos.y += swell(pos.xz, dir, waterTime);
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
  float foam = smoothstep(0.18, 0.03, t) * (0.35 + 0.65 * pattern);
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
    attributes: ['position'],
    uniforms: [
      'viewProjection', 'waterTime', 'sunDir', 'sunColor', 'sunIntensity', 'skyColor',
      'cameraDir', 'shallowColor', 'deepColor', 'foamColor', 'dayness', 'maxDepth',
      'reflectionSampler', 'reflectionViewProjection', 'waterLevel',
      'depthMap', 'depthOrigin', 'depthScale', 'depthRange', 'seaDir',
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
  return material;
}

export function createWaterSideMaterial(scene, options) {
  registerShaders();
  const material = new ShaderMaterial('waterSideMat', scene, { vertex: 'waterSide', fragment: 'waterSide' }, {
    attributes: ['position', 'uv'],
    uniforms: ['viewProjection', 'waterTime', 'surfaceColor', 'deepColor', 'foamColor', 'dayness', 'seaDir'],
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
  material.setFloat('waterTime', seconds % 3600);
}

