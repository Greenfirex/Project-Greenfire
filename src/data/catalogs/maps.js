// Registr map — seznam klíčů a deklarace map (rozměr světa, barvy půdy, atmosféra).
// Přidání mapy = jeden záznam v MAPS a klíč v MAP_KEYS.
export const MAPS = {
  glade: {
    displayName: 'Temný hvozd',
    groundSize: 26,
    seed: 20261016,
    clearingRadius: 8,
    clearingCenter: { cx: 3, cz: -2 },
    colors: {
      ground: [0.055, 0.082, 0.055],
      path: [0.13, 0.115, 0.095],
      water: [0.06, 0.16, 0.19],
      gridLine: [0.16, 0.22, 0.17],
      sky: [0.035, 0.045, 0.055],
      floorTile: [0.19, 0.28, 0.17],
      cliffTile: [0.28, 0.29, 0.30],
      tintStrength: 0.85,
    },
    light: {
      hemiIntensity: 0.32,
      hemiGround: [0.05, 0.07, 0.05],
      sunIntensity: 0.72,
      sunDirection: [-0.62, -0.72, 0.32],
      sunPosition: [26, 19, -14],
      shadowBlur: 32,
    },
    dayNight: {
      dayLengthSeconds: 180,
      startTime: 0.35,
      dawnTime: 0.25,
      duskTime: 0.75,
      sunDistance: 40,
      sunHeight: 34,
      moonIntensity: 0.06,
      moonTint: [0.46, 0.58, 0.88],
      dawnColor: [0.36, 0.26, 0.22],
      dayColor: [0.035, 0.045, 0.055],
      duskColor: [0.32, 0.20, 0.18],
      nightColor: [0.0015, 0.0025, 0.007],
      nightLight: 0.07,
    },
  },
};

export const MAP_KEYS = Object.keys(MAPS);

export const DEFAULT_MAP = 'glade';

export function getMap(mapKey) {
  return MAPS[mapKey] || null;
}
