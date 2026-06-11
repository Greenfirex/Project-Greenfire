import { showConfirmPopup } from '../panels/confirmPopup.js';
import { getSelectedLanguage, setLanguage, t, isReady } from '../../locales/locales.js';
import { preloader } from '../system/preloader.js';

const BODY_CLASS = 'title-screen-active';

export function updateTitleScreenText() {
    const set = (id, key) => {
        const el = document.getElementById(id);
        if (el) el.textContent = t(key);
    };
    set('titleContinueBtn', 'title_continue');
    set('titleNewGameBtn', 'title_new_game');
    set('titleSettingsBtn', 'title_settings');
    set('titleChangelogBtn', 'title_changelog');
    set('titleExitBtn', 'title_exit');
}

function setHiddenWithInert(el, hidden) {
    if (!el) return;
    try {
        el.setAttribute('aria-hidden', hidden ? 'true' : 'false');
    } catch { /* ignore */ }

    try {
        el.inert = !!hidden;
    } catch { /* ignore */ }
    try {
        if (hidden) el.setAttribute('inert', '');
        else el.removeAttribute('inert');
    } catch { /* ignore */ }
}

function hasSaveGame() {
    try {
        const raw = localStorage.getItem('gameState');
        return !!raw && raw.length > 10;
    } catch {
        return false;
    }
}

function canExitApp() {
    try {
        if (typeof navigator !== 'undefined' && navigator.app && typeof navigator.app.exitApp === 'function') return true;
    } catch { /* ignore */ }

    try {
        const cap = window.Capacitor;
        const plugin = cap?.Plugins?.App;
        const isNative = typeof cap?.isNativePlatform === 'function' ? !!cap.isNativePlatform() : false;
        const platform = typeof cap?.getPlatform === 'function' ? String(cap.getPlatform()) : '';
        if (isNative && platform.toLowerCase() === 'android' && plugin && typeof plugin.exitApp === 'function') return true;
    } catch { /* ignore */ }

    return false;
}

async function tryExitApp() {
    try {
        if (typeof navigator !== 'undefined' && navigator.app && typeof navigator.app.exitApp === 'function') {
            navigator.app.exitApp();
            return true;
        }
    } catch { /* ignore */ }

    try {
        const cap = window.Capacitor;
        const plugin = cap?.Plugins?.App;
        const isNative = typeof cap?.isNativePlatform === 'function' ? !!cap.isNativePlatform() : false;
        const platform = typeof cap?.getPlatform === 'function' ? String(cap.getPlatform()) : '';
        if (isNative && platform.toLowerCase() === 'android' && plugin && typeof plugin.exitApp === 'function') {
            await plugin.exitApp();
            return true;
        }
    } catch { /* ignore */ }

    return false;
}

// ==========================================================================
// Power-on assembly animation via Web Animations API
// ==========================================================================

const POWER_EASING = 'cubic-bezier(0.22, 0.61, 0.36, 1)';

function animateElement(el, keyframes, options) {
    if (!el || !el.animate) return;
    try {
        el.animate(keyframes, { fill: 'both', easing: POWER_EASING, ...options });
    } catch { /* ignore */ }
}

function playPowerOnAssembly() {
    // Header slides down
    animateElement(document.getElementById('header'), [
        { transform: 'translateY(-100%)', opacity: 0 },
        { transform: 'translateY(0)', opacity: 1, offset: 0.3 },
        { transform: 'translateY(0)', opacity: 1 }
    ], { duration: 1400 });

    // Main menu slides from left with 3D tilt
    animateElement(document.getElementById('mainMenu'), [
        { transform: 'translateX(-100%) perspective(600px) rotateY(8deg)', opacity: 0 },
        { transform: 'translateX(-10%) perspective(600px) rotateY(1deg)', opacity: 0.5, offset: 0.4 },
        { transform: 'translateX(0) perspective(600px) rotateY(0deg)', opacity: 1 }
    ], { duration: 1600, delay: 300 });

    // Info panel slides from right
    animateElement(document.getElementById('infoPanel'), [
        { transform: 'translateX(100%)', opacity: 0 },
        { transform: 'translateX(0)', opacity: 0.4, offset: 0.3 },
        { transform: 'translateX(0)', opacity: 1 }
    ], { duration: 1600, delay: 500 });

    // Footer rises up (before game area)
    animateElement(document.getElementById('footer'), [
        { transform: 'translateY(100%)', opacity: 0 },
        { transform: 'translateY(0)', opacity: 0.5, offset: 0.5 },
        { transform: 'translateY(0)', opacity: 1 }
    ], { duration: 1400, delay: 700 });

    // Game area — "Terminal Boot" effect (CRT power-on)
    animateElement(document.getElementById('gameArea'), [
        { opacity: 0, transform: 'scale(0.97)', filter: 'brightness(0)' },
        { filter: 'brightness(2.5)', offset: 0.15 },
        { opacity: 0.2, filter: 'brightness(0.6)', offset: 0.35 },
        { opacity: 1, transform: 'scale(1)', filter: 'brightness(1)' }
    ], { duration: 1800, delay: 1600, easing: 'ease-out' });

    // Menu buttons stagger in
    const menuBtns = document.querySelectorAll('.menu-button');
    menuBtns.forEach((btn, i) => {
        animateElement(btn, [
            { opacity: 0, transform: 'translateY(20px) scale(0.85)' },
            { opacity: 1, transform: 'translateY(0) scale(1)' }
        ], { duration: 1000, delay: 1200 + i * 240, easing: 'ease-out' });
    });

    // Prevent popups from appearing during assembly. CSS hides them under this class.
    document.body.classList.add('ui-assembling');

    // After assembly finishes (~3.8s), remove the lock so popups animate in.
    setTimeout(() => {
        document.body.classList.remove('ui-assembling');
    }, 3800);
}

// ==========================================================================
// Public API
// ==========================================================================

export function showTitleScreen() {
    const overlay = document.getElementById('titleScreen');
    if (!overlay) return;

    try { overlay.hidden = false; } catch { /* ignore */ }
    overlay.classList.remove('hidden');
    document.body.classList.add(BODY_CLASS);

    // Prevent focus/tabbing into the game UI.
    try {
        setHiddenWithInert(document.getElementById('header'), true);
        setHiddenWithInert(document.getElementById('mainContainer'), true);
        setHiddenWithInert(document.getElementById('footer'), true);
    } catch { /* ignore */ }

    setHiddenWithInert(overlay, false);

    // Translate button text (always, so they're correct after a language-switch reload).
    updateTitleScreenText();

    // Signal title screen is partially ready (needs translations to be fully ready).
    preloader.progress('titleScreen', 0.5, 'Preparing title...');

    // If translations are already done (e.g. language-changed fired before we attached
    // the listener), mark the title screen fully ready now so the preloader can dismiss.
    if (isReady()) {
        preloader.progress('titleScreen', 1);
    }

    // Update button states.
    const continueBtn = document.getElementById('titleContinueBtn');
    if (continueBtn) continueBtn.disabled = !hasSaveGame();

    const exitBtn = document.getElementById('titleExitBtn');
    if (exitBtn) exitBtn.hidden = !canExitApp();

    // Focus first available primary action.
    try {
        const focusTarget = (continueBtn && !continueBtn.disabled) ? continueBtn : document.getElementById('titleNewGameBtn');
        focusTarget?.focus?.({ preventScroll: true });
    } catch { /* ignore */ }
}

export function hideTitleScreen() {
    const overlay = document.getElementById('titleScreen');
    if (!overlay) return;

    overlay.classList.add('hidden');
    try { overlay.hidden = true; } catch { /* ignore */ }
    setHiddenWithInert(overlay, true);

    document.body.classList.remove(BODY_CLASS);

    // Force a style recalculation so the game UI elements are at their natural
    // state (visible, no transforms) before we animate them.
    void document.body.offsetWidth;

    // Reveal game UI for accessibility/focus.
    try {
        setHiddenWithInert(document.getElementById('header'), false);
        setHiddenWithInert(document.getElementById('mainContainer'), false);
        setHiddenWithInert(document.getElementById('footer'), false);
    } catch { /* ignore */ }

    // Play the power-on assembly animation using Web Animations API.
    // This bypasses browser class-change batching and guarantees playback.
    playPowerOnAssembly();
}

export function initTitleScreen({
    onContinue,
    onNewGame,
} = {}) {
    const overlay = document.getElementById('titleScreen');
    if (!overlay) return;

    // Start hidden by default; caller decides when to show.
    try { overlay.hidden = true; } catch { /* ignore */ }
    try { overlay.classList.add('hidden'); } catch { /* ignore */ }
    setHiddenWithInert(overlay, true);

    const continueBtn = document.getElementById('titleContinueBtn');
    const newBtn = document.getElementById('titleNewGameBtn');
    const settingsBtn = document.getElementById('titleSettingsBtn');
    const changelogBtn = document.getElementById('titleChangelogBtn');
    const exitBtn = document.getElementById('titleExitBtn');

    const lockButtons = (locked) => {
        [continueBtn, newBtn, settingsBtn, changelogBtn, exitBtn].forEach((b) => {
            if (!b) return;
            try { b.disabled = !!locked; } catch { /* ignore */ }
        });
    };

    if (continueBtn && continueBtn.dataset.wired !== 'true') {
        continueBtn.dataset.wired = 'true';
        continueBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (!hasSaveGame()) return;
            lockButtons(true);
            try { hideTitleScreen(); } catch { /* ignore */ }
            try { onContinue?.(); } catch { /* ignore */ }
        });
    }

    if (newBtn && newBtn.dataset.wired !== 'true') {
        newBtn.dataset.wired = 'true';
        newBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const ok = await showConfirmPopup({
                title: t('confirm_new_game_title'),
                message: t('confirm_new_game_msg'),
                confirmText: t('confirm_new_game_confirm'),
                cancelText: t('confirm_new_game_cancel'),
            });
            if (!ok) return;
            lockButtons(true);
            try { hideTitleScreen(); } catch { /* ignore */ }
            try { onNewGame?.(); } catch { /* ignore */ }
        });
    }

    if (settingsBtn && settingsBtn.dataset.wired !== 'true') {
        settingsBtn.dataset.wired = 'true';
        settingsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const menu = document.getElementById('optionsMenu');
            if (menu) {
                try { menu.hidden = false; } catch { /* ignore */ }
                menu.classList.remove('hidden');
                try { menu.style.display = ''; } catch { /* ignore */ }
                try { window.dispatchEvent(new CustomEvent('popup-open')); } catch { /* ignore */ }
            }
        });
    }

    if (changelogBtn && changelogBtn.dataset.wired !== 'true') {
        changelogBtn.dataset.wired = 'true';
        changelogBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const btn = document.getElementById('changelogBtn');
            if (btn) btn.click();
        });
    }

    // Language flag buttons
    const langEnBtn = document.getElementById('titleLangEn');
    const langCsBtn = document.getElementById('titleLangCs');

    function updateFlagActiveState() {
        const lang = getSelectedLanguage();
        if (langEnBtn) langEnBtn.classList.toggle('active', lang === 'en');
        if (langCsBtn) langCsBtn.classList.toggle('active', lang === 'cs');
    }

    if (langEnBtn && langEnBtn.dataset.wired !== 'true') {
        langEnBtn.dataset.wired = 'true';
        langEnBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const ok = await showConfirmPopup({
                title: t('confirm_lang_change_title'),
                message: t('confirm_lang_change_msg'),
                confirmText: t('confirm_lang_change_confirm'),
                cancelText: t('confirm_lang_change_cancel')
            });
            if (!ok) return;
            setLanguage('en');
            updateFlagActiveState();
            updateTitleScreenText();
        });
    }

    if (langCsBtn && langCsBtn.dataset.wired !== 'true') {
        langCsBtn.dataset.wired = 'true';
        langCsBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const ok = await showConfirmPopup({
                title: t('confirm_lang_change_title'),
                message: t('confirm_lang_change_msg'),
                confirmText: t('confirm_lang_change_confirm'),
                cancelText: t('confirm_lang_change_cancel')
            });
            if (!ok) return;
            setLanguage('cs');
            updateFlagActiveState();
            updateTitleScreenText();
        });
    }

    updateFlagActiveState();

    // Re-translate title buttons whenever translations finish loading asynchronously
    // (e.g. Czech JSON files arrive after the title screen is already visible).
    window.addEventListener('language-changed', () => {
        updateTitleScreenText();
        // Title screen is now fully ready with correct translations.
        preloader.progress('titleScreen', 1, 'Title screen ready');
    });

    if (exitBtn && exitBtn.dataset.wired !== 'true') {
        exitBtn.dataset.wired = 'true';
        exitBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const ok = await showConfirmPopup({
                title: t('confirm_exit_title'),
                message: t('confirm_exit_msg'),
                confirmText: t('confirm_exit_confirm'),
                cancelText: t('confirm_exit_cancel'),
            });
            if (!ok) return;

            const exited = await tryExitApp();
            if (!exited) {
                // Web/PWA fallback: we can't reliably close the app.
                await showConfirmPopup({
                    title: 'Exit not available',
                    message: 'On web/PWA, the game cannot close itself. Please close the tab or swipe away the app.',
                    confirmText: 'OK',
                    cancelText: 'OK',
                });
            }
        });
    }
}
