import { resources, updateResourceInfo, setupInfoPanel, computeResourceRates } from './resources.js';
import { buildings } from '../data/definitions/buildings.js';
import { gameFlags } from '../data/gameFlags.js';
import { setupColonySection } from '../sections/colony.js';
import { updateBuildingButtonsState } from '../ui/components/buildingButtons.js';
import { setupResearchSection, updateTechButtonsState } from '../sections/research.js';
import { setupManufacturingSection } from '../sections/manufacturing.js';
import { setupShipyardSection } from '../sections/shipyard.js';
import { setupGalaxyMapSection } from '../sections/galaxyMap.js';
import { setupCrashSiteSection, updateCrashSiteActionButtonsState } from '../sections/crashSite.js';
import { setupCampsiteJobsPanel, updateCampsiteJobsPanel, updateCampsiteIdleWarnings } from '../sections/campsite.js';
import { setupJournalSection } from '../sections/journal.js';
import { setupCharacterSection } from '../sections/character.js';
import { setupEncryptedDriveSection } from '../sections/encryptedDrive.js';
import { characterState, computeCharacterStats, computeLevelFromXp } from '../data/character.js';
import { addLogEntry, LogType } from './ingameLog.js';
import { updateSurvivalDebuffBadge, initTooltips } from '../ui/panels/tooltip.js';
import { initTimeManager, startTimeManager } from './time.js';
import { loadGameState, resetToDefaultState, saveGameState } from './saveload.js';
import { showStoryPopup } from '../ui/panels/popup.js';
import { storyEvents } from '../data/definitions/storyEvents.js';
import { initOptions, setGlowColor, setGlowIntensity, shouldRunInBackground } from './settings.js';
import { recomputeObjectives } from '../data/objectives.js';
import { initFooter, getIsPaused, pauseGame, resumeGame, registerMainLoopCallbacks } from '../ui/footer.js';
import { initTitleScreen, showTitleScreen, hideTitleScreen } from '../ui/titleScreen.js';
import '../ui/header.js';
import '../ui/compactMode.js';
import '../ui/pwa.js';
import '../ui/panelCollapse.js';
import '../ui/viewportFix.js';
import '../ui/mobileMenuIcons.js';
import '../ui/panels/changelog.js';
import '../ui/panels/objectivesPanel.js';
import '../ui/panels/mobileObjectivesLogSwap.js';
import { MENU_SECTIONS, initMenuBadges, setMenuNewItemFlag, setColonyMenuNewItemFlag } from '../ui/menuBadges.js';

window.debugResources = resources;
window.TIME_SCALE = Number(localStorage.getItem('gameTimeScale')) || 1;

let lastUpdateTime = Date.now();
let lastObjectivesCheck = 0;

let lastKnownCharacterLevel = null;
let hasStarted = false;

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
    document.getElementById('preloader').classList.add('hidden');

    // Init the shell UI immediately so Title Screen buttons can reuse Settings/Changelog.
    try { initOptions(); } catch { /* ignore */ }
    try {
        const savedColor = localStorage.getItem('glowColor') || 'green';
        setGlowColor(savedColor);
        const savedIntensity = localStorage.getItem('glowIntensity') || 70;
        setGlowIntensity(savedIntensity);
    } catch { /* ignore */ }

    // Preserve old reset flow: reset triggers reload with isResetting flag.
    try {
        const isResetting = localStorage.getItem('isResetting');
        if (isResetting) {
            localStorage.removeItem('isResetting');
            hideTitleScreen();
            startGame({ mode: 'new' });
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
        // Fallback: if Title Screen fails, start game like before.
        startGame({ mode: 'continue' });
    }
});

document.addEventListener('beforeunload', () => {
    saveGameState();
});

function startGame({ mode = 'continue' } = {}) {
    if (hasStarted) return;
    hasStarted = true;

    try { hideTitleScreen(); } catch { /* ignore */ }

    initTooltips();
    // Load stored time immediately but do NOT start the time loop yet.
    // We'll start it after the saved game is applied so there are no visible
    // intermediate ticks showing a stale/zero clock value.
    initTimeManager(false);

    if (mode === 'new') {
        try { localStorage.removeItem('isResetting'); } catch { /* ignore */ }
        resetToDefaultState();
    } else {
        loadGameState();
    }

    // Ensure max Health/Stamina reflect character progression/gear.
    syncVitalCapsFromCharacter();
    try {
        window.addEventListener('character-state-changed', () => syncVitalCapsFromCharacter());
    } catch { /* non-fatal */ }

    // --- Create all game section elements ---
    const crashSiteSection = document.createElement('div');
    crashSiteSection.id = 'crashSiteSection';
    crashSiteSection.classList.add('game-section');

    const journalSection = document.createElement('div'); 
    journalSection.id = 'journalSection';
    journalSection.classList.add('game-section');

    const characterSection = document.createElement('div');
    characterSection.id = 'characterSection';
    characterSection.classList.add('game-section');

    const colonySection = document.createElement('div');
    colonySection.id = 'colonySection';
    colonySection.classList.add('game-section');

    const researchSection = document.createElement('div');
    researchSection.id = 'researchSection';
    researchSection.classList.add('game-section');

    const manufacturingSection = document.createElement('div');
    manufacturingSection.id = 'manufacturingSection';
    manufacturingSection.classList.add('game-section');
	
	const shipyardSection = document.createElement('div');
    shipyardSection.id = 'shipyardSection';
    shipyardSection.classList.add('game-section');

    const galaxyMapSection = document.createElement('div');
    galaxyMapSection.id = 'galaxyMapSection';
    galaxyMapSection.classList.add('game-section');

    const encryptedDriveSection = document.createElement('div');
    encryptedDriveSection.id = 'encryptedDriveSection';
    encryptedDriveSection.classList.add('game-section');

    // --- Append all sections to the game area ---
    const gameArea = document.getElementById('gameArea');
    gameArea.appendChild(crashSiteSection);
    gameArea.appendChild(characterSection);
    gameArea.appendChild(journalSection);
    gameArea.appendChild(colonySection);
    gameArea.appendChild(researchSection);
    gameArea.appendChild(manufacturingSection);
	gameArea.appendChild(shipyardSection);
	gameArea.appendChild(galaxyMapSection);
    gameArea.appendChild(encryptedDriveSection);

    // --- Setup all sections ---
    setupInfoPanel();
    setupCrashSiteSection(crashSiteSection);
    setupCharacterSection(characterSection);
    setupJournalSection(journalSection);
    setupColonySection(colonySection);
    setupResearchSection(researchSection);
    setupManufacturingSection(manufacturingSection);
	setupShipyardSection(shipyardSection);
	setupGalaxyMapSection(galaxyMapSection);
    setupEncryptedDriveSection(encryptedDriveSection);
	
    setupMenuButtons();
    initMenuBadges();
    loadCurrentSection();
    updateResourceInfo();
    applyActivatedSections();

    // Initialize character level tracking (used for menu badge on level-up).
    lastKnownCharacterLevel = getCurrentCharacterLevel();

    let gameLoopInterval = null;
    let autosaveInterval = null;

    function startMainLoop() {
        if (gameLoopInterval) return;
        lastUpdateTime = Date.now();
        gameLoopInterval = setInterval(() => {
            const now = Date.now();
            let deltaTime = (now - lastUpdateTime) / 1000;
            lastUpdateTime = now;

                        // Apply temporary global time scale for debugging
            deltaTime *= (window.TIME_SCALE || 5);

            // If run-in-background is disabled and we woke after a long sleep, avoid giant jumps
            if (!shouldRunInBackground() && deltaTime > 2) {
                deltaTime = 0;
            }

            // --- Resource rate application (use centralized computeResourceRates)
            resources.forEach(res => {
                const rates = computeResourceRates(res.name);
                if (!rates) return;
                const delta = rates.netPerSecond * deltaTime;
                if (delta === 0) return;
                res.amount = Math.max(0, Math.min(res.capacity, res.amount + delta));
            });

            // --- Character level-up detection (UI badge) ---
            try {
                const lvl = getCurrentCharacterLevel();
                if (lastKnownCharacterLevel === null) lastKnownCharacterLevel = lvl;
                if (lvl > lastKnownCharacterLevel) {
                    lastKnownCharacterLevel = lvl;
                    let current = null;
                    try { current = localStorage.getItem('currentSection'); } catch {}
                    if (current !== 'characterSection') {
                        setMenuNewItemFlag('characterSection', true);
                    }
                }
            } catch { /* non-fatal */ }

            // --- UI Updates (call your existing update functions) ---
            updateResourceInfo();
            updateSurvivalDebuffBadge();
            updateCampsiteIdleWarnings();
            updateCampsiteJobsPanel();
            checkConditions();
            // Keep action buttons accurate as resources change (affordability/drains)
            if (typeof updateCrashSiteActionButtonsState === 'function') updateCrashSiteActionButtonsState();
            if (typeof updateBuildingButtonsState === 'function') updateBuildingButtonsState();
            if (typeof updateTechButtonsState === 'function') updateTechButtonsState();

            // Emit a resource change event for instant UI reactions
            try {
                window.dispatchEvent(new CustomEvent('resources-updated', {
                    detail: {
                        timestamp: now,
                        resourcesSnapshot: resources.map(r => ({ name: r.name, amount: r.amount, capacity: r.capacity }))
                    }
                }));
            } catch (e) { /* non-fatal */ }
            
            // Periodically check objectives to catch completions from passive resource gains
            // Throttle to once per second to avoid excessive computation
            if (now - lastObjectivesCheck >= 1000) {
                try { recomputeObjectives(); } catch (e) { /* non-fatal */ }
                lastObjectivesCheck = now;
            }
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

    // Visibility handler: pause/resume based on the option
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            if (!shouldRunInBackground()) {
                stopMainLoop();
                stopAutosave();
                window.dispatchEvent(new CustomEvent('game-pause', { detail: { showOverlay: false, source: 'visibility' } }));
                console.log('[visibility] game paused (tab hidden)');
            } else {
                console.log('[visibility] run-in-background enabled — keeping game running');
            }
        } else if (document.visibilityState === 'visible') {
            startMainLoop();
            startAutosave();
            window.dispatchEvent(new CustomEvent('game-resume', { detail: { source: 'visibility' } }));
            console.log('[visibility] game resumed (tab visible)');
        }
    });

    // Register main loop control with footer module
    registerMainLoopCallbacks(startMainLoop, stopMainLoop);

    // Initialize footer controls (pause, speed, XP)
    initFooter();

    // Start the time manager now that saved game state (including ingame minutes)
    // has been applied. If the game is paused, the time manager should remain
    // stopped until resumeGame is called.
    if (!getIsPaused()) {
        try { startTimeManager(); } catch (e) { /* ignore if not available */ }
    }

    // start loops initially
    if (!getIsPaused()) startMainLoop();
    startAutosave();
}

export function getInitialActivatedSections() {
    return {
        crashSiteSection: true,
        characterSection: true,
        journalSection: false,
        colonySection: false,
        researchSection: false,
        manufacturingSection: false,
        shipyardSection: false,
        galaxyMapSection: false,
        encryptedDriveSection: false,
    };
}

export function setActivatedSections(sections) {
    // Keep a stable object reference (many modules store references via `window.activatedSections`).
    // Merge into defaults for forward compatibility when new sections are added.
    const defaults = getInitialActivatedSections();
    const next = {
        ...defaults,
        ...(sections && typeof sections === 'object' ? sections : {})
    };

    if (!activatedSections || typeof activatedSections !== 'object') {
        // Extremely defensive: rehydrate to an object if something went wrong.
        activatedSections = defaults;
    }

    // Mutate in place to preserve existing references.
    for (const key of Object.keys(activatedSections)) {
        delete activatedSections[key];
    }
    Object.assign(activatedSections, next);

    localStorage.setItem('activatedSections', JSON.stringify(activatedSections));

    // Ensure the window alias always points at the current live object.
    if (typeof window !== 'undefined') {
        window.activatedSections = activatedSections;
    }
}

export let activatedSections = JSON.parse(localStorage.getItem('activatedSections')) || getInitialActivatedSections();

function setupMenuButtons() {
    // Order matters: keep Character above Journal
    const sections = MENU_SECTIONS;
    const container = document.querySelector('.menu-buttons-container');
    container.innerHTML = '';
    sections.forEach(section => {
        const button = document.createElement('button');
        button.className = 'menu-button';
        button.dataset.section = section;
        
        const baseName = section.replace('Section', '');
        const formattedName = baseName.replace(/([A-Z])/g, ' $1');
        const displayName = formattedName.charAt(0).toUpperCase() + formattedName.slice(1);

        // Use structured content so we can overlay badges (e.g., idle crew warning) without
        // affecting the main label layout.
        const label = document.createElement('span');
        label.className = 'menu-button-label';
        label.textContent = displayName;

        const warning = document.createElement('span');
        warning.className = 'menu-button-warning is-hidden';
        warning.textContent = '!';
        warning.setAttribute('aria-hidden', 'true');

        button.appendChild(label);
        button.appendChild(warning);

        button.addEventListener('click', () => showSection(section));
        container.appendChild(button);
    });

    // Badge visibility is restored by `initMenuBadges()` after the menu is built.
}

export function applyActivatedSections() {
    document.querySelectorAll('.menu-button[data-section]').forEach(button => {
        const section = button.getAttribute('data-section');
        // MODIFIED: Simplified logic to just check the flag
        if (activatedSections[section]) {
            button.classList.remove('hidden');
        } else {
            button.classList.add('hidden');
        }
    });
}

export function checkConditions() {
    const crystal = resources.find(r => r.name === 'Crystal');
    const xylite = resources.find(r => r.name === 'Xylite');
    const survivors = resources.find(r => r.name === 'Survivors');
    const metalParts = resources.find(r => r.name === 'Metal Parts');

    // Track when player first reaches 15 metal parts (for objectives)
    // Note: keep the existing flag name for save compatibility.
    if (metalParts && metalParts.amount >= 15 && !gameFlags.hasReached15ScrapMetal) {
        gameFlags.hasReached15ScrapMetal = true;
    }

    // Legacy Xylite auto-unlock disabled: we'll use a different unlock method.
    
    // Legacy Laboratory auto-unlock disabled: we'll use a different unlock method.

    // Legacy Manufacturing auto-unlock disabled: we'll use a different unlock method.

    // New: Manufacturing unlocks once the first Workshop is built.
    try {
        const workshop = buildings.find(b => b && b.name === 'Workshop');
        if (workshop && (Number(workshop.count) || 0) >= 1 && !activatedSections.manufacturingSection) {
            enableSection('manufacturingSection');
            try { addLogEntry('New menu section unlocked: Manufacturing', LogType.UNLOCK); } catch {}
            try { setMenuNewItemFlag('manufacturingSection', true); } catch {}
        }
    } catch { /* non-fatal */ }
}

// Tooltip implementation moved to tooltip.js (imports at top of file)

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
        import('../sections/journal.js').then(mod => {
            const sectionEl = document.getElementById('journalSection');
            if (sectionEl && typeof mod.setupJournalSection === 'function') {
                mod.setupJournalSection(sectionEl);
            }
        }).catch(() => { /* ignore import errors */ });
    }

    if (sectionId === 'colonySection') {
        try {
            const sectionEl = document.getElementById('colonySection');
            if (sectionEl) setupColonySection(sectionEl);
        } catch (e) { /* non-fatal */ }
    }
    
    localStorage.setItem('currentSection', sectionId);
};

function loadCurrentSection() {
    const savedSection = localStorage.getItem('currentSection');

    // MODIFIED: Default to crashSiteSection for a new game
    const defaultSection = 'crashSiteSection';

    if (savedSection && activatedSections[savedSection]) {
        showSection(savedSection);
    } else {
        showSection(defaultSection);
    }
}

// Export helper to enable a UI section by id (keeps activation logic centralized)
export function enableSection(sectionId) {
    try {
        // `activatedSections` is the module-scoped object used by main.js
        if (typeof activatedSections === 'undefined') return;
        if (activatedSections[sectionId]) return;
        activatedSections[sectionId] = true;
        try { setActivatedSections(activatedSections); } catch (e) { /* ignore */ }
        // Removed "New menu section activated" log message
        try { applyActivatedSections(); } catch (e) { /* ignore */ }
    } catch (e) {
        console.warn('enableSection failed', e);
    }
}

// Reuse existing unlock path from anywhere (e.g., action handlers)
if (typeof window !== 'undefined') {
    window.enableSection = enableSection;
    window.setupCampsiteJobsPanel = setupCampsiteJobsPanel;
    window.updateCampsiteJobsPanel = updateCampsiteJobsPanel;
    window.updateCampsiteIdleWarnings = updateCampsiteIdleWarnings;
    window.activatedSections = activatedSections;
    window.setActivatedSections = setActivatedSections;
    window.applyActivatedSections = applyActivatedSections;
    window.showSection = showSection;
    window.setMenuNewItemFlag = setMenuNewItemFlag;
}

// small helper to humanize the key (optional)
function formatSectionName(key) {
    if (!key) return '';
    const base = key.replace('Section', '');
    return base.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
}

// Keep backwards-compatible exports for modules that already import these from `core/main.js`.
export { setMenuNewItemFlag, setColonyMenuNewItemFlag };