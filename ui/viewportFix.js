// Keeps viewport-height-dependent layout stable on mobile browsers (esp. after reload/reset)
// by syncing a CSS variable to the actual visual viewport height.

function setAppVhVar() {
    try {
        const vv = window.visualViewport;
        const height = Math.max(0, Math.floor((vv && vv.height) ? vv.height : window.innerHeight));
        if (!height) return;
        // Used by CSS as: height: calc(var(--app-vh, 1vh) * 100)
        document.documentElement.style.setProperty('--app-vh', `${height * 0.01}px`);
    } catch {
        /* ignore */
    }
}

function forceRecalcSoon() {
    setAppVhVar();
    requestAnimationFrame(() => {
        setAppVhVar();
        requestAnimationFrame(setAppVhVar);
    });
}

// Run once immediately (module eval) so early layout uses a good value.
setAppVhVar();

// Keep in sync on lifecycle events.
try {
    window.addEventListener('resize', setAppVhVar, { passive: true });
    window.addEventListener('orientationchange', setAppVhVar, { passive: true });
    window.visualViewport?.addEventListener('resize', setAppVhVar, { passive: true });
} catch {
    /* ignore */
}

// Popups (story/combat/confirm) can cause mobile browsers to adjust the visual viewport.
// Force a recalculation on open/close so the game area doesn't stay shifted.
try {
    window.addEventListener('popup-open', forceRecalcSoon, { passive: true });
    window.addEventListener('popup-close', forceRecalcSoon, { passive: true });
} catch {
    /* ignore */
}

// After a game reset, force a couple of recalcs (some browsers apply viewport changes a tick late).
try {
    window.addEventListener('gameReset', () => {
        forceRecalcSoon();
    });
} catch {
    /* ignore */
}
