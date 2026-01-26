import { getLocalMapTileAt, isCrashPoi, hasInternalPoiWallBetween, hasInternalPoiDoorBetween, isCrashWallBetween } from '../data/definitions/localMapTiles.js';
import { allActions as salvageActions } from '../data/definitions/allActions.js';

const COLS = 11; // A-K
const ROWS = 9;  // 1-9
const LETTERS = Array.from({ length: COLS }, (_, i) => String.fromCharCode('A'.charCodeAt(0) + i));

function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}

function isDiscovered({ col, row, centerCol, centerRow, radius }) {
    // Square reveal for now (simple, readable prototype)
    return (Math.abs(col - centerCol) <= radius) && (Math.abs(row - centerRow) <= radius);
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
    const z = Number(state && typeof state === 'object' ? state.zoom : 1);
    if (!Number.isFinite(z)) return 1;
    return clamp(z, 0.6, 2.0);
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

    const mapState = normalizeState(state);
    const zoom = normalizeZoom(state);
    const { panX, panY } = normalizePan(state, zoom);
    const stage = clamp(Number(scoutStage) || 0, 0, Math.max(0, Number(totalStages) || 0));
    const radius = 1; // Always reveal one tile away from the player

    // Mark the current player position as visited (persistent exploration).
    ensureVisited(state, mapState.x, mapState.y);

    // Reveal should follow the player's current position.
    const centerCol = mapState.x;
    const centerRow = mapState.y;

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

    container.innerHTML = `
        <div class="localmap-root">
            <div class="localmap-layout">
                <div class="localmap-mapwrap">
                    <div class="localmap-shell" style="--cols:${COLS}; --rows:${ROWS}; --zoom:${zoom}; --pan-x:${panX}px; --pan-y:${panY}px;">
                        <div class="localmap-corner" aria-hidden="true"></div>
                        <div class="localmap-top" aria-hidden="true">
                            ${LETTERS.map(l => `<div class="localmap-label">${l}</div>`).join('')}
                        </div>
                        <div class="localmap-left" aria-hidden="true">
                            ${Array.from({ length: ROWS }, (_, i) => `<div class="localmap-label">${i + 1}</div>`).join('')}
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
                <div class="localmap-infowrap" aria-live="polite">
                    <div class="localmap-card localmap-info-card">
                        <div class="localmap-card-header"><h3>Tile</h3></div>
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

            const onPointerDown = (e) => {
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

            const endDrag = () => {
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
        const status = visited
            ? 'Explored'
            : (discovered ? 'Unexplored' : 'Unknown (fog)');
        const poi = poiLabel ? `<div class="localmap-info-row"><span class="k">POI</span><span class="v">${poiLabel}</span></div>` : '';
        const typeRow = discovered
            ? `<div class="localmap-info-row"><span class="k">Type</span><span class="v">${meta.label}</span></div>`
            : '';
        const blockedRow = discovered && meta.blocked
            ? `<div class="localmap-info-row"><span class="k">Access</span><span class="v">Blocked</span></div>`
            : '';

        // Resources hinting:
        // - D7 has Food Rations (berries/food source)
        // - H8 has Clean Water (water source)
        // - Once Scavenge Debris Field is unlocked, tiles adjacent to the crash POI are known to contain Metal Parts
        // - Everything else stays Unknown
        let resourcesValue = 'Unknown';
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
                    resourcesValue = resources.join(', ');
                } else if (isH8) {
                    resourcesValue = 'Clean Water';
                } else if (isG3) {
                    const chem = (salvageActions || []).find(a => a && a.id === 'collectChemicals');
                    if (chem && chem.isUnlocked) resourcesValue = 'Chemicals';
                } else {
                const debris = (salvageActions || []).find(a => a && a.id === 'scavengeDebris');
                const debrisUnlocked = !!(debris && debris.isUnlocked);
                if (debrisUnlocked && isOrthogonallyAdjacentToCrashPoi(col, row)) {
                    resourcesValue = 'Metal Parts';
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
                    resourcesValue = (used >= 7) ? 'None' : 'Food Rations, Clean Water';
                } else if (meta && meta.typeId === 'crewQuarters') {
                    resourcesValue = 'Fabric';
                } else {
                    const key = `${Number(col)},${Number(row)}`;
                    if (meta && meta.typeId === 'corridor') {
                        const used = Math.max(0, Math.floor(Number(state?.wiringStrippedByTile?.[key] || 0)));
                        resourcesValue = (used >= 5) ? 'None' : 'Wire';
                    }
                }
            }
        } catch { /* ignore */ }
        const resourcesRow = `<div class="localmap-info-row"><span class="k">Resources</span><span class="v">${resourcesValue}</span></div>`;
        const noteText = !discovered
            ? 'Fog blocks detail. Scout more to reveal the area.'
            : (meta.description || (poiLabel
                ? 'The wreckage looms over the area. There may be ways inside.'
                : 'Looks quiet.'));
        infoBody.innerHTML = `
            <div class="localmap-info-row"><span class="k">Coord</span><span class="v">${label}</span></div>
            <div class="localmap-info-row"><span class="k">Status</span><span class="v">${status}</span></div>
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
                || isDiscovered({ col: c, row: r, centerCol, centerRow, radius })
                || (c === mapState.x && r === mapState.y);
            tile.classList.toggle('is-unknown', !discovered);
            tile.classList.toggle('is-unexplored', !!(discovered && !visited));
            tile.classList.toggle('is-explored', !!visited);

            const meta = tileMeta(c, r);
            tile.classList.toggle('is-blocked', !!meta.blocked);

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
                const markersHost = document.createElement('div');
                markersHost.className = 'localmap-markers';
                markersHost.setAttribute('aria-hidden', 'true');

                for (const m of markers) {
                    const kind = (m && m.kind) ? String(m.kind) : 'alert';
                    const marker = document.createElement('div');
                    marker.className = `localmap-marker localmap-marker--${kind}`;
                    marker.textContent = (m && m.text !== null && m.text !== undefined) ? String(m.text) : '';
                    markersHost.appendChild(marker);
                }

                if (meta.markerAlwaysVisible) {
                    tile.classList.add('has-always-marker');
                }

                tile.appendChild(markersHost);
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

                // Internal corridor walls inside the POI
                try {
                    if (hasInternalPoiWallBetween(c, r, c, r - 1)) tile.classList.add('poi-wall-top');
                    if (hasInternalPoiWallBetween(c, r, c, r + 1)) tile.classList.add('poi-wall-bottom');
                    if (hasInternalPoiWallBetween(c, r, c - 1, r)) tile.classList.add('poi-wall-left');
                    if (hasInternalPoiWallBetween(c, r, c + 1, r)) tile.classList.add('poi-wall-right');
                } catch { /* ignore */ }

                // Visual doors
                try {
                    // Render each door edge only once (canonical owner):
                    // - vertical edges: render on the lower tile as a "top" door
                    // - horizontal edges: render on the right tile as a "left" door
                    if (hasInternalPoiDoorBetween(c, r, c, r - 1)) tile.classList.add('poi-door-top');
                    if (hasInternalPoiDoorBetween(c, r, c - 1, r)) tile.classList.add('poi-door-left');
                } catch { /* ignore */ }

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

    // If nothing was selected for some reason, show player's tile.
    if (infoBody && !infoBody.innerHTML) {
        const discovered = true;
        const visited = true;
        const meta = tileMeta(mapState.x, mapState.y);
        const inCrash = isCrashPoi(mapState.x, mapState.y);
        renderInfo(mapState.x, mapState.y, { discovered, visited }, inCrash ? (meta.poiLabel || 'Crash Site') : null);
    }
}
