// Vlny vodní hladiny — jediné místo, kde jsou jejich čísla i výpočet.
// Ze stejných čísel se skládá program na kartě, takže obraz a hra se nemůže rozejít.
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

export function waveDirection(dirX, dirZ, x, z, time) {
  const dx = dirX + 1e-5;
  const dz = dirZ + 1e-5;
  const length = Math.hypot(dx, dz) || 1;
  const baseX = dx / length;
  const baseZ = dz / length;
  const wobble = (
    Math.sin(x * WAVE_SWAY.frequencyX + time * WAVE_SWAY.speedX)
    + Math.sin(z * WAVE_SWAY.frequencyZ + time * WAVE_SWAY.speedZ)
  ) * WAVE_SWAY.amount;
  const c = Math.cos(wobble);
  const s = Math.sin(wobble);
  return { x: baseX * c - baseZ * s, z: baseX * s + baseZ * c };
}

export function waveHeight(x, z, dirX, dirZ, time) {
  let height = 0;
  for (const term of WAVE_TERMS) {
    const k = (Math.PI * 2) / term.wavelength;
    height += Math.sin(k * (x * dirX + z * dirZ - term.speed * time)) * term.height;
  }
  return height;
}

export function waveOffset(x, z, dirX, dirZ, time) {
  const dir = waveDirection(dirX, dirZ, x, z, time);
  return waveHeight(x, z, dir.x, dir.z, time);
}

export function glslFloat(value) {
  const text = String(value);
  return text.includes('.') || text.includes('e') ? text : `${text}.0`;
}

export function swellGlsl() {
  return WAVE_TERMS
    .map((term) => `sin(seaPhase(p, dir, ${glslFloat(term.wavelength)}, ${glslFloat(term.speed)}, time)) * ${glslFloat(term.height)}`)
    .join('\n       + ');
}

export function swellSlopeGlsl() {
  return WAVE_TERMS
    .map((term) => `dir * ${glslFloat((Math.PI * 2) / term.wavelength)} * ${glslFloat(term.height)} * cos(seaPhase(p, dir, ${glslFloat(term.wavelength)}, ${glslFloat(term.speed)}, time))`)
    .join('\n       + ');
}
