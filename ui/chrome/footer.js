// Footer UI Management
// - Speed control buttons (1x, 2x, 5x, 10x)

import { addLogEntry, LogType } from '../../engine/ingameLog.js';
import { t } from '../../locales/locales.js';

let mainLoopCallbacks = { start: null, stop: null };

const MOBILE_SPEED_ORDER = [1, 2, 5, 10];

function updateMobileSpeedButton() {
    const btn = document.getElementById('mobileSpeedBtn');
    if (!btn) return;
    const s = Number(window.TIME_SCALE) || 1;
    btn.textContent = `Speed ${s}x`;
    btn.setAttribute('aria-label', `Game speed ${s}x. Tap to change.`);
}

// Debug resource gain multiplier (playtesting helper)
if (typeof window !== 'undefined' && typeof window.DEBUG_RESOURCE_GAIN === 'undefined') {
    const savedDebug = localStorage.getItem('debugResourceGain');
    window.DEBUG_RESOURCE_GAIN = savedDebug === '10' ? 10 : 1;
}

// Allow main.js to register its loop control functions
export function registerMainLoopCallbacks(startFn, stopFn) {
    mainLoopCallbacks.start = startFn;
    mainLoopCallbacks.stop = stopFn;
}

function updateHUD() {
    const hud = document.getElementById('gameStatusHUD');
    if (hud) hud.textContent = `${window.TIME_SCALE}x`;
}

function setGameSpeed(factor, announce = true) {
    window.TIME_SCALE = Number(factor) || 1;
    try { localStorage.setItem('gameTimeScale', String(window.TIME_SCALE)); } catch (e) {}
    document.querySelectorAll('.speed-btn').forEach(btn => {
        btn.classList.toggle('active', Number(btn.dataset.speed) === Number(window.TIME_SCALE));
    });
    updateMobileSpeedButton();
    updateHUD();
    if (announce) addLogEntry(t('log_game_speed_set', { speed: window.TIME_SCALE }), LogType.INFO);
}

export function initFooter() {
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
                footerControls.appendChild(mobileBtn);
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

            updateMobileSpeedButton();

            try {
                const applyCompactState = () => {
                    try { updateMobileSpeedButton(); } catch { /* ignore */ }
                };

                if (mobileBtn.dataset.compactWired !== 'true') {
                    mobileBtn.dataset.compactWired = 'true';
                    window.addEventListener('compactmodechange', applyCompactState);
                    window.addEventListener('resize', applyCompactState, { passive: true });
                    window.addEventListener('orientationchange', applyCompactState, { passive: true });
                    window.visualViewport?.addEventListener('resize', applyCompactState, { passive: true });
                }
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
            try { localStorage.setItem('debugResourceGain', String(window.DEBUG_RESOURCE_GAIN)); } catch {}
            const stateLabel = window.DEBUG_RESOURCE_GAIN === 10 ? 'ENABLED' : 'disabled';
            addLogEntry(`Debug resource multiplier ${stateLabel}.`, LogType.INFO);
        });
    }

    // Apply persisted settings
    setGameSpeed(window.TIME_SCALE, false);

    // Ensure debug button reflects current state on load
    if (debugBtn) debugBtn.classList.toggle('active', window.DEBUG_RESOURCE_GAIN === 10);
}