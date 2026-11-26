// Rozložení hlavního panelu editoru — které záložky má a co leží v které z nich.
// Štětec, který tu chybí, se ukáže dole mezi společnými tlačítky, aby se neztratil.
import { BRUSHES, BRUSH_KEYS } from '../data/catalogs/brushes.js';

const CREATURE_BRUSHES = BRUSH_KEYS.filter((key) => BRUSHES[key].creature);

export const HUD_TABS = [
  {
    key: 'terrain',
    label: 'Terén',
    row: 0,
    sections: [
      {
        label: 'Nástroje',
        tools: [
          { mode: 'height', label: 'Výška', note: 'Táhni po buňkách a nastav jim přesnou výšku; potvrdíš v okně Výška. Další klik vrátí štětce.' },
          { mode: 'area', label: 'Herní plocha', note: 'Přidá nebo ubere buňky hrací plochy i s podkladem a výškou. Další klik vrátí štětce.' },
        ],
      },
      { label: 'Tvar', brushes: ['hill', 'hollow', 'cliff', 'beach'] },
      { label: 'Přechody', brushes: ['join', 'bridge'] },
      { brushes: ['erase_terrain'] },
    ],
  },
  {
    key: 'water',
    label: 'Voda',
    row: 0,
    sections: [
      { label: 'Moře', sea: true },
      { label: 'Jezera a řeky', brushes: ['lake', 'river'] },
    ],
  },
  {
    key: 'surface',
    label: 'Povrch',
    row: 0,
    sections: [
      { brushes: ['surface', 'trail'] },
      { brushes: ['erase_path'] },
    ],
  },
  {
    key: 'caves',
    label: 'Jeskyně',
    row: 0,
    mode: 'floors',
    sections: [
      { text: 'Jeskyně se kopou v okně Patra. Na povrchu klikni na stěnu útesu, v patře táhni výběr a dej Aplikovat.' },
    ],
  },
  {
    key: 'plants',
    label: 'Rostliny',
    row: 1,
    sections: [
      { label: 'Stromy', brushes: ['forest_exact', 'araucarias', 'pandans', 'palms', 'bananas', 'broadleaf'] },
      { label: 'Podrost', brushes: ['bushes', 'monsteras', 'herbs', 'mushrooms', 'grass', 'moss'] },
      { brushes: ['erase_plants'] },
    ],
  },
  {
    key: 'objects',
    label: 'Předměty',
    row: 1,
    sections: [
      { label: 'Les a skály', brushes: ['rocks', 'deadwood', 'clubs', 'planks', 'palmLeaves', 'cliffDebris'] },
      { label: 'Pláž a moře', brushes: ['driftwood', 'shore', 'starfish', 'reef'] },
      { label: 'Tábor a poklady', brushes: ['crafting', 'chest', 'skeleton', 'furniture', 'trinkets'] },
      { brushes: ['erase_objects'] },
    ],
  },
  {
    key: 'creatures',
    label: 'Tvorové',
    row: 1,
    sections: [
      { label: 'Na souši', brushes: [...CREATURE_BRUSHES, 'koa_nest', 'crabs'] },
      { label: 'Ve vodě', brushes: ['fish'] },
      { brushes: ['creature_settings', 'erase_creatures'] },
    ],
  },
];

export const COMMON_BRUSHES = ['move', 'spawn', 'erase_all'];

export function hudTab(key) {
  return HUD_TABS.find((tab) => tab.key === key) || null;
}

export function tabBrushes(tab) {
  if (!tab) return [];
  return tab.sections.flatMap((section) => section.brushes || []).filter((key) => BRUSHES[key]);
}

export function tabModes(tab) {
  if (!tab) return [];
  if (tab.mode) return [tab.mode];
  return ['zone', ...tab.sections.flatMap((section) => (section.tools || []).map((tool) => tool.mode))];
}

export function tabForMode(mode, current) {
  if (tabModes(hudTab(current)).includes(mode)) return current;
  const owner = HUD_TABS.find((tab) => tab.mode === mode || (!tab.mode && tabModes(tab).includes(mode) && mode !== 'zone'));
  return owner ? owner.key : HUD_TABS[0].key;
}

export function looseBrushes() {
  const placed = new Set([...HUD_TABS.flatMap(tabBrushes), ...COMMON_BRUSHES]);
  return BRUSH_KEYS.filter((key) => !placed.has(key));
}
