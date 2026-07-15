// ==========================================================================
// Smart Preloader Module
//
// Tracks readiness of all subsystems, renders a progress bar, and fades out
// only when everything is genuinely ready. No CSS timing games.
//
// Usage:
//   import { preloader } from '../ui/system/preloader.js';
//   preloader.register('images', 30);
//   preloader.progress('images', 0.5, 'Images...');
//   // When all categories reach 100%, preloader auto-dismisses.
// ==========================================================================

function getPreloaderEl() { return document.getElementById('preloader'); }
function getProgressBarEl() { return getPreloaderEl()?.querySelector('.preloader-bar-fill'); }
function getProgressTextEl() { return getPreloaderEl()?.querySelector('.preloader-status'); }
function getLoaderTextEl() { return getPreloaderEl()?.querySelector('.preloader-text'); }

const categories = new Map();  // name → { weight, progress }
let isLangReload = false;
let dismissed = false;
let imagesTotal = 0;
let imagesLoaded = 0;
let _showTime = Date.now();
const ANIM_DURATION_MS = 1500; // bar fills over 1.5s for a smooth experience
const MIN_SHOW_MS = 400;       // minimum time the preloader stays visible after everything is ready
let _animStarted = false;
let _animStartTime = 0;
let _animFrame = null;
let _displayedProgress = 0;  // what the user sees (lerps toward real progress)
let _dismissTimer = null;
let _allReady = false;
let _dismissPending = false;
let _safetyTimer = null;     // guarantee rAF is always cleaned up

// ==========================================================================
// Auto-discover all image assets used in the page
// ==========================================================================

/** Discover all image URLs from DOM and CSS — zero maintenance, always up-to-date. */
function discoverAllImageUrls() {
    const urls = new Set();
    const imageExt = /\.(png|jpg|jpeg|svg|webp|gif|ico)(\?.*)?$/i;

    // 1. <img> tags
    try {
        document.querySelectorAll('img[src]').forEach(img => {
            const url = String(img.src || '').trim();
            if (url && imageExt.test(url)) urls.add(url);
        });
    } catch { /* ignore */ }

    // 2. <link> favicons / apple-touch-icon
    try {
        document.querySelectorAll('link[rel]').forEach(link => {
            const rel = String(link.rel || '').toLowerCase();
            if (/(icon|apple-touch-icon)/.test(rel)) {
                const href = String(link.href || '').trim();
                if (href && imageExt.test(href)) urls.add(href);
            }
        });
    } catch { /* ignore */ }

    // 3. CSS url() references from all stylesheets
    try {
        for (const sheet of document.styleSheets) {
            try {
                if (!sheet.href || sheet.href === location.href) {
                    for (const rule of sheet.cssRules || []) {
                        const text = String(rule.cssText || '');
                        for (const m of text.matchAll(/url\(["']?([^)"']+)["']?\)/g)) {
                            const raw = String(m[1] || '').trim();
                            if (imageExt.test(raw)) {
                                try { urls.add(new URL(raw, sheet.href || location.href).href); }
                                catch { urls.add(raw); }
                            }
                        }
                    }
                }
            } catch { /* cross-origin stylesheet, skip */ }
        }
    } catch { /* ignore */ }

    // 4. Resource Timing fallback
    try {
        if (performance && typeof performance.getEntriesByType === 'function') {
            const entries = performance.getEntriesByType('resource');
            for (const entry of entries) {
                const name = String(entry.name || '');
                if (imageExt.test(name)) urls.add(name);
            }
        }
    } catch { /* ignore */ }

    return [...urls];
}

function preloadAllImages() {
    const urls = discoverAllImageUrls();
    if (urls.length === 0) {
        preloader.progress('images', 1, 'No images to load');
        return;
    }
    imagesTotal = urls.length;
    imagesLoaded = 0;
    urls.forEach(url => {
        const img = new Image();
        const onDone = () => {
            imagesLoaded++;
            const fraction = imagesTotal > 0 ? imagesLoaded / imagesTotal : 1;
            preloader.progress('images', fraction, `Images (${imagesLoaded}/${imagesTotal})`);
        };
        img.onload = onDone;
        img.onerror = onDone;
        img.src = url;
    });
}

try { if (sessionStorage.getItem('langReload')) { isLangReload = true; sessionStorage.removeItem('langReload'); } } catch { /* ignore */ }

function computeTotalProgress() {
    let totalWeight = 0, weightedProgress = 0;
    for (const [, cat] of categories) { totalWeight += cat.weight; weightedProgress += cat.weight * cat.progress; }
    return totalWeight === 0 ? 0 : Math.min(1, Math.max(0, weightedProgress / totalWeight));
}

function easeOutQuad(t) { return t * (2 - t); }

function cancelRaf() {
    if (_animFrame) { cancelAnimationFrame(_animFrame); _animFrame = null; }
}

/** Guarantee that rAF is cancelled within 30s even if dismiss never fires (iOS background freeze etc). */
function scheduleRafSafety() {
    if (_safetyTimer) clearTimeout(_safetyTimer);
    _safetyTimer = setTimeout(() => {
        cancelRaf();
        if (!dismissed) {
            _displayedProgress = 1;
            doDismiss();
        }
    }, 30000);
}

function startSmoothAnimation() {
    if (_animStarted || dismissed) return;
    _animStarted = true;
    _animStartTime = Date.now();
    scheduleRafSafety();

    function tick() {
        if (dismissed) { _animFrame = null; return; }
        const bar = getProgressBarEl();
        if (!bar) { _animFrame = null; return; }

        const elapsed = Date.now() - _animStartTime;
        const animFraction = Math.min(1, elapsed / ANIM_DURATION_MS);
        const eased = easeOutQuad(animFraction);
        const real = computeTotalProgress();
        let visual;
        const floor = eased * 0.3;
        visual = Math.max(real, floor);
        visual = Math.max(_displayedProgress, visual);
        _displayedProgress = Math.min(1, visual);

        bar.style.width = `${Math.round(_displayedProgress * 100)}%`;
        bar.setAttribute('aria-valuenow', String(Math.round(_displayedProgress * 100)));

        if (_displayedProgress >= 1 && _allReady) {
            doDismiss();
            _animFrame = null;
            return;
        }
        _animFrame = requestAnimationFrame(tick);
    }
    _animFrame = requestAnimationFrame(tick);
}

function isPortrait() {
    try {
        const vv = window.visualViewport;
        const w = vv?.width || window.innerWidth || 0;
        const h = vv?.height || window.innerHeight || 0;
        return w > 0 && h > 0 && w < h;
    } catch { return false; }
}

let _readyTime = 0;

function doDismiss() {
    // Cancel safety net — we're dismissing normally.
    if (_safetyTimer) { clearTimeout(_safetyTimer); _safetyTimer = null; }
    if (dismissed) return;

    // Enforce minimum show time after everything became ready.
    const elapsedSinceReady = _readyTime > 0 ? Date.now() - _readyTime : 0;
    if (elapsedSinceReady < MIN_SHOW_MS) {
        setTimeout(doDismiss, MIN_SHOW_MS - elapsedSinceReady);
        return;
    }

    // If still portrait, defer dismissal.
    if (isPortrait()) { _dismissPending = true; return; }

    cancelRaf();
    const pl = getPreloaderEl();
    if (!pl) return;
    dismissed = true;

    const bar = getProgressBarEl();
    if (bar) bar.style.width = '100%';

    pl.classList.add('preloader-done');
    try { pl.hidden = true; } catch { /* ignore */ }
    setTimeout(() => {
        try { pl.remove(); } catch { /* ignore */ }
        // Notify the game that preloading is complete.
        try { window.dispatchEvent(new CustomEvent('preloader-ready')); } catch { /* ignore */ }
    }, 600);
}

function dismiss() {
    _allReady = true;
    if (!_readyTime) _readyTime = Date.now();
}

function checkAllReady() {
    for (const [, cat] of categories) { if (cat.progress < 1) return false; }
    return true;
}

// ==========================================================================
// Public API
// ==========================================================================

export const preloader = {
    register(name, weight = 10) {
        if (categories.has(name)) return;
        categories.set(name, { weight: Math.max(0, Number.isFinite(weight) ? weight : 10), progress: 0 });
    },

    progress(name, fraction, statusText) {
        const cat = categories.get(name);
        if (!cat || dismissed) return;
        const v = Math.min(1, Math.max(0, Number.isFinite(fraction) ? fraction : 0));
        cat.progress = v;
        if (!_animStarted) startSmoothAnimation();
        const statusEl = getProgressTextEl();
        if (statusEl && statusText) statusEl.textContent = isLangReload ? '' : String(statusText);
        if (checkAllReady()) dismiss();
    },

    get isLangReload() { return isLangReload; },

    get isDone() { return dismissed; },

    setLabel(text) {
        const lbl = getLoaderTextEl();
        if (lbl) lbl.textContent = String(text ?? '');
    },

    startImagePreloading() { preloadAllImages(); },

    preloadUrls(urls) {
        if (!Array.isArray(urls) || urls.length === 0) return;
        if (!categories.has('images')) this.register('images', 20);
        imagesTotal += urls.length;
        urls.forEach(url => {
            const img = new Image();
            const onDone = () => {
                imagesLoaded++;
                const fraction = imagesTotal > 0 ? imagesLoaded / imagesTotal : 1;
                preloader.progress('images', fraction, `Images (${imagesLoaded}/${imagesTotal})`);
            };
            img.onload = onDone;
            img.onerror = onDone;
            img.src = url;
        });
    },
};

// ==========================================================================
// Initialise
// ==========================================================================

(function init() {
    const pl = getPreloaderEl();
    if (!pl) return;

    // Progress bar and status text are now in HTML template — no need to create them.
    // Fallback for backwards compatibility if they're somehow missing:
    if (!getProgressBarEl()) {
        const bar = document.createElement('div'); bar.className = 'preloader-bar';
        const fill = document.createElement('div'); fill.className = 'preloader-bar-fill';
        fill.setAttribute('role', 'progressbar');
        fill.setAttribute('aria-valuemin', '0'); fill.setAttribute('aria-valuemax', '100'); fill.setAttribute('aria-valuenow', '0');
        bar.appendChild(fill); pl.appendChild(bar);
    }
    if (!getProgressTextEl()) {
        const status = document.createElement('p'); status.className = 'preloader-status'; pl.appendChild(status);
    }

    if (isLangReload) {
        const loaderText = pl.querySelector('.preloader-text');
        if (loaderText) loaderText.textContent = 'Switching language…';
    }

    const tryDismissOnLandscape = () => {
        if (_dismissPending && !dismissed && !isPortrait()) { _dismissPending = false; doDismiss(); }
    };
    window.addEventListener('resize', tryDismissOnLandscape, { passive: true });
    window.addEventListener('orientationchange', tryDismissOnLandscape, { passive: true });
    try { window.visualViewport?.addEventListener('resize', tryDismissOnLandscape, { passive: true }); } catch { /* ignore */ }

    setTimeout(() => { if (!_animStarted && !dismissed) startSmoothAnimation(); }, 200);
})();