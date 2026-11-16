// Barvy rostlin na jednom místě: společné doladění všech stromů a keřů a korekce modelů z Meshy.
// Korekce modelu srovná jeho listí na společnou žlutozelenou (mezi palmou a banánovníkem).
export const FLORA_GRADE = {
  brightness: 1,
  warmth: 0,
  saturation: 1,
};

export const MODEL_COLORS = {
  'palm_a.glb': { leafTint: [0.73, 1.07, 0.56], saturation: 1.2 },
  'palm_curved.glb': { leafTint: [0.75, 1.08, 0.92], saturation: 1.2 },
  'banana_a.glb': { leafTint: [0.77, 0.98, 1.06], saturation: 1.2 },
  'banana_b.glb': { leafTint: [0.64, 0.84, 0.51], saturation: 1.2 },
  'pandan_a.glb': { leafTint: [0.77, 1.11, 0.75], saturation: 1.2 },
  'pandan_b.glb': { leafTint: [0.61, 1.37, 0.53], saturation: 1.2 },
  'araucaria_a.glb': { leafTint: [0.5, 1.09, 0.18], saturation: 1.2 },
  'araucaria_b.glb': { leafTint: [0.83, 1.24, 0.56], saturation: 1.2 },
  'monstera.glb': { leafTint: [0.91, 1.1, 1.54], saturation: 1.2 },
  'healing_plant.glb': { leafTint: [0.8, 0.9, 1.74], saturation: 1.2 },
};

export function modelColorsFor(url) {
  if (!url) return null;
  const file = url.slice(url.lastIndexOf('/') + 1);
  return MODEL_COLORS[file] || null;
}
