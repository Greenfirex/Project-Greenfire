export function coordKey(x, y) {
    return `${Number(x)},${Number(y)}`;
}

export function edgeKey(ax, ay, bx, by) {
    const a = coordKey(ax, ay);
    const b = coordKey(bx, by);
    return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function manhattanDist(ax, ay, bx, by) {
    const fx = Number(ax);
    const fy = Number(ay);
    const tx = Number(bx);
    const ty = Number(by);
    if (![fx, fy, tx, ty].every(Number.isFinite)) return NaN;
    return Math.abs(tx - fx) + Math.abs(ty - fy);
}

export function isOrthAdjacent(ax, ay, bx, by) {
    return manhattanDist(ax, ay, bx, by) === 1;
}
