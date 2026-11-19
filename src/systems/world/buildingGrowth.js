// Část staveb: jak stavbu porůstá džungle — tráva a kapradí prorůstající dírami v podlaze a trsy
// kolem obvodu stavby a terasy i pod okrajem podlahy. Patří k BuildingSystem (sdílí jeho this).

const pick = (rng, list) => list[Math.floor(rng() * list.length)];
const between = (rng, [low, high]) => low + rng() * (high - low);

export default {
  holeGrowth(plan, x, z) {
    const growth = plan.growth;
    if (!growth || plan.rng() > growth.holes.chance) return;
    const ground = plan.groundAt(x, z);
    if (ground > -0.1) return;
    this.addGrassSpot(plan, x, ground, z, pick(plan.rng, growth.holes.species), between(plan.rng, growth.holes.size));
  },

  overgrow(plan, growth) {
    const { rng } = plan;
    const edge = growth.edge;
    const halfW = plan.width / 2;
    const halfD = plan.depth / 2;
    const far = halfD + (plan.porchDepth || 0);
    const sides = [
      { from: [-halfW, far], to: [halfW, far], out: [0, 1] },
      { from: [halfW, -halfD], to: [halfW, far], out: [1, 0] },
      { from: [-halfW, -halfD], to: [-halfW, far], out: [-1, 0] },
      { from: [-halfW, -halfD], to: [halfW, -halfD], out: [0, -1] },
    ];
    for (const side of sides) {
      const length = Math.hypot(side.to[0] - side.from[0], side.to[1] - side.from[1]);
      for (let along = 0; along <= length; along += edge.step) {
        if (rng() > edge.chance) continue;
        const t = along / length;
        const push = between(rng, edge.out);
        const x = side.from[0] + (side.to[0] - side.from[0]) * t + side.out[0] * push + (rng() - 0.5) * 0.3;
        const z = side.from[1] + (side.to[1] - side.from[1]) * t + side.out[1] * push + (rng() - 0.5) * 0.3;
        if ((plan.keepClear || []).some((box) => x > box.x0 && x < box.x1 && z > box.z0 && z < box.z1)) continue;
        const ground = plan.groundAt(x, z);
        if (ground > -0.05) continue;
        this.addGrassSpot(plan, x, ground, z, pick(rng, edge.species), between(rng, edge.size));
      }
    }
  },
};
