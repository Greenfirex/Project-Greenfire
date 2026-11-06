// Boční hmota terénu z pevných pruhů — plné stěny na místech, kde skála sousedí se vzduchem.
// Cíl: z boku/zezadu neprosvítá moře (doplní tloušťku za tenké pláty útesů). Za přepínačem.
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { CELL_SIZE } from '../../utils/gridMath.js';
import { buildColumnRuns } from '../../utils/terrainRuns.js';

const EPS = 1e-4;

function overlaps(runs, y0, y1) {
  for (const [a, b] of runs) {
    if (a < y1 - EPS && b > y0 + EPS) return true;
  }
  return false;
}

export function buildRunVolume(scene, layout) {
  const columns = buildColumnRuns(layout || {});
  if (!columns.size) return null;
  const half = CELL_SIZE / 2;
  const positions = [];
  const indices = [];
  const quad = (ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz) => {
    const start = positions.length / 3;
    positions.push(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz);
    indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  };
  for (const [id, runs] of columns) {
    if (!runs.length) continue;
    const [cx, cz] = id.split(',').map(Number);
    const x0 = cx * CELL_SIZE - half;
    const x1 = x0 + CELL_SIZE;
    const z0 = cz * CELL_SIZE - half;
    const z1 = z0 + CELL_SIZE;
    const east = columns.get(`${cx + 1},${cz}`) || [];
    const west = columns.get(`${cx - 1},${cz}`) || [];
    const north = columns.get(`${cx},${cz + 1}`) || [];
    const south = columns.get(`${cx},${cz - 1}`) || [];
    for (const [b, t] of runs) {
      if (!overlaps(east, b, t)) quad(x1, b, z0, x1, b, z1, x1, t, z1, x1, t, z0);
      if (!overlaps(west, b, t)) quad(x0, b, z0, x0, b, z1, x0, t, z1, x0, t, z0);
      if (!overlaps(north, b, t)) quad(x0, b, z1, x1, b, z1, x1, t, z1, x0, t, z1);
      if (!overlaps(south, b, t)) quad(x0, b, z0, x1, b, z0, x1, t, z0, x0, t, z0);
    }
  }
  if (!positions.length) return null;
  const normals = [];
  VertexData.ComputeNormals(positions, indices, normals);
  const mesh = new Mesh('terrainRunVolume', scene);
  const data = new VertexData();
  data.positions = positions;
  data.indices = indices;
  data.normals = normals;
  data.applyToMesh(mesh);
  mesh.isPickable = false;
  mesh.receiveShadows = false;
  const material = new StandardMaterial('terrainRunVolumeMat', scene);
  material.diffuseColor = new Color3(0.36, 0.33, 0.3);
  material.specularColor = new Color3(0, 0, 0);
  material.ambientColor = new Color3(0.12, 0.12, 0.12);
  material.backFaceCulling = false;
  mesh.material = material;
  mesh.metadata = { runVolume: true };
  return mesh;
}
