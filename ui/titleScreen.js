import { showConfirmPopup } from './panels/confirmPopup.js';

const BODY_CLASS = 'title-screen-active';

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
                title: 'New Game',
                message: 'Start a new game? This will overwrite your current save.',
                confirmText: 'New Game',
                cancelText: 'Cancel',
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
                menu.classList.remove('hidden');
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

    if (exitBtn && exitBtn.dataset.wired !== 'true') {
        exitBtn.dataset.wired = 'true';
        exitBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const ok = await showConfirmPopup({
                title: 'Exit',
                message: 'Exit the game?',
                confirmText: 'Exit',
                cancelText: 'Cancel',
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
