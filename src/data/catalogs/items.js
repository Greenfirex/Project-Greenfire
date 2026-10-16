// Deklarace typu předmětů (suroviny a produkty).
// Drží jen deklarace a resolve helpery, žádnou herní logiku.
export const ITEM_TYPES = {
  iron_ore: {
    displayName: 'Železná ruda',
    stackSize: 100,
    kind: 'raw',
    color: [0.55, 0.5, 0.48],
  },
  iron_ingot: {
    displayName: 'Železný ingot',
    stackSize: 100,
    kind: 'product',
    color: [0.72, 0.72, 0.75],
  },
  copper_ore: {
    displayName: 'Měděná ruda',
    stackSize: 100,
    kind: 'raw',
    color: [0.78, 0.45, 0.25],
  },
  copper_ingot: {
    displayName: 'Měděný ingot',
    stackSize: 100,
    kind: 'product',
    color: [0.85, 0.55, 0.3],
  },
};

export const ITEM_KEYS = Object.keys(ITEM_TYPES);

export function getItem(itemKey) {
  return ITEM_TYPES[itemKey] || null;
}
