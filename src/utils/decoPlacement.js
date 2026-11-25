// Umístění jedné dekorace na buňce — posun, otočení a velikost na jednom místě.
// Počítá to sázení dekorací i náhled pod kurzorem, aby si oba spočítali totéž.

export function cellNoise(cx, cz, salt) {
  const n = Math.sin(cx * 127.1 + cz * 311.7 + salt * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

export function patchValue(cx, cz, size = 7) {
  const x = cx / size + cellNoise(cx, cz, 41) * 0.85;
  const z = cz / size + cellNoise(cx, cz, 43) * 0.85;
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const top = cellNoise(ix, iz, 47) + (cellNoise(ix + 1, iz, 47) - cellNoise(ix, iz, 47)) * sx;
  const bottom = cellNoise(ix, iz + 1, 47) + (cellNoise(ix + 1, iz + 1, 47) - cellNoise(ix, iz + 1, 47)) * sx;
  return top + (bottom - top) * sz;
}

function treeJitter(entry) {
  return {
    yaw: (cellNoise(entry.cx, entry.cz, 3) - 0.5) * 0.87,
    x: (cellNoise(entry.cx, entry.cz, 7) - 0.5) * 0.4,
    z: (cellNoise(entry.cx, entry.cz, 11) - 0.5) * 0.4,
    scale: 0.9 + cellNoise(entry.cx, entry.cz, 17) * 0.2,
  };
}

function rockJitter(entry) {
  return {
    yaw: cellNoise(entry.cx, entry.cz, 29) * Math.PI * 2,
    x: 0,
    z: 0,
    scale: 0.85 + cellNoise(entry.cx, entry.cz, 31) * 0.3,
  };
}

function plantJitter(entry, fixedScale) {
  const x = entry.cx + (entry.offsetX || 0) * 7.3;
  const z = entry.cz + (entry.offsetZ || 0) * 5.9;
  return {
    yaw: cellNoise(x, z, 23) * Math.PI * 2,
    x: (cellNoise(entry.cx, entry.cz, 19) - 0.5) * 0.5,
    z: (cellNoise(entry.cx, entry.cz, 37) - 0.5) * 0.5,
    scale: fixedScale ? 1 : 0.94 + cellNoise(x, z, 31) * 0.12,
  };
}

export function decoJitter(def, entry) {
  if (!def || !entry || entry.exact) return null;
  if (def.tree) return treeJitter(entry);
  if (def.kind === 'bush') return plantJitter(entry, def.fixedScale);
  if (def.rock || def.stone || def.log || def.branch || def.driftwood || def.shell || def.flat || def.coral || def.flower || def.bush || def.loose) return rockJitter(entry);
  return null;
}

export function decoPlacement(def, entry) {
  const jitter = decoJitter(def, entry);
  const jitterX = jitter ? jitter.x : 0;
  const jitterZ = jitter ? jitter.z : 0;
  const entryScale = Number.isFinite(entry.scale) ? entry.scale : 1;
  const defScale = Number.isFinite(def && def.scale) ? def.scale : 1;
  const yaw = (Math.PI / 2) * (entry.rotation || 0) + (jitter ? jitter.yaw : 0);
  const back = Number.isFinite(def && def.backToEdge) ? def.backToEdge : 0;
  return {
    offsetX: (entry.offsetX || 0) + jitterX - Math.sin(yaw) * back,
    offsetZ: (entry.offsetZ || 0) + jitterZ - Math.cos(yaw) * back,
    jitterX,
    jitterZ,
    yaw,
    scale: defScale * entryScale * (jitter ? jitter.scale : 1),
  };
}
