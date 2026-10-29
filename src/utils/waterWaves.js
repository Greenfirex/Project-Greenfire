// Vlny vodní hladiny — jediné místo, kde jsou jejich čísla i výpočet.
// Výška se počítá ze vzdálenosti od břehu, takže hřebeny jdou jako kruhy kolem pevniny.
export const WAVE_TERMS = [
  { wavelength: 18, speed: 1.2, height: 0.16 },
  { wavelength: 11, speed: 1.7, height: 0.11 },
  { wavelength: 7, speed: 2.3, height: 0.06 },
];

export const WAVE_SWAY = {
  frequencyX: 0.05,
  frequencyZ: 0.043,
  speedX: 0.13,
  speedZ: -0.11,
  amount: 0.06,
};
export const WAVE_REACH = WAVE_TERMS.reduce((sum, term) => sum + term.height, 0);
export const WAVE_TIME_WRAP = 3600;

export function waveHeight(distance, time) {
  let height = 0;
  for (const term of WAVE_TERMS) {
    const k = (Math.PI * 2) / term.wavelength;
    height += Math.sin(k * (distance + term.speed * time)) * term.height;
  }
  return height;
}

export function glslFloat(value) {
  const text = String(value);
  return text.includes('.') || text.includes('e') ? text : `${text}.0`;
}

export function swellGlsl() {
  return WAVE_TERMS
    .map((term) => `sin(seaPhase(waveDist, ${glslFloat(term.wavelength)}, ${glslFloat(term.speed)}, time)) * ${glslFloat(term.height)}`)
    .join('\n       + ');
}

export function swellSlopeGlsl() {
  return WAVE_TERMS
    .map((term) => `dir * ${glslFloat((Math.PI * 2) / term.wavelength)} * ${glslFloat(term.height)} * cos(seaPhase(waveDist, ${glslFloat(term.wavelength)}, ${glslFloat(term.speed)}, time))`)
    .join('\n       + ');
}
