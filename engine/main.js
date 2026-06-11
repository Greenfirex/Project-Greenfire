import { resources, updateResourceInfo, setupInfoPanel, computeResourceRates } from './resources.js';
import { preloader } from '../ui/system/preloader.js';
import { gameFlags } from './gameFlags.js';
import { setupLocationSection, updateLocationActionButtonsState } from '../sections/locations/locationEngine.js';
import { setupJournalSection } from '../sections/journal/journal.js';
import { setupCharacterSection } from '../sections/character/characterSection.js';
import { characterState, computeCharacterStats, computeLevelFromXp } from '../sections/character/character.js';
import { addLogEntry, LogType } from './ingameLog.js';
import { initTimeManager, startTimeManager } from './time.js';
import { loadGameState, resetToDefaultState, saveGameState } from './saveload.js';
import { initOptions, setGlowColor, setGlowIntensity, shouldRunInBackground } from './settings.js';
import { recomputeObjectives } from './objectives.js';
import { initFooter, getIsPaused, registerMainLoopCallbacks } from '../ui/chrome/footer.js';
import { initTitleScreen, showTitleScreen, hideTitleScreen } from '../ui/screens/titleScreen.js';
import '../ui/chrome/header.js';
import '../ui/mobile/compactMode.js';
import '../ui/system/pwa.js';
import '../ui/chrome/panelCollapse.js';
import '../ui/system/viewportFix.js';
import '../ui/mobile/mobileMenuIcons.js';
import '../ui/panels/changelog.js';
import '../ui/panels/objectivesPanel.js';
import '../ui/mobile/mobileObjectivesLogSwap.js';
import { MENU_SECTIONS, initMenuBadges, setMenuNewItemFlag } from '../ui/chrome/menuBadges.js';
import { t } from '../locales/locales.js';

window.debugResources = resources;
window.TIME_SCALE = Number(localStorage.getItem('gameTimeScale')) || 1;

let lastUpdateTime = Date.now();
let hasStarted = false;

let lastKnownCharacterLevel = null;

function syncVitalCapsFromCharacter() {
    try {
        const stats = computeCharacterStats(characterState);
        const hp = resources.find(r => r && r.name === 'Health');
        const stam = resources.find(r => r && r.name === 'Stamina');

        if (hp) {
            const nextCap = Math.max(1, Math.floor(Number(stats?.health ?? hp.capacity ?? 0)));
            hp.capacity = nextCap;
            hp.amount = Math.min(Number(hp.amount ?? 0), nextCap);
        }
        if (stam) {
            const nextCap = Math.max(1, Math.floor(Number(stats?.stamina ?? stam.capacity ?? 0)));
            stam.capacity = nextCap;
            stam.amount = Math.min(Number(stam.amount ?? 0), nextCap);
        }
    } catch { /* non-fatal */ }
}

function getCurrentCharacterLevel() {
    try {
        const xp = resources.find(r => r && r.name === 'XP');
        const totalXp = xp ? xp.amount : 0;
        return computeLevelFromXp(totalXp).level;
    } catch {
        return 1;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Register preloader categories.
    preloader.register('images', 30);
    preloader.register('core', 20);
    preloader.register('titleScreen', 30);

    // Start auto-discovering and preloading images from DOM + CSS.
    preloader.startImagePreloading();

    // Core subsystems are loaded (module imports resolved, DOM ready).
    preloader.progress('core', 0.5, 'Initializing...');

    try { initOptions(); } catch { /* ignore */ }
    try {
        const savedColor = localStorage.getItem('glowColor') || 'green';
        setGlowColor(savedColor);
        const savedIntensity = localStorage.getItem('glowIntensity') || 70;
        setGlowIntensity(savedIntensity);
    } catch { /* ignore */ }

    // Helper: wait for translations to be ready, then start the game.
    // Prevents rendering the game UI with fallback English before Czech loads.
    async function startWhenTranslationsReady(mode) {
        const { isInitComplete } = await import('../locales/locales.js');
        if (isInitComplete()) {
            // Translations fully loaded and applied.
            startGame({ mode });
        } else {
            // Wait for async translations (e.g. Czech JSON fetch).
            window.addEventListener('language-changed', () => {
                startGame({ mode });
            }, { once: true });
        }
    }

    try {
        const isResetting = localStorage.getItem('isResetting');
        if (isResetting) {
            localStorage.removeItem('isResetting');
            // Mark preloader complete since we're skipping the title screen.
            preloader.progress('core', 1);
            preloader.progress('titleScreen', 1);
            hideTitleScreen();
            startWhenTranslationsReady('new');
            return;
        }
    } catch { /* ignore */ }

    try {
        const autoContinue = localStorage.getItem('autoContinueAfterReload');
        if (autoContinue) {
            localStorage.removeItem('autoContinueAfterReload');
            // Mark preloader complete since we're skipping the title screen.
            preloader.progress('core', 1);
            preloader.progress('titleScreen', 1);
            hideTitleScreen();
            startWhenTranslationsReady('continue');
            return;
        }
    } catch { /* ignore */ }

    try {
        initTitleScreen({
            onContinue: () => startGame({ mode: 'continue' }),
            onNewGame: () => startGame({ mode: 'new' }),
        });
        showTitleScreen();
    } catch {
        startGame({ mode: 'continue' });
    }

    // Core subsystems fully initialized.
    preloader.progress('core', 1, 'Ready.');
});

document.addEventListener('beforeunload', () => {
    saveGameState();
});

function startGame({ mode = 'continue' } = {}) {
    if (hasStarted) return;
    hasStarted = true;

    try { hideTitleScreen(); } catch { /* ignore */ }

    initTimeManager(false);

    if (mode === 'new') {
        try { localStorage.removeItem('isResetting'); } catch { /* ignore */ }
        resetToDefaultState();
        // Activate first objective and show welcome popup
        try { recomputeObjectives(); } catch {}
        try {
            import('../ui/panels/storyPopup.js').then(mod => {
                mod.showStoryPopup({
                    id: 'welcome_intro',
                    title: t('popup_welcome_title'),
                    pages: [t('popup_welcome_page1'), t('popup_welcome_page2'), t('popup_welcome_page3')]
                });
            });
            addLogEntry(t('objectives_new_log', { name: t('obj_first_steps_label') }), LogType.UNLOCK);
        } catch {}
    } else {
        loadGameState();
    }

    syncVitalCapsFromCharacter();
    try {
        window.addEventListener('character-state-changed', () => syncVitalCapsFromCharacter());
    } catch { /* non-fatal */ }

    // Create game section elements
    const crashSiteSection = document.createElement('div');
    crashSiteSection.id = 'crashSiteSection';
    crashSiteSection.classList.add('game-section', 'hidden');

    const journalSection = document.createElement('div'); 
    journalSection.id = 'journalSection';
    journalSection.classList.add('game-section', 'hidden');

    const characterSection = document.createElement('div');
    characterSection.id = 'characterSection';
    characterSection.classList.add('game-section', 'hidden');

    const gameArea = document.getElementById('gameArea');
    gameArea.appendChild(crashSiteSection);
    gameArea.appendChild(characterSection);
    gameArea.appendChild(journalSection);

    // Setup sections
    setupInfoPanel();
    setupLocationSection(crashSiteSection);
    setupCharacterSection(characterSection);
    setupJournalSection(journalSection);

    setupMenuButtons();
    initMenuBadges();
    loadCurrentSection();
    updateResourceInfo();
    applyActivatedSections();

    lastKnownCharacterLevel = getCurrentCharacterLevel();

    let gameLoopInterval = null;
    let autosaveInterval = null;

    function getEffectiveTimeScale() {
        try {
            const s = Number(window.TIME_SCALE);
            return Number.isFinite(s) && s > 0 ? s : 1;
        } catch {
            return 1;
        }
    }

    function applyResourceRates(deltaTimeSeconds) {
        if (!Number.isFinite(deltaTimeSeconds) || deltaTimeSeconds <= 0) return;

        resources.forEach(res => {
            const rates = computeResourceRates(res.name);
            if (!rates) return;
            const delta = rates.netPerSecond * deltaTimeSeconds;
            if (delta === 0) return;
            res.amount = Math.max(0, Math.min(res.capacity, res.amount + delta));
        });
    }

    function startMainLoop() {
        if (gameLoopInterval) return;
        lastUpdateTime = Date.now();

        gameLoopInterval = setInterval(() => {
            const now = Date.now();
            let deltaTime = (now - lastUpdateTime) / 1000;
            lastUpdateTime = now;

            deltaTime *= getEffectiveTimeScale();

            if (!shouldRunInBackground() && deltaTime > 2) {
                deltaTime = 0;
            }

            applyResourceRates(deltaTime);
            updateResourceInfo();

            // Check conditions / unlock things
            checkConditions();

            // Update action button states
            if (typeof updateLocationActionButtonsState === 'function') updateLocationActionButtonsState();

            // Periodic objectives check
            try { recomputeObjectives(); } catch (e) { /* non-fatal */ }

            // Emit resource change event
            try {
                window.dispatchEvent(new CustomEvent('resources-updated', {
                    detail: {
                        timestamp: now,
                        resourcesSnapshot: resources.map(r => ({ name: r.name, amount: r.amount, capacity: r.capacity }))
                    }
                }));
            } catch (e) { /* non-fatal */ }
        }, 100);
    }

    function stopMainLoop() {
        if (gameLoopInterval) {
            clearInterval(gameLoopInterval);
            gameLoopInterval = null;
        }
    }

    function startAutosave() {
        if (autosaveInterval) return;
        autosaveInterval = setInterval(() => {
            saveGameState();
        }, 300000); // Autosave every 5 minutes
    }

    function stopAutosave() {
        if (autosaveInterval) {
            clearInterval(autosaveInterval);
            autosaveInterval = null;
        }
    }

    // Visibility handler
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            if (!shouldRunInBackground()) {
                stopMainLoop();
                stopAutosave();
                window.dispatchEvent(new CustomEvent('game-pause', { detail: { showOverlay: false, source: 'visibility' } }));
            }
        } else if (document.visibilityState === 'visible') {
            if (getIsPaused()) return;

            try {
                if (shouldRunInBackground() && gameLoopInterval) {
                    const now = Date.now();
                    let wakeDelta = (now - lastUpdateTime) / 1000;
                    wakeDelta *= getEffectiveTimeScale();
                    wakeDelta = Math.min(wakeDelta, 60 * 60);

                    if (wakeDelta > 0.01) {
                        applyResourceRates(wakeDelta);
                        lastUpdateTime = now;
                        try { updateResourceInfo(); } catch { /* ignore */ }
                    }
                }
            } catch { /* non-fatal */ }

            startMainLoop();
            startAutosave();
            window.dispatchEvent(new CustomEvent('game-resume', { detail: { source: 'visibility' } }));
        }
    });

    registerMainLoopCallbacks(startMainLoop, stopMainLoop);
    initFooter();

    if (!getIsPaused()) {
        try { startTimeManager(); } catch (e) { /* ignore */ }
    }

    if (!getIsPaused()) startMainLoop();
    startAutosave();
}

export function getInitialActivatedSections() {
    return {
        crashSiteSection: true,
        characterSection: true,
        journalSection: true,
    };
}

export function setActivatedSections(sections) {
    const defaults = getInitialActivatedSections();
    const incoming = (sections && typeof sections === 'object') ? sections : {};
    const next = { ...defaults };
    for (const key of Object.keys(defaults)) {
        if (Object.prototype.hasOwnProperty.call(incoming, key)) {
            next[key] = incoming[key];
        }
    }

    if (!activatedSections || typeof activatedSections !== 'object') {
        activatedSections = defaults;
    }

    for (const key of Object.keys(activatedSections)) {
        delete activatedSections[key];
    }
    Object.assign(activatedSections, next);

    localStorage.setItem('activatedSections', JSON.stringify(activatedSections));

    if (typeof window !== 'undefined') {
        window.activatedSections = activatedSections;
    }
}

export let activatedSections = JSON.parse(localStorage.getItem('activatedSections')) || getInitialActivatedSections();
try { setActivatedSections(activatedSections); } catch { /* ignore */ }

const SECTION_KEYS = {
    crashSiteSection: 'menu_local_area',
    characterSection: 'menu_character',
    journalSection: 'menu_journal',
};

function setupMenuButtons() {
    const sections = MENU_SECTIONS;
    const container = document.querySelector('.menu-buttons-container');
    container.innerHTML = '';
    sections.forEach(section => {
        const button = document.createElement('button');
        button.className = 'menu-button';
        button.dataset.section = section;

        const label = document.createElement('span');
        label.className = 'menu-button-label';
        label.textContent = t(SECTION_KEYS[section] || section);

        const warning = document.createElement('span');
        warning.className = 'menu-button-warning is-hidden';
        warning.textContent = '!';
        warning.setAttribute('aria-hidden', 'true');

        button.appendChild(label);
        button.appendChild(warning);

        button.addEventListener('click', () => showSection(section));
        container.appendChild(button);
    });
}

export function applyActivatedSections() {
    document.querySelectorAll('.menu-button[data-section]').forEach(button => {
        const section = button.getAttribute('data-section');
        if (activatedSections[section]) {
            button.classList.remove('hidden');
        } else {
            button.classList.add('hidden');
        }
    });
}

export function checkConditions() {
    // Placeholder for future condition checks
}

export function showSection(sectionId) {
    try { setMenuNewItemFlag(sectionId, false); } catch { /* ignore */ }
    const allMenuButtons = document.querySelectorAll('.menu-button');
    allMenuButtons.forEach(btn => {
        btn.classList.remove('active');
    });

    const newActiveButton = document.querySelector(`.menu-button[data-section="${sectionId}"]`);
    if (newActiveButton) {
        newActiveButton.classList.add('active');
    }

    const sections = document.querySelectorAll('.game-section');
    sections.forEach(section => {
        section.classList.add('hidden');
    });

    const activeSection = document.getElementById(sectionId);
    if (activeSection) {
        activeSection.classList.remove('hidden');
    }

    // Re-render Character on show so inventory/equipment changes are reflected.
    if (sectionId === 'characterSection') {
        try {
            const sectionEl = document.getElementById('characterSection');
            if (sectionEl) setupCharacterSection(sectionEl);
        } catch (e) { /* non-fatal */ }
    }

    if (sectionId === 'journalSection') {
        import('../sections/journal/journal.js').then(mod => {
            const sectionEl = document.getElementById('journalSection');
            if (sectionEl && typeof mod.setupJournalSection === 'function') {
                mod.setupJournalSection(sectionEl);
            }
        }).catch(() => { /* ignore */ });
    }

    localStorage.setItem('currentSection', sectionId);
}

function loadCurrentSection() {
    const savedSection = localStorage.getItem('currentSection');
    const defaultSection = 'crashSiteSection';

    if (savedSection && activatedSections[savedSection]) {
        showSection(savedSection);
    } else {
        showSection(defaultSection);
    }
}

export function enableSection(sectionId) {
    try {
        if (typeof activatedSections === 'undefined') return;
        if (activatedSections[sectionId]) return;
        activatedSections[sectionId] = true;
        try { setActivatedSections(activatedSections); } catch (e) { /* ignore */ }
        try { applyActivatedSections(); } catch (e) { /* ignore */ }
    } catch (e) {
        console.warn('enableSection failed', e);
    }
}

if (typeof window !== 'undefined') {
    window.enableSection = enableSection;
    window.activatedSections = activatedSections;
    window.setActivatedSections = setActivatedSections;
    window.applyActivatedSections = applyActivatedSections;
    window.showSection = showSection;
    window.setMenuNewItemFlag = setMenuNewItemFlag;
}

export { setMenuNewItemFlag };