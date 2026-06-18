import { resources, updateResourceInfo, setupInfoPanel, roundResourceAmount } from './resources.js';
import { preloader } from '../ui/system/preloader.js';
import { gameFlags } from './gameFlags.js';
import { setupLocationSection, updateLocationActionButtonsState } from '../sections/locations/locationEngine.js';
import { setupJournalSection } from '../sections/journal/journal.js';
import { setupCharacterSection } from '../sections/character/characterSection.js';
import { characterState, computeCharacterStats, computeLevelFromXp } from '../sections/character/character.js';
import { addLogEntry, LogType } from './ingameLog.js';
import { initTimeManager } from './time.js';
import { loadGameState, resetToDefaultState, saveGameState } from './saveload.js';
import { initOptions, setGlowColor, setGlowIntensity, shouldRunInBackground } from './settings.js';
import { recomputeObjectives } from './objectives.js';
import { initFooter, registerMainLoopCallbacks } from '../ui/chrome/footer.js';
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
import { initEffects } from './effects.js';

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
            roundResourceAmount(hp);
        }
        if (stam) {
            const nextCap = Math.max(1, Math.floor(Number(stats?.stamina ?? stam.capacity ?? 0)));
            stam.capacity = nextCap;
            stam.amount = Math.min(Number(stam.amount ?? 0), nextCap);
            roundResourceAmount(stam);
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
    preloader.register('images', 30);
    preloader.register('core', 20);
    preloader.register('titleScreen', 30);

    preloader.startImagePreloading();
    preloader.progress('core', 0.5, 'Initializing...');

    try { initOptions(); } catch { /* ignore */ }
    try {
        const savedColor = localStorage.getItem('glowColor') || 'green';
        setGlowColor(savedColor);
        const savedIntensity = localStorage.getItem('glowIntensity') || 70;
        setGlowIntensity(savedIntensity);
    } catch { /* ignore */ }

    async function startWhenTranslationsReady(mode) {
        const { isInitComplete } = await import('../locales/locales.js');
        if (isInitComplete()) {
            startGame({ mode });
        } else {
            window.addEventListener('language-changed', () => {
                startGame({ mode });
            }, { once: true });
        }
    }

    try {
        const isResetting = localStorage.getItem('isResetting');
        if (isResetting) {
            localStorage.removeItem('isResetting');
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

    preloader.progress('core', 1, 'Ready.');
});

document.addEventListener('beforeunload', () => {
    saveGameState();
});

function startGame({ mode = 'continue' } = {}) {
    if (hasStarted) return;
    hasStarted = true;

    // For continue/reset/autoContinue: hide title screen and play assembly.
    // New game mode: title screen dismissal + assembly is handled by the
    // orchestrated intro sequence in titleScreen.js (playNewGameIntroSequence).
    if (mode !== 'new') {
        try { hideTitleScreen(); } catch { /* ignore */ }
    }

    initTimeManager();

    if (mode === 'new') {
        try { localStorage.removeItem('isResetting'); } catch { /* ignore */ }
        resetToDefaultState();
        initEffects();
        try { recomputeObjectives(); } catch {}
        // Story popup is now shown by titleScreen.js during the intro sequence,
        // before assembly animation — eliminating the race condition where
        // players could click actions before the popup appeared.
    } else {
        loadGameState();
        // Restore saved action progress if any
        try {
            const savedGameState = JSON.parse(localStorage.getItem('gameState'));
            if (savedGameState && savedGameState.activeActionState) {
                setTimeout(() => {
                    if (typeof window.__resumeSavedAction === 'function') {
                        window.__resumeSavedAction(savedGameState.activeActionState);
                    }
                }, 100); // small delay to let sections setup first
            }
        } catch { /* ignore */ }
    }

    syncVitalCapsFromCharacter();
    try {
        window.addEventListener('character-state-changed', () => syncVitalCapsFromCharacter());
    } catch { /* non-fatal */ }

    const locationsSection = document.createElement('div');
    locationsSection.id = 'locationsSection';
    locationsSection.classList.add('game-section', 'hidden');

    const journalSection = document.createElement('div'); 
    journalSection.id = 'journalSection';
    journalSection.classList.add('game-section', 'hidden');

    const characterSection = document.createElement('div');
    characterSection.id = 'characterSection';
    characterSection.classList.add('game-section', 'hidden');

    const gameArea = document.getElementById('gameArea');
    gameArea.appendChild(locationsSection);
    gameArea.appendChild(characterSection);
    gameArea.appendChild(journalSection);

    setupInfoPanel();
    setupLocationSection(locationsSection);
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

    function startMainLoop() {
        if (gameLoopInterval) return;
        lastUpdateTime = Date.now();

        gameLoopInterval = setInterval(() => {
            const now = Date.now();
            lastUpdateTime = now;

            updateResourceInfo();
            checkConditions();

            try { recomputeObjectives(); } catch (e) { /* non-fatal */ }

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
        }, 300000);
    }

    function stopAutosave() {
        if (autosaveInterval) {
            clearInterval(autosaveInterval);
            autosaveInterval = null;
        }
    }

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            if (!shouldRunInBackground()) {
                stopMainLoop();
                stopAutosave();
                window.dispatchEvent(new CustomEvent('game-pause', { detail: { showOverlay: false, source: 'visibility' } }));
            }
        } else if (document.visibilityState === 'visible') {
            startMainLoop();
            startAutosave();
            window.dispatchEvent(new CustomEvent('game-resume', { detail: { source: 'visibility' } }));
        }
    });

    registerMainLoopCallbacks(startMainLoop, stopMainLoop);
    initFooter();

    startMainLoop();
    startAutosave();

    // Panel activation is now part of the assembly animation (playPowerOnAssembly).
    // No separate stagger needed here.
}

export function getInitialActivatedSections() {
    return {
        locationsSection: true,
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
    locationsSection: 'menu_local_area',
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
    const defaultSection = 'locationsSection';

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