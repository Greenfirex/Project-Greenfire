import { saveGameState } from './saveload.js';
import { getIngameTimeString } from './time.js';

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
        }
    }

    function hideOptionsMenu() {
        if (optionsMenu) {
            optionsMenu.classList.add('hidden');
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
});

// This handles the clock at the top of the screen
function updateTime() {
    const clockEl = document.getElementById('headerClock');
    if (!clockEl) return;
    // show in-game time
    clockEl.textContent = getIngameTimeString();
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