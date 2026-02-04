// Minimal PWA wiring: registers the service worker when supported.

function shouldRegister() {
    try {
        // Avoid registering on file://
        return location && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1');
    } catch {
        return false;
    }
}

async function registerSw() {
    if (!('serviceWorker' in navigator)) return;
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
