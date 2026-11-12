// Čísla, která sdílí moře i jezera — o kolik hladina sedí pod svou výškou a jak jemně se měří hloubka.
import { CELL_SIZE } from '../../utils/gridMath.js';
import { SEA_DISTANCE_REACH } from '../../utils/waterWaves.js';

export const WATER_SINK = 0.02;
export const DEPTH_STEP = 0.5;
export const DEPTH_MAX = 256;
export const DEPTH_RANGE = 5;
export const CLIFF_DEPTH_JUMP = 1;

export const LAKE_SHORE_CELLS = Math.ceil(SEA_DISTANCE_REACH / CELL_SIZE);
export const LAKE_OPEN_DIST = 30;
export const LAKE_FOAM_DIR = [0.6, -0.8];
