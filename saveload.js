import { resources, getInitialResources, updateResourceInfo } from './resources.js';
import { technologies, resetTechnologies } from './data/technologies.js';
import { buildings, resetBuildings } from './data/buildings.js'; // FIXED: Import the new reset function
import { setResearchProgress, getResearchProgress, getCurrentResearchingTech, setCurrentResearchingTech, setResearchInterval, getResearchInterval, getCurrentResearchStartTime, setCurrentResearchStartTime, resumeOngoingResearch } from './sections/research.js';
import { applyActivatedSections, activatedSections, setActivatedSections } from './main.js';
import { addLogEntry } from './log.js';

export function saveGameState() {
    const gameState = {
        resources: resources,
        technologies: technologies,
        researchProgress: getResearchProgress(),
        currentResearchingTech: getCurrentResearchingTech(),
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
    logSection.innerHTML = 'Log entries:';

    if (savedGameState) {
        const gameState = JSON.parse(savedGameState);
        console.log('3. Loading from saved state:', gameState);
        
        resources.length = 0;
        resources.push(...gameState.resources);
        
        technologies.length = 0;
        technologies.push(...gameState.technologies);
        
        if (gameState.buildings) {
            buildings.length = 0;
            buildings.push(...gameState.buildings);
        }
        
        setResearchProgress(gameState.researchProgress ?? 0);
        setCurrentResearchingTech(gameState.currentResearchingTech);
        setResearchInterval(null);
        setCurrentResearchStartTime(0);
        setActivatedSections(gameState.activatedSections);

        // REMOVED: All setup calls are now correctly handled only in main.js.

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

    // FIXED: Correctly reset all data using their specific reset functions.
    resources.length = 0;
    resources.push(...getInitialResources());
    resetTechnologies();
    resetBuildings();

    // Reset research progress
    clearInterval(getResearchInterval());
    setResearchInterval(null);
    setResearchProgress(0);
    setCurrentResearchingTech(null);

    // Reset unlocked sections
    setActivatedSections({
        researchSection: false,
        manufacturingSection: false,
    });
    
    // REMOVED: All setup calls are handled in main.js. This prevents the "element not found" error.
    
    addLogEntry('Game state reset.', 'yellow');
    console.log('6. Resources after reset:', resources);
}

// This function is unchanged and remains as part of the file.
export function resetGameState() {
    console.log('Resetting game state via page reload');
    localStorage.clear();
    location.reload();
}