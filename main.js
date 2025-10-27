import { resources, updateResourceInfo, setupInfoPanel, computeResourceRates } from './resources.js';
import { buildings } from './data/buildings.js';
import { setupColonySection, updateBuildingButtonsState } from './sections/colony.js';
import { setupResearchSection, updateTechButtonsState } from './sections/research.js';
import { setupManufacturingSection } from './sections/manufacturing.js';
import { setupShipyardSection } from './sections/shipyard.js';
import { setupGalaxyMapSection } from './sections/galaxyMap.js';
import { setupCrashSiteSection } from './sections/crashSite.js';
import { setupCrewManagementSection, updateCrewSection } from './sections/crewManagement.js';
import { setupJournalSection } from './sections/journal.js';
import { loadGameState, saveGameState, resetToDefaultState } from './saveload.js';
import { addLogEntry, LogType } from './log.js';
import { updateSurvivalDebuffBadge, initTooltips } from './tooltip.js';
import { initTimeManager } from './time.js';
import { showStoryPopup } from './popup.js';
import { storyEvents } from './data/storyEvents.js';
import { initOptions, setGlowColor, setActiveGlowColor, setGlowIntensity, shouldRunInBackground } from './options.js';
import { updateImpactTimer } from './eventManager.js';
import './headeroptions.js';

window.debugResources = resources;
window.TIME_SCALE = Number(localStorage.getItem('gameTimeScale')) || 1;

let lastUpdateTime = Date.now();

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
    initTimeManager(true);
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

    // --- Append all sections to the game area ---
    const gameArea = document.getElementById('gameArea');
    gameArea.appendChild(crashSiteSection);
    gameArea.appendChild(crewSection); 
    gameArea.appendChild(journalSection);
    gameArea.appendChild(colonySection);
    gameArea.appendChild(researchSection);
    gameArea.appendChild(manufacturingSection);
	gameArea.appendChild(shipyardSection);
	gameArea.appendChild(galaxyMapSection);

    // --- Setup all sections ---
    setupInfoPanel();
    setupCrashSiteSection(crashSiteSection);
    setupCrewManagementSection(crewSection);
    setupJournalSection(journalSection);
    setupColonySection(colonySection);
    setupResearchSection(researchSection);
    setupManufacturingSection(manufacturingSection);
	setupShipyardSection(shipyardSection);
	setupGalaxyMapSection(galaxyMapSection);
	
    setupMenuButtons();
    loadCurrentSection();
    updateResourceInfo();
    applyActivatedSections();

    let gameLoopInterval = null;
    let autosaveInterval = null;

        // --- Pause / Speed controls wiring ---
    let isPaused = false;
    // ensure TIME_SCALE exists and reflect initial buttons
    const savedPaused = (localStorage.getItem('gamePaused') === 'true');

    function updateHUD() {
        const hud = document.getElementById('gameStatusHUD');
        if (hud) hud.textContent = isPaused ? 'Paused' : `${window.TIME_SCALE}x`;
    }

    function setGameSpeed(factor, announce = true) {
        window.TIME_SCALE = Number(factor) || 1;
        // persist new value
        try { localStorage.setItem('gameTimeScale', String(window.TIME_SCALE)); } catch (e) {}
        // update UI active button
        document.querySelectorAll('.speed-btn').forEach(btn => {
            btn.classList.toggle('active', Number(btn.dataset.speed) === Number(window.TIME_SCALE));
        });
        updateHUD();
        if (announce) addLogEntry(`Game speed set to ${window.TIME_SCALE}x.`, LogType.INFO);
    }

    // Pause/resume helpers
    function pauseGame(announce = true) {
        if (isPaused) return;
        isPaused = true;
        // stop main loop and notify subsystems
        stopMainLoop();
        window.dispatchEvent(new CustomEvent('game-pause'));
        const btn = document.getElementById('pauseBtn');
        if (btn) btn.textContent = 'Resume';
        // persist paused state
        try { localStorage.setItem('gamePaused', 'true'); } catch (e) {}
        updateHUD();
        if (announce) addLogEntry('Game paused.', LogType.INFO);
    }
    function resumeGame(announce = true) {
        if (!isPaused) return;
        isPaused = false;
        startMainLoop();
        window.dispatchEvent(new CustomEvent('game-resume'));
        const btn = document.getElementById('pauseBtn');
        if (btn) btn.textContent = 'Pause';
        try { localStorage.setItem('gamePaused', 'false'); } catch (e) {}
        updateHUD();
        if (announce) addLogEntry(`Game resumed at ${window.TIME_SCALE}x.`, LogType.INFO);
    }
    function togglePause() {
        if (isPaused) resumeGame(); else pauseGame();
    }

    // Hook up DOM controls (safe even if DOM not present)
    const pauseBtn = document.getElementById('pauseBtn');
    if (pauseBtn) pauseBtn.addEventListener('click', (e) => { e.preventDefault(); togglePause(); });
    document.querySelectorAll('.speed-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const v = Number(btn.dataset.speed) || 1;
            setGameSpeed(v, true);
            // if paused, do not auto-resume; just show speed change in log
        });
    });

    // Apply persisted settings now that handlers exist
    setGameSpeed(window.TIME_SCALE, false);
    if (savedPaused) {
        // do not announce when restoring state
        pauseGame(false);
    } else {
        // ensure we are not paused
        isPaused = false;
        const pBtn = document.getElementById('pauseBtn'); if (pBtn) pBtn.textContent = 'Pause';
        updateHUD();
    }
    // --- end pause/speed wiring ---

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

            // --- UI Updates (call your existing update functions) ---
            updateResourceInfo();
            updateSurvivalDebuffBadge();
            updateCrewSection();
            checkConditions();
            if (typeof updateBuildingButtonsState === 'function') updateBuildingButtonsState();
            if (typeof updateTechButtonsState === 'function') updateTechButtonsState();
            if (typeof updateImpactTimer === 'function') updateImpactTimer();
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

    // start loops initially
    if (!isPaused) startMainLoop();
    startAutosave();
}

export function getInitialActivatedSections() {
    return {
        crashSiteSection: true,
        crewManagementSection: false,
        journalSection: true,
        colonySection: false,
        researchSection: false,
        manufacturingSection: false,
        shipyardSection: false,
        galaxyMapSection: false,
    };
}

export function setActivatedSections(sections) {
    activatedSections = sections;
    localStorage.setItem('activatedSections', JSON.stringify(activatedSections));
}

export let activatedSections = JSON.parse(localStorage.getItem('activatedSections')) || getInitialActivatedSections();

function setupMenuButtons() {
    const sections = ['crashSiteSection', 'crewManagementSection', 'journalSection', 'colonySection', 'researchSection', 'manufacturingSection', 'shipyardSection', 'galaxyMapSection'];
    const container = document.querySelector('.menu-buttons-container');
    container.innerHTML = '';
    sections.forEach(section => {
        const button = document.createElement('button');
        button.className = 'menu-button';
        button.dataset.section = section;
        
        const baseName = section.replace('Section', '');
        const formattedName = baseName.replace(/([A-Z])/g, ' $1');
        const displayName = formattedName.charAt(0).toUpperCase() + formattedName.slice(1);

        button.textContent = displayName;
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
    const stone = resources.find(r => r.name === 'Stone');
    const xylite = resources.find(r => r.name === 'Xylite');
    const survivors = resources.find(r => r.name === 'Survivors');

    // Unlock Xylite resource once enough stone has been gathered
    if (stone && xylite) {
        if (stone.amount >= 5 && !xylite.isDiscovered) {
            xylite.isDiscovered = true;
            updateResourceInfo();
            setupColonySection();
            showStoryPopup(storyEvents.unlockXylite);
            addLogEntry('A crystalline anomaly has been detected. (Click to read)', LogType.STORY, {
                onClick: () => showStoryPopup(storyEvents.unlockXylite)
            });
        }
    }
    
    // Unlock Laboratory building once enough stone has been gathered
    const laboratory = buildings.find(b => b.name === 'Laboratory');
    if (stone && laboratory && stone.amount >= 10 && !laboratory.isUnlocked) {
        laboratory.isUnlocked = true;
        setupColonySection();
        showStoryPopup(storyEvents.unlockResearch);
        addLogEntry('A glimmer of insight has been recorded. (Click to read)', LogType.STORY, {
            onClick: () => showStoryPopup(storyEvents.unlockResearch)
        });
        addLogEntry('The ability to construct a Laboratory has been unlocked!', LogType.UNLOCK);
    }

    // Unlock Manufacturing section once enough stone has been gathered
    const manufacturingButton = document.querySelector('.menu-button[data-section="manufacturingSection"]');
    if (stone && manufacturingButton) {
        if (stone.amount >= 20 && !activatedSections['manufacturingSection']) {
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

    if (sectionId === 'journalSection') {
        import('./sections/journal.js').then(mod => {
            const sectionEl = document.getElementById('journalSection');
            if (sectionEl && typeof mod.setupJournalSection === 'function') {
                mod.setupJournalSection(sectionEl);
            }
        }).catch(() => { /* ignore import errors */ });
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
        addLogEntry(`New menu section activated: ${formatSectionName(sectionId) || sectionId}`, LogType.UNLOCK);
        try { applyActivatedSections(); } catch (e) { /* ignore */ }
    } catch (e) {
        console.warn('enableSection failed', e);
    }
}

// small helper to humanize the key (optional)
function formatSectionName(key) {
    if (!key) return '';
    const base = key.replace('Section', '');
    return base.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
}