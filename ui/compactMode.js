// Centralized compact phone-landscape detection + orientation UX.
//
// Goal: keep desktop unchanged while making iPhone/Android installed-app behavior
// reliably enter the phone-landscape compact layout.

const ROTATE_OVERLAY_ID = 'rotateToLandscapeOverlay';

function safeMatchMedia(query) {
    try {
        return !!window.matchMedia && window.matchMedia(query).matches;
    } catch {
        return false;
    }
}

function isStandaloneDisplayMode() {
    // iOS Safari uses navigator.standalone when launched from home screen.
    // Modern browsers support (display-mode: standalone).
    try {
        // eslint-disable-next-line no-undef
        const iosStandalone = typeof navigator !== 'undefined' && navigator && navigator.standalone === true;
        return iosStandalone || safeMatchMedia('(display-mode: standalone)') || safeMatchMedia('(display-mode: fullscreen)');
    } catch {
        return false;
    }
}

function isTouchLikeDevice() {
    try {
        const mtp = Number(navigator?.maxTouchPoints || 0);
        if (mtp > 0) return true;
    } catch {
        /* ignore */
    }

    // any-pointer is better than pointer (works across multiple inputs)
    if (safeMatchMedia('(any-pointer: coarse)')) return true;
    if (safeMatchMedia('(pointer: coarse)')) return true;

    try {
        return 'ontouchstart' in window;
    } catch {
        return false;
    }
}

function getViewportDims() {
    try {
        const vv = window.visualViewport;
        const w = Math.round(Number(vv?.width || window.innerWidth || document.documentElement?.clientWidth || 0));
        const h = Math.round(Number(vv?.height || window.innerHeight || document.documentElement?.clientHeight || 0));
        return { w, h };
    } catch {
        return { w: 0, h: 0 };
    }
}

function getScreenDims() {
    try {
        const w = Math.round(Number(screen?.width || 0));
        const h = Math.round(Number(screen?.height || 0));
        return { w, h };
    } catch {
        return { w: 0, h: 0 };
    }
}

function computeIsLandscape() {
    const { w, h } = getViewportDims();
    if (w && h) return w >= h;
    const s = getScreenDims();
    return !!(s.w && s.h && s.w >= s.h);
}

function computeIsCompactPhoneLandscape() {
    // Intentionally not UA-based.
    // We treat "compact" as: touch device, landscape, and small short-side.
    const touch = isTouchLikeDevice();
    if (!touch) return false;

    const { w: vw, h: vh } = getViewportDims();
    const { w: sw, h: sh } = getScreenDims();

    const landscape = (vw && vh) ? (vw >= vh) : (sw && sh) ? (sw >= sh) : safeMatchMedia('(orientation: landscape)');

    const shortV = (vw && vh) ? Math.min(vw, vh) : 9999;
    const shortS = (sw && sh) ? Math.min(sw, sh) : 9999;

    // Existing design target: iPhone 12 Pro landscape is 844 x 390.
    // Using <= 450 keeps iPads out while still catching phones even when
    // iOS reports a "desktop" layout viewport.
    const shortSideSmall = (shortV <= 450) || (shortS <= 450);

    return !!(landscape && shortSideSmall);
}

let _state = {
    touch: false,
    standalone: false,
    compact: false,
    landscape: false,
    portrait: false,
};

function applyRootClasses(next) {
    const root = document.documentElement;
    if (!root) return;

    root.classList.toggle('is-touch', !!next.touch);
    root.classList.toggle('is-standalone', !!next.standalone);
    root.classList.toggle('is-compact', !!next.compact);
    root.classList.toggle('is-landscape', !!next.landscape);
    root.classList.toggle('is-portrait', !!next.portrait);
}

function ensureRotateOverlay() {
    if (!document?.body) return null;

    let el = document.getElementById(ROTATE_OVERLAY_ID);
    if (el) return el;

    el = document.createElement('div');
    el.id = ROTATE_OVERLAY_ID;
    el.className = 'rotate-overlay hidden';
    el.setAttribute('aria-hidden', 'true');

    el.innerHTML = `
        <div class="rotate-overlay-card" role="dialog" aria-modal="true" aria-label="Rotate device">
            <div class="rotate-overlay-title">Rotate to Landscape</div>
            <div class="rotate-overlay-subtitle">This game is optimized for phone landscape.</div>
            <button type="button" class="rotate-overlay-btn">Try again</button>
        </div>
    `;

    const btn = el.querySelector('.rotate-overlay-btn');
    if (btn) {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            await requestLandscapeLock();
            // Recompute immediately after a user gesture.
            refreshUiModeSoon();
        });
    }

    // Any tap on the overlay also tries to lock (Android installed PWAs)
    el.addEventListener('pointerdown', async () => {
        await requestLandscapeLock();
    }, { passive: true });

    document.body.appendChild(el);
    return el;
}

function updateRotateOverlay(next) {
    const el = ensureRotateOverlay();
    if (!el) return;

    // Show overlay on touch devices in portrait.
    const shouldShow = !!(next.touch && next.portrait);

    el.classList.toggle('hidden', !shouldShow);
    el.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
}

function computeState() {
    const touch = isTouchLikeDevice();
    const standalone = isStandaloneDisplayMode();
    const landscape = computeIsLandscape();
    const portrait = !landscape;
    const compact = computeIsCompactPhoneLandscape();

    return { touch, standalone, compact, landscape, portrait };
}

function statesEqual(a, b) {
    return !!a && !!b &&
        a.touch === b.touch &&
        a.standalone === b.standalone &&
        a.compact === b.compact &&
        a.landscape === b.landscape &&
        a.portrait === b.portrait;
}

function emitChange(prev, next) {
    try {
        window.dispatchEvent(new CustomEvent('compactmodechange', {
            detail: {
                prev,
                next,
                compact: !!next.compact,
                landscape: !!next.landscape,
                portrait: !!next.portrait,
                touch: !!next.touch,
                standalone: !!next.standalone,
            }
        }));
    } catch {
        /* ignore */
    }
}

let _refreshTimer = 0;
function refreshUiModeSoon() {
    if (_refreshTimer) return;
    _refreshTimer = window.setTimeout(() => {
        _refreshTimer = 0;
        refreshUiModeNow();
    }, 50);
}

function refreshUiModeNow() {
    const prev = _state;
    const next = computeState();
    _state = next;

    applyRootClasses(next);
    updateRotateOverlay(next);

    if (!statesEqual(prev, next)) {
        emitChange(prev, next);
    }
}

export function isCompactPhoneLandscape() {
    return !!_state.compact;
}

export async function requestLandscapeLock() {
    // Only works in some contexts (usually installed mode + user gesture).
    try {
        const o = screen?.orientation;
        if (o && typeof o.lock === 'function') {
            await o.lock('landscape');
            return true;
        }
    } catch {
        /* ignore */
    }
    return false;
}

// Initialize once on module eval.
try {
    // If script runs before body exists, overlay will be created later.
    refreshUiModeNow();
} catch {
    /* ignore */
}

// Keep in sync.
try {
    window.addEventListener('resize', refreshUiModeSoon, { passive: true });
    window.addEventListener('orientationchange', refreshUiModeSoon, { passive: true });
    window.visualViewport?.addEventListener('resize', refreshUiModeSoon, { passive: true });
    document.addEventListener('visibilitychange', refreshUiModeSoon, { passive: true });
} catch {
    /* ignore */
}

// Create overlay after DOM is ready (for early module eval cases).
try {
    document.addEventListener('DOMContentLoaded', () => {
        ensureRotateOverlay();
        refreshUiModeSoon();

        // Best-effort: on installed mode, try to request landscape after first user gesture.
        // (Android PWAs often allow this; iOS typically ignores it.)
        const onFirstGesture = async () => {
            try { await requestLandscapeLock(); } catch { /* ignore */ }
            refreshUiModeSoon();
            window.removeEventListener('pointerdown', onFirstGesture, true);
        };
        window.addEventListener('pointerdown', onFirstGesture, true);
    }, { once: true });
} catch {
    /* ignore */
}
