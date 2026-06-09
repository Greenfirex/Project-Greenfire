import { showConfirmPopup } from '../panels/confirmPopup.js';
import { getSelectedLanguage, setLanguage, t } from '../../locales/locales.js';

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

    try {
        setHiddenWithInert(document.getElementById('header'), false);
        setHiddenWithInert(document.getElementById('mainContainer'), false);
        setHiddenWithInert(document.getElementById('footer'), false);
    } catch { /* ignore */ }
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
        langEnBtn.addEventListener('click', (e) => {
            e.preventDefault();
            setLanguage('en');
            updateFlagActiveState();
            updateTitleScreenText();
        });
    }

    if (langCsBtn && langCsBtn.dataset.wired !== 'true') {
        langCsBtn.dataset.wired = 'true';
        langCsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            setLanguage('cs');
            updateFlagActiveState();
            updateTitleScreenText();
        });
    }

    updateFlagActiveState();

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
                // Web/PWA fallback: we can’t reliably close the app.
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
