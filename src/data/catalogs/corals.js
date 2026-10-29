// Recepty na koraly — tvar, rozměry a odstíny, ze kterých se ve hře skládá geometrie.
// Koral nevzniká v modelovém souboru, takže se dá ladit jedním číslem.
export const CORAL_RECIPES = {
  coral_fan: {
    shape: 'fan',
    seed: 8111,
    size: [0.6, 0.45, 0.2],
    branches: 13,
    radius: 0.03,
    spread: 1.15,
    baseTint: [0.82, 0.26, 0.4],
    tipTint: [1.24, 0.55, 0.62],
  },
  coral_branch: {
    shape: 'branch',
    seed: 8221,
    size: [0.5, 0.42, 0.5],
    branches: 8,
    radius: 0.045,
    lean: 0.6,
    baseTint: [0.68, 0.3, 0.53],
    tipTint: [1.14, 0.58, 0.74],
  },
  coral_brain: {
    shape: 'brain',
    seed: 8333,
    size: [0.62, 0.3, 0.58],
    ribs: 9,
    ridge: 0.09,
    baseTint: [0.88, 0.52, 0.2],
    tipTint: [1.28, 0.88, 0.38],
  },
};

export function getCoralRecipe(key) {
  return CORAL_RECIPES[key] || null;
}
