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

/** Convert totalIngameMinutes -> { day, hour (1-24), minute } */
export function getIngameTimeObject() {
    const mins = Math.floor(totalIngameMinutes);
    const totalHours = Math.floor(mins / 60);
    const day = Math.floor(totalHours / 24);
    const hour = (totalHours % 24); // 1..24
    const minute = mins % 60;
    return { day, hour, minute };
}

function pad(n) {
    return n.toString().padStart(2, '0');
}

export function getIngameTimeString() {
    const t = getIngameTimeObject();
    return `Day ${t.day}, Hour ${pad(t.hour)}`;
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