// Část staveb: střecha nad místností v patře — došková střecha z modelu (z Meshy, připraví
// tools/prepareRoof.mjs) položená na štíty z ubývajících klád, a popínavky na štítech.
// Model se načítá zvlášť a připojí se, až je načtený. Patří k BuildingSystem (sdílí jeho this).
import { loadModel, instantiateModel } from '../../utils/assetLoader.js';
import { roughLog, placeAlongZ } from '../../utils/buildingGeometry.js';

export default {
  buildRoof(plan, roof) {
    const room = plan.upperRoom;
    if (!room) return;
    const { rng } = plan;
    const walls = plan.walls;
    const step = walls.log * walls.spacing;
    const rows = Math.max(1, Math.round(room.height / step));
    const radius = walls.log / 2;
    const plate = room.base + (rows - 0.5) * step + radius;
    const gableBase = room.base + rows * step;
    const xc = (room.x0 + room.x1) / 2;
    const zc = (room.z0 + room.z1) / 2;
    const half = (room.z1 - room.z0) / 2;
    const rise = half * Math.tan(roof.pitch);
    const top = plate + rise + roof.thatch;

    for (const x of [room.x0, room.x1]) {
      for (let y = gableBase + step; y < plate + rise - step * 0.3; y += step) {
        const span = half * (1 - (y - plate) / rise) + 0.12;
        if (span < 0.2) break;
        const log = roughLog(rng, walls, zc - span, zc + span, y, radius * (0.9 + rng() * 0.15), span * 2);
        this.addLog(plan, log, placeAlongZ(x), this.logShade(plan));
      }
    }

    for (const [x, out] of [[room.x0, -1], [room.x1, 1]]) {
      const face = x + out * (radius + walls.vineGap);
      for (let along = -half + 0.3; along < half - 0.2; along += roof.vineStep) {
        const z = zc + along + (rng() - 0.5) * roof.vineStep * 0.5;
        const y = plate + (half - Math.abs(z - zc)) * Math.tan(roof.pitch) - 0.1;
        this.addVineAnchor(plan, face, y, z, out, 0, y - room.base, roof.vineChance, 'wall');
      }
    }

    loadModel(this.s, roof.model).then((template) => {
      if (!template || plan.root.isDisposed()) return;
      const node = instantiateModel(this.s, template, `${plan.name}_roof`);
      if (!node) return;
      node.parent = plan.root;
      node.scaling.setAll(1);
      node.position.set(xc, top, zc);
      for (const mesh of node.getChildMeshes()) this.addPartMesh(plan, mesh, 'roof');
    });
  },
};
