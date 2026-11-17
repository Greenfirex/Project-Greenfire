// Krabi na pláži — velikost, hustota na písku a cesta k modelu. Jsou jen pro ozdobu.
// Model je připravený klepety k +Z a široký 1 m; skutečnou šířku dopočítá CrabSystem.
import { ASSET_DIRS } from './assetPaths.js';

export const CRAB = {
  displayName: 'Krab',
  description: 'Plachý obyvatel pláže',
  sizeMin: 0.16,
  sizeMax: 0.4,
  model: `${ASSET_DIRS.crab}crab.glb`,
  sandFloor: 'floor_sand',
  beachShare: 0.06,
  beachReach: 4,
  brushCount: 2,
  maxCount: 160,
};
