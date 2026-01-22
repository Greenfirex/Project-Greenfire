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

export function setupCrashSiteLocalMap(container, { scoutStage = 0, totalStages = 3, state = null } = {}) {
    if (!container) return;

    const mapState = normalizeState(state);
    const stage = clamp(Number(scoutStage) || 0, 0, Math.max(0, Number(totalStages) || 0));
    const radius = 1; // Always reveal one tile away from the player

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

    const tileMeta = (c, r) => getLocalMapTileAt(c, r, { scoutStage: stage, hasTriedReentry, localMapState: state });

    container.innerHTML = `
        <div class="localmap-root">
            <div class="localmap-layout">
                <div class="localmap-mapwrap">
                    <div class="localmap-shell" style="--cols:${COLS}; --rows:${ROWS};">
                        <div class="localmap-corner" aria-hidden="true"></div>
                        <div class="localmap-top" aria-hidden="true">
                            ${LETTERS.map(l => `<div class="localmap-label">${l}</div>`).join('')}
                        </div>
                        <div class="localmap-left" aria-hidden="true">
                            ${Array.from({ length: ROWS }, (_, i) => `<div class="localmap-label">${i + 1}</div>`).join('')}
                        </div>
                        <div class="localmap-grid" role="grid" aria-label="Local map grid (A-K / 1-9)"></div>
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

            const discovered = isDiscovered({ col: c, row: r, centerCol, centerRow, radius })
                || (c === mapState.x && r === mapState.y);
            tile.classList.toggle('is-unknown', !discovered);
            tile.classList.toggle('is-known', discovered);

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

                // Outline the footprint perimeter by checking neighbors.
                if (!isCrashPoi(c, r - 1)) tile.classList.add('poi-border-top');
                if (!isCrashPoi(c, r + 1)) tile.classList.add('poi-border-bottom');
                if (!isCrashPoi(c - 1, r)) tile.classList.add('poi-border-left');
                if (!isCrashPoi(c + 1, r)) tile.classList.add('poi-border-right');
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
