import { showConfirmPopup } from '../panels/confirmPopup.js';
import { getSelectedLanguage, setLanguage, t, isReady } from '../../locales/locales.js';
import { preloader } from '../system/preloader.js';

const BODY_CLASS = 'title-screen-active';
const EXIT_ANIM_DURATION = 600; // matches CSS card-exiting animation

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

/**
 * Play the assembly animation and optionally dismiss intro background.
 * @param {Object} [opts]
 * @param {boolean} [opts.dismissIntroBg=false] - fade out the intro background during assembly
 * @param {Function} [opts.onComplete] - callback after assembly done (~3.8s)
 */
function playPowerOnAssembly(opts = {}) {
    const { dismissIntroBg = false, onComplete } = opts;

    // Header slides down
    animateElement(document.getElementById('header'), [
        { transform: 'translateY(-100%)', opacity: 0 },
        { transform: 'translateY(0)', opacity: 1, offset: 0.3 },
        { transform: 'translateY(0)', opacity: 1 }
    ], { duration: 1400 });

    // Main menu slides from left
    animateElement(document.getElementById('mainMenu'), [
        { transform: 'translateX(-100%)', opacity: 0 },
        { transform: 'translateX(0)', opacity: 0.4, offset: 0.3 },
        { transform: 'translateX(0)', opacity: 1 }
    ], { duration: 1600, delay: 300 });

    // Info panel slides from right
    animateElement(document.getElementById('infoPanel'), [
        { transform: 'translateX(100%)', opacity: 0 },
        { transform: 'translateX(0)', opacity: 0.4, offset: 0.3 },
        { transform: 'translateX(0)', opacity: 1 }
    ], { duration: 1600, delay: 300 });

    // Footer rises up (before game area)
    animateElement(document.getElementById('footer'), [
        { transform: 'translateY(100%)', opacity: 0 },
        { transform: 'translateY(0)', opacity: 0.5, offset: 0.5 },
        { transform: 'translateY(0)', opacity: 1 }
    ], { duration: 1400, delay: 700 });

    // Game area — grow-in effect
    animateElement(document.getElementById('gameArea'), [
        { opacity: 0, transform: 'scale(0.97)' },
        { opacity: 1, transform: 'scale(1)' }
    ], { duration: 1800, delay: 1600, easing: 'ease-out' });

    // Menu buttons stagger in
    const menuBtns = document.querySelectorAll('.menu-button');
    menuBtns.forEach((btn, i) => {
        animateElement(btn, [
            { opacity: 0, transform: 'translateY(20px) scale(0.85)' },
            { opacity: 1, transform: 'translateY(0) scale(1)' }
        ], { duration: 1000, delay: 1200 + i * 240, easing: 'ease-out' });
    });

    // --- Panel content animations (staggered within assembly window) ---

    // Log section — fade in + slide up
    animateElement(document.getElementById('logSection'), [
        { opacity: 0, transform: 'translateY(12px)' },
        { opacity: 1, transform: 'translateY(0)' }
    ], { duration: 600, delay: 1000, easing: 'ease-out' });

    // Info sub-panels (Resources, Effects, Queue) — staggered
    const infoSubPanels = document.querySelectorAll('#infoPanelContent .info-sub-panel');
    infoSubPanels.forEach((panel, i) => {
        animateElement(panel, [
            { opacity: 0, transform: 'translateY(8px)' },
            { opacity: 1, transform: 'translateY(0)' }
        ], { duration: 500, delay: 1800 + i * 250, easing: 'ease-out' });
    });

    // Location tiles — staggered entrance
    const locationTiles = document.querySelectorAll('[id^="locations"][id$="Tile"]');
    locationTiles.forEach((tile, i) => {
        animateElement(tile, [
            { opacity: 0, transform: 'translateY(16px)' },
            { opacity: 1, transform: 'translateY(0)' }
        ], { duration: 550, delay: 2000 + i * 200, easing: 'ease-out' });
    });

    // Action buttons — staggered after location tiles
    const actionBtns = document.querySelectorAll('.location-action-btn');
    actionBtns.forEach((btn, i) => {
        animateElement(btn, [
            { opacity: 0, transform: 'translateY(10px) scale(0.95)' },
            { opacity: 1, transform: 'translateY(0) scale(1)' }
        ], { duration: 400, delay: 2500 + i * 65, easing: 'ease-out' });
    });

    // Footer action buttons — fade in + slide up
    const footerBtns = document.querySelectorAll('#footerControls .header-link');
    footerBtns.forEach((btn, i) => {
        animateElement(btn, [
            { opacity: 0, transform: 'translateY(8px)' },
            { opacity: 1, transform: 'translateY(0)' }
        ], { duration: 450, delay: 2700 + i * 100, easing: 'ease-out' });
    });

    // Prevent popups from appearing during assembly.
    document.body.classList.add('ui-assembling');

    const assemblyDuration = 5000;

    if (dismissIntroBg) {
        // Start the overlay fade-out immediately
        const overlay = document.getElementById('titleScreen');
        if (overlay) overlay.classList.add('intro-bg-fading');

        // Fully hide the overlay after the fade-out transition completes (0.8s via CSS)
        setTimeout(() => {
            const overlay = document.getElementById('titleScreen');
            if (overlay) {
                overlay.classList.add('hidden');
                try { overlay.hidden = true; } catch { /* ignore */ }
                setHiddenWithInert(overlay, true);
                overlay.classList.remove('intro-bg-fading');
            }
            document.body.classList.remove(BODY_CLASS);
        }, 900);
    }

    // After assembly finishes, remove the lock and fire callback
    setTimeout(() => {
        document.body.classList.remove('ui-assembling');
        if (typeof onComplete === 'function') {
            onComplete();
        }
    }, assemblyDuration);
}

// ==========================================================================
// Panel activation stagger (called after startGame initializes UI)
// ==========================================================================

/**
 * Stagger-activate the info sub-panels for a polished intro.
 * Called after startGame() has fully rendered all sections.
 */
export function playPanelActivationSequence() {
    const panelContent = document.getElementById('infoPanelContent');
    if (!panelContent) return;

    const sections = panelContent.querySelectorAll('.info-sub-panel');
    sections.forEach((section, i) => {
        // Start hidden
        section.style.opacity = '0';
        section.style.transform = 'translateY(12px)';
        section.style.transition = 'opacity 0.4s ease-out, transform 0.4s ease-out';

        setTimeout(() => {
            section.style.opacity = '1';
            section.style.transform = 'translateY(0)';
        }, i * 200);
    });

    // Stagger the location action buttons too
    setTimeout(() => {
        const actionBtns = document.querySelectorAll('.location-action-btn');
        actionBtns.forEach((btn, i) => {
            btn.style.opacity = '0';
            btn.style.transform = 'translateY(10px) scale(0.95)';
            btn.style.transition = 'opacity 0.35s ease-out, transform 0.35s ease-out';

            setTimeout(() => {
                btn.style.opacity = '';
                btn.style.transform = '';
            }, i * 60);
        });
    }, 400);
}

// ==========================================================================
// Public API
// ==========================================================================

export function showTitleScreen() {
    const overlay = document.getElementById('titleScreen');
    if (!overlay) return;

    // Set initial states for smooth simultaneous entrance.
    const logo = overlay.querySelector('.title-screen-logo');
    const flags = Array.from(overlay.querySelectorAll('.title-screen-flag'));
    const menuBtns = Array.from(overlay.querySelectorAll('.title-screen-btn'));
    const allElements = [logo, ...flags, ...menuBtns].filter(Boolean);

    allElements.forEach(el => {
        el.style.opacity = '0';
    });

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

    // Smooth simultaneous fade-in for all title screen elements.
    allElements.forEach(el => {
        try {
            el.animate([
                { opacity: 0 },
                { opacity: 1 }
            ], { duration: 500, delay: 100, fill: 'forwards', easing: 'ease-out' });
        } catch { /* ignore */ }
    });

    // Translate button text (always, so they're correct after a language-switch reload).
    updateTitleScreenText();

    // Signal title screen is partially ready (needs translations to be fully ready).
    preloader.progress('titleScreen', 0.5, 'Preparing title...');

    // If translations are already done, mark the title screen fully ready.
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

/**
 * Standard hide — used for Continue mode (old behavior: hide overlay, play assembly, fire callback).
 */
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

    // Play the power-on assembly animation.
    playPowerOnAssembly();
}

/**
 * Orchestrated new game intro:
 *   1. Card exits with animation (background stays)
 *   2. Story popup shows over the intro background
 *   3. Player reads & clicks Close
 *   4. Assembly animation plays (background fades out)
 *   5. startGame() fires via callback (no race condition possible)
 *
 * @param {Object} opts
 * @param {Function} opts.onStartGame - called after assembly to init the game
 */
async function playNewGameIntroSequence({ onStartGame }) {
    const overlay = document.getElementById('titleScreen');
    const card = overlay ? overlay.querySelector('.title-screen-card') : null;

    // 1. Exit card animation (overlay already shows background3.jpg by default)
    if (card) {
        card.classList.add('card-exiting');
    }
    await new Promise(r => setTimeout(r, EXIT_ANIM_DURATION));

    // 2. Hide the card
    if (card) {
        card.style.display = 'none';
    }

    // 3. Show story popup over the background image (transparentBg so image shows through)
    //    Defer the in-game log entry since the log DOM doesn't exist yet.
    const popupEvent = {
        id: 'welcome_intro',
        title: t('popup_welcome_title'),
        titleKey: 'popup_welcome_title',
        pages: [t('popup_welcome_page1'), t('popup_welcome_page2'), t('popup_welcome_page3')],
        pageKeys: ['popup_welcome_page1', 'popup_welcome_page2', 'popup_welcome_page3'],
        transparentBg: true,
        deferLog: true,
    };
    try {
        const popupMod = await import('../panels/storyPopup.js');
        await new Promise((resolve) => {
            popupEvent.onClose = () => resolve();
            popupMod.showStoryPopup(popupEvent);
        });
    } catch {
        // If popup fails, still proceed with assembly
    }

    // 4. Initialize the game now that the player has finished reading.
    if (typeof onStartGame === 'function') {
        onStartGame();
    }

    // Log the journal entry now that the game UI (including log) is built
    if (popupEvent._deferredLogTitle) {
        try {
            const { addLogEntry, LogType } = await import('../../engine/ingameLog.js');
            const { t: translate } = await import('../../locales/locales.js');
            addLogEntry(translate('log_story_entry', { title: popupEvent._deferredLogTitle }), LogType.STORY);
        } catch { /* ignore */ }
    }

    // Small delay to let sections render before assembly
    await new Promise(r => setTimeout(r, 150));

    // 5. Reveal game UI and play assembly
    //    Set inline starting states so elements don't flash visible before animation.
    const header = document.getElementById('header');
    const mainContainer = document.getElementById('mainContainer');
    const footer = document.getElementById('footer');
    const gameArea = document.getElementById('gameArea');
    const infoPanel = document.getElementById('infoPanel');
    const mainMenu = document.getElementById('mainMenu');
    const menuBtns = document.querySelectorAll('.menu-button');

    if (header) { header.style.opacity = '0'; header.style.transform = 'translateY(-100%)'; }
    if (mainMenu) { mainMenu.style.opacity = '0'; mainMenu.style.transform = 'translateX(-100%)'; }
    if (infoPanel) { infoPanel.style.opacity = '0'; infoPanel.style.transform = 'translateX(100%)'; }
    if (footer) { footer.style.opacity = '0'; footer.style.transform = 'translateY(100%)'; }
    if (gameArea) { gameArea.style.opacity = '0'; gameArea.style.transform = 'scale(0.97)'; }
    menuBtns.forEach(btn => { btn.style.opacity = '0'; btn.style.transform = 'translateY(20px) scale(0.85)'; });

    // Now remove title-screen-active so elements are rendered (but invisible via inline styles)
    document.body.classList.remove(BODY_CLASS);
    try {
        setHiddenWithInert(header, false);
        setHiddenWithInert(mainContainer, false);
        setHiddenWithInert(footer, false);
    } catch { /* ignore */ }

    // Force style recalculation so Web Animations API picks up the inline starting states
    void document.body.offsetWidth;

    // Play assembly — animates from the inline-hidden states to visible
    playPowerOnAssembly({
        dismissIntroBg: true,
    });
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
            try {
                playNewGameIntroSequence({ onStartGame: onNewGame });
            } catch { /* ignore */ }
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

    // Re-translate title buttons whenever translations finish loading asynchronously.
    window.addEventListener('language-changed', () => {
        updateTitleScreenText();
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