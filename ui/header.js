import { saveGameState } from '../core/saveload.js';
import { getIngameTimeString, getTotalIngameMinutes } from '../core/time.js';
import { setupTooltip } from './panels/tooltip.js';
import { getCurrentWeather } from '../data/weather.js';
import { getConfirmOnLoad, getConfirmOnReset } from '../core/settings.js';
import { showConfirmPopup } from './panels/confirmPopup.js';

document.addEventListener('DOMContentLoaded', () => {

    const optionsLink = document.getElementById('optionsLink');
    const optionsMenu = document.getElementById('optionsMenu');
    // MODIFIED: Use the unique class for the options menu's close button
    const closeButton = optionsMenu?.querySelector('.options-menu-close');
    const resetButton = document.getElementById('resetButton');
    const saveLink = document.getElementById('saveLink');
    const loadLink = document.getElementById('loadLink');

    // --- Mobile dropdown for Options/Save/Load ---
    // Kept CSS-driven so desktop layout remains unchanged.
    try {
        const headerRight = document.querySelector('#header .header-right');
        const headerLinks = headerRight?.querySelector('.header-links');

        if (headerRight && headerLinks) {
            let menuBtn = headerRight.querySelector('.header-menu-btn');
            if (!menuBtn) {
                menuBtn = document.createElement('button');
                menuBtn.type = 'button';
                menuBtn.className = 'header-link header-menu-btn';
                menuBtn.id = 'headerMenuBtn';
                menuBtn.title = 'Menu';
                menuBtn.setAttribute('aria-label', 'Menu');
                menuBtn.setAttribute('aria-expanded', 'false');
                menuBtn.textContent = '⋯';
                headerRight.insertBefore(menuBtn, headerLinks);
            }

            const closeMenu = () => {
                headerRight.classList.remove('is-menu-open');
                try { menuBtn.setAttribute('aria-expanded', 'false'); } catch { /* ignore */ }
            };

            const openMenu = () => {
                headerRight.classList.add('is-menu-open');
                try { menuBtn.setAttribute('aria-expanded', 'true'); } catch { /* ignore */ }
            };

            const toggleMenu = () => {
                if (headerRight.classList.contains('is-menu-open')) closeMenu();
                else openMenu();
            };

            menuBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleMenu();
            });

            // Close when selecting an item
            headerLinks.addEventListener('click', (e) => {
                const target = e.target && e.target.closest ? e.target.closest('a,button') : null;
                if (target) closeMenu();
            });

            // Inject Changelog into the mobile dropdown (reuses existing footer popup)
            try {
                let changelogLink = document.getElementById('changelogLink');
                if (!changelogLink) {
                    changelogLink = document.createElement('a');
                    changelogLink.href = '#';
                    changelogLink.id = 'changelogLink';
                    changelogLink.className = 'header-link';
                    const existing = document.getElementById('changelogBtn');
                    const label = (existing && existing.textContent && existing.textContent.trim()) ? existing.textContent.trim() : 'Changelog';
                    changelogLink.textContent = label;
                    headerLinks.appendChild(changelogLink);
                }
                if (changelogLink.dataset.wired !== 'true') {
                    changelogLink.dataset.wired = 'true';
                    changelogLink.addEventListener('click', (e) => {
                        e.preventDefault();
                        const btn = document.getElementById('changelogBtn');
                        if (btn) btn.click();
                    });
                }
            } catch { /* ignore */ }

            // Close on outside click
            document.addEventListener('click', (e) => {
                if (!headerRight.contains(e.target)) closeMenu();
            });

            // Close on Escape (useful on desktop dev tools)
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') closeMenu();
            });

            // Also close if any of the header links run their handler
            const closeOnActivate = (el) => {
                try {
                    el?.addEventListener('click', () => closeMenu());
                } catch { /* ignore */ }
            };
            closeOnActivate(optionsLink);
            closeOnActivate(saveLink);
            closeOnActivate(loadLink);
        }
    } catch (e) {
        /* ignore */
    }

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
        resetButton.addEventListener('click', async () => {
            const needsConfirm = getConfirmOnReset();
            const ok = !needsConfirm || await showConfirmPopup({
                title: 'Reset Progress',
                message: 'Are you sure you want to reset your progress? This cannot be undone.',
                confirmText: 'Reset',
                cancelText: 'Cancel'
            });
            if (ok) {
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
            (async () => {
                const needsConfirm = getConfirmOnLoad();
                const ok = !needsConfirm || await showConfirmPopup({
                    title: 'Load Last Save',
                    message: 'Load your last save? Any unsaved progress will be lost.',
                    confirmText: 'Load',
                    cancelText: 'Cancel'
                });
                if (ok) {
                    localStorage.removeItem('isResetting');
                    location.reload();
                }
            })();
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