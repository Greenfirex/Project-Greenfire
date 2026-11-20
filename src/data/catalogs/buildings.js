// Stavby skládané z dílů na mřížce — rozměr v buňkách, prkenná podlaha a stěny z klád s otvory.
// Strany a otvory jsou v neotočené stavbě; otočení z mapy se použije na celek. Plán je v DEV.md, sekce „Stavby".
import { ASSET_DIRS, PLANKS_TEXTURE, PLANKS_TEXTURE_PLANKS, LOG_TEXTURE, LOG_NORMAL } from './assetPaths.js';

export const BUILDINGS = {
  pirate_cabin: {
    displayName: 'Opuštěný pirátský srub',
    width: 4,
    depth: 3,
    shift: [0, 0.25],
    age: {
      moss: [0.46, 0.5, 0.3],
      mossAmount: 0.45,
      mossHeight: 0.9,
      grime: 0.55,
      noiseScale: 1.3,
      bleach: [1.3, 1.24, 1.05],
      bleachAmount: 1,
      bleachScale: 1.1,
      streak: 0.6,
      streakScale: 4.5,
    },
    floor: {
      texture: PLANKS_TEXTURE,
      tile: 2,
      texturePlanks: PLANKS_TEXTURE_PLANKS,
      lift: 0.3,
      tint: [0.5, 0.43, 0.36],
      shadeSpread: 0.3,
      plank: 0.24,
      gap: 0.012,
      thickness: 0.04,
      warp: 0.012,
      tilt: 0.02,
      pieceMin: 1.4,
      pieceMax: 3.4,
      missing: 0.035,
      broken: 0.08,
      rotten: 0.08,
      rotSag: 0.06,
      joist: 0.09,
      joistSpacing: 1.3,
      post: 0.2,
      postSpacing: 2,
      postInset: 0.2,
      postSink: 0.25,
      postLean: 0.12,
      stepKey: 'planks',
    },
    walls: {
      sides: ['north', 'south', 'west', 'east'],
      texture: LOG_TEXTURE,
      normal: LOG_NORMAL,
      tile: 1.2,
      log: 0.28,
      logSpread: 0.18,
      spacing: 0.84,
      height: 2.5,
      overhang: 0.34,
      endSpread: 0.26,
      sag: 0.09,
      bow: 0.08,
      taper: 0.2,
      bulge: 0.07,
      lift: 0.05,
      segments: 8,
      logSides: 10,
      shadeSpread: 0.22,
      brokenTop: 0.35,
      cutSpread: 0.12,
      ringSeat: 0.84,
      insideCut: 1.1,
      door: {
        openHint: 'otevřít Dveře',
        closeHint: 'zavřít Dveře',
        thickness: 0.045,
        plank: 0.17,
        gap: 0.01,
        inset: 0.05,
        gapTop: 0.06,
        ragged: 0.06,
        warp: 0.02,
        battens: [0.22, 0.78],
        batten: 0.11,
        battenThick: 0.03,
        tint: [0.66, 0.57, 0.47],
        shadeSpread: 0.2,
        tile: 1.2,
        swing: 1.75,
        seconds: 0.6,
      },
      tint: [0.88, 0.86, 0.62],
      weather: 1,
      vineStep: 0.9,
      vineChance: 0.7,
      vineDrape: 0.3,
      vineGap: 0.04,
      ends: { wood: '#9c8468', ring: '#5c4636', crack: '#3a2c22', bark: '#3b3029' },
      outline: [[-4, -3], [4, -3], [4, 0.75], [2, 0.75], [2, 3], [-2, 3], [-2, 0.75], [-4, 0.75]],
      posts: { at: [[3.86, 2.86], [-3.86, 2.86]], radius: 0.13, sink: 0.25, lean: 0.06, above: 0.2 },
      openings: [
        { side: 'north', at: 1, width: 1.3, bottom: 0, top: 2.35, kind: 'cave' },
        { side: 'south', at: 0.9, width: 1.1, bottom: 0, top: 1.95, kind: 'door' },
        { side: 'south', at: -3.0, width: 0.9, bottom: 0.95, top: 1.7, kind: 'window' },
        { side: 'west', at: -0.6, width: 0.9, bottom: 0.95, top: 1.7, kind: 'window' },
        { side: 'east', at: -0.6, width: 0.8, bottom: 1.0, top: 1.65, kind: 'window' },
      ],
    },
    upper: {
      room: [-3.7, 2, -2.7, 1],
      height: 2.3,
      sides: ['north', 'south', 'west', 'east'],
      joistOut: 0.25,
      moss: 0.15,
      planks: { missing: 0, broken: 0, rotten: 0.06, rotSag: 0.02, gap: 0.006 },
      subfloor: { missing: 0, broken: 0, rotten: 0, gap: 0.004 },
      openings: [
        { side: 'west', at: -2.1, width: 0.9, bottom: 0, top: 2.0, kind: 'door' },
        { side: 'east', at: 0.4, width: 1.0, bottom: 0, top: 2.0, kind: 'door' },
        { side: 'south', at: -1.2, width: 0.8, bottom: 0.9, top: 1.5, kind: 'window' },
      ],
      rail: { height: 0.95, low: 0.48, radius: 0.05, post: 0.085, lean: 0.1, spacing: 2, missing: 0.2, broken: 0.35, fallTo: 0.7 },
      rails: [
        { alongX: false, at: 4, from: -3, to: 3 },
        { alongX: true, at: -3, from: 2.3, to: 2.7 },
        { alongX: true, at: -3, from: 3.6, to: 4 },
        { alongX: true, at: 3, from: -4, to: 4 },
        { alongX: false, at: -4, from: 1.35, to: 3 },
      ],
      sideSteps: { x: 3.15, width: 0.9, edge: -3, dir: -1, reach: 1.2, rise: 0.18, run: 0.3, log: 0.07, missing: 0.1 },
      stairs: {
        x: -4.85,
        width: 1.0,
        top: -1.9,
        platform: { x0: -5.6, x1: -4.0, z0: 0.95, z1: 2.55, height: 0.7 },
        terrace: { to: -3.0, width: 1.2 },
        run: 0.3,
        groundReach: 1.2,
        landing: -3.0,
        wall: -4.0,
        rise: 0.23,
        log: 0.075,
        missing: 0.08,
        broken: 0.2,
        brokenDrop: 0.12,
        postStep: 1.4,
        postSink: 0.25,
        planks: { missing: 0.05, broken: 0.1, rotten: 0.1 },
        rail: { height: 0.95, low: 0.48, radius: 0.05, post: 0.085, lean: 0.08, spacing: 1.5, missing: 0.15, broken: 0.35, fallTo: 0.6 },
      },
    },
    roof: {
      model: `${ASSET_DIRS.props}cabin_roof/cabin_roof.glb`,
      length: 6.8,
      width: 4.7,
      pitch: 0.78,
      thatch: 0.35,
      vineStep: 0.55,
      vineChance: 0.5,
    },
    furniture: {
      styles: {
        table: { size: [1.5, 0.78, 0.85], plank: 0.22, top: 0.05, leg: 0.07, inset: 0.1, rail: 0.18, tint: [0.66, 0.57, 0.47], shadeSpread: 0.15, tile: 1.2 },
        chair: { size: [0.44, 0.95, 0.42], seat: 0.45, top: 0.04, leg: 0.045, slat: 0.07, slats: [0.45, 0.85], tint: [0.66, 0.57, 0.47], shadeSpread: 0.25, tile: 1.2 },
        workbench: {
          size: [1.9, 0.88, 0.65], top: 0.08, leg: 0.09, inset: 0.08, shelf: 0.22, tint: [0.62, 0.53, 0.43], shadeSpread: 0.15, tile: 1.2,
          tools: [
            { at: [-0.55, 0.05], size: [0.32, 0.1, 0.12], yaw: 0.3 },
            { at: [-0.4, 0.12], size: [0.04, 0.03, 0.34], yaw: 0.3 },
            { at: [0.45, -0.08], size: [0.5, 0.025, 0.2], yaw: -0.15 },
            { at: [0.6, 0.15], size: [0.22, 0.16, 0.18], yaw: 0.5 },
          ],
        },
        hammock: {
          size: [3, 1, 0.9], hang: 0.95, sag: 0.45, curl: 0.12, width: 0.9, rope: 0.35, ropeRadius: 0.012, post: 0.06,
          ropeTint: [0.62, 0.55, 0.4], blockFrom: 0.3, blockTo: 1.0, tint: [1, 1, 1], shadeSpread: 0,
        },
        lantern: {
          size: [0.17, 0.42], metal: [0.2, 0.18, 0.16], candle: [0.85, 0.8, 0.68], tint: [1, 1, 1], shadeSpread: 0,
          glass: [0.75, 0.72, 0.6], glassAlpha: 0.35, glassGlow: [0.9, 0.62, 0.3], flameGlow: [1, 0.78, 0.4],
          light: { color: [1, 0.68, 0.36], range: 7, day: 0.15, night: 1.4, flicker: 0.12, shadowDarkness: 0.5 },
        },
        anchor: { size: [0.8, 1.3, 0.35], block: true, iron: [0.2, 0.17, 0.15], thick: 0.045, height: 1.3, width: 0.8, ring: 0.08 },
        rope: { size: [0.5, 0.15, 0.5], block: true, rope: [0.55, 0.45, 0.3], thick: 0.03, loops: [[0.24, 0.03], [0.2, 0.08], [0.15, 0.13]] },
        boat: { size: [3.0, 0.95, 1.15], block: true, depth: 0.42, trestle: 0.55, tint: [0.6, 0.48, 0.36] },
        map: {
          size: [0.5, 0, 0.36], curl: 0.012, dagger: [0.17, 0.11], daggerTilt: 0.25, steel: [0.55, 0.56, 0.58], grip: [0.25, 0.15, 0.08],
          colors: { paper: '#c9b48a', burn: 'rgba(70,40,15,0.75)', stain: 'rgba(90,60,25,0.18)', land: '#b69a62', ink: '#3b2a1a', mark: '#8e1b12' },
        },
        bottle: { radius: 0.035, heights: [0.17, 0.215, 0.29], cork: [0.45, 0.33, 0.2], colors: [[0.1, 0.28, 0.14]], shards: [[0.12, 0.05, 0.03], [0.18, -0.04, 0.022], [0.08, -0.07, 0.018]] },
        mug: { radius: 0.042, height: 0.1, pewter: [0.48, 0.48, 0.5] },
        wheel: { radius: 0.42, rim: 0.03, spokes: 8, spoke: 0.02, handle: 0.13, hub: 0.07, peg: 0.09, tint: [0.6, 0.48, 0.36] },
        spyglass: { brass: [0.72, 0.56, 0.26], tubes: [[0.18, 0.032], [0.15, 0.026], [0.12, 0.02]] },
        compass: { brass: [0.72, 0.56, 0.26], face: [0.85, 0.8, 0.65], needle: [0.6, 0.1, 0.08], radius: 0.06, height: 0.025 },
        bench: { size: [1.7, 0.45, 0.35], block: true, seat: 0.16, stump: 0.14 },
        chest: { size: [1.0, 0.58, 0.56], block: true, lid: 0.1, bands: [-0.32, 0.32], tint: [0.5, 0.38, 0.28], iron: [0.2, 0.18, 0.16] },
        shelf: {
          depth: 0.22, board: 0.035, bracket: 0.22, tint: [0.56, 0.47, 0.38],
          colors: { jar: [0.55, 0.6, 0.5], lid: [0.3, 0.22, 0.15], candle: [0.88, 0.82, 0.68], wick: [0.1, 0.08, 0.07], gold: [0.85, 0.66, 0.22], iron: [0.2, 0.18, 0.16], paper: [0.8, 0.72, 0.55], tie: [0.45, 0.12, 0.1] },
        },
        bookcase: {
          size: [1.7, 2.1, 0.42], board: 0.035, plinth: 0.08, rows: 4, cols: 3, tint: [0.56, 0.47, 0.38], shadeSpread: 0.1, tile: 1.2,
          motion: { seconds: 1.4, openHint: 'zatáhnout za páku', closeHint: 'zatáhnout za páku' },
          lever: { at: [0.87, 1.15, 0.08], plate: [0.02, 0.1, 0.06], handle: [0.025, 0.16, 0.025], angle: -0.5, color: [0.18, 0.16, 0.15] },
          decor: [
            { kind: 'books', cell: [1, 0], books: [
              { size: [0.05, 0.26], color: [0.45, 0.12, 0.1] },
              { size: [0.06, 0.24], color: [0.15, 0.28, 0.18] },
              { size: [0.045, 0.27], color: [0.35, 0.25, 0.15] },
              { size: [0.07, 0.22], color: [0.12, 0.15, 0.3] },
            ] },
            { kind: 'books', cell: [3, 1], books: [
              { size: [0.06, 0.2], color: [0.55, 0.42, 0.2] },
              { size: [0.05, 0.23], color: [0.3, 0.12, 0.1] },
            ] },
            { kind: 'jar', cell: [2, 2], shift: 0.12, size: [0.12, 0.18], color: [0.55, 0.6, 0.5], lid: [0.3, 0.22, 0.15] },
            { kind: 'bottle', cell: [2, 0], shift: 0.1, color: [0.3, 0.18, 0.08] },
            { kind: 'bottle', cell: [2, 0], shift: 0.22, color: [0.1, 0.28, 0.14] },
            { kind: 'scroll', cell: [0, 1], shift: 0.04, length: 0.36, radius: 0.035, color: [0.8, 0.72, 0.55] },
          ],
        },
      },
      items: [
        { kind: 'bookcase', at: [1.0, -2.62], slide: 1.7 },
        { kind: 'table', at: [-1.0, 0.6] },
        { kind: 'lantern', at: [-0.55, 0.42], lift: 0.78, yaw: 0.3, use: { kind: 'lamp', onHint: 'rozsvítit lucernu', offHint: 'zhasnout lucernu' } },
        { kind: 'chair', at: [-1.3, -0.15] },
        { kind: 'chair', at: [-0.7, 1.35], yaw: 3.0 },
        { kind: 'chair', at: [-2.2, 0.2], yaw: 1.45 },
        { kind: 'chair', at: [-1.35, 2.2], yaw: 0.6, tilt: -1.5708, lift: 0.21 },
        { kind: 'workbench', at: [-2.88, -2.51], use: { kind: 'crafting', hint: 'pracovat u ponku' } },
        { kind: 'spyglass', at: [-3.0, -2.3], lift: 0.88, yaw: 0.3 },
        { kind: 'compass', at: [-3.62, -2.22], lift: 0.88 },
        { kind: 'map', at: [-1.35, 0.75], lift: 0.78, yaw: 0.25 },
        { kind: 'bottle', at: [-1.6, 0.4], lift: 0.78 },
        { kind: 'bottle', at: [-0.4, 0.9], lift: 0.78, color: [0.3, 0.18, 0.08] },
        { kind: 'bottle', at: [0.3, 1.9], broken: true, yaw: 0.8 },
        { kind: 'mug', at: [-0.9, 0.95], lift: 0.78, yaw: 2.2 },
        { kind: 'mug', at: [-1.2, 0.3], lift: 0.78, yaw: -0.6 },
        { kind: 'wheel', at: [3.78, -2.0], lift: 1.45 },
        {
          kind: 'shelf', at: [-0.95, -2.75], lift: 1.6, length: 1.4,
          items: [
            { kind: 'bottle', at: -0.55 },
            { kind: 'bottle', at: -0.44, color: [0.3, 0.18, 0.08] },
            { kind: 'jar', at: -0.2 },
            { kind: 'coins', at: 0.08, stacks: [[0, 0, 6], [0.05, 0.03, 3], [-0.04, 0.04, 2]] },
            { kind: 'candle', at: 0.3, height: 0.09 },
            { kind: 'mug', at: 0.52, yaw: 1.2 },
          ],
        },
        {
          kind: 'shelf', at: [-3.75, -2.0], lift: 1.5, yaw: 1.5708, length: 1.2,
          items: [
            { kind: 'box', at: -0.33, size: [0.26, 0.14, 0.16] },
            { kind: 'bottle', at: 0.02 },
            { kind: 'bottle', at: 0.13, color: [0.12, 0.15, 0.3] },
            { kind: 'scroll', at: 0.38, length: 0.26 },
          ],
        },
        {
          kind: 'shelf', at: [1.75, 1.8], lift: 1.45, yaw: -1.5708, length: 1.0,
          items: [
            { kind: 'candle', at: -0.32, height: 0.13 },
            { kind: 'candle', at: -0.26, height: 0.07 },
            { kind: 'bottle', at: -0.05, color: [0.3, 0.18, 0.08] },
            { kind: 'mug', at: 0.18, yaw: -0.4 },
            { kind: 'coins', at: 0.36, stacks: [[0, 0, 4], [0.04, -0.03, 2]] },
          ],
        },
        { kind: 'anchor', at: [3.2, 1.2], tilt: -0.25 },
        { kind: 'rope', at: [2.45, 1.6] },
        { kind: 'boat', at: [6.3, 0.6], on: 'ground', yaw: 1.5708 },
        { kind: 'bench', at: [3.0, 8.3], on: 'ground' },
        { kind: 'chest', on: 'upper', at: [1.2, -2.2], yaw: 0.05 },
        { kind: 'lantern', on: 'upper', at: [1.45, -2.25], lift: 0.59, yaw: -0.4, use: { kind: 'lamp', onHint: 'rozsvítit lucernu', offHint: 'zhasnout lucernu' } },
        {
          kind: 'shelf', on: 'upper', at: [-1.6, -2.45], lift: 1.5, length: 1.2,
          items: [
            { kind: 'scroll', at: -0.42, length: 0.24 },
            { kind: 'bottle', at: -0.15, color: [0.1, 0.28, 0.14] },
            { kind: 'candle', at: 0.05, height: 0.1 },
            { kind: 'coins', at: 0.22, stacks: [[0, 0, 5], [0.045, 0.02, 2]] },
            { kind: 'jar', at: 0.42 },
          ],
        },
        { kind: 'bottle', on: 'upper', at: [-0.3, -0.25], broken: true, yaw: 2.1 },
        { kind: 'mug', on: 'upper', at: [-0.12, -0.02], yaw: 0.7 },
        { kind: 'rope', on: 'upper', at: [-3.05, -0.9] },
        { kind: 'hammock', on: 'upper', at: [0, 0.35], span: [-3.56, -0.5], anchorTop: [1.6, 1.55], post: true },
      ],
    },
    growth: {
      holes: { chance: 0.85, species: ['broadleaf', 'coastal', 'fern'], size: [1.2, 1.7] },
      edge: { step: 0.4, out: [-0.35, 0.9], chance: 0.8, species: ['broadleaf', 'fern', 'coastal', 'cushion'], size: [0.9, 1.5] },
    },
    porch: {
      depth: 2.1,
      sideFrom: [2.65, 0.95],
      from: -4,
      to: 4,
      post: 0.09,
      postSink: 0.3,
      lean: 0.12,
      planks: { missing: 0.12, broken: 0.18, rotten: 0.18, rotSag: 0.14, tilt: 0.05, warp: 0.02, pieceMin: 1, pieceMax: 2.1 },
      rail: { height: 0.95, low: 0.48, radius: 0.05, missing: 0.25, broken: 0.35, fallTo: 0.7 },
      steps: { at: 1.4, width: 1.2, rise: 0.2, run: 0.34, log: 0.075, missing: 0.12, broken: 0.3, brokenDrop: 0.15 },
    },
    props: {
      flag: {
        at: [-3.8, 5.0],
        height: 5.2,
        lean: 0.28,
        radius: 0.06,
        size: [1.15, 0.78],
        dir: 1,
        droop: 0.22,
        wave: 0.1,
        colors: { cloth: '#1c1a19', stain: '#5a4a38', bone: '#d8cfba' },
      },
      barrels: {
        style: {
          height: 0.95, radius: 0.3, bulge: 0.14, sides: 16, staves: 16, texturePlanks: PLANKS_TEXTURE_PLANKS, tile: 1,
          hoops: [0.1, 0.32, 0.68, 0.9], hoopWidth: 0.05, hoopOut: 0.008,
          tint: [0.78, 0.64, 0.5], hoopTint: [0.2, 0.18, 0.17], shadeSpread: 0.25,
        },
        items: [
          { at: [-3.52, 4.62], on: 'porch' },
          { at: [-2.88, 4.72], on: 'porch', scale: 0.9 },
          { at: [3.3, 6.4], on: 'ground', lying: 'x' },
          { at: [-5.0, 1.75], on: 'ground', lying: 'z', scale: 0.95 },
          { at: [2.5, -0.85], on: 'upper', scale: 0.9 },
          { at: [-2.75, 1.45], on: 'upper', scale: 0.85 },
        ],
      },
      crates: {
        style: { size: 0.6, thickness: 0.03, tile: 1.2, tint: [0.82, 0.7, 0.55], shadeSpread: 0.25 },
        items: [
          { at: [3.5, 4.62], on: 'porch', yaw: 0.3, open: true },
          { at: [3.55, 3.95], on: 'porch', yaw: -0.2, scale: 0.8 },
          { at: [-4.4, 1.3], on: 'ground', yaw: 0.4, scale: 0.7 },
          { at: [-4.45, 2.15], on: 'ground', yaw: -0.25, scale: 0.6 },
          { at: [2.5, -1.45], on: 'upper', yaw: 0.1 },
          { at: [2.52, -1.45], on: 'upper', lift: 0.6, yaw: 0.5, scale: 0.6 },
          { at: [-1.95, 1.45], on: 'upper', yaw: 0.05, scale: 0.9 },
          { at: [-1.35, 1.42], on: 'upper', yaw: -0.3, scale: 0.7 },
        ],
      },
      netColors: { rope: '#8c7a58', float: '#a0703a' },
      nets: [
        { at: -1.0, width: 1.7, height: 1.45, top: 2.15, sag: 0.3, bulge: 0.08 },
        { on: 'upper', wall: 1, at: 0.55, width: 1.4, height: 1.2, top: 1.95, sag: 0.25, bulge: 0.07 },
      ],
    },
  },
};

export function getBuilding(key) {
  return BUILDINGS[key] || null;
}

export function buildingSize(entry) {
  const def = getBuilding(entry && entry.key);
  if (!def) return null;
  const turned = ((((entry.rotation || 0) % 4) + 4) % 4) % 2 === 1;
  return turned ? { width: def.depth, depth: def.width } : { width: def.width, depth: def.depth };
}

export function buildingCellKeys(entries) {
  const keys = new Set();
  for (const entry of entries || []) {
    for (const [cx, cz] of buildingCells(entry)) keys.add(`${cx},${cz}`);
  }
  return keys;
}

export function buildingCells(entry) {
  const size = buildingSize(entry);
  if (!size) return [];
  const cells = [];
  for (let x = 0; x < size.width; x += 1) {
    for (let z = 0; z < size.depth; z += 1) cells.push([entry.cx + x, entry.cz + z]);
  }
  return cells;
}
