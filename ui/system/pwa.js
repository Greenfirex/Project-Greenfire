// Minimal PWA wiring: registers the service worker when supported.

function isDevHost() {
    try {
        const h = String(location.hostname || '').toLowerCase();
        // Typical local-dev hosts (VS Code Live Server etc.)
        return (h === 'localhost' || h === '127.0.0.1') && String(location.protocol || '').toLowerCase() === 'http:';
    } catch {
        return false;
    }
}

async function unregisterSwAndClearCachesInDev() {
    // Dev ergonomics: avoid stale cached JS/CSS due to SW runtime caching.
    // This runs only on http://localhost / http://127.0.0.1.
    try {
        if (!('serviceWorker' in navigator)) return;
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all((regs || []).map(r => r.unregister()));
    } catch {
        /* ignore */
    }
    try {
        if (!('caches' in window)) return;
        const keys = await caches.keys();
        await Promise.all((keys || []).map((k) => {
            // Only clear our caches.
            if (String(k || '').includes('greenfire-sw-')) return caches.delete(k);
            return Promise.resolve();
        }));
    } catch {
        /* ignore */
    }
}

function shouldRegister() {
    try {
        // In dev, explicitly avoid SW registration so edits always reflect immediately.
        if (isDevHost()) return false;
        // Avoid registering on file://
        return location && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1');
    } catch {
        return false;
    }
}

async function registerSw() {
    if (!('serviceWorker' in navigator)) return;

    // If previously registered in dev, clean it up (prevents "why don't my changes show" issues).
    try {
        if (isDevHost()) {
            await unregisterSwAndClearCachesInDev();
            return;
        }
    } catch {
        /* ignore */
    }

    if (!shouldRegister()) return;

    try {
        const swUrl = new URL('../sw.js', import.meta.url);
        await navigator.serviceWorker.register(swUrl, { scope: './' });
    } catch {
        // Non-fatal; PWA still works without offline cache.
    }
}

// Register after load so it doesn't slow first paint.
try {
    window.addEventListener('load', () => {
        registerSw();
    }, { once: true });
} catch {
    /* ignore */
}
