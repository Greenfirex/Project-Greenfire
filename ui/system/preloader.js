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
const MIN_SHOW_MS = 600;       // minimum time the preloader stays visible
let _animStarted = false;
let _animStartTime = 0;
let _animFrame = null;
let _displayedProgress = 0;  // what the user sees (lerps toward real progress)
let _dismissTimer = null;
let _allReady = false;
let _dismissPending = false;

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
                    // Same-origin or inline — safe to read
                    for (const rule of sheet.cssRules || []) {
                        const text = String(rule.cssText || '');
                        for (const m of text.matchAll(/url\(["']?([^)"']+)["']?\)/g)) {
                            const raw = String(m[1] || '').trim();
                            if (imageExt.test(raw)) {
                                try {
                                    urls.add(new URL(raw, sheet.href || location.href).href);
                                } catch { urls.add(raw); }
                            }
                        }
                    }
                }
            } catch {
                // Cross-origin stylesheet — cannot read rules, skip.
                // Images from external CSS are loaded by the browser automatically
                // and will be tracked via the Resource Timing fallback below.
            }
        }
    } catch { /* ignore */ }

    // 4. Resource Timing fallback: find already-fetched images the browser loaded
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

/** Preload and track all discovered images, reporting progress to the preloader. */
function preloadAllImages() {
    const urls = discoverAllImageUrls();

    if (urls.length === 0) {
        // No images found — mark complete immediately.
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
            const label = `Images (${imagesLoaded}/${imagesTotal})`;
            preloader.progress('images', fraction, label);
        };
        img.onload = onDone;
        img.onerror = onDone;  // count errors as "done" so preloader doesn't get stuck
        img.src = url;
    });
}

// Detect language-change reload early (set by inline script in <head>)
try {
    if (sessionStorage.getItem('langReload')) {
        isLangReload = true;
        sessionStorage.removeItem('langReload');
    }
} catch { /* ignore */ }

function computeTotalProgress() {
    let totalWeight = 0;
    let weightedProgress = 0;
    for (const [, cat] of categories) {
        totalWeight += cat.weight;
        weightedProgress += cat.weight * cat.progress;
    }
    if (totalWeight === 0) return 0;
    return Math.min(1, Math.max(0, weightedProgress / totalWeight));
}

// Ease-out: starts fast, slows near the end. t ∈ [0, 1].
function easeOutQuad(t) {
    return t * (2 - t);
}

function startSmoothAnimation() {
    if (_animStarted || dismissed) return;
    _animStarted = true;
    _animStartTime = Date.now();

    function tick() {
        if (dismissed) { _animFrame = null; return; }
        const bar = getProgressBarEl();
        if (!bar) { _animFrame = null; return; }

        const elapsed = Date.now() - _animStartTime;
        const animFraction = Math.min(1, elapsed / ANIM_DURATION_MS);
        const eased = easeOutQuad(animFraction);

        // Blend: use the real progress as a floor, but smoothly advance visually.
        // If real progress is ahead, snap to it. Otherwise ease toward 100%.
        const real = computeTotalProgress();
        let visual;
        if (real >= 0.99) {
            // All loaded — smoothly finish the animation toward 100%.
            visual = _displayedProgress + (1 - _displayedProgress) * 0.12;
            if (visual > 0.985) visual = 1;
        } else {
            // Real progress drives the floor; visual eases above it.
            visual = real * 0.7 + eased * 0.3;
            visual = Math.max(_displayedProgress, visual);
        }
        _displayedProgress = Math.min(1, visual);

        bar.style.width = `${Math.round(_displayedProgress * 100)}%`;
        bar.setAttribute('aria-valuenow', String(Math.round(_displayedProgress * 100)));

        if (_displayedProgress >= 1 && _allReady) {
            // Animation complete AND everything loaded — dismiss.
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

function doDismiss() {
    if (dismissed) return;

    // If still portrait, don't dismiss — wait for landscape.
    // This keeps the preloader as a curtain until the user rotates.
    if (isPortrait()) {
        _dismissPending = true;
        return;
    }

    if (_animFrame) { cancelAnimationFrame(_animFrame); _animFrame = null; }
    const pl = getPreloaderEl();
    if (!pl) return;
    dismissed = true;

    // Ensure bar reads 100%.
    const bar = getProgressBarEl();
    if (bar) bar.style.width = '100%';

    // Fade out preloader.
    pl.classList.add('preloader-done');
    try { pl.hidden = true; } catch { /* ignore */ }

    // Remove from DOM after transition so it doesn't block anything.
    setTimeout(() => {
        try { pl.remove(); } catch { /* ignore */ }
    }, 600);
}

function dismiss() {
    _allReady = true;
}

function checkAllReady() {
    for (const [, cat] of categories) {
        if (cat.progress < 1) return false;
    }
    return true;
}

// ==========================================================================
// Public API
// ==========================================================================

export const preloader = {
    /**
     * Register a named loading category.
     * @param {string} name - Unique category name.
     * @param {number} weight - Contribution to total (e.g. 30 means 30%).
     */
    register(name, weight = 10) {
        if (categories.has(name)) return;
        const w = Math.max(0, Number.isFinite(weight) ? weight : 10);
        categories.set(name, { weight: w, progress: 0 });
    },

    /**
     * Report progress for a category.
     * @param {string} name - Category name (must be registered first).
     * @param {number} fraction - 0..1 progress within this category.
     * @param {string} [statusText] - Optional status message to show.
     */
    progress(name, fraction, statusText) {
        const cat = categories.get(name);
        if (!cat || dismissed) return;

        const v = Math.min(1, Math.max(0, Number.isFinite(fraction) ? fraction : 0));
        cat.progress = v;

        // Start the smooth animation on first progress report.
        if (!_animStarted) startSmoothAnimation();

        // Update status text (suppress on langReload for cleaner experience).
        const statusEl = getProgressTextEl();
        if (statusEl && statusText) {
            statusEl.textContent = isLangReload ? '' : String(statusText);
        }

        // Check if everything is loaded.
        if (checkAllReady()) {
            dismiss();
        }
    },

    /**
     * Returns whether this is a language-change reload (for components to adapt).
     */
    get isLangReload() {
        return isLangReload;
    },

    /**
     * Set the label at the top of the preloader screen.
     */
    setLabel(text) {
        const lbl = getLoaderTextEl();
        if (lbl) {
            lbl.textContent = String(text ?? '');
        }
    },

    /**
     * Auto-discover all image assets in the page and preload them,
     * reporting progress to the 'images' category (must be registered first).
     */
    startImagePreloading() {
        preloadAllImages();
    },

    /**
     * Preload specific URLs (e.g. location images) so they're cached before the game starts.
     * Each URL is loaded via new Image() and counted toward the 'images' category.
     * @param {string[]} urls - Array of absolute or relative image URLs.
     */
    preloadUrls(urls) {
        if (!Array.isArray(urls) || urls.length === 0) return;
        if (!categories.has('images')) {
            this.register('images', 20);
        }
        const cat = categories.get('images');
        imagesTotal += urls.length;

        urls.forEach(url => {
            const img = new Image();
            const onDone = () => {
                imagesLoaded++;
                const fraction = imagesTotal > 0 ? imagesLoaded / imagesTotal : 1;
                const label = `Images (${imagesLoaded}/${imagesTotal})`;
                preloader.progress('images', fraction, label);
            };
            img.onload = onDone;
            img.onerror = onDone;
            img.src = url;
        });
    },
};

// ==========================================================================
// Initialise — hide spinner on lang reload, keep curtain up
// ==========================================================================

(function init() {
    const pl = getPreloaderEl();
    if (!pl) return;

    // Ensure progress bar elements exist in the preloader.
    if (!getProgressBarEl()) {
        const bar = document.createElement('div');
        bar.className = 'preloader-bar';
        const fill = document.createElement('div');
        fill.className = 'preloader-bar-fill';
        fill.setAttribute('role', 'progressbar');
        fill.setAttribute('aria-valuemin', '0');
        fill.setAttribute('aria-valuemax', '100');
        fill.setAttribute('aria-valuenow', '0');
        bar.appendChild(fill);
        pl.appendChild(bar);
    }
    if (!getProgressTextEl()) {
        const status = document.createElement('p');
        status.className = 'preloader-status';
        pl.appendChild(status);
    }

    // On language-switch reloads: hide the spinner and "Loading..." text immediately,
    // but keep the preloader curtain as a plain black backdrop.
    if (isLangReload) {
        const spinner = pl.querySelector('.loader');
        if (spinner) spinner.style.display = 'none';
        const loaderText = pl.querySelector('.preloader-text');
        if (loaderText) loaderText.style.display = 'none';
    }

    // Listen for orientation changes — if preloader is waiting in portrait,
    // retry dismiss when user rotates to landscape.
    const tryDismissOnLandscape = () => {
        if (_dismissPending && !dismissed && !isPortrait()) {
            _dismissPending = false;
            doDismiss();
        }
    };
    window.addEventListener('resize', tryDismissOnLandscape, { passive: true });
    window.addEventListener('orientationchange', tryDismissOnLandscape, { passive: true });
    try {
        window.visualViewport?.addEventListener('resize', tryDismissOnLandscape, { passive: true });
    } catch { /* ignore */ }

    // Safety fallback: if no progress is reported within 200ms,
    // start the animation anyway so the bar always fills.
    setTimeout(() => {
        if (!_animStarted && !dismissed) {
            startSmoothAnimation();
        }
    }, 200);
})();
