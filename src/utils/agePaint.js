// Barva starého dřeva po bodech — mech dole a na horních plochách, špína u země, u venkovního dřeva
// i oprýskaná vybledlá místa a tmavé šmouhy od deště. Používají ji stavby i volně stojící nábytek.
import { valueNoise, smoothstep } from './noise.js';

export function agePaint(age, seed) {
  const offset = (seed % 1000) * 0.37;
  return (base, x, y, z, up, extra = 0, weather = 0) => {
    const patch = valueNoise(x * age.noiseScale + offset, z * age.noiseScale + y * age.noiseScale * 0.7);
    const low = 1 - smoothstep(0, age.mossHeight, y);
    const moss = Math.min(1, smoothstep(0.35, 0.8, patch) * (low * 0.8 + Math.max(0, up) * 0.45 + extra) * age.mossAmount);
    const grime = 1 - age.grime * (1 - smoothstep(-0.2, 0.7, y)) * (0.6 + 0.4 * patch);
    const along = x + z;
    const peel = smoothstep(0.5, 0.57, valueNoise(along * age.bleachScale + offset * 1.7, y * age.bleachScale * 2.4)) * age.bleachAmount * weather;
    const streak = 1 - age.streak * weather * smoothstep(0.5, 0.9, valueNoise(along * age.streakScale + offset * 2.3, y * 0.35)) * (0.4 + 0.6 * smoothstep(0, 2.5, y));
    return [0, 1, 2].map((i) => {
      const worn = base[i] * (1 - peel + peel * age.bleach[i]) * streak;
      return (worn * (1 - moss) + age.moss[i] * moss) * grime;
    });
  };
}
