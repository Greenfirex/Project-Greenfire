// Footer UI Management
// - Pause/Resume button
// - Speed control buttons (1x, 2x, 5x, 10x)
// - (XP display lives in Character stats)

import { addLogEntry, LogType } from '../core/ingameLog.js';

let isPaused = false;
let mainLoopCallbacks = { start: null, stop: null };

// Debug resource gain multiplier (playtesting helper)
// Exposed on window so other modules (resources, action handling) can read it.
// 1 = normal, 10 = boosted. Survivors are explicitly excluded where applied.
if (typeof window !== 'undefined' && typeof window.DEBUG_RESOURCE_GAIN === 'undefined') {
    // Load persisted debug state
    const savedDebug = localStorage.getItem('debugResourceGain');
    window.DEBUG_RESOURCE_GAIN = savedDebug === '10' ? 10 : 1;
}

// Allow main.js to register its loop control functions
function registerMainLoopCallbacks(startFn, stopFn) {
    mainLoopCallbacks.start = startFn;
    mainLoopCallbacks.stop = stopFn;
}

function updateHUD() {
    const hud = document.getElementById('gameStatusHUD');
    if (hud) hud.textContent = isPaused ? 'Paused' : `${window.TIME_SCALE}x`;
}

function setGameSpeed(factor, announce = true) {
    window.TIME_SCALE = Number(factor) || 1;
    // persist new value
    try { localStorage.setItem('gameTimeScale', String(window.TIME_SCALE)); } catch (e) {}
    // update UI active button
    document.querySelectorAll('.speed-btn').forEach(btn => {
        btn.classList.toggle('active', Number(btn.dataset.speed) === Number(window.TIME_SCALE));
    });
    updateHUD();
    if (announce) addLogEntry(`Game speed set to ${window.TIME_SCALE}x.`, LogType.INFO);
}

// Pause/resume helpers
function pauseGame(announce = true) {
    if (isPaused) return;
    isPaused = true;
    // stop main loop and notify subsystems
    if (mainLoopCallbacks.stop) mainLoopCallbacks.stop();
    window.dispatchEvent(new CustomEvent('game-pause'));
    const btn = document.getElementById('pauseBtn');
    if (btn) { btn.textContent = 'Resume'; btn.classList.add('active'); }
    // persist paused state
    try { localStorage.setItem('gamePaused', 'true'); } catch (e) {}
    updateHUD();
    if (announce) addLogEntry('Game paused.', LogType.INFO);
}

function resumeGame(announce = true) {
    if (!isPaused) return;
    isPaused = false;
    if (mainLoopCallbacks.start) mainLoopCallbacks.start();
    window.dispatchEvent(new CustomEvent('game-resume'));
    const btn = document.getElementById('pauseBtn');
    if (btn) { btn.textContent = 'Pause'; btn.classList.remove('active'); }
    try { localStorage.setItem('gamePaused', 'false'); } catch (e) {}
    updateHUD();
    if (announce) addLogEntry(`Game resumed at ${window.TIME_SCALE}x.`, LogType.INFO);
}

function togglePause() {
    if (isPaused) resumeGame(); else pauseGame();
}

// Export for main.js to use
export function getIsPaused() {
    return isPaused;
}

export function setIsPaused(value) {
    isPaused = value;
}

export function initFooter() {
    // Read persisted pause state
    const savedPaused = (localStorage.getItem('gamePaused') === 'true');

    // Hook up DOM controls
    const pauseBtn = document.getElementById('pauseBtn');
    if (pauseBtn) pauseBtn.addEventListener('click', (e) => { e.preventDefault(); togglePause(); });
    
    document.querySelectorAll('.speed-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const v = Number(btn.dataset.speed) || 1;
            setGameSpeed(v, true);
        });
    });

    // Debug toggle button
    const debugBtn = document.getElementById('debugBtn');
    if (debugBtn) {
        debugBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const enabled = window.DEBUG_RESOURCE_GAIN === 10;
            window.DEBUG_RESOURCE_GAIN = enabled ? 1 : 10;
            debugBtn.classList.toggle('active', !enabled);
            // Persist debug state
            try { localStorage.setItem('debugResourceGain', String(window.DEBUG_RESOURCE_GAIN)); } catch {}
            const stateLabel = window.DEBUG_RESOURCE_GAIN === 10 ? 'ENABLED' : 'disabled';
            addLogEntry(`Debug resource multiplier ${stateLabel}.`, LogType.INFO);
        });
    }

    // Apply persisted settings
    setGameSpeed(window.TIME_SCALE, false);
    if (savedPaused) {
        pauseGame(false);
    } else {
        isPaused = false;
        const pBtn = document.getElementById('pauseBtn');
        if (pBtn) { pBtn.textContent = 'Pause'; pBtn.classList.remove('active'); }
        updateHUD();
    }

    // Ensure debug button reflects current state on load
    if (debugBtn) debugBtn.classList.toggle('active', window.DEBUG_RESOURCE_GAIN === 10);
}

// Export pause/resume functions and registration for core to use
export { pauseGame, resumeGame, togglePause, updateHUD, registerMainLoopCallbacks };
