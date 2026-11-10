// Vlny vodní hladiny — jediné místo, kde jsou jejich čísla i výpočet.
// Fáze se bere ze vzdálenosti od břehu, takže hřebeny jsou obrysy ostrova
// a na každé straně běží ke břehu; kratší vlnky dodělá až jemný šum v programu.
import { smoothstep } from './noise.js';

const SWELL_WAVES = [
  { wavelength: 9, period: 4, height: 0.055, phase: 0.6, shape: true },
  { wavelength: 5.6, period: 4, height: 0.032, phase: 2.4, shape: true },
  { wavelength: 4, period: 4, height: 0.018, phase: 4.9, shape: false },
  { wavelength: 2.8, period: 4, height: 0.01, phase: 1.2, shape: false },
];

export const WAVE_REACH = SWELL_WAVES
  .filter((wave) => wave.shape)
  .reduce((sum, wave) => sum + wave.height, 0);
export const WAVE_CREST_SCALE = WAVE_REACH * 1.35;
export const WAVE_TIME_WRAP = 3600;
export const CRASH_LIFT = 1.2;
export const CLIFF_SHOAL = 0.45;
export const CLIFF_RISE_MIN = 1.2;
export const SEA_DIRECTION = [0.94, 0.34];
export const WATER_MAX_DEPTH = 2.5;
export const SHORE_FOAM_WIDTH = 1.5;
export const SEA_DISTANCE_REACH = 6;
const SHOAL_REACH = 7;
const SHOAL_GAIN = 0.85;
const WAVE_AMP_MIN = 1.2;
const WAVE_AMP_MAX = 2.6;
const GUST = {
  base: 0.86,
  slow: 0.14,
  slowSpeed: (Math.PI * 2) / 40,
  fast: 0.05,
  fastSpeed: (Math.PI * 2) / 16,
};
const SWASH_TIME = (Math.PI * 2) / 4;
const SWASH_DIST = 0.9;
export const FOAM_SWING = 0.5;
export const SHORE_SWING = 0.08;
const RIPPLE_WAVES = [
  { wavelength: 0.78, period: 2.4, slope: 0.022, angle: -0.25, phase: 0.7 },
  { wavelength: 0.64, period: 2, slope: 0.02, angle: 0.55, phase: 2.1 },
  { wavelength: 0.52, period: 1.8, slope: 0.018, angle: -0.85, phase: 4.3 },
  { wavelength: 0.43, period: 1.5, slope: 0.017, angle: 1.05, phase: 1.4 },
  { wavelength: 0.36, period: 1.5, slope: 0.015, angle: -1.25, phase: 5.2 },
  { wavelength: 0.31, period: 1.8, slope: 0.014, angle: 0.15, phase: 3 },
  { wavelength: 0.26, period: 1.2, slope: 0.013, angle: 1.25, phase: 0.3 },
  { wavelength: 0.22, period: 1.5, slope: 0.012, angle: -0.55, phase: 2.7 },
  { wavelength: 0.18, period: 1.2, slope: 0.011, angle: 0.75, phase: 4.9 },
  { wavelength: 0.15, period: 1.2, slope: 0.01, angle: -1.05, phase: 1.9 },
];
const RIPPLE_WARP = { scale: 0.33, amount: 0.15 };
export const SHORE_BREATH = { scale: 0.26, amount: 0.3, speed: 0.06 };
const ENVELOPE = {
  mid: 0.78,
  slow: 0.14,
  fast: 0.08,
  slowDir: [0.033, -0.021],
  fastDir: [0.077, -0.052],
  slowSpeed: (Math.PI * 2) / 90,
  fastSpeed: (Math.PI * 2) / 40,
};

const WAVES = SWELL_WAVES.map((wave) => ({
  k: (Math.PI * 2) / wave.wavelength,
  omega: (Math.PI * 2) / wave.period,
  height: wave.height,
  phase: wave.phase,
  shape: wave.shape === true,
}));

const SHAPE_WAVES = WAVES.filter((wave) => wave.shape);

export function waveAmpFor(depth, taperDepth) {
  const t = Math.min(1, Math.max(0, (depth - 0.15) / (taperDepth - 0.15)));
  return WAVE_AMP_MIN + (WAVE_AMP_MAX - WAVE_AMP_MIN) * (t * t * (3 - 2 * t));
}

export function waveAmpGlsl(depthExpr, taperExpr) {
  const span = Number((WAVE_AMP_MAX - WAVE_AMP_MIN).toFixed(3));
  return `(${glslFloat(WAVE_AMP_MIN)} + ${glslFloat(span)}
       * smoothstep(0.15, ${taperExpr}, ${depthExpr}))`;
}

function gustAt(time) {
  return GUST.base
    + GUST.slow * Math.sin(time * GUST.slowSpeed)
    + GUST.fast * Math.sin(time * GUST.fastSpeed);
}

function envelopeAt(x, z, time) {
  return ENVELOPE.mid
    + ENVELOPE.slow * Math.sin(x * ENVELOPE.slowDir[0] + z * ENVELOPE.slowDir[1] - time * ENVELOPE.slowSpeed)
    + ENVELOPE.fast * Math.sin(x * ENVELOPE.fastDir[0] + z * ENVELOPE.fastDir[1] + time * ENVELOPE.fastSpeed);
}

export function shoalAt(dist) {
  return 1 + SHOAL_GAIN * (1 - smoothstep(0.5, SHOAL_REACH, dist));
}

export function shoalWithCliff(dist, cliff) {
  return shoalAt(dist) * (1 + CLIFF_SHOAL * cliff);
}

export function swellAt(dist, x, z, time) {
  let height = 0;
  for (const wave of SHAPE_WAVES) {
    height += Math.sin(wave.k * dist + wave.omega * time + wave.phase) * wave.height;
  }
  return height * gustAt(time) * envelopeAt(x, z, time);
}

export function glslFloat(value) {
  const text = String(value);
  return text.includes('.') || text.includes('e') ? text : `${text}.0`;
}

export function rippleSlopeGlsl() {
  return RIPPLE_WAVES.map((wave) => {
    const k = Number(((Math.PI * 2) / wave.wavelength).toFixed(4));
    const omega = Number(((Math.PI * 2) / wave.period).toFixed(4));
    return `  g += rippleTerm(p, time, ripplePhaseDir(dir, perp, ${glslFloat(wave.angle)}), ${glslFloat(k)}, ${glslFloat(omega)}, ${glslFloat(wave.phase)}, ${glslFloat(wave.slope)}, ${glslFloat(wave.wavelength)});`;
  }).join('\n');
}

export function rippleWarpGlsl() {
  return `vec2 rippleWarp(vec2 p) {
  return vec2(
    rippleNoise(p * ${glslFloat(RIPPLE_WARP.scale)} + vec2(7.1, 3.3)),
    rippleNoise(p * ${glslFloat(RIPPLE_WARP.scale)} + vec2(-4.7, 9.2))
  ) * ${glslFloat(RIPPLE_WARP.amount)};
}`;
}

function gustGlsl() {
  return `${glslFloat(GUST.base)}
       + ${glslFloat(GUST.slow)} * sin(time * ${glslFloat(GUST.slowSpeed)})
       + ${glslFloat(GUST.fast)} * sin(time * ${glslFloat(GUST.fastSpeed)})`;
}

function phaseGlsl(wave) {
  return `${glslFloat(wave.k)} * d + ${glslFloat(wave.omega)} * time + ${glslFloat(wave.phase)}`;
}

function envelopeGlsl() {
  const slow = `vec2(${glslFloat(ENVELOPE.slowDir[0])}, ${glslFloat(ENVELOPE.slowDir[1])})`;
  const fast = `vec2(${glslFloat(ENVELOPE.fastDir[0])}, ${glslFloat(ENVELOPE.fastDir[1])})`;
  return `(${glslFloat(ENVELOPE.mid)}
       + ${glslFloat(ENVELOPE.slow)} * sin(dot(p, ${slow}) - time * ${glslFloat(ENVELOPE.slowSpeed)})
       + ${glslFloat(ENVELOPE.fast)} * sin(dot(p, ${fast}) + time * ${glslFloat(ENVELOPE.fastSpeed)}))`;
}

function swellGlsl() {
  const sum = SHAPE_WAVES
    .map((wave) => `sin(${phaseGlsl(wave)}) * ${glslFloat(wave.height)}`)
    .join('\n       + ');
  return `((${sum}) * (${gustGlsl()}) * ${envelopeGlsl()})`;
}

function swellSlopeGlsl() {
  const sum = WAVES
    .map((wave) => `cos(${phaseGlsl(wave)}) * ${glslFloat(wave.k * wave.height)}`)
    .join('\n       + ');
  return `((${sum}) * (${gustGlsl()}) * ${envelopeGlsl()})`;
}

function swashGlsl() {
  return `(0.5 + 0.5 * sin(time * ${glslFloat(SWASH_TIME)}
       + noise(p * 0.14) * 6.2831 - d * ${glslFloat(SWASH_DIST)}))`;
}

export function waveFieldGlsl() {
  return `
float swellAt(float d, vec2 p, float time) {
  return ${swellGlsl()};
}

float swellSlopeAt(float d, vec2 p, float time) {
  return ${swellSlopeGlsl()};
}

float shoalAt(float d) {
  return (1.0 + ${glslFloat(SHOAL_GAIN)} * (1.0 - smoothstep(0.5, ${glslFloat(SHOAL_REACH)}, d)));
}

float shoalWithCliff(float d, float cliff) {
  return shoalAt(d) * (1.0 + ${glslFloat(CLIFF_SHOAL)} * cliff);
}

float swashAt(float d, vec2 p, float time) {
  return ${swashGlsl()};
}
`;
}
