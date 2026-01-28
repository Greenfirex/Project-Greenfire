// Footer UI Management
// - Pause/Resume button
// - Speed control buttons (1x, 2x, 5x, 10x)
// - (XP display lives in Character stats)

import { addLogEntry, LogType } from '../core/ingameLog.js';

let isPaused = false;
let mainLoopCallbacks = { start: null, stop: null };

const MOBILE_SPEED_ORDER = [1, 2, 5, 10];

function isCompactPhoneLandscape() {
    try {
        return window.matchMedia('(max-width: 600px), (max-width: 900px) and (max-height: 450px)').matches;
    } catch {
        return false;
    }
}

function updateMobileSpeedButton() {
    const btn = document.getElementById('mobileSpeedBtn');
    if (!btn) return;
    const s = Number(window.TIME_SCALE) || 1;
    btn.textContent = `Speed ${s}x`;
    btn.setAttribute('aria-label', `Game speed ${s}x. Tap to change.`);
}

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
    updateMobileSpeedButton();
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

    // Mobile compact speed control (single cycling button)
    try {
        const footerControls = document.getElementById('footerControls');
        if (footerControls) {
            let mobileBtn = document.getElementById('mobileSpeedBtn');
            if (!mobileBtn) {
                mobileBtn = document.createElement('button');
                mobileBtn.type = 'button';
                mobileBtn.id = 'mobileSpeedBtn';
                mobileBtn.className = 'header-link mobile-speed-btn';
                mobileBtn.title = 'Change speed';
                mobileBtn.setAttribute('aria-label', 'Change game speed');
                // Insert after Pause for compact layouts
                footerControls.insertBefore(mobileBtn, footerControls.querySelector('.speed-buttons') || null);
            }

            const cycle = () => {
                const current = Number(window.TIME_SCALE) || 1;
                const idx = Math.max(0, MOBILE_SPEED_ORDER.indexOf(current));
                const next = MOBILE_SPEED_ORDER[(idx + 1) % MOBILE_SPEED_ORDER.length];
                setGameSpeed(next, true);
            };

            if (mobileBtn.dataset.wired !== 'true') {
                mobileBtn.dataset.wired = 'true';
                mobileBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    cycle();
                });
            }

            // Show/hide handled by CSS; keep label updated.
            updateMobileSpeedButton();

            // If viewport changes between compact/desktop (dev tools), keep label fresh.
            try {
                const mql = window.matchMedia('(max-width: 600px), (max-width: 900px) and (max-height: 450px)');
                if (mql && mobileBtn.dataset.mqlWired !== 'true') {
                    mobileBtn.dataset.mqlWired = 'true';
                    mql.addEventListener('change', () => updateMobileSpeedButton());
                }
            } catch { /* ignore */ }

            // If we are not in compact mode, ensure button doesn't steal focus via tabbing.
            try {
                if (!isCompactPhoneLandscape()) mobileBtn.setAttribute('tabindex', '-1');
                else mobileBtn.removeAttribute('tabindex');
            } catch { /* ignore */ }
        }
    } catch { /* ignore */ }
    
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
