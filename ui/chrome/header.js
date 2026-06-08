import { saveGameState } from '../../core/saveload.js';
import { getIngameTimeString, getTotalIngameMinutes } from '../../core/time.js';
import { setupTooltip } from '../panels/tooltip.js';
import { getConfirmOnLoad, getConfirmOnReset } from '../../core/settings.js';
import { showConfirmPopup } from '../panels/confirmPopup.js';

document.addEventListener('DOMContentLoaded', () => {

    const optionsLink = document.getElementById('optionsLink');
    const optionsMenu = document.getElementById('optionsMenu');
    const closeButton = optionsMenu?.querySelector('.options-menu-close');
    const resetButton = document.getElementById('resetButton');
    const saveLink = document.getElementById('saveLink');
    const titleLink = document.getElementById('titleLink');
    const loadLink = document.getElementById('loadLink');

    // --- Mobile dropdown for Options/Save/Load ---
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
                menuBtn.textContent = '...';
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

            headerLinks.addEventListener('click', (e) => {
                const target = e.target && e.target.closest ? e.target.closest('a,button') : null;
                if (target) closeMenu();
            });

            // Inject Changelog into the mobile dropdown
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

            document.addEventListener('click', (e) => {
                if (!headerRight.contains(e.target)) closeMenu();
            });

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') closeMenu();
            });

            const closeOnActivate = (el) => {
                try { el?.addEventListener('click', () => closeMenu()); } catch { /* ignore */ }
            };
            closeOnActivate(optionsLink);
            closeOnActivate(saveLink);
            closeOnActivate(loadLink);
        }
    } catch (e) { /* ignore */ }

    function showOptionsMenu(event) {
        event.preventDefault();
        if (optionsMenu) {
            try { optionsMenu.hidden = false; } catch { /* ignore */ }
            optionsMenu.classList.remove('hidden');
            try { optionsMenu.style.display = ''; } catch { /* ignore */ }
            try { window.dispatchEvent(new CustomEvent('popup-open')); } catch (e) { /* ignore */ }
        }
    }

    function hideOptionsMenu() {
        if (optionsMenu) {
            optionsMenu.classList.add('hidden');
            try { optionsMenu.hidden = true; } catch { /* ignore */ }
            try { optionsMenu.style.display = ''; } catch { /* ignore */ }
            try { window.dispatchEvent(new CustomEvent('popup-close')); } catch (e) { /* ignore */ }
        }
    }

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
    if (titleLink) {
        titleLink.addEventListener('click', (e) => {
            e.preventDefault();
            (async () => {
                try {
                    const mod = await import('../screens/titleScreen.js');
                    mod.showTitleScreen();
                } catch { /* ignore */ }
            })();
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
                    try { localStorage.setItem('autoContinueAfterReload', 'true'); } catch { /* ignore */ }
                    location.reload();
                }
            })();
        });
    }

    // Setup tooltip for clock
    try {
        const clockEl = document.getElementById('headerClock');
        if (clockEl) {
            setupTooltip(clockEl, () => {
                const timeStr = getIngameTimeString();
                const total = getTotalIngameMinutes();
                const elapsed = Math.max(0, Math.floor(total - 60));
                const d = Math.floor(elapsed / (60 * 24));
                const h = Math.floor((elapsed % (60 * 24)) / 60);
                const m = elapsed % 60;
                const scale = Number(window.TIME_SCALE || localStorage.getItem('gameTimeScale') || 1) || 1;
                const minsPerSec = 5 * scale;
                const hoursPerMin = 5 * scale;
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
});

function updateTime() {
    const clockEl = document.getElementById('headerClock');
    if (clockEl) {
        clockEl.textContent = getIngameTimeString();
    }
}

setInterval(updateTime, 1000);
updateTime();

document.addEventListener('game-state-applied', () => {
    updateTime();
});

export function refreshClock() {
    updateTime();
}