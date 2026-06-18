import { saveGameState } from '../../engine/saveload.js';
import { getIngameTimeString, getTotalIngameMinutes } from '../../engine/time.js';
import { setupTooltip } from '../panels/tooltip.js';
import { gameFlags } from '../../engine/gameFlags.js';
import { getConfirmOnLoad, getConfirmOnReset } from '../../engine/settings.js';
import { showConfirmPopup } from '../panels/confirmPopup.js';
import { t } from '../../locales/locales.js';

document.addEventListener('DOMContentLoaded', () => {

    const optionsLink = document.getElementById('optionsLink');
    const optionsMenu = document.getElementById('optionsMenu');
    const closeButton = optionsMenu?.querySelector('.options-menu-close');
    const resetButton = document.getElementById('resetButton');
    const saveLink = document.getElementById('saveLink');
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
                title: t('confirm_reset_title'),
                message: t('confirm_reset_msg'),
                confirmText: t('confirm_reset_confirm'),
                cancelText: t('confirm_reset_cancel')
            });
            if (ok) {
                // Clear ALL save data so the game boots to title screen with no saved state.
                try {
                    localStorage.removeItem('gameState');
                    localStorage.removeItem('characterStateV1');
                    localStorage.removeItem('logSettings');
                    localStorage.removeItem('activatedSections');
                    localStorage.removeItem('currentSection');
                    localStorage.removeItem('objectivesStatus');
                    localStorage.removeItem('isResetting');
                    localStorage.removeItem('autoContinueAfterReload');
                    // Keep user preferences (language, glow, settings).
                } catch { /* ignore */ }
                location.reload();
            }
        });
    }
    // Title button in options menu
    const optionsTitleBtn = document.getElementById('optionsTitleBtn');
    if (optionsTitleBtn && optionsTitleBtn.dataset.wired !== 'true') {
        optionsTitleBtn.dataset.wired = 'true';
        optionsTitleBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                hideOptionsMenu();
                const mod = await import('../screens/titleScreen.js');
                mod.showTitleScreen();
            } catch { /* ignore */ }
        });
    }

    // Language flag buttons in options menu
    function wireLangFlagButton(id, lang) {
        const btn = document.getElementById(id);
        if (!btn || btn.dataset.wired === 'true') return;
        btn.dataset.wired = 'true';
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const ok = await showConfirmPopup({
                title: t('confirm_lang_change_title'),
                message: t('confirm_lang_change_msg'),
                confirmText: t('confirm_lang_change_confirm'),
                cancelText: t('confirm_lang_change_cancel')
            });
            if (!ok) return;
            // Set auto-continue so in-game language switch resumes the game, not title screen.
            try { localStorage.setItem('autoContinueAfterReload', 'true'); } catch { /* ignore */ }
            import('../../locales/locales.js').then(m => {
                m.setLanguage(lang);
                updateAllFlagStates();
            }).catch(() => {});
        });
    }
    wireLangFlagButton('optLangEn', 'en');
    wireLangFlagButton('optLangCs', 'cs');

    // Header language flag — display only (switching is done in Options menu)
    const headerFlag = document.getElementById('headerLangFlag');
    const FLAG_SVGS = {
        en: '<svg viewBox="0 0 60 40" class="flag-icon"><rect width="60" height="40" fill="#012169"/><path d="M0 0l60 40M60 0L0 40" stroke="#fff" stroke-width="6"/><path d="M0 0l60 40M60 0L0 40" stroke="#C8102E" stroke-width="3"/><rect width="18" height="40" fill="#012169" x="21"/><rect width="60" height="14" fill="#012169" y="13"/><path d="M30 0v40M0 20h60" stroke="#fff" stroke-width="10"/><path d="M30 0v40M0 20h60" stroke="#C8102E" stroke-width="4"/></svg>',
        cs: '<svg viewBox="0 0 60 40" class="flag-icon"><rect width="60" height="20" fill="#fff"/><rect y="20" width="60" height="20" fill="#D7141A"/><polygon points="0,0 25,20 0,40" fill="#11457E"/></svg>'
    };

    function updateAllFlagStates() {
        const lang = (() => {
            try { const ls = localStorage.getItem('gameLanguage'); return ls && (ls === 'en' || ls === 'cs') ? ls : 'en'; }
            catch { return 'en'; }
        })();
        // Options menu flag buttons
        ['optLangEn','optLangCs'].forEach(id => {
            const b = document.getElementById(id);
            if (b) b.classList.toggle('active', b.dataset.lang === lang);
        });
        // Title screen flag buttons
        ['titleLangEn','titleLangCs'].forEach(id => {
            const b = document.getElementById(id);
            if (b) b.classList.toggle('active', b.dataset.lang === lang);
        });
        // Header flag indicator (display only, no click action)
        if (headerFlag) {
            headerFlag.innerHTML = FLAG_SVGS[lang] || '';
            headerFlag.title = lang === 'en' ? 'English' : 'Čeština';
        }
    }
    updateAllFlagStates();
    window.addEventListener('language-changed', () => {
        updateAllFlagStates();
        refreshHeaderLabels();
        refreshLogHeader();
        refreshLocaleElements();
    });
    // Header flag is display-only — no click handler needed.

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
                    title: t('confirm_load_title'),
                    message: t('confirm_load_msg'),
                    confirmText: t('confirm_load_confirm'),
                    cancelText: t('confirm_load_cancel')
                });
                if (ok) {
                    localStorage.removeItem('isResetting');
                    try { localStorage.setItem('autoContinueAfterReload', 'true'); } catch { /* ignore */ }
                    location.reload();
                }
            })();
        });
    }

    // Update header link labels
    function refreshHeaderLabels() {
        if (optionsLink) optionsLink.textContent = t('header_options');
        if (saveLink) saveLink.textContent = t('header_save');
        if (loadLink) loadLink.textContent = t('header_load');
    }
    refreshHeaderLabels();

    // Translate log header
    function refreshLogHeader() {
        const logTitle = document.getElementById('logHeaderTitle');
        if (logTitle) logTitle.textContent = t('log_entries');
    }
    refreshLogHeader();

    // Scan and translate all [data-locale] elements
    function refreshLocaleElements() {
        document.querySelectorAll('[data-locale]').forEach(el => {
            const key = el.dataset.locale;
            if (key) el.textContent = t(key);
        });
    }
    refreshLocaleElements();


    // Setup tooltip for clock
    try {
        const clockEl = document.getElementById('headerClock');
        if (clockEl) {
            setupTooltip(clockEl, () => {
                const timeStr = getIngameTimeString();
                const total = Math.max(0, getTotalIngameMinutes());
                const d = Math.floor(total / (60 * 24));
                const h = Math.floor((total % (60 * 24)) / 60);
                const m = total % 60;
                const loop = (gameFlags && Number.isFinite(gameFlags.loopCount)) ? gameFlags.loopCount : 0;
                const scale = Number(window.TIME_SCALE || localStorage.getItem('gameTimeScale') || 1) || 1;
                const speedText = t('clock_speed', { scale });
                const loopHtml = loop > 0 ? `<p>${t('clock_loop')}: <strong>${loop}</strong></p>` : '';
                return `
                    <h4>${t('clock_title')}</h4>
                    <p><strong>${timeStr}</strong></p>
                    <div class="tooltip-section">
                        <p>${t('clock_elapsed')}: <strong>${d}d ${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m</strong></p>
                        ${loopHtml}
                        <p class="tooltip-detail">${speedText}</p>
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