// ==========================================================================
// Audio Utility — synthesized UI sound effects (Web Audio API)
// No external files required. Lazily initializes AudioContext on first use.
// ==========================================================================

let _ctx = null;

function getContext() {
    if (!_ctx) {
        try {
            _ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch {
            // Web Audio not available — all functions become no-ops
            _ctx = null;
        }
    }
    // Resume if suspended (browsers require user gesture)
    if (_ctx && _ctx.state === 'suspended') {
        try { _ctx.resume(); } catch { /* ignore */ }
    }
    return _ctx;
}

/**
 * Play a short, crisp "tick" sound for action button press.
 * Uses a sine oscillator with fast exponential decay (~50 ms).
 */
export function playActionStart() {
    const ctx = getContext();
    if (!ctx) return;

    try {
        const now = ctx.currentTime;

        // --- Tick oscillator (800 Hz for ~50 ms) ---
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.value = 800;

        // Quick attack, then exponential decay
        gain.gain.setValueAtTime(0.25, now);          // peak volume (subtle)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05); // decay over 50ms

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.06);
    } catch {
        // Silently ignore audio errors
    }
}

/**
 * Play a short "error" / "denied" sound for disabled/invalid button clicks.
 * Lower frequency, slightly longer — conveys "nope".
 */
export function playActionDenied() {
    const ctx = getContext();
    if (!ctx) return;

    try {
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'square';
        osc.frequency.value = 180;

        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.15);
    } catch {
        // Silently ignore
    }
}