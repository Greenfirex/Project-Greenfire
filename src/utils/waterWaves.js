// Vlny vodní hladiny — jediné místo, kde jsou jejich čísla i výpočet.
// Hřebeny jsou čáry stejné vzdálenosti od břehu, takže všude opisují pobřeží.
export const SHORE_TERMS = [
  { wavelength: 15.3, speed: 1.05, height: 0.1 },
  { wavelength: 9.7, speed: 1.6, height: 0.06 },
  { wavelength: 5.9, speed: 2.0, height: 0.035 },
];

export const WAVE_REACH = SHORE_TERMS.reduce((sum, term) => sum + term.height, 0);
export const WAVE_TIME_WRAP = 3600;
const CHOP = 0.35;
const WAVE_AMP_MIN = 1.05;
const WAVE_AMP_MAX = 2.15;
const GUST = { base: 0.86, slow: 0.14, slowSpeed: 0.13, fast: 0.05, fastSpeed: 0.37 };

export function waveAmpFor(depth, taperDepth) {
  const t = Math.min(1, Math.max(0, (depth - 0.15) / (taperDepth - 0.15)));
  return WAVE_AMP_MIN + (WAVE_AMP_MAX - WAVE_AMP_MIN) * (t * t * (3 - 2 * t));
}

export function waveAmpGlsl(depthExpr, taperExpr) {
  const span = Number((WAVE_AMP_MAX - WAVE_AMP_MIN).toFixed(3));
  return `(${glslFloat(WAVE_AMP_MIN)} + ${glslFloat(span)}
       * smoothstep(0.15, ${taperExpr}, ${depthExpr}))`;
}

export function gustAt(time) {
  return GUST.base
    + GUST.slow * Math.sin(time * GUST.slowSpeed)
    + GUST.fast * Math.sin(time * GUST.fastSpeed);
}

export function waveHeight(distance, time) {
  let height = 0;
  for (const term of SHORE_TERMS) {
    const k = (Math.PI * 2) / term.wavelength;
    height += Math.sin(k * (term.speed * time + distance)) * term.height;
  }
  return height * gustAt(time);
}

export function glslFloat(value) {
  const text = String(value);
  return text.includes('.') || text.includes('e') ? text : `${text}.0`;
}

function shorePhaseGlsl(term) {
  const k = glslFloat((Math.PI * 2) / term.wavelength);
  return `${k} * (${glslFloat(term.speed)} * time + waveDist)`;
}

function gustGlsl() {
  return `${glslFloat(GUST.base)}
       + ${glslFloat(GUST.slow)} * sin(time * ${glslFloat(GUST.slowSpeed)})
       + ${glslFloat(GUST.fast)} * sin(time * ${glslFloat(GUST.fastSpeed)})`;
}

export function swellGlsl() {
  const sum = SHORE_TERMS
    .map((term) => `sin(${shorePhaseGlsl(term)}) * ${glslFloat(term.height)}`)
    .join('\n       + ');
  return `(${sum})
       * (${gustGlsl()})`;
}

export function swellSlopeGlsl() {
  const sum = SHORE_TERMS
    .map((term) => `${glslFloat((Math.PI * 2) / term.wavelength)} * ${glslFloat(term.height)} * (cos(${shorePhaseGlsl(term)}) + ${glslFloat(CHOP * 2)} * cos(${shorePhaseGlsl(term)} * 2.0))`)
    .join('\n       + ');
  return `dir * (
       ${sum}
       ) * (${gustGlsl()})`;
}

const WATER_FLOW = { x: 0.45, z: -0.32 };

export function waveDriftGlsl() {
  return `
vec2 waveDriftShift(float time) {
  return vec2(${glslFloat(WATER_FLOW.x)}, ${glslFloat(WATER_FLOW.z)}) * time;
}`;
}
