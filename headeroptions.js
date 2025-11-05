import { saveGameState } from './saveload.js';
import { getIngameTimeString, getTotalIngameMinutes } from './time.js';
import { setupTooltip } from './tooltip.js';
import { getCurrentWeather } from './data/weather.js';

document.addEventListener('DOMContentLoaded', () => {

    const optionsLink = document.getElementById('optionsLink');
    const optionsMenu = document.getElementById('optionsMenu');
    // MODIFIED: Use the unique class for the options menu's close button
    const closeButton = optionsMenu?.querySelector('.options-menu-close');
    const resetButton = document.getElementById('resetButton');
    const saveLink = document.getElementById('saveLink');
    const loadLink = document.getElementById('loadLink');

    function showOptionsMenu(event) {
        event.preventDefault();
        if (optionsMenu) {
            optionsMenu.classList.remove('hidden');
            try { window.dispatchEvent(new CustomEvent('popup-open')); } catch (e) { /* ignore */ }
        }
    }

    function hideOptionsMenu() {
        if (optionsMenu) {
            optionsMenu.classList.add('hidden');
            try { window.dispatchEvent(new CustomEvent('popup-close')); } catch (e) { /* ignore */ }
        }
    }

    // --- Event Listeners ---
    if (optionsLink) {
        optionsLink.addEventListener('click', showOptionsMenu);
    }
    if (closeButton) {
        closeButton.addEventListener('click', hideOptionsMenu);
    }
    if (optionsMenu) {
        optionsMenu.addEventListener('click', (event) => {
            if (event.target === optionsMenu) {
                hideOptionsMenu();
            }
        });
    }
    if (resetButton) {
        resetButton.addEventListener('click', () => {
            if (confirm("Are you sure you want to reset your progress? This cannot be undone.")) {
                localStorage.setItem('isResetting', 'true');
                location.reload();
            }
        });
    }
    if (saveLink) {
        saveLink.addEventListener('click', (e) => {
            e.preventDefault();
            saveGameState();
        });
    }
    if (loadLink) {
        loadLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm("Are you sure you want to load your last save? Any unsaved progress will be lost.")) {
                localStorage.removeItem('isResetting');
                location.reload();
            }
        });
    }

    // Setup tooltips for clock and weather widget
    try {
        const clockEl = document.getElementById('headerClock');
        if (clockEl) {
            setupTooltip(clockEl, () => {
                const timeStr = getIngameTimeString();
                const total = getTotalIngameMinutes();
                const elapsed = Math.max(0, Math.floor(total - 60)); // start at Hour 1
                const d = Math.floor(elapsed / (60 * 24));
                const h = Math.floor((elapsed % (60 * 24)) / 60);
                const m = elapsed % 60;
                const scale = Number(window.TIME_SCALE || localStorage.getItem('gameTimeScale') || 1) || 1;
                const minsPerSec = 5 * scale; // 1 real sec -> 5*scale in-game minutes
                const hoursPerMin = 5 * scale; // 1 real minute -> 5*scale in-game hours
                return `
                    <h4>In-game Time</h4>
                    <p><strong>${timeStr}</strong></p>
                    <div class="tooltip-section">
                        <p>Elapsed since crash: <strong>${d}d ${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m</strong></p>
                        <p class="tooltip-detail">At current speed (${scale}x): 1 real sec = ${minsPerSec} in-game min</p>
                        <p class="tooltip-detail">At current speed (${scale}x): 1 real min = ${hoursPerMin} in-game hr</p>
                    </div>
                `;
            });
        }
    } catch (e) { /* ignore */ }

    try {
        const wEl = document.getElementById('weatherWidget');
        if (wEl) {
            setupTooltip(wEl, () => {
                try {
                    const w = getCurrentWeather();
                    const eta = (typeof w.remainingMinutes === 'number') ? minsToHrsMins(w.remainingMinutes) : '—';
                    const morale = (typeof w.moraleDelta === 'number' && w.moraleDelta !== 0)
                        ? `${w.moraleDelta > 0 ? '+' : ''}${w.moraleDelta}%`
                        : '+0%';
                    return `
                        <h4>Weather</h4>
                        <p><strong>${w.label || '—'}</strong> • <strong>${(typeof w.tempC === 'number') ? `${w.tempC}°C` : ''}</strong></p>
                        <div class="tooltip-section">
                            <p>Morale effect: <strong>${morale}</strong></p>
                            <p class="tooltip-detail">Wrist PDA forecast: next change in ~${eta}</p>
                        </div>
                    `;
                } catch (e) {
                    // Fallback static message if module not available
                    return `<h4>Weather</h4><p>Wrist PDA online. Forecast unavailable.</p>`;
                }
            });
        }
    } catch (e) { /* ignore */ }
});

// This handles the clock at the top of the screen
function minsToHrsMins(mins) {
    const m = Math.max(0, Math.floor(mins || 0));
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${h}h ${String(mm).padStart(2,'0')}m`;
}

function updateTime() {
    const clockEl = document.getElementById('headerClock');
    if (clockEl) {
        clockEl.textContent = getIngameTimeString();
    }
    // Weather widget near the clock
    const wEl = document.getElementById('weatherWidget');
    if (wEl) {
        try {
            const w = getCurrentWeather();
            const icon = w.icon || '⌁';
            const label = w.label || '—';
            const temp = (typeof w.tempC === 'number') ? `${w.tempC}°C` : '';
            wEl.innerHTML = `
                <span class="weather-icon">${icon}</span>
                <span class="weather-label">${label}</span>
                <span class="weather-temp">${temp}</span>
            `;
            wEl.classList.remove('hidden');
        } catch (e) {
            // hide widget gracefully if weather module fails
            wEl.classList.add('hidden');
        }
    }
}

// Replace any existing setInterval(updateTime, 1000) with:
setInterval(updateTime, 1000);
updateTime();

// If a saved game is applied after the initial DOMContentLoaded, force an
// immediate clock update so the header shows the restored in-game time
// without waiting for the next interval tick.
document.addEventListener('game-state-applied', () => {
    updateTime();
});

/**
 * Public helper to refresh the header clock immediately.
 * Other modules can import this and call it instead of relying on the
 * `game-state-applied` event.
 */
export function refreshClock() {
    updateTime();
}