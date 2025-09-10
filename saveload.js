import { resources, getInitialResources, updateResourceInfo } from './resources.js';
import { technologies } from './data/technologies.js';
import { buildings } from './data/buildings.js';
import { setResearchProgress, getResearchProgress, getCurrentResearchingTech, setCurrentResearchingTech, setResearchInterval, getResearchInterval, getCurrentResearchStartTime, setCurrentResearchStartTime, resumeOngoingResearch } from './sections/research.js';
import { applyActivatedSections, activatedSections, setActivatedSections } from './main.js';
import { setupMiningSection } from './sections/mining.js';
import { setupResearchSection } from './sections/research.js';
import { addLogEntry } from './log.js';

export function getDefaultGameState() {
    return {
        resources: getInitialResources(),
        technologies: technologies,
        activatedSections: {
            researchSection: false,
            manufacturingSection: false,
        },
        buildings: buildings,
    };
}

export function saveGameState() {
    const gameState = {
        resources: resources,
        technologies: technologies,
        researchProgress: getResearchProgress(),
        currentResearchingTech: getCurrentResearchingTech(),
        researchInterval: getResearchInterval(),
        activatedSections: activatedSections,
        buildings: buildings,
    };
    console.log('Saving game state:', gameState);
    localStorage.setItem('gameState', JSON.stringify(gameState));
    addLogEntry('Game state saved.', 'blue');
}

export function loadGameState() {
    console.log('2. loadGameState() called. Resources before load:', resources);
    const savedGameState = localStorage.getItem('gameState');
    const logSection = document.getElementById('logSection');
    const logHeaderText = 'Log entries:';
    logSection.innerHTML = logHeaderText;

    if (savedGameState) {
        const gameState = JSON.parse(savedGameState);
        console.log('3. Loading from saved state:', gameState);
        
        // Zde si ulož data do pole resources
        resources.length = 0;
        resources.push(...gameState.resources);
        
        technologies.length = 0;
        technologies.push(...gameState.technologies);
        
        if (gameState.buildings) {
            buildings.length = 0;
            buildings.push(...gameState.buildings);
        } else {
            const defaultState = getDefaultGameState();
            buildings.length = 0;
            buildings.push(...defaultState.buildings);
        }
        console.log('4. Resources after loading from save:', resources);
        
        setResearchProgress(gameState.researchProgress ?? 0);
        setCurrentResearchingTech(gameState.currentResearchingTech);
        setResearchInterval(null);
        setCurrentResearchStartTime(0);
        setActivatedSections(gameState.activatedSections);

        updateResourceInfo();
        setupMiningSection();
        setupResearchSection();
        applyActivatedSections();

        if (getCurrentResearchingTech()) {
            const tech = technologies.find(t => t.name === getCurrentResearchingTech());
            if (tech) {
                const cancelButton = document.querySelector('.cancel-button');
                const elapsedTime = (gameState.researchProgress / 100) * tech.duration * 1000;
                setCurrentResearchStartTime(Date.now() - elapsedTime);
                resumeOngoingResearch(tech, cancelButton, getResearchProgress(), getCurrentResearchStartTime());
            }
        }
        addLogEntry('Game state loaded.', 'green');
    } else {
        console.log('3. No saved game state found. Resetting to default.');
        addLogEntry('No saved game state found.', 'red');
        resetToDefaultState();
    }
}

export function resetToDefaultState() {
    console.log('5. resetToDefaultState() called. Resources before reset:', resources);
    const defaultState = getDefaultGameState();

    resources.length = 0;
    resources.push(...getInitialResources());
    technologies.length = 0;
    technologies.push(...getDefaultGameState().technologies);
    buildings.length = 0;
    buildings.push(...getDefaultGameState().buildings);

    clearInterval(getResearchInterval());
    setResearchInterval(null);
    setResearchProgress(0);
    setCurrentResearchingTech(null);

    setActivatedSections(getDefaultGameState().activatedSections);

    updateResourceInfo();
    setupMiningSection();
    setupResearchSection();
    applyActivatedSections();
    addLogEntry('Game state reset.', 'yellow');
    console.log('6. Resources after reset:', resources);
}

export function resetGameState() {
    console.log('Resetting game state via page reload');
    localStorage.clear();
    location.reload();
}