// Vlastní program pro vodu — vlny, odlesk slunce, odraz okolí, barva podle hloubky a pěna.
// Počítá se směrem pohledu orthografické kamery, takže je stabilní z každého úhlu.
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { Effect } from '@babylonjs/core/Materials/effect';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';

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

float waterRise(vec2 p, float depth, float time) {
  float calm = smoothstep(0.05, 1.1, depth);
  float phase = noise(p * 0.12 + vec2(time * 0.03, time * 0.02)) * 2.0 - 1.0;
  float waves = sin(p.x * 0.55 + time * 1.4 + phase * 2.2) * 0.09
              + sin(p.y * 0.42 - time * 1.8 + phase * 1.5) * 0.06
              + sin((p.x + p.y) * 1.1 + time * 2.3) * 0.025
              + sin((p.x - p.y) * 0.8 - time * 1.1 + phase * 3.0) * 0.035;
  float shore = 1.0 - smoothstep(0.0, 0.9, depth);
  float shoreNoise = noise(p * 0.35 + vec2(time * 0.12, -time * 0.09));
  float swash = sin(time * 0.8 + shoreNoise * 6.2831) * 0.22 * shore;
  return waves * calm + swash;
}
`;

const VERTEX = `
precision highp float;

attribute vec3 position;
attribute vec2 uv;

uniform mat4 viewProjection;
uniform float waterTime;
${WAVE}
varying vec3 vPosition;
varying float vDepth;

void main(void) {
  float depth = max(uv.x, 0.0);
  vDepth = depth;
  float rise = waterRise(position.xz, depth, waterTime);
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
uniform samplerCube reflectionSampler;

varying vec3 vPosition;
varying float vDepth;
${WAVE}
void main(void) {
  vec2 p = vPosition.xz;
  float depth = max(vDepth, 0.0);

  float waveHeight = waterRise(p, depth, waterTime);
  float eps = 0.22;
  float hx = waterRise(p + vec2(eps, 0.0), depth, waterTime);
  float hz = waterRise(p + vec2(0.0, eps), depth, waterTime);
  float gx = (hx - waveHeight) / eps;
  float gz = (hz - waveHeight) / eps;

  vec3 normal = normalize(vec3(-gx, 1.0, -gz));
  vec3 viewDir = normalize(cameraDir);

  float sun = max(dot(normal, sunDir), 0.0);
  vec3 halfDir = sunDir + viewDir;
  float halfLen = length(halfDir);
  halfDir = halfLen > 0.0001 ? halfDir / halfLen : normal;
  float spec = pow(max(dot(normal, halfDir), 0.0), 220.0);
  float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);

  float t = clamp(depth / maxDepth, 0.0, 1.0);
  vec3 base = mix(shallowColor, deepColor, t);

  float daylight = 0.35 + 0.65 * dayness;
  vec3 ambient = vec3(0.16, 0.22, 0.26) * daylight;
  vec3 color = base * (ambient + sunColor * sunIntensity * (0.35 + sun * 0.85));
  color += deepColor * 0.25;
  color += skyColor * fresnel * (0.20 + 0.60 * dayness);
  color += sunColor * spec * sunIntensity * 0.6;

  vec3 reflected = textureCube(reflectionSampler, reflect(-viewDir, normal)).rgb;
  float mirror = clamp(0.28 + fresnel * 1.2, 0.0, 0.75);
  mirror *= (0.4 + 0.6 * smoothstep(0.15, 1.1, depth)) * (0.4 + 0.6 * dayness);
  color = mix(color, reflected * 0.95, mirror);
  float crest = smoothstep(0.02, 0.2, waveHeight);
  color = mix(color, shallowColor * 1.2 + 0.02, crest * 0.3);

  float n1 = noise(p * 0.85 + vec2(waterTime * 0.22, waterTime * 0.16));
  float n2 = noise(p * 2.15 - vec2(waterTime * 0.34, waterTime * 0.27));
  float foamNoise = n1 * 0.68 + n2 * 0.32;
  float bandNoise = noise(p * 0.45 + vec2(waterTime * 0.05, -waterTime * 0.04));
  float band = 0.02 + bandNoise * 0.22;
  float shore = 1.0 - smoothstep(band, band + 0.5, depth);
  float tongues = smoothstep(0.30, 0.75, foamNoise + shore * 0.25);
  float foam = shore * mix(0.15, 1.0, tongues);
  float crestFoam = smoothstep(0.07, 0.2, waveHeight) * smoothstep(0.5, 0.8, foamNoise) * 0.5;
  float swashFoam = smoothstep(0.04, 0.13, waveHeight) * (1.0 - smoothstep(0.0, 0.4, depth)) * 0.65;
  float lace = (1.0 - smoothstep(0.35, 0.95, depth)) * smoothstep(0.62, 0.92, n2) * 0.4;
  foam = max(foam, crestFoam);
  foam = max(foam, swashFoam);
  foam = max(foam, lace);
  foam = smoothstep(0.1, 0.6, foam);
  color = mix(color, foamColor * (0.4 + 0.6 * dayness), foam * 0.85);

  float alpha = mix(0.30, 0.9, t);
  alpha = max(alpha, foam * 0.85);
  gl_FragColor = vec4(color, alpha);
}
`;

const SIDE_VERTEX = `
precision highp float;

attribute vec3 position;
attribute vec2 uv;

uniform mat4 viewProjection;
uniform float waterTime;
${WAVE}
varying vec2 vUV;
varying vec3 vPosition;

void main(void) {
  vec3 pos = position;
  if (uv.y < 0.5) {
    float depth = max(uv.x, 0.0);
    pos.y += waterRise(pos.xz, depth, waterTime);
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
    attributes: ['position', 'uv'],
    uniforms: [
      'viewProjection', 'waterTime', 'sunDir', 'sunColor', 'sunIntensity', 'skyColor',
      'cameraDir', 'shallowColor', 'deepColor', 'foamColor', 'dayness', 'maxDepth',
      'reflectionSampler',
    ],
  });
  material.backFaceCulling = false;
  material.alpha = 0.999;
  material.setFloat('waterTime', 0);
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
  return material;
}

export function createWaterSideMaterial(scene, options) {
  registerShaders();
  const material = new ShaderMaterial('waterSideMat', scene, { vertex: 'waterSide', fragment: 'waterSide' }, {
    attributes: ['position', 'uv'],
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
  material.setFloat('waterTime', seconds % 3600);
}

