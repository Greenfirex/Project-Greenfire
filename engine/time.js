// Simple in-game time manager
const STORAGE_KEY = 'ingameTimeMinutes';
let totalIngameMinutes = 0; // default: day 0, hour 1 -> 1*60 = 60 minutes
let running = false;
let lastRealTimestamp = 0;
let tickInterval = null;

/** Load saved time or default */
function load() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw !== null) totalIngameMinutes = Number(raw);
    } catch (e) {
        // ignore
    }
}

/** Persist time */
function save() {
    try {
        localStorage.setItem(STORAGE_KEY, String(Math.floor(totalIngameMinutes)));
    } catch (e) {
        // ignore
    }
}

// Return structured in-game time object { day, hour, minute } based on totalIngameMinutes
export function getIngameTimeObject() {
    const mins = Math.max(0, Math.floor(totalIngameMinutes || 0));
    const day = Math.floor(mins / (60 * 24));
    const hour = Math.floor((mins % (60 * 24)) / 60);
    const minute = mins % 60;
    return { day, hour, minute };
}

// Convenience string formatter: "Day X, Hour YY"
export function getIngameTimeString() {
    const t = getIngameTimeObject();
    return `Day ${t.day}, Hour ${String(t.hour).padStart(2, '0')}`;
}

// --- New: raw getters/setters so saveload can persist/restore precisely ---
export function getTotalIngameMinutes() {
    return Math.max(0, Math.floor(totalIngameMinutes || 0));
}
export function setTotalIngameMinutes(mins) {
    totalIngameMinutes = Number(mins) || 0;
    save();

    // Prevent the next tick from applying a huge delta if the manager is running
    // Reset the internal last-real timestamp so the first rAF tick uses a fresh baseline.
    try {
        if (running) lastRealTimestamp = performance.now();
    } catch (e) {
        // ignore in non-browser/test environments
    }
}

/** Advance internal time by realSeconds.
 *  Mapping: the code uses a multiplier so N real seconds -> in-game minutes.
 *  The existing behavior multiplies by 5 (so 1 real second -> 5 in-game minutes).
 *  We preserve that mapping but also respect the global `window.TIME_SCALE`
 *  so changing game speed affects how fast in-game minutes advance.
 */
function advanceByRealSeconds(realSeconds) {
    // Read the global time scale used by the main loop; default to 1 when
    // unavailable (tests / non-browser environments).
    let scale = 1;
    try { scale = Number(window.TIME_SCALE) || 1; } catch (e) { /* ignore */ }

    // Preserve previous base multiplier (5) to avoid changing game pacing.
    const BASE_MULTIPLIER = 5; // existing mapping: 1 real sec -> 5 in-game minutes
    totalIngameMinutes += realSeconds * BASE_MULTIPLIER * scale;
}

/** Internal tick using real delta */
function tick(now) {
    if (!running) return;
    if (!lastRealTimestamp) lastRealTimestamp = now;
    const deltaMs = now - lastRealTimestamp;
    lastRealTimestamp = now;
    const deltaSeconds = deltaMs / 1000;
    advanceByRealSeconds(deltaSeconds);
    save();
}

/** Start the manager (safe to call multiple times) */
export function startTimeManager() {
    if (running) return;
    running = true;
    lastRealTimestamp = performance.now();
    // use rAF loop to get accurate delta (also works if main loop paused/restarted)
    function loop(now) {
        if (!running) return;
        tick(now);
        tickInterval = requestAnimationFrame(loop);
    }
    tickInterval = requestAnimationFrame(loop);
}

/** Stop / pause the manager */
export function stopTimeManager() {
    running = false;
    lastRealTimestamp = 0;
    if (tickInterval) {
        cancelAnimationFrame(tickInterval);
        tickInterval = null;
    }
    save();
}

/** Reset to day 0 hour 1 */
export function resetIngameTime() {
    // keep behavior but use setter so save is consistent
    setTotalIngameMinutes(1 * 60);
}

/** Initialize on load, optionally auto-start */
export function initTimeManager(autoStart = true) {
    load();
    if (autoStart) startTimeManager();
}

/* Pause/resume on global events so time respects game-pause/game-resume */
window.addEventListener('game-pause', () => {
    stopTimeManager();
});
window.addEventListener('game-resume', () => {
    startTimeManager();
});