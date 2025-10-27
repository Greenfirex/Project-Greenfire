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

/** Advance internal time by realSeconds.
 *  Mapping: 1 real second -> 1 in-game minute (so 60s = 1 in-game hour)
 */
function advanceByRealSeconds(realSeconds) {
    totalIngameMinutes += realSeconds * 5; // 1 real sec = 1 in-game min
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
    totalIngameMinutes = 1 * 60;
    save();
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