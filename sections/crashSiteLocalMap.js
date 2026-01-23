import { getLocalMapTileAt, isCrashPoi } from '../data/definitions/localMapTiles.js';

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

        // User correction: previous C3 note was meant to be D5.
        // (This is effectively a no-op in practice because the outside neighbor (C5) is blocked,
        // but keep it as an explicit opening if/when rules change.)
        if (edge === 'left' && c === 4 && r === 5) return true;

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

    const renderInfo = (col, row, discovered, poiLabel = null) => {
        if (!infoBody) return;
        const meta = tileMeta(col, row);
        const label = toCoordLabel(col, row);
        const status = discovered ? 'Known' : 'Unknown (fog)';
        const poi = poiLabel ? `<div class="localmap-info-row"><span class="k">POI</span><span class="v">${poiLabel}</span></div>` : '';
        const typeRow = discovered
            ? `<div class="localmap-info-row"><span class="k">Type</span><span class="v">${meta.label}</span></div>`
            : '';
        const blockedRow = discovered && meta.blocked
            ? `<div class="localmap-info-row"><span class="k">Access</span><span class="v">Blocked</span></div>`
            : '';
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
            <div class="localmap-divider" aria-hidden="true"></div>
            <div class="localmap-note">${noteText}</div>
        `;
    };

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
            tile.classList.toggle('is-known', discovered);
            tile.classList.toggle('is-visited', visited);

            const meta = tileMeta(c, r);
            tile.classList.toggle('is-blocked', !!meta.blocked);

            // Tile markers (only show when discovered; hidden under fog)
            if (discovered && meta.markerText) {
                const marker = document.createElement('div');
                const kind = meta.markerKind ? String(meta.markerKind) : 'alert';
                marker.className = `localmap-marker localmap-marker--${kind}`;
                marker.textContent = meta.markerText;
                tile.appendChild(marker);
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
            }

            const isSelected = (c === mapState.selectedX && r === mapState.selectedY);
            tile.classList.toggle('is-selected', isSelected);

            const isPlayer = (c === mapState.x && r === mapState.y);
            tile.classList.toggle('is-player', isPlayer);

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

            tiles.appendChild(tile);

            // Fill initial info based on current selection.
            if (isSelected) {
                renderInfo(c, r, discovered, discovered ? (tile.dataset.poi || null) : null);
            }
        }
    }
    grid.appendChild(tiles);

    // If nothing was selected for some reason, show player's tile.
    if (infoBody && !infoBody.innerHTML) {
        const discovered = true;
        const meta = tileMeta(mapState.x, mapState.y);
        const inCrash = isCrashPoi(mapState.x, mapState.y);
        renderInfo(mapState.x, mapState.y, discovered, inCrash ? (meta.poiLabel || 'Crash Site') : null);
    }
}
