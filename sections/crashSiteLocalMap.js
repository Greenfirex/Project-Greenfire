import { getLocalMapTileAt, isCrashPoi, hasInternalPoiWallBetween, hasInternalPoiDoorBetween, isCrashWallBetween } from '../data/definitions/localMapTiles.js';
import { allActions as salvageActions } from '../data/definitions/allActions.js';
import { isCompactPhoneLandscape } from '../ui/compactMode.js';

const COLS = 11; // A-K
const ROWS = 9;  // 1-9
const LETTERS = Array.from({ length: COLS }, (_, i) => String.fromCharCode('A'.charCodeAt(0) + i));

// isCompactPhoneLandscape is centralized in ui/compactMode.js

function hasCompactZoomTouched() {
    try { return localStorage.getItem('localMapCompactZoomTouched') === 'true'; } catch { return false; }
}

function markCompactZoomTouched() {
    try { localStorage.setItem('localMapCompactZoomTouched', 'true'); } catch { /* ignore */ }
}

function tileCenterToSvgPoint(col, row) {
    const c = Number(col);
    const r = Number(row);
    // SVG is 0..100 in each axis, so convert tile center to percent.
    const x = ((c - 0.5) / COLS) * 100;
    const y = ((r - 0.5) / ROWS) * 100;
    return { x, y };
}

function ensurePathOverlay(container, grid) {
    if (!container || !grid) return null;
    try {
        if (container._localMapPathOverlay && container._localMapPathOverlay.ownerSVGElement) {
            const svg = container._localMapPathOverlay.ownerSVGElement;
            // If the map DOM was re-rendered, the cached overlay may be detached.
            // Only reuse it if it is still connected and inside the current grid.
            if (svg && svg.isConnected && grid.contains(svg)) {
                return svg;
            }
            try { delete container._localMapPathOverlay; } catch { /* ignore */ }
        }
    } catch { /* ignore */ }

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('localmap-path-overlay');
    svg.dataset.kind = 'move';
    // Ensure it sizes correctly across browsers.
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.display = 'block';

    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    svg.appendChild(poly);

    const endDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    endDot.setAttribute('r', '0');
    svg.appendChild(endDot);

    // Insert before tiles so it sits under markers.
    try {
        grid.insertBefore(svg, grid.firstChild);
    } catch {
        grid.appendChild(svg);
    }

    try {
        container._localMapPathOverlay = poly;
        container._localMapPathOverlayEndDot = endDot;
    } catch { /* ignore */ }

    return svg;
}

export function updateCrashSiteLocalMapPathOverlay(container, preview = null) {
    if (!container) return;
    const grid = container.querySelector('.localmap-grid');
    if (!grid) return;

    const svg = ensurePathOverlay(container, grid);
    let poly = null;
    let endDot = null;
    try { poly = container._localMapPathOverlay; } catch { poly = null; }
    try { endDot = container._localMapPathOverlayEndDot; } catch { endDot = null; }
    if (!svg || !poly) return;

    const points = preview && Array.isArray(preview.points) ? preview.points : null;
    const kind = preview && preview.kind ? String(preview.kind) : 'move';

    if (!points || points.length < 2) {
        poly.setAttribute('points', '');
        try {
            if (endDot) endDot.setAttribute('r', '0');
        } catch { /* ignore */ }
        svg.style.display = 'none';
        return;
    }

    const svgPoints = [];
    for (const p of points) {
        const c = Number(p && (p.x ?? p.col));
        const r = Number(p && (p.y ?? p.row));
        if (!Number.isFinite(c) || !Number.isFinite(r)) continue;
        const sp = tileCenterToSvgPoint(c, r);
        svgPoints.push(`${sp.x.toFixed(3)},${sp.y.toFixed(3)}`);
    }

    poly.setAttribute('points', svgPoints.join(' '));
    svg.dataset.kind = kind;
    svg.style.display = 'block';

    // End-of-route marker (larger dot on target tile).
    try {
        const last = points[points.length - 1];
        const lc = Number(last && (last.x ?? last.col));
        const lr = Number(last && (last.y ?? last.row));
        if (endDot && Number.isFinite(lc) && Number.isFinite(lr)) {
            const sp = tileCenterToSvgPoint(lc, lr);
            endDot.setAttribute('cx', sp.x.toFixed(3));
            endDot.setAttribute('cy', sp.y.toFixed(3));
            endDot.setAttribute('r', kind === 'traverse' ? '2.25' : '1.55');
        }
    } catch { /* ignore */ }
}

function startTravelDotAnimation(container, grid, moveAnim) {
    if (!container || !grid || !moveAnim) return;

    // Cancel any previous animation.
    try {
        if (container._localMapTravelAnim && typeof container._localMapTravelAnim.cancel === 'function') {
            container._localMapTravelAnim.cancel();
        }
    } catch { /* ignore */ }

    const from = tileCenterToSvgPoint(moveAnim.fromX, moveAnim.fromY);
    const to = tileCenterToSvgPoint(moveAnim.toX, moveAnim.toY);

    const dot = document.createElement('div');
    dot.className = 'localmap-travel-dot';
    dot.style.left = `${from.x}%`;
    dot.style.top = `${from.y}%`;

    try { grid.classList.add('is-player-traveling'); } catch { /* ignore */ }
    try { grid.appendChild(dot); } catch { /* ignore */ }

    const TRAVEL_MS = Math.max(120, Number(moveAnim.durationMs) || 320);
    const start = Number(moveAnim.startAt) || Date.now();
    let rafId = 0;
    let cancelled = false;

    const cleanup = () => {
        try { if (rafId) cancelAnimationFrame(rafId); } catch { /* ignore */ }
        try { dot.remove(); } catch { /* ignore */ }
        // If an in-flight animation is being cancelled by a rerender, don't reveal the
        // static player dot on the origin tile for a frame.
        if (!(cancelled && moveAnim && moveAnim._kind === 'inflight')) {
            try { grid.classList.remove('is-player-traveling'); } catch { /* ignore */ }
        }
    };

    const tick = () => {
        if (cancelled) return;
        const t = Math.max(0, Math.min(1, (Date.now() - start) / TRAVEL_MS));
        const x = from.x + (to.x - from.x) * t;
        const y = from.y + (to.y - from.y) * t;
        dot.style.left = `${x}%`;
        dot.style.top = `${y}%`;
        if (t >= 1) {
            // For in-flight travel we intentionally keep the travel dot (and keep the
            // static player dot hidden) until the next map rerender cancels it.
            // Otherwise there's a one-frame flash of the player dot back on the origin tile.
            if (moveAnim && moveAnim._kind === 'inflight') {
                dot.style.left = `${to.x}%`;
                dot.style.top = `${to.y}%`;
                setTimeout(() => {
                    try {
                        if (!cancelled && dot.isConnected) cleanup();
                    } catch { /* ignore */ }
                }, 750);
                return;
            }

            cleanup();
            return;
        }
        rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    try {
        container._localMapTravelAnim = {
            cancel: () => {
                cancelled = true;
                cleanup();
            }
        };
    } catch { /* ignore */ }
}

function getTravelAnimSpec(state) {
    try {
        // If we just ran an in-flight travel animation, skip the fallback hop to avoid ghosting.
        const skipUntil = Number(state && typeof state === 'object' ? state._skipPostMoveAnimUntil : 0);
        if (Number.isFinite(skipUntil) && skipUntil > 0 && Date.now() < skipUntil) {
            return null;
        }

        const inflight = state && typeof state === 'object' ? state.inFlightTravel : null;
        if (inflight && typeof inflight === 'object') {
            const startAt = Number(inflight.startAt);
            const durationMs = Number(inflight.durationMs);
            const fromX = Number(inflight.fromX);
            const fromY = Number(inflight.fromY);
            const toX = Number(inflight.toX);
            const toY = Number(inflight.toY);
            if ([startAt, durationMs, fromX, fromY, toX, toY].every(Number.isFinite) && durationMs > 0) {
                if ((Date.now() - startAt) <= (durationMs + 200)) {
                    return { fromX, fromY, toX, toY, startAt, durationMs, _kind: 'inflight' };
                }
            }
        }
    } catch { /* ignore */ }

    // Fallback: lightweight post-move hop based on lastMoveAt.
    try {
        const at = Number(state && typeof state === 'object' ? state.lastMoveAt : 0);
        if (!Number.isFinite(at) || at <= 0) return null;
        if ((Date.now() - at) > 900) return null;
        const fromX = Number(state.lastMoveFromX);
        const fromY = Number(state.lastMoveFromY);
        const toX = Number(state.lastMoveToX);
        const toY = Number(state.lastMoveToY);
        if (![fromX, fromY, toX, toY].every(Number.isFinite)) return null;
        return { fromX, fromY, toX, toY, startAt: at, durationMs: 220, _kind: 'post' };
    } catch {
        return null;
    }
}

function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}

const CARDINAL_DIRS = [
    { dx: 0, dy: -1 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
];

const EIGHT_DIRS = [
    ...CARDINAL_DIRS,
    { dx: 1, dy: -1 },
    { dx: 1, dy: 1 },
    { dx: -1, dy: 1 },
    { dx: -1, dy: -1 },
];

function inBounds(col, row) {
    const c = Number(col);
    const r = Number(row);
    return Number.isFinite(c) && Number.isFinite(r) && c >= 1 && c <= COLS && r >= 1 && r <= ROWS;
}

function edgeBlocksSight(fromX, fromY, toX, toY, localMapState) {
    // Treat all crash-site walls (boundary + internal POI) as opaque for visibility.
    // This prevents revealing tiles through ship walls / bulkheads.
    try {
        return !!isCrashWallBetween(fromX, fromY, toX, toY, { localMapState });
    } catch {
        return false;
    }
}

function canStepDiagonal(fromX, fromY, toX, toY, localMapState) {
    const fx = Number(fromX);
    const fy = Number(fromY);
    const tx = Number(toX);
    const ty = Number(toY);
    const dx = tx - fx;
    const dy = ty - fy;
    if (Math.abs(dx) !== 1 || Math.abs(dy) !== 1) return false;

    // Diagonal visibility/stepping is allowed only if at least one of the two
    // orthogonal "corner" routes isn't blocked by walls. This avoids seeing
    // through corners across the crash-site boundary or internal bulkheads.
    const viaX = { x: fx + dx, y: fy };
    const viaY = { x: fx, y: fy + dy };

    const pathViaX = inBounds(viaX.x, viaX.y)
        && !edgeBlocksSight(fx, fy, viaX.x, viaX.y, localMapState)
        && !edgeBlocksSight(viaX.x, viaX.y, tx, ty, localMapState);

    const pathViaY = inBounds(viaY.x, viaY.y)
        && !edgeBlocksSight(fx, fy, viaY.x, viaY.y, localMapState)
        && !edgeBlocksSight(viaY.x, viaY.y, tx, ty, localMapState);

    return pathViaX || pathViaY;
}

function computeVisibleTiles(centerCol, centerRow, radius, { localMapState = null, insideCrashPoi = false } = {}) {
    const cx = Number(centerCol);
    const cy = Number(centerRow);
    const r = Math.max(0, Math.floor(Number(radius) || 0));
    const visible = new Set();
    if (!inBounds(cx, cy)) return visible;

    const keyOf = (x, y) => `${x},${y}`;
    visible.add(keyOf(cx, cy));
    if (r <= 0) return visible;

    // Special rule: inside the Crash Site POI, visibility is severely limited by smoke.
    // Only reveal orthogonally adjacent tiles, and still respect walls.
    if (insideCrashPoi) {
        for (const d of CARDINAL_DIRS) {
            const nx = cx + d.dx;
            const ny = cy + d.dy;
            if (!inBounds(nx, ny)) continue;
            if (edgeBlocksSight(cx, cy, nx, ny, localMapState)) continue;
            visible.add(keyOf(nx, ny));
        }
        return visible;
    }

    // Outside the POI: do a small breadth-first visibility flood within the square radius.
    // Walls stop propagation so you can't "see" through the ship hull or bulkheads.
    const queue = [{ x: cx, y: cy, dist: 0 }];
    const seen = new Set([keyOf(cx, cy)]);

    while (queue.length) {
        const cur = queue.shift();
        if (!cur) break;
        if (cur.dist >= r) continue;

        for (const d of EIGHT_DIRS) {
            const nx = cur.x + d.dx;
            const ny = cur.y + d.dy;
            if (!inBounds(nx, ny)) continue;

            // Keep the old "square" reveal feel.
            if (Math.abs(nx - cx) > r || Math.abs(ny - cy) > r) continue;

            const k = keyOf(nx, ny);
            if (seen.has(k)) continue;

            const isDiagonal = (d.dx !== 0 && d.dy !== 0);
            if (isDiagonal) {
                if (!canStepDiagonal(cur.x, cur.y, nx, ny, localMapState)) continue;
            } else {
                if (edgeBlocksSight(cur.x, cur.y, nx, ny, localMapState)) continue;
            }

            seen.add(k);
            visible.add(k);
            queue.push({ x: nx, y: ny, dist: cur.dist + 1 });
        }
    }

    return visible;
}

function toCoordLabel(col, row) {
    const c = clamp(Number(col) || 1, 1, COLS);
    const r = clamp(Number(row) || 1, 1, ROWS);
    return `${LETTERS[c - 1]}${r}`;
}

function normalizeState(state) {
    const fallback = {
        x: 6,
        y: 8,
        selectedX: 6,
        selectedY: 8,
    };
    if (!state || typeof state !== 'object') return { ...fallback };
    const x = clamp(Number(state.x) || fallback.x, 1, COLS);
    const y = clamp(Number(state.y) || fallback.y, 1, ROWS);
    const selectedX = clamp(Number(state.selectedX) || x, 1, COLS);
    const selectedY = clamp(Number(state.selectedY) || y, 1, ROWS);
    return { x, y, selectedX, selectedY };
}

function normalizeZoom(state) {
    const compact = isCompactPhoneLandscape();
    const touched = compact ? hasCompactZoomTouched() : true;
    const raw = Number(state && typeof state === 'object' ? state.zoom : NaN);

    // Slightly zoom-in by default on compact phone-landscape so the map reads better.
    // Only apply this when the player hasn't interacted with the zoom controls yet.
    const compactDefault = 1.2;

    if (Number.isFinite(raw)) {
        if (compact && !touched && Math.abs(raw - 1) < 0.001) return compactDefault;
        return clamp(raw, 0.6, 2.0);
    }

    if (compact && !touched) return compactDefault;
    return 1;
}

function normalizePan(state, zoom) {
    if (!state || typeof state !== 'object') return { panX: 0, panY: 0 };
    const px = Number(state.panX);
    const py = Number(state.panY);
    const panX = Number.isFinite(px) ? px : 0;
    const panY = Number.isFinite(py) ? py : 0;
    if (zoom <= 1.01) return { panX: 0, panY: 0 };
    return {
        panX: Math.max(-5000, Math.min(5000, panX)),
        panY: Math.max(-5000, Math.min(5000, panY)),
    };
}

function ensureVisited(state, x, y) {
    if (!state || typeof state !== 'object') return;
    if (!state.visited || typeof state.visited !== 'object' || Array.isArray(state.visited)) {
        state.visited = {};
    }
    const key = `${clamp(Number(x) || 1, 1, COLS)},${clamp(Number(y) || 1, 1, ROWS)}`;
    state.visited[key] = true;
}

function isVisited(state, col, row) {
    try {
        const key = `${Number(col)},${Number(row)}`;
        return !!(state && typeof state === 'object' && state.visited && typeof state.visited === 'object' && state.visited[key] === true);
    } catch {
        return false;
    }
}

function buildCorridorOutlinePath({ openTop, openBottom, openLeft, openRight, isPlayer = false } = {}) {
    // Build an SVG path (stroke only) outlining the union of corridor rectangles.
    // This avoids the "lines to the middle" artifact on junctions because the outline
    // naturally wraps around the corridor shape.
    const SCALE = 100; // hundredths of a percent (0..10000)
    const MAX = 100 * SCALE;

    const corridorWidthPct = 40;
    const corridorHalfPct = corridorWidthPct / 2;
    // Extend corridor openings all the way to the tile edge.
    // We "bleed" the open corridor rectangles slightly past the SVG viewbox so
    // the outline generator doesn't create a boundary segment on the tile edge.
    // (Those edge strokes would look like walls between traversable tiles.)
    const bleedPct = 8;

    const x0 = Math.round((50 - corridorHalfPct) * SCALE);
    const x1 = Math.round((50 + corridorHalfPct) * SCALE);
    const y0 = Math.round((50 - corridorHalfPct) * SCALE);
    const y1 = Math.round((50 + corridorHalfPct) * SCALE);
    const bleed = Math.round(bleedPct * SCALE);

    const rects = [];
    rects.push({ xA: x0, yA: y0, xB: x1, yB: y1 });
    if (openTop) rects.push({ xA: x0, yA: -bleed, xB: x1, yB: y0 });
    if (openBottom) rects.push({ xA: x0, yA: y1, xB: x1, yB: MAX + bleed });
    if (openLeft) rects.push({ xA: -bleed, yA: y0, xB: x0, yB: y1 });
    if (openRight) rects.push({ xA: x1, yA: y0, xB: MAX + bleed, yB: y1 });

    const clampRect = (r) => {
        // Prevent pathological values, but preserve the bleed beyond 0..MAX.
        const LIM = MAX * 2;
        return {
            xA: Math.max(-LIM, Math.min(LIM, r.xA)),
            yA: Math.max(-LIM, Math.min(LIM, r.yA)),
            xB: Math.max(-LIM, Math.min(LIM, r.xB)),
            yB: Math.max(-LIM, Math.min(LIM, r.yB)),
        };
    };

    const normRect = (r) => {
        const rr = clampRect(r);
        const xMin = Math.min(rr.xA, rr.xB);
        const xMax = Math.max(rr.xA, rr.xB);
        const yMin = Math.min(rr.yA, rr.yB);
        const yMax = Math.max(rr.yA, rr.yB);
        return { xMin, xMax, yMin, yMax };
    };

    const R = rects.map(normRect).filter(r => (r.xMax > r.xMin) && (r.yMax > r.yMin));
    const xs = new Set([0, MAX]);
    const ys = new Set([0, MAX]);
    for (const r of R) {
        xs.add(r.xMin); xs.add(r.xMax);
        ys.add(r.yMin); ys.add(r.yMax);
    }
    const xVals = Array.from(xs).sort((a, b) => a - b);
    const yVals = Array.from(ys).sort((a, b) => a - b);

    const EPS = 1;
    const filled = (x, y) => {
        for (const r of R) {
            if (x >= r.xMin && x <= r.xMax && y >= r.yMin && y <= r.yMax) return true;
        }
        return false;
    };

    const segments = [];
    // Vertical boundary segments
    for (const x of xVals) {
        for (let i = 0; i < yVals.length - 1; i++) {
            const yA = yVals[i];
            const yB = yVals[i + 1];
            if (yB <= yA) continue;
            const yMid = Math.floor((yA + yB) / 2);
            const left = filled(x - EPS, yMid);
            const right = filled(x + EPS, yMid);
            if (left !== right) segments.push({ ax: x, ay: yA, bx: x, by: yB });
        }
    }
    // Horizontal boundary segments
    for (const y of yVals) {
        for (let i = 0; i < xVals.length - 1; i++) {
            const xA2 = xVals[i];
            const xB2 = xVals[i + 1];
            if (xB2 <= xA2) continue;
            const xMid = Math.floor((xA2 + xB2) / 2);
            const up = filled(xMid, y - EPS);
            const down = filled(xMid, y + EPS);
            if (up !== down) segments.push({ ax: xA2, ay: y, bx: xB2, by: y });
        }
    }

    // Build adjacency map for a single closed loop.
    const pointKey = (x, y) => `${x},${y}`;
    const points = new Map();
    const adj = new Map();

    const addEdge = (x1p, y1p, x2p, y2p) => {
        const k1 = pointKey(x1p, y1p);
        const k2 = pointKey(x2p, y2p);
        points.set(k1, { x: x1p, y: y1p });
        points.set(k2, { x: x2p, y: y2p });
        if (!adj.has(k1)) adj.set(k1, []);
        if (!adj.has(k2)) adj.set(k2, []);
        adj.get(k1).push(k2);
        adj.get(k2).push(k1);
    };

    for (const s of segments) {
        addEdge(s.ax, s.ay, s.bx, s.by);
    }

    const allPts = Array.from(points.values());
    if (!allPts.length) return '';
    allPts.sort((p1, p2) => (p1.y - p2.y) || (p1.x - p2.x));
    const start = allPts[0];
    const startKey = pointKey(start.x, start.y);
    const startNeighbors = adj.get(startKey) || [];
    if (startNeighbors.length === 0) return '';

    // Choose an arbitrary direction to walk the loop.
    let prevKey = null;
    let curKey = startKey;
    let nextKey = startNeighbors[0];

    const ordered = [startKey];
    let guard = 0;
    while (guard++ < 1000) {
        if (nextKey === startKey) break;
        ordered.push(nextKey);
        const nbs = adj.get(nextKey) || [];
        const candidate = nbs.find(k => k !== curKey);
        prevKey = curKey;
        curKey = nextKey;
        nextKey = candidate || startKey;
        if (prevKey === curKey) break;
    }

    // Convert to SVG path in 0..100 coordinates.
    const toSvg = (k) => {
        const p = points.get(k);
        if (!p) return null;
        return { x: p.x / SCALE, y: p.y / SCALE };
    };
    const first = toSvg(ordered[0]);
    if (!first) return '';
    let d = `M ${first.x} ${first.y}`;
    for (let i = 1; i < ordered.length; i++) {
        const p = toSvg(ordered[i]);
        if (!p) continue;
        d += ` L ${p.x} ${p.y}`;
    }
    d += ' Z';
    return d;
}

function buildRoomOutlinePath({ openTop, openBottom, openLeft, openRight } = {}) {
    // A room is mostly "filled" (inset rectangle), with optional openings that connect to adjacent traversable tiles.
    // The outline is generated from the union of rectangles (same technique as corridor outlines).
    const SCALE = 100;
    const MAX = 100 * SCALE;

    const insetPct = 9;
    const openingWidthPct = 34;
    const bleedPct = 8;

    const inset = Math.round(insetPct * SCALE);
    const bleed = Math.round(bleedPct * SCALE);
    const halfOpen = Math.round((openingWidthPct / 2) * SCALE);

    const xA = inset;
    const xB = MAX - inset;
    const yA = inset;
    const yB = MAX - inset;

    const rects = [{ xA, yA, xB, yB }];

    const cx = Math.round(50 * SCALE);
    const cy = Math.round(50 * SCALE);
    const openX0 = cx - halfOpen;
    const openX1 = cx + halfOpen;
    const openY0 = cy - halfOpen;
    const openY1 = cy + halfOpen;

    if (openTop) rects.push({ xA: openX0, yA: -bleed, xB: openX1, yB: yA });
    if (openBottom) rects.push({ xA: openX0, yA: yB, xB: openX1, yB: MAX + bleed });
    if (openLeft) rects.push({ xA: -bleed, yA: openY0, xB: xA, yB: openY1 });
    if (openRight) rects.push({ xA: xB, yA: openY0, xB: MAX + bleed, yB: openY1 });

    // Reuse the corridor outline algorithm by inlining the same approach.
    const clampRect = (r) => {
        const LIM = MAX * 2;
        return {
            xA: Math.max(-LIM, Math.min(LIM, r.xA)),
            yA: Math.max(-LIM, Math.min(LIM, r.yA)),
            xB: Math.max(-LIM, Math.min(LIM, r.xB)),
            yB: Math.max(-LIM, Math.min(LIM, r.yB)),
        };
    };

    const normRect = (r) => {
        const rr = clampRect(r);
        const xMin = Math.min(rr.xA, rr.xB);
        const xMax = Math.max(rr.xA, rr.xB);
        const yMin = Math.min(rr.yA, rr.yB);
        const yMax = Math.max(rr.yA, rr.yB);
        return { xMin, xMax, yMin, yMax };
    };

    const R = rects.map(normRect).filter(r => (r.xMax > r.xMin) && (r.yMax > r.yMin));
    const xs = new Set([0, MAX]);
    const ys = new Set([0, MAX]);
    for (const r of R) {
        xs.add(r.xMin); xs.add(r.xMax);
        ys.add(r.yMin); ys.add(r.yMax);
    }
    const xVals = Array.from(xs).sort((a, b) => a - b);
    const yVals = Array.from(ys).sort((a, b) => a - b);

    const EPS = 1;
    const filled = (x, y) => {
        for (const r of R) {
            if (x >= r.xMin && x <= r.xMax && y >= r.yMin && y <= r.yMax) return true;
        }
        return false;
    };

    const segments = [];
    for (const x of xVals) {
        for (let i = 0; i < yVals.length - 1; i++) {
            const y0 = yVals[i];
            const y1 = yVals[i + 1];
            if (y1 <= y0) continue;
            const yMid = Math.floor((y0 + y1) / 2);
            const left = filled(x - EPS, yMid);
            const right = filled(x + EPS, yMid);
            if (left !== right) segments.push({ ax: x, ay: y0, bx: x, by: y1 });
        }
    }
    for (const y of yVals) {
        for (let i = 0; i < xVals.length - 1; i++) {
            const x0 = xVals[i];
            const x1 = xVals[i + 1];
            if (x1 <= x0) continue;
            const xMid = Math.floor((x0 + x1) / 2);
            const up = filled(xMid, y - EPS);
            const down = filled(xMid, y + EPS);
            if (up !== down) segments.push({ ax: x0, ay: y, bx: x1, by: y });
        }
    }

    const pointKey = (x, y) => `${x},${y}`;
    const points = new Map();
    const adj = new Map();
    const addEdge = (x1, y1, x2, y2) => {
        const k1 = pointKey(x1, y1);
        const k2 = pointKey(x2, y2);
        points.set(k1, { x: x1, y: y1 });
        points.set(k2, { x: x2, y: y2 });
        if (!adj.has(k1)) adj.set(k1, []);
        if (!adj.has(k2)) adj.set(k2, []);
        adj.get(k1).push(k2);
        adj.get(k2).push(k1);
    };
    for (const s of segments) addEdge(s.ax, s.ay, s.bx, s.by);

    const allPts = Array.from(points.values());
    if (!allPts.length) return '';
    allPts.sort((p1, p2) => (p1.y - p2.y) || (p1.x - p2.x));
    const start = allPts[0];
    const startKey = pointKey(start.x, start.y);
    const startNeighbors = adj.get(startKey) || [];
    if (startNeighbors.length === 0) return '';

    let curKey = startKey;
    let nextKey = startNeighbors[0];
    const ordered = [startKey];
    let guard = 0;
    while (guard++ < 1000) {
        if (nextKey === startKey) break;
        ordered.push(nextKey);
        const nbs = adj.get(nextKey) || [];
        const candidate = nbs.find(k => k !== curKey);
        curKey = nextKey;
        nextKey = candidate || startKey;
    }

    const toSvg = (k) => {
        const p = points.get(k);
        if (!p) return null;
        return { x: p.x / SCALE, y: p.y / SCALE };
    };
    const first = toSvg(ordered[0]);
    if (!first) return '';
    let d = `M ${first.x} ${first.y}`;
    for (let i = 1; i < ordered.length; i++) {
        const p = toSvg(ordered[i]);
        if (!p) continue;
        d += ` L ${p.x} ${p.y}`;
    }
    d += ' Z';
    return d;
}

function buildLiftBoxPath() {
    // A simple central box representing the lift platform.
    const inset = 28;
    const x0 = inset;
    const x1 = 100 - inset;
    const y0 = inset;
    const y1 = 100 - inset;
    return `M ${x0} ${y0} L ${x1} ${y0} L ${x1} ${y1} L ${x0} ${y1} Z`;
}

export function setupCrashSiteLocalMap(container, { scoutStage = 0, totalStages = 3, state = null } = {}) {
    if (!container) return;

    // Touch UX: double-tap a tile to trigger the same behavior as desktop double-click.
    // Persist these across rerenders by caching on the container.
    try {
        if (!container._localMapTapState) {
            container._localMapTapState = { lastKey: null, lastAt: 0, suppressClickUntil: 0 };
        }
    } catch { /* ignore */ }

    // Allow the travel animation helper to clear state.inFlightTravel when it finishes.
    try { container._localMapStateRef = state; } catch { /* ignore */ }

    const mapState = normalizeState(state);
    const zoom = normalizeZoom(state);
    const { panX, panY } = normalizePan(state, zoom);

    // If we're not zoomed in, force pan to 0 so the background/grid can't look offset.
    try {
        if (state && typeof state === 'object' && zoom <= 1.01) {
            state.panX = 0;
            state.panY = 0;
        }
    } catch { /* ignore */ }
    const stage = clamp(Number(scoutStage) || 0, 0, Math.max(0, Number(totalStages) || 0));
    const radius = 1; // Always reveal one tile away from the player

    // Mark the current player position as visited (persistent exploration).
    ensureVisited(state, mapState.x, mapState.y);

    // Reveal should follow the player's current position.
    const centerCol = mapState.x;
    const centerRow = mapState.y;

    // IMPORTANT: Do not call tileMeta() here (it's a const defined later).
    // Use the POI footprint directly to avoid temporal dead zone errors.
    const insideCrashPoi = isCrashPoi(centerCol, centerRow);
    const visibleNow = computeVisibleTiles(centerCol, centerRow, radius, { localMapState: state, insideCrashPoi });

    const hasTriedReentry = (() => {
        try {
            const raw = (typeof state === 'object' && state) ? state.hasTriedReentry : null;
            return raw === true;
        } catch {
            return false;
        }
    })();

    // The crash-site outline is always visible, but it has a gap under F7 until
    // the re-entry attempt fails (hasTriedReentry becomes true).
    const shouldSkipCrashWallEdge = (col, row, edge) => {
        const c = Number(col);
        const r = Number(row);

        // Gap at the ship entrance: remove the bottom edge under F7 until the attempt is made.
        if (edge === 'bottom' && c === 6 && r === 7 && hasTriedReentry !== true) return true;

        // Alternate access opening at D5: only visible once the hull has been pried open.
        if (edge === 'left' && c === 4 && r === 5) {
            return !!(state && typeof state === 'object' && state.d5HullOpened === true);
        }

        return false;
    };

    const tileMeta = (c, r) => getLocalMapTileAt(c, r, { scoutStage: stage, hasTriedReentry, localMapState: state });

    const tilePanelCollapsed = (() => {
        try { return localStorage.getItem('localMapTilePanelCollapsed') === 'true'; } catch { return false; }
    })();

    container.innerHTML = `
        <div class="localmap-root">
            <div class="localmap-layout ${tilePanelCollapsed ? 'is-tile-collapsed' : ''}">
                <div class="localmap-mapwrap">
                    <div class="localmap-shell" style="--cols:${COLS}; --rows:${ROWS}; --zoom:${zoom}; --pan-x:${panX}px; --pan-y:${panY}px;">
                        <div class="localmap-corner" aria-hidden="true"></div>
                        <div class="localmap-top" aria-hidden="true">
                            ${LETTERS.map((l, i) => {
                                const col = i + 1;
                                const isSelected = col === mapState.selectedX;
                                return `<div class="localmap-label${isSelected ? ' is-selected-axis is-selected-col' : ''}" data-col="${col}"><span>${l}</span></div>`;
                            }).join('')}
                        </div>
                        <div class="localmap-left" aria-hidden="true">
                            ${Array.from({ length: ROWS }, (_, i) => {
                                const row = i + 1;
                                const isSelected = row === mapState.selectedY;
                                return `<div class="localmap-label${isSelected ? ' is-selected-axis is-selected-row' : ''}" data-row="${row}"><span>${row}</span></div>`;
                            }).join('')}
                        </div>
                        <div class="localmap-grid-viewport" aria-label="Local map grid (A-K / 1-9)">
                            <div class="localmap-grid-pan">
                                <div class="localmap-grid" role="grid"></div>
                            </div>
                        </div>

                        <div class="localmap-bottom" aria-label="Map controls">
                            <div class="localmap-zoom" aria-label="Map zoom controls">
                                <button type="button" class="localmap-zoom-btn" data-zoom="-" aria-label="Zoom out">−</button>
                                <div class="localmap-zoom-readout" aria-hidden="true">${Math.round(zoom * 100)}%</div>
                                <button type="button" class="localmap-zoom-btn" data-zoom="+" aria-label="Zoom in">+</button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="localmap-infowrap ${tilePanelCollapsed ? 'is-collapsed' : ''}" aria-live="polite">
                    <div class="localmap-card localmap-info-card">
                        <div class="localmap-card-header">
                            <h3>Tile</h3>
                            <button type="button" class="localmap-info-collapse-btn" aria-label="${tilePanelCollapsed ? 'Expand Tile panel' : 'Collapse Tile panel'}" aria-expanded="${tilePanelCollapsed ? 'false' : 'true'}">
                                <svg class="chevrons-icon" width="22" height="16" viewBox="0 0 24 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                    <path d="M3 12 L12 3 L21 12" stroke-linecap="round" />
                                    <path d="M3 18 L12 9 L21 18" stroke-linecap="round" />
                                </svg>
                            </button>
                        </div>
                        <div class="localmap-card-body" id="localMapInfoBody"></div>
                    </div>
                </div>
                <div class="localmap-card localmap-actions-card">
                    <div class="localmap-card-header"><h3>Actions</h3></div>
                    <div id="crashSiteLocalMapActions" class="localmap-actions-row"></div>
                </div>
            </div>
        </div>
    `;

    // Tile panel collapse toggle
    try {
        const btn = container.querySelector('.localmap-info-collapse-btn');
        if (btn && btn.dataset.wired !== 'true') {
            btn.dataset.wired = 'true';
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                try {
                    const next = !(localStorage.getItem('localMapTilePanelCollapsed') === 'true');
                    localStorage.setItem('localMapTilePanelCollapsed', next ? 'true' : 'false');
                } catch { /* ignore */ }
                setupCrashSiteLocalMap(container, { scoutStage, totalStages, state });
            });
        }
    } catch { /* ignore */ }

    const grid = container.querySelector('.localmap-grid');
    if (!grid) return;

    const viewport = container.querySelector('.localmap-grid-viewport');
    const shell = container.querySelector('.localmap-shell');

    const clampPanToBounds = () => {
        if (!state || typeof state !== 'object') return;
        const z = normalizeZoom(state);
        if (!viewport || !shell || z <= 1.01) {
            state.panX = 0;
            state.panY = 0;
            return;
        }
        const rect = viewport.getBoundingClientRect();
        const maxX = (rect.width * (z - 1)) / 2;
        const maxY = (rect.height * (z - 1)) / 2;
        const px = Number(state.panX);
        const py = Number(state.panY);
        const nextX = Number.isFinite(px) ? Math.max(-maxX, Math.min(maxX, px)) : 0;
        const nextY = Number.isFinite(py) ? Math.max(-maxY, Math.min(maxY, py)) : 0;
        state.panX = nextX;
        state.panY = nextY;
    };

    // Pan/drag when zoomed in
    // NOTE: Do not preventDefault on pointerdown, otherwise some browsers suppress click events.
    // We only enter "panning" mode once movement passes a small threshold.
    const drag = {
        active: false,   // pointer is down
        panning: false,  // movement threshold passed
        startX: 0,
        startY: 0,
        startPanX: 0,
        startPanY: 0,
        lastDragAt: 0,
        pointerId: null,
    };

    const setViewportClasses = () => {
        if (!viewport) return;
        const z = normalizeZoom(state);
        viewport.classList.toggle('is-pannable', z > 1.01);
        viewport.classList.toggle('is-panning', drag.panning);
    };

    try {
        clampPanToBounds();
        setViewportClasses();
    } catch { /* ignore */ }

    try {
        if (viewport && !viewport.dataset.boundPan) {
            viewport.dataset.boundPan = 'true';

            const clampZoomRaw = (z) => clamp(Number(z) || 1, 0.6, 2.0);
            const activePointers = new Map();
            const pinch = {
                active: false,
                startDist: 0,
                baseZoom: 1,
                lastZoom: 1,
                lastAt: 0,
            };

            const getViewportCenter = () => {
                const rect = viewport.getBoundingClientRect();
                return {
                    cx: rect.left + rect.width / 2,
                    cy: rect.top + rect.height / 2,
                };
            };

            const dist2 = (a, b) => {
                const dx = (a.x - b.x);
                const dy = (a.y - b.y);
                return Math.sqrt(dx * dx + dy * dy);
            };

            const applyPanZoomVars = () => {
                if (!shell || !state || typeof state !== 'object') return;
                const z = clampZoomRaw(state.zoom);
                shell.style.setProperty('--zoom', `${z}`);
                shell.style.setProperty('--pan-x', `${Number(state.panX) || 0}px`);
                shell.style.setProperty('--pan-y', `${Number(state.panY) || 0}px`);
            };

            const suppressTileClicksBriefly = (ms = 450) => {
                try {
                    if (!container._localMapTapState) {
                        container._localMapTapState = { lastKey: null, lastAt: 0, suppressClickUntil: 0 };
                    }
                    container._localMapTapState.suppressClickUntil = Date.now() + ms;
                } catch { /* ignore */ }
            };

            const beginPinchIfReady = () => {
                if (pinch.active) return;
                if (!state || typeof state !== 'object') return;
                if (activePointers.size !== 2) return;
                const pts = Array.from(activePointers.values());
                const d = dist2(pts[0], pts[1]);
                if (!Number.isFinite(d) || d < 4) return;
                pinch.active = true;
                pinch.startDist = d;
                pinch.baseZoom = clampZoomRaw(normalizeZoom(state));
                pinch.lastZoom = pinch.baseZoom;
                pinch.lastAt = Date.now();

                // Only capture pointers once we know we're pinching.
                // Capturing on every pointerdown can suppress tile click events on desktop.
                try {
                    for (const pointerId of activePointers.keys()) {
                        try { viewport.setPointerCapture(pointerId); } catch { /* ignore */ }
                    }
                } catch { /* ignore */ }

                if (isCompactPhoneLandscape()) markCompactZoomTouched();

                // Pinch overrides panning.
                drag.active = false;
                drag.panning = false;
                drag.pointerId = null;
                setViewportClasses();
                suppressTileClicksBriefly(650);
            };

            const updatePinch = () => {
                if (!pinch.active) return;
                if (!state || typeof state !== 'object') return;
                if (activePointers.size < 2) return;
                const pts = Array.from(activePointers.values());
                const d = dist2(pts[0], pts[1]);
                if (!Number.isFinite(d) || d < 4 || pinch.startDist < 4) return;

                const ratio = d / pinch.startDist;
                const nextZoom = clampZoomRaw(pinch.baseZoom * ratio);
                const prevZoom = clampZoomRaw(pinch.lastZoom);

                // Anchor zoom around the current pinch midpoint.
                const midX = (pts[0].x + pts[1].x) / 2;
                const midY = (pts[0].y + pts[1].y) / 2;
                const { cx, cy } = getViewportCenter();
                const vx = midX - cx;
                const vy = midY - cy;

                const panX = Number(state.panX) || 0;
                const panY = Number(state.panY) || 0;
                const scale = (prevZoom > 0.001) ? (nextZoom / prevZoom) : 1;

                state.zoom = nextZoom;
                state.panX = panX + (1 - scale) * (vx - panX);
                state.panY = panY + (1 - scale) * (vy - panY);
                pinch.lastZoom = nextZoom;
                pinch.lastAt = Date.now();

                clampPanToBounds();
                applyPanZoomVars();
                setViewportClasses();
            };

            const endPinch = () => {
                if (!pinch.active) return;
                pinch.active = false;
                pinch.startDist = 0;
                pinch.lastAt = Date.now();
                drag.lastDragAt = Date.now();
                suppressTileClicksBriefly(450);
                setViewportClasses();

                // Re-render once to ensure all derived UI stays consistent.
                try {
                    setTimeout(() => {
                        try { setupCrashSiteLocalMap(container, { scoutStage, totalStages, state }); } catch { /* ignore */ }
                    }, 0);
                } catch { /* ignore */ }
            };

            const onPointerDown = (e) => {
                if (!viewport) return;
                activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

                // Two-finger pinch can start even at zoom=1.
                beginPinchIfReady();
                if (pinch.active) {
                    e.preventDefault();
                    return;
                }

                const z = normalizeZoom(state);
                if (z <= 1.01) return;
                drag.active = true;
                drag.panning = false;
                drag.pointerId = e.pointerId;
                drag.startX = e.clientX;
                drag.startY = e.clientY;
                drag.startPanX = Number(state?.panX) || 0;
                drag.startPanY = Number(state?.panY) || 0;
                setViewportClasses();
            };

            const onPointerMove = (e) => {
                if (!viewport) return;
                if (activePointers.has(e.pointerId)) {
                    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
                }

                if (pinch.active) {
                    updatePinch();
                    e.preventDefault();
                    return;
                }

                if (!drag.active) return;
                if (drag.pointerId !== null && e.pointerId !== drag.pointerId) return;
                if (!state || typeof state !== 'object') return;
                const z = normalizeZoom(state);
                if (z <= 1.01) return;
                const dx = e.clientX - drag.startX;
                const dy = e.clientY - drag.startY;

                // Only start panning after a small movement threshold.
                if (!drag.panning) {
                    if ((Math.abs(dx) + Math.abs(dy)) <= 3) return;
                    drag.panning = true;
                    try { viewport.setPointerCapture(e.pointerId); } catch { /* ignore */ }
                    setViewportClasses();
                }

                state.panX = drag.startPanX + dx;
                state.panY = drag.startPanY + dy;
                clampPanToBounds();

                // Update CSS vars without full rerender (smoother drag)
                if (shell) {
                    shell.style.setProperty('--pan-x', `${Number(state.panX) || 0}px`);
                    shell.style.setProperty('--pan-y', `${Number(state.panY) || 0}px`);
                }
                setViewportClasses();
                e.preventDefault();
            };

            const endDrag = (e = null) => {
                if (e && activePointers.has(e.pointerId)) {
                    activePointers.delete(e.pointerId);
                }

                if (pinch.active) {
                    if (activePointers.size < 2) endPinch();
                    return;
                }

                if (!drag.active) return;
                drag.active = false;
                if (drag.panning) drag.lastDragAt = Date.now();
                drag.panning = false;
                drag.pointerId = null;
                setViewportClasses();
            };

            viewport.addEventListener('pointerdown', onPointerDown);
            viewport.addEventListener('pointermove', onPointerMove);
            viewport.addEventListener('pointerup', endDrag);
            viewport.addEventListener('pointercancel', endDrag);
            viewport.addEventListener('pointerleave', endDrag);

            // Prevent wheel-scroll from scrolling the page when hovering the map.
            viewport.addEventListener('wheel', (e) => {
                const z = normalizeZoom(state);
                if (z <= 1.01) return;
                e.preventDefault();
            }, { passive: false });
        }
    } catch { /* ignore */ }

    // Wire zoom buttons
    try {
        const zoomBtns = container.querySelectorAll('.localmap-zoom-btn');
        zoomBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                if (!state || typeof state !== 'object') return;
                if (isCompactPhoneLandscape()) markCompactZoomTouched();
                const current = normalizeZoom(state);
                const dir = btn.dataset.zoom;
                const nextZoom = clamp(
                    Math.round((current + (dir === '+' ? 0.1 : -0.1)) * 10) / 10,
                    0.6,
                    2.0
                );
                state.zoom = nextZoom;
                setupCrashSiteLocalMap(container, { scoutStage, totalStages, state });
            });
        });
    } catch { /* ignore */ }

    const infoBody = container.querySelector('#localMapInfoBody');

    const isOrthogonallyAdjacentToCrashPoi = (x, y) => {
        const c = Number(x);
        const r = Number(y);
        if (isCrashPoi(c, r)) return false;
        return (
            isCrashPoi(c - 1, r)
            || isCrashPoi(c + 1, r)
            || isCrashPoi(c, r - 1)
            || isCrashPoi(c, r + 1)
        );
    };

    const renderInfo = (col, row, { discovered, visited } = {}, poiLabel = null) => {
        if (!infoBody) return;
        const meta = tileMeta(col, row);
        const label = toCoordLabel(col, row);
        const coordHtml = (() => {
            try {
                const s = String(label || '');
                const m = /^([A-Z]+)(\d+)$/.exec(s.trim());
                if (!m) return `<span class="localmap-selected-coord">${s}</span>`;
                return `
                    <span class="localmap-selected-coord" aria-label="Selected coordinate ${s}">
                        <span class="localmap-selected-coord__letters">${m[1]}</span><span class="localmap-selected-coord__numbers">${m[2]}</span>
                    </span>
                `;
            } catch {
                return `<span class="localmap-selected-coord">${label}</span>`;
            }
        })();
        const isBlocked = !!(discovered && meta && meta.blocked);
        const statusKey = isBlocked
            ? 'blocked'
            : (visited ? 'explored' : (discovered ? 'unexplored' : 'unknown'));
        const statusText = isBlocked
            ? 'Blocked'
            : (visited ? 'Explored' : (discovered ? 'Unexplored' : 'Unknown (fog)'));
        const poi = poiLabel ? `<div class="localmap-info-row"><span class="k">POI</span><span class="v">${poiLabel}</span></div>` : '';
        const typeRow = discovered
            ? `<div class="localmap-info-row"><span class="k">Type</span><span class="v">${meta.label}</span></div>`
            : '';
        const blockedRow = discovered && meta.blocked
            ? `<div class="localmap-info-row"><span class="k">Access</span><span class="v status--blocked">Blocked</span></div>`
            : '';

        // Resources hinting:
        // - D7 has Food Rations (berries/food source)
        // - H8 has Drinking Water (water source)
        // - Once Scavenge Debris Field is unlocked, tiles adjacent to the crash POI are known to contain Metal Parts
        // - Everything else stays Unknown
        let resourcesValue = 'Unknown';
        /** @type {string[] | null} */
        let resourcesList = null;
        try {
            if (discovered) {
                const isD7 = (Number(col) === 4 && Number(row) === 7);
                const isH8 = (Number(col) === 8 && Number(row) === 8);
                const isG3 = (Number(col) === 7 && Number(row) === 3);
                if (isD7) {
                    const debris = (salvageActions || []).find(a => a && a.id === 'scavengeDebris');
                    const debrisUnlocked = !!(debris && debris.isUnlocked);

                    const resources = ['Food Rations'];
                    if (debrisUnlocked && isOrthogonallyAdjacentToCrashPoi(col, row)) {
                        resources.push('Metal Parts');
                    }
                    resourcesList = resources;
                } else if (isH8) {
                    resourcesList = ['Drinking Water'];
                } else if (isG3) {
                    const chem = (salvageActions || []).find(a => a && a.id === 'collectChemicals');
                    if (chem && chem.isUnlocked) resourcesList = ['Chemicals'];
                } else {
                const debris = (salvageActions || []).find(a => a && a.id === 'scavengeDebris');
                const debrisUnlocked = !!(debris && debris.isUnlocked);
                if (debrisUnlocked && isOrthogonallyAdjacentToCrashPoi(col, row)) {
                    resourcesList = ['Metal Parts'];
                }
                }
            }
        } catch { /* ignore */ }

        // Explored crash-site interior: wiring is abundant.
        try {
            if (resourcesValue === 'Unknown' && visited && isCrashPoi(Number(col), Number(row))) {
                const isD6 = (Number(col) === 4 && Number(row) === 6);
                if (isD6) {
                    const used = Math.max(0, Math.floor(Number(state?.cafeteriaSuppliesByTile?.['4,6'] || 0)));
                    resourcesValue = (used >= 7) ? 'None' : 'Food Rations, Drinking Water';
                    if (resourcesValue !== 'None') resourcesList = ['Food Rations', 'Drinking Water'];
                } else if (meta && meta.typeId === 'crewQuarters') {
                    resourcesList = ['Fabric'];
                } else {
                    const key = `${Number(col)},${Number(row)}`;
                    if (meta && meta.typeId === 'corridor') {
                        const used = Math.max(0, Math.floor(Number(state?.wiringStrippedByTile?.[key] || 0)));
                        resourcesValue = (used >= 5) ? 'None' : 'Wire';
                        if (resourcesValue !== 'None') resourcesList = ['Wire'];
                    }
                }
            }
        } catch { /* ignore */ }

        const resourcesHtml = (() => {
            if (Array.isArray(resourcesList) && resourcesList.length) {
                return resourcesList.map(s => String(s)).join('<br>');
            }
            const s = String(resourcesValue ?? 'Unknown');
            if (s.includes(',')) {
                const parts = s.split(',').map(p => p.trim()).filter(Boolean);
                if (parts.length > 1) return parts.join('<br>');
            }
            return s;
        })();

        const resourcesRow = `<div class="localmap-info-row"><span class="k">Resources</span><span class="v">${resourcesHtml}</span></div>`;
        const noteText = !discovered
            ? 'Fog blocks detail. Scout more to reveal the area.'
            : (meta.description || (poiLabel
                ? 'The wreckage looms over the area. There may be ways inside.'
                : 'Looks quiet.'));
        infoBody.innerHTML = `
            <div class="localmap-info-row"><span class="k">Coord</span><span class="v">${coordHtml}</span></div>
            <div class="localmap-info-row"><span class="k">Status</span><span class="v localmap-status status--${statusKey}">${statusText}</span></div>
            ${typeRow}
            ${poi}
            ${blockedRow}
            ${resourcesRow}
            <div class="localmap-divider" aria-hidden="true"></div>
            <div class="localmap-note">${noteText}</div>
        `;
    };

    // Movement animation (lightweight): pulse the destination tile and briefly highlight the origin.
    // Values are written by the Move action completion handler.
    const moveAnim = (() => {
        try {
            const at = Number(state && typeof state === 'object' ? state.lastMoveAt : 0);
            if (!Number.isFinite(at) || at <= 0) return null;
            if ((Date.now() - at) > 900) return null;
            const fromX = Number(state.lastMoveFromX);
            const fromY = Number(state.lastMoveFromY);
            const toX = Number(state.lastMoveToX);
            const toY = Number(state.lastMoveToY);
            if (![fromX, fromY, toX, toY].every(Number.isFinite)) return null;
            return { fromX, fromY, toX, toY };
        } catch {
            return null;
        }
    })();

    // Burning animation (lightweight): briefly flicker a fire/ember overlay on the target tile.
    // Values are written by the Burn Thorny Wall action completion handler.
    const burnAnim = (() => {
        try {
            const at = Number(state && typeof state === 'object' ? state.lastBurnAt : 0);
            if (!Number.isFinite(at) || at <= 0) return null;
            if ((Date.now() - at) > 1400) return null;
            const x = Number(state.lastBurnX);
            const y = Number(state.lastBurnY);
            if (![x, y].every(Number.isFinite)) return null;
            return { x, y };
        } catch {
            return null;
        }
    })();

    // Build tiles
    const tiles = document.createDocumentFragment();
    for (let r = 1; r <= ROWS; r++) {
        for (let c = 1; c <= COLS; c++) {
            const tile = document.createElement('div');
            tile.className = 'localmap-tile';
            tile.setAttribute('role', 'gridcell');
            tile.dataset.col = String(c);
            tile.dataset.row = String(r);

            const visited = isVisited(state, c, r);
            const discovered = visited
                || visibleNow.has(`${c},${r}`)
                || (c === mapState.x && r === mapState.y);
            tile.classList.toggle('is-unknown', !discovered);
            tile.classList.toggle('is-unexplored', !!(discovered && !visited));
            tile.classList.toggle('is-explored', !!visited);

            const meta = tileMeta(c, r);
            // Do not reveal blocked tiles through fog-of-war.
            tile.classList.toggle('is-blocked', !!(discovered && meta.blocked));

            // Base Camp tile overlay (visual): once established, draw the camp art directly on the tile.
            try {
                const established = !!(state && typeof state === 'object' && state.baseCampEstablished === true);
                const isBaseCamp = !!(meta && meta.typeId === 'baseCamp');
                if (established && isBaseCamp) {
                    tile.classList.add('has-basecamp-overlay');
                    const campOverlay = document.createElement('div');
                    campOverlay.className = 'localmap-basecamp-overlay';
                    campOverlay.setAttribute('aria-hidden', 'true');
                    tile.appendChild(campOverlay);
                }
            } catch { /* ignore */ }

            if (burnAnim && c === burnAnim.x && r === burnAnim.y) {
                tile.classList.add('is-just-burned');
                const burn = document.createElement('div');
                burn.className = 'localmap-burn-overlay';
                burn.setAttribute('aria-hidden', 'true');
                tile.appendChild(burn);
            }

            // Special-case: the alternate access "door" at C5↔D5 sits behind an exterior hull wall,
            // so D5 is not visible until the hull is opened. Still show the door edge while standing adjacent.
            try {
                const isC5 = (c === 3 && r === 5);
                const hullOpened = !!(state && typeof state === 'object' && state.d5HullOpened === true);
                const openingKnown = !!(state && typeof state === 'object' && (state.c5ShipOpeningSpotted === true || state.c5ThornWallBurned === true));
                const playerAdjacent = (
                    (mapState.x === 3 && mapState.y === 5) // standing on C5
                    || (mapState.x === 4 && mapState.y === 5) // standing on D5 (after opening)
                );

                if (isC5 && openingKnown && !hullOpened && playerAdjacent && discovered) {
                    tile.classList.add('has-external-door', 'poi-door-right');
                    const doorsOverlay = document.createElement('div');
                    doorsOverlay.className = 'poi-doors-overlay';
                    doorsOverlay.setAttribute('aria-hidden', 'true');
                    doorsOverlay.innerHTML = `<div class="poi-door poi-door--right"></div>`;
                    tile.appendChild(doorsOverlay);
                }
            } catch { /* ignore */ }

            // Tile markers
            // - Usually hidden under fog
            // - Some tutorial/guide markers can opt in to always-visible (e.g., newly-unlocked base camp tile)
            const markers = Array.isArray(meta.markers) && meta.markers.length
                ? meta.markers
                : ((meta.markerKind !== null && meta.markerKind !== undefined)
                    ? [{ kind: meta.markerKind, text: meta.markerText, alwaysVisible: meta.markerAlwaysVisible }]
                    : []);

            const showMarkers = markers.length && (discovered || !!meta.markerAlwaysVisible);
            if (showMarkers) {
                const alertMarkers = markers.filter(m => {
                    try { return String(m?.kind || '') === 'alert'; } catch { return false; }
                });
                const cornerMarkers = markers.filter(m => {
                    try { return String(m?.kind || '') !== 'alert'; } catch { return true; }
                });

                // Centered tile warning (matches the food/water depletion warning badge styling).
                if (alertMarkers.length) {
                    const alert = document.createElement('div');
                    alert.className = 'localmap-tile-alert';
                    alert.setAttribute('aria-hidden', 'true');
                    alert.textContent = '!';
                    tile.appendChild(alert);
                }

                // Corner icons for other markers (rest, berries, water, etc.)
                if (cornerMarkers.length) {
                    const markersHost = document.createElement('div');
                    markersHost.className = 'localmap-markers';
                    markersHost.setAttribute('aria-hidden', 'true');

                    for (const m of cornerMarkers) {
                        const kind = (m && m.kind) ? String(m.kind) : 'alert';
                        const marker = document.createElement('div');
                        marker.className = `localmap-marker localmap-marker--${kind}`;
                        marker.textContent = (m && m.text !== null && m.text !== undefined) ? String(m.text) : '';
                        markersHost.appendChild(marker);
                    }

                    tile.appendChild(markersHost);
                }

                if (meta.markerAlwaysVisible) {
                    tile.classList.add('has-always-marker');
                }
            }

            // Non-crash POI points (e.g., established Base Camp)
            if (!isCrashPoi(c, r) && meta.poiLabel) {
                tile.classList.add('is-poi-point');
                tile.dataset.poi = meta.poiLabel;
                tile.title = tile.dataset.poi;
            }

            // Crash Site POI footprint
            const inCrash = isCrashPoi(c, r);
            if (inCrash) {
                tile.classList.add('is-poi-area');
                tile.dataset.poi = meta.poiLabel || 'Crash Site';
                tile.title = tile.dataset.poi;

                // Outline the footprint perimeter (always visible).
                if (!isCrashPoi(c, r - 1) && !shouldSkipCrashWallEdge(c, r, 'top')) tile.classList.add('poi-border-top');
                if (!isCrashPoi(c, r + 1) && !shouldSkipCrashWallEdge(c, r, 'bottom')) tile.classList.add('poi-border-bottom');
                if (!isCrashPoi(c - 1, r) && !shouldSkipCrashWallEdge(c, r, 'left')) tile.classList.add('poi-border-left');
                if (!isCrashPoi(c + 1, r) && !shouldSkipCrashWallEdge(c, r, 'right')) tile.classList.add('poi-border-right');

                // Intentionally do NOT render thick "hull" wall edges inside the POI.
                // The corridor/room outline visuals already communicate walls/doors well.
                // Wall blocking still applies via localMapTiles.js logic.

                // Visual doors (hide under fog-of-war)
                const isDiscoveredAt = (dc, dr) => {
                    if (dc < 1 || dc > COLS || dr < 1 || dr > ROWS) return false;
                    const v = isVisited(state, dc, dr);
                    return v || visibleNow.has(`${dc},${dr}`) || (dc === mapState.x && dr === mapState.y);
                };

                if (discovered) {
                    try {
                        // Render each door edge only once (canonical owner):
                        // - vertical edges: render on the lower tile as a "top" door
                        // - horizontal edges: render on the right tile as a "left" door
                        //
                        // Doors should be visible when standing next to them; do not require both tiles to be discovered.
                        if (hasInternalPoiDoorBetween(c, r, c, r - 1, { localMapState: state })) tile.classList.add('poi-door-top');
                        if (hasInternalPoiDoorBetween(c, r, c - 1, r, { localMapState: state })) tile.classList.add('poi-door-left');
                    } catch { /* ignore */ }
                }

                // Crash-site interior visuals should not show through fog-of-war.
                if (discovered) {
                    // POI hull wall overlay layer (styled in CSS). This keeps hull walls visible even when a tile is selected.
                    const wallOverlay = document.createElement('div');
                    wallOverlay.className = 'poi-wall-overlay';
                    wallOverlay.setAttribute('aria-hidden', 'true');
                    tile.appendChild(wallOverlay);

                    // Doors overlay (visual only)
                    const doorsOverlay = document.createElement('div');
                    doorsOverlay.className = 'poi-doors-overlay';
                    doorsOverlay.setAttribute('aria-hidden', 'true');
                    doorsOverlay.innerHTML = `
                        <div class="poi-door poi-door--top"></div>
                        <div class="poi-door poi-door--left"></div>
                    `;
                    tile.appendChild(doorsOverlay);

                    // Corridor/room overlays (visual): draw inset outlines for interior tiles.
                    try {
                        const isCorridorLike = meta && (meta.typeId === 'corridor' || meta.typeId === 'elevator');
                        const isRoom = meta && ['cafeteria', 'crewQuarters', 'laboratory', 'powerCore', 'captainsQuarters', 'bridge'].includes(meta.typeId);

                        if (isCorridorLike) {
                            tile.classList.add('poi-has-corridor');

                            const canTraverseTo = (toC, toR) => {
                                if (toC < 1 || toC > COLS || toR < 1 || toR > ROWS) return false;
                                const nMeta = tileMeta(toC, toR);
                                if (!nMeta || nMeta.blocked) return false;
                                try {
                                    if (isCrashWallBetween(c, r, toC, toR, { localMapState: state })) return false;
                                } catch { /* ignore */ }
                                return true;
                            };

                            const openTop = canTraverseTo(c, r - 1);
                            const openBottom = canTraverseTo(c, r + 1);
                            const openLeft = canTraverseTo(c - 1, r);
                            const openRight = canTraverseTo(c + 1, r);

                            const d = buildCorridorOutlinePath({ openTop, openBottom, openLeft, openRight, isPlayer: tile.classList.contains('is-player') });
                            const liftBox = (meta.typeId === 'elevator') ? buildLiftBoxPath() : '';

                            const overlay = document.createElement('div');
                            overlay.className = 'poi-corridor-overlay';
                            overlay.setAttribute('aria-hidden', 'true');
                            overlay.innerHTML = d
                                ? (meta.typeId === 'elevator'
                                    ? `<svg class="poi-corridor-svg poi-elevator-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" /><path class="lift-box" d="${liftBox}" /></svg>`
                                    : `<svg class="poi-corridor-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" /></svg>`)
                                : '';
                            tile.appendChild(overlay);
                        }

                        if (isRoom) {
                            tile.classList.add('poi-has-room');

                            const canTraverseTo = (toC, toR) => {
                                if (toC < 1 || toC > COLS || toR < 1 || toR > ROWS) return false;
                                const nMeta = tileMeta(toC, toR);
                                if (!nMeta || nMeta.blocked) return false;
                                try {
                                    if (isCrashWallBetween(c, r, toC, toR, { localMapState: state })) return false;
                                } catch { /* ignore */ }
                                return true;
                            };

                            const openTop = canTraverseTo(c, r - 1);
                            const openBottom = canTraverseTo(c, r + 1);
                            const openLeft = canTraverseTo(c - 1, r);
                            const openRight = canTraverseTo(c + 1, r);

                            const dRoom = buildRoomOutlinePath({ openTop, openBottom, openLeft, openRight });
                            const roomOverlay = document.createElement('div');
                            roomOverlay.className = 'poi-room-overlay';
                            roomOverlay.setAttribute('aria-hidden', 'true');
                            roomOverlay.innerHTML = dRoom
                                ? `<svg class="poi-room-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="${dRoom}" /></svg>`
                                : '';
                            tile.appendChild(roomOverlay);
                        }
                    } catch { /* ignore */ }
                }
            }

            const isSelected = (c === mapState.selectedX && r === mapState.selectedY);
            tile.classList.toggle('is-selected', isSelected);

            const isPlayer = (c === mapState.x && r === mapState.y);
            tile.classList.toggle('is-player', isPlayer);

            // Player route hints: tiny arrows on the edges indicating reachable adjacent tiles.
            if (isPlayer) {
                try {
                    const arrowsHost = document.createElement('div');
                    arrowsHost.className = 'localmap-player-arrows';

                    const dirs = [
                        { dx: 0, dy: -1, cls: 'up' },
                        { dx: 0, dy: 1, cls: 'down' },
                        { dx: -1, dy: 0, cls: 'left' },
                        { dx: 1, dy: 0, cls: 'right' },
                    ];

                    for (const d of dirs) {
                        const nx = c + d.dx;
                        const ny = r + d.dy;
                        if (nx < 1 || nx > COLS || ny < 1 || ny > ROWS) continue;

                        const nMeta = tileMeta(nx, ny);
                        if (nMeta && nMeta.blocked) continue;

                        // Blocked by the crash POI boundary wall or internal corridor walls.
                        try {
                            if (isCrashWallBetween(c, r, nx, ny, { localMapState: state })) continue;
                        } catch { /* ignore */ }

                        const arrow = document.createElement('div');
                        arrow.className = `localmap-move-arrow localmap-move-arrow--${d.cls}`;
                        arrow.setAttribute('aria-hidden', 'true');
                        arrowsHost.appendChild(arrow);
                    }

                    if (arrowsHost.childElementCount) tile.appendChild(arrowsHost);
                } catch { /* ignore */ }
            }

            if (moveAnim) {
                tile.classList.toggle('is-move-from', (c === moveAnim.fromX && r === moveAnim.fromY));
                tile.classList.toggle('is-just-moved', (isPlayer && c === moveAnim.toX && r === moveAnim.toY));
            }

            if (!inCrash) {
                tile.title = `${LETTERS[c - 1]}${r}`;
            }

            tile.addEventListener('click', () => {
                try {
                    const ts = container._localMapTapState;
                    if (ts && ts.suppressClickUntil && Date.now() < ts.suppressClickUntil) return;
                } catch { /* ignore */ }
                try {
                    if (drag.lastDragAt && (Date.now() - drag.lastDragAt) < 250) return;
                } catch { /* ignore */ }
                try {
                    if (state && typeof state === 'object') {
                        state.selectedX = c;
                        state.selectedY = r;
                    }
                } catch { /* ignore */ }

                // Re-render to update selection styling.
                setupCrashSiteLocalMap(container, { scoutStage, totalStages, state });

                // Bubble an event so other UI can react if needed.
                try {
                    container.dispatchEvent(new CustomEvent('local-map-selection-changed', {
                        bubbles: true,
                        detail: { x: c, y: r, coord: toCoordLabel(c, r) }
                    }));
                } catch { /* ignore */ }
            });

            // Mobile double-tap: emulate dblclick.
            tile.addEventListener('pointerup', (e) => {
                try {
                    if (!e || e.pointerType !== 'touch') return;
                    if (drag.lastDragAt && (Date.now() - drag.lastDragAt) < 250) return;

                    const ts = container._localMapTapState;
                    if (!ts) return;
                    const key = `${c},${r}`;
                    const now = Date.now();
                    const within = (ts.lastKey === key) && ((now - (Number(ts.lastAt) || 0)) <= 350);
                    ts.lastKey = key;
                    ts.lastAt = now;
                    if (!within) return;

                    // Prevent the follow-up click from running (some browsers still fire it).
                    ts.suppressClickUntil = now + 450;

                    try { e.preventDefault(); } catch { /* ignore */ }

                    if (state && typeof state === 'object') {
                        state.selectedX = c;
                        state.selectedY = r;
                    }

                    setupCrashSiteLocalMap(container, { scoutStage, totalStages, state });

                    try {
                        container.dispatchEvent(new CustomEvent('local-map-tile-double-clicked', {
                            bubbles: true,
                            detail: { x: c, y: r, coord: toCoordLabel(c, r) }
                        }));
                    } catch { /* ignore */ }
                } catch { /* ignore */ }
            });

            // Double-click: treat as a Move intent by default.
            tile.addEventListener('dblclick', (e) => {
                try { e.preventDefault(); } catch { /* ignore */ }
                try {
                    if (drag.lastDragAt && (Date.now() - drag.lastDragAt) < 250) return;
                } catch { /* ignore */ }

                try {
                    if (state && typeof state === 'object') {
                        state.selectedX = c;
                        state.selectedY = r;
                    }
                } catch { /* ignore */ }

                // Re-render to update selection styling.
                setupCrashSiteLocalMap(container, { scoutStage, totalStages, state });

                try {
                    container.dispatchEvent(new CustomEvent('local-map-tile-double-clicked', {
                        bubbles: true,
                        detail: { x: c, y: r, coord: toCoordLabel(c, r) }
                    }));
                } catch { /* ignore */ }
            });

            tiles.appendChild(tile);

            // Fill initial info based on current selection.
            if (isSelected) {
                renderInfo(c, r, { discovered, visited }, discovered ? (tile.dataset.poi || null) : null);
            }
        }
    }
    // Re-renders happen often (selection, zoom, movement). Clear the previous tile DOM
    // so overlays don't stack on top of each other.
    grid.innerHTML = '';
    grid.appendChild(tiles);

    // Animate the player marker traveling between tiles.
    // getTravelAnimSpec() already handles:
    // - in-flight travel (started at action start)
    // - post-move hop fallback (based on lastMoveAt)
    // - suppression window to avoid double-anim on completion
    try {
        const travelSpec = getTravelAnimSpec(state);
        if (travelSpec) startTravelDotAnimation(container, grid, travelSpec);
    } catch { /* ignore */ }

    // If nothing was selected for some reason, show player's tile.
    if (infoBody && !infoBody.innerHTML) {
        const discovered = true;
        const visited = true;
        const meta = tileMeta(mapState.x, mapState.y);
        const inCrash = isCrashPoi(mapState.x, mapState.y);
        renderInfo(mapState.x, mapState.y, { discovered, visited }, inCrash ? (meta.poiLabel || 'Crash Site') : null);
    }
}
