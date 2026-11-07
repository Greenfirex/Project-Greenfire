// Recepty na lastury — vějíř žeber, ze kterého se ve hře skládá geometrie.
// Lastura nevzniká v modelovém souboru, takže se dá ladit jedním číslem.
const SHELL_STONE = { texture: 'Ground080_1K-JPG_Color.jpg' };

export const SHELL_RECIPES = {
  shell_small: {
    ...SHELL_STONE,
    size: [0.16, 0.075, 0.17],
    ribs: 7,
    spread: 1.1,
    wave: 0.06,
    curl: 0.06,
    thickness: 0.5,
    tint: [1.22, 1.17, 1.1],
  },
  shell_mid: {
    ...SHELL_STONE,
    size: [0.27, 0.13, 0.29],
    ribs: 9,
    spread: 1.2,
    wave: 0.08,
    curl: 0.06,
    thickness: 0.5,
    tint: [1.18, 1.13, 1.06],
  },
  shell_wide: {
    ...SHELL_STONE,
    size: [0.34, 0.1, 0.28],
    ribs: 11,
    spread: 1.45,
    wave: 0.14,
    curl: 0.02,
    thickness: 0.55,
    tint: [1.24, 1.18, 1.1],
  },
  shell_cup: {
    ...SHELL_STONE,
    size: [0.21, 0.2, 0.27],
    ribs: 7,
    spread: 0.85,
    wave: 0.04,
    curl: 0.4,
    thickness: 0.45,
    tint: [1.2, 1.15, 1.08],
  },
};

export function getShellRecipe(key) {
  return SHELL_RECIPES[key] || null;
}
