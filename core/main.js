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
import { setupCrewManagementSection, updateCrewSection } from '../sections/crewManagement.js';
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
import { initOptions, setGlowColor, setActiveGlowColor, setGlowIntensity, shouldRunInBackground } from './settings.js';
import { recomputeObjectives } from '../data/objectives.js';
import { initFooter, getIsPaused, pauseGame, resumeGame, registerMainLoopCallbacks } from '../ui/footer.js';
import '../ui/header.js';

window.debugResources = resources;
window.TIME_SCALE = Number(localStorage.getItem('gameTimeScale')) || 1;

let lastUpdateTime = Date.now();
let lastObjectivesCheck = 0;

let lastKnownCharacterLevel = null;

const CHARACTER_MENU_NEW_ITEM_KEY = 'uiCharacterMenuNewItem';
const JOURNAL_MENU_NEW_ITEM_KEY = 'uiJournalMenuNewItem';

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

function setCharacterMenuNewItemBadgeVisible(visible) {
    const btn = document.querySelector('.menu-button[data-section="characterSection"]');
    const badge = btn ? btn.querySelector('.menu-button-warning') : null;
    if (!badge) return;
    badge.classList.toggle('is-hidden', !visible);
}

function setJournalMenuNewItemBadgeVisible(visible) {
    const btn = document.querySelector('.menu-button[data-section="journalSection"]');
    const badge = btn ? btn.querySelector('.menu-button-warning') : null;
    if (!badge) return;
    badge.classList.toggle('is-hidden', !visible);
}

function setCharacterMenuNewItemFlag(visible) {
    try { localStorage.setItem(CHARACTER_MENU_NEW_ITEM_KEY, visible ? 'true' : 'false'); } catch (e) { /* ignore */ }
    setCharacterMenuNewItemBadgeVisible(visible);
}

function setJournalMenuNewItemFlag(visible) {
    try { localStorage.setItem(JOURNAL_MENU_NEW_ITEM_KEY, visible ? 'true' : 'false'); } catch (e) { /* ignore */ }
    setJournalMenuNewItemBadgeVisible(visible);
}

function refreshCharacterMenuNewItemFlagFromStorage() {
    let visible = false;
    try { visible = localStorage.getItem(CHARACTER_MENU_NEW_ITEM_KEY) === 'true'; } catch (e) { /* ignore */ }
    setCharacterMenuNewItemBadgeVisible(visible);
}

function refreshJournalMenuNewItemFlagFromStorage() {
    let visible = false;
    try { visible = localStorage.getItem(JOURNAL_MENU_NEW_ITEM_KEY) === 'true'; } catch (e) { /* ignore */ }
    setJournalMenuNewItemBadgeVisible(visible);
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
    startGame();
});

document.addEventListener('beforeunload', () => {
    saveGameState();
});

function startGame() {
    initOptions();
    initTooltips();
    // Load stored time immediately but do NOT start the time loop yet.
    // We'll start it after the saved game is applied so there are no visible
    // intermediate ticks showing a stale/zero clock value.
    initTimeManager(false);
    const savedColor = localStorage.getItem('glowColor') || 'green';
    setGlowColor(savedColor);
    const savedIntensity = localStorage.getItem('glowIntensity') || 1;
    setGlowIntensity(savedIntensity);

    const savedActiveColor = localStorage.getItem('activeGlowColor') || 'green';
    setActiveGlowColor(savedActiveColor);
    const isResetting = localStorage.getItem('isResetting');
    if (!isResetting) {
        loadGameState();
    } else {
        localStorage.removeItem('isResetting');
        resetToDefaultState();
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

    const crewSection = document.createElement('div');
    crewSection.id = 'crewManagementSection';
    crewSection.classList.add('game-section');

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
    gameArea.appendChild(crewSection); 
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
    setupCrewManagementSection(crewSection);
    setupCharacterSection(characterSection);
    setupJournalSection(journalSection);
    setupColonySection(colonySection);
    setupResearchSection(researchSection);
    setupManufacturingSection(manufacturingSection);
	setupShipyardSection(shipyardSection);
	setupGalaxyMapSection(galaxyMapSection);
    setupEncryptedDriveSection(encryptedDriveSection);
	
    setupMenuButtons();
    refreshCharacterMenuNewItemFlagFromStorage();
    refreshJournalMenuNewItemFlagFromStorage();
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
                        setCharacterMenuNewItemFlag(true);
                    }
                }
            } catch { /* non-fatal */ }

            // --- UI Updates (call your existing update functions) ---
            updateResourceInfo();
            updateSurvivalDebuffBadge();
            updateCrewSection();
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
                window.dispatchEvent(new CustomEvent('game-pause'));
                console.log('[visibility] game paused (tab hidden)');
            } else {
                console.log('[visibility] run-in-background enabled — keeping game running');
            }
        } else if (document.visibilityState === 'visible') {
            startMainLoop();
            startAutosave();
            window.dispatchEvent(new CustomEvent('game-resume'));
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
        crewManagementSection: false,
        characterSection: true,
        journalSection: true,
        colonySection: false,
        researchSection: false,
        manufacturingSection: false,
        shipyardSection: false,
        galaxyMapSection: false,
        encryptedDriveSection: false,
    };
}

export function setActivatedSections(sections) {
    activatedSections = sections;
    localStorage.setItem('activatedSections', JSON.stringify(activatedSections));
}

export let activatedSections = JSON.parse(localStorage.getItem('activatedSections')) || getInitialActivatedSections();

function setupMenuButtons() {
    // Order matters: keep Character above Journal
    const sections = ['crashSiteSection', 'colonySection', 'crewManagementSection', 'manufacturingSection', 'shipyardSection', 'researchSection', 'galaxyMapSection', 'encryptedDriveSection', 'characterSection', 'journalSection'];
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

    // Unlock Xylite resource once enough crystal has been gathered
    if (crystal && xylite) {
        if (crystal.amount >= 5 && !xylite.isDiscovered) {
            xylite.isDiscovered = true;
            updateResourceInfo();
            setupColonySection();
            showStoryPopup(storyEvents.unlockXylite);
            addLogEntry('A crystalline anomaly has been detected. (Click to read)', LogType.STORY, {
                onClick: () => showStoryPopup(storyEvents.unlockXylite)
            });
        }
    }
    
    // Unlock Laboratory building once enough crystal has been gathered
    const laboratory = buildings.find(b => b.name === 'Laboratory');
    if (crystal && laboratory && crystal.amount >= 10 && !laboratory.isUnlocked) {
        laboratory.isUnlocked = true;
        setupColonySection();
        showStoryPopup(storyEvents.unlockResearch);
        addLogEntry('A glimmer of insight has been recorded. (Click to read)', LogType.STORY, {
            onClick: () => showStoryPopup(storyEvents.unlockResearch)
        });
        addLogEntry('The ability to construct a Laboratory has been unlocked!', LogType.UNLOCK);
    }

    // Unlock Manufacturing section once enough crystal has been gathered
    const manufacturingButton = document.querySelector('.menu-button[data-section="manufacturingSection"]');
    if (crystal && manufacturingButton) {
        if (crystal.amount >= 20 && !activatedSections['manufacturingSection']) {
            manufacturingButton.classList.remove('hidden');
            addLogEntry('New menu section activated: Manufacturing', LogType.UNLOCK);
            activatedSections['manufacturingSection'] = true;
            applyActivatedSections();
        }
    }
}

// Tooltip implementation moved to tooltip.js (imports at top of file)

export function showSection(sectionId) {
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
        setCharacterMenuNewItemFlag(false);
        try {
            const sectionEl = document.getElementById('characterSection');
            if (sectionEl) setupCharacterSection(sectionEl);
        } catch (e) { /* non-fatal */ }
    }

    if (sectionId === 'journalSection') {
        setJournalMenuNewItemFlag(false);
        import('../sections/journal.js').then(mod => {
            const sectionEl = document.getElementById('journalSection');
            if (sectionEl && typeof mod.setupJournalSection === 'function') {
                mod.setupJournalSection(sectionEl);
            }
        }).catch(() => { /* ignore import errors */ });
    }
    
    localStorage.setItem('currentSection', sectionId);
};

// Mark the Character menu button when a new item is granted.
// This is intentionally UI-only and persists until the player opens the Character screen.
if (typeof window !== 'undefined') {
    window.addEventListener('inventory-item-added', () => {
        try {
            const current = localStorage.getItem('currentSection');
            if (current === 'characterSection') return;
        } catch (e) { /* ignore */ }
        setCharacterMenuNewItemFlag(true);
    });

    // Mark the Journal menu button only when objectives become newly active (new quests).
    // This uses a dedicated event so the badge isn't triggered by other uses of `objectivesChanged`.
    window.addEventListener('objectivesNewlyActive', (ev) => {
        try {
            const newlyActive = ev?.detail?.newlyActive;
            if (!Array.isArray(newlyActive) || !newlyActive.length) return;

            let current = null;
            try { current = localStorage.getItem('currentSection'); } catch {}
            if (current === 'journalSection') return;
            setJournalMenuNewItemFlag(true);
        } catch { /* ignore */ }
    });
}

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
    window.setupCrewManagementSection = setupCrewManagementSection;
    window.activatedSections = activatedSections;
    window.setActivatedSections = setActivatedSections;
    window.applyActivatedSections = applyActivatedSections;
    window.showSection = showSection;
}

// small helper to humanize the key (optional)
function formatSectionName(key) {
    if (!key) return '';
    const base = key.replace('Section', '');
    return base.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
}