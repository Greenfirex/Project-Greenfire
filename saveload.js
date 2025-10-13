import { resources, getInitialResources, updateResourceInfo } from './resources.js';
import { technologies, resetTechnologies } from './data/technologies.js';
import { buildings, getInitialBuildings, resetBuildings } from './data/buildings.js'; // FIXED: Import the new reset function
import { setResearchProgress, getResearchProgress, getCurrentResearchingTech, setCurrentResearchingTech, setResearchInterval, getResearchInterval, getCurrentResearchStartTime, setCurrentResearchStartTime, resumeOngoingResearch } from './sections/research.js';
import { applyActivatedSections, activatedSections, setActivatedSections } from './main.js';
import { showStoryPopup } from './popup.js';
import { storyEvents } from './data/storyEvents.js';
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
    const savedGameState = localStorage.getItem('gameState');
    const logSection = document.getElementById('logSection');
    logSection.innerHTML = '<h3>Log entries:</h3>';

    if (savedGameState) {
        const gameState = JSON.parse(savedGameState);
        
        // --- Smart Loading Logic ---
        const defaultResources = getInitialResources();
        const defaultBuildings = getInitialBuildings();

        defaultResources.forEach(defaultResource => {
            const savedResource = gameState.resources.find(r => r.name === defaultResource.name);
            if (savedResource) {
                Object.assign(defaultResource, savedResource); // Copy saved data over default
            }
        });
        resources.length = 0;
        resources.push(...defaultResources);

        if (gameState.buildings) {
            defaultBuildings.forEach(defaultBuilding => {
                const savedBuilding = gameState.buildings.find(b => b.name === defaultBuilding.name);
                if (savedBuilding) {
                    Object.assign(defaultBuilding, savedBuilding);
                }
            });
            buildings.length = 0;
            buildings.push(...defaultBuildings);
        }
        
        // --- Load the rest of the game state ---
        setResearchProgress(gameState.researchProgress ?? 0);
        setCurrentResearchingTech(gameState.currentResearchingTech);
        setResearchInterval(null);
        setCurrentResearchStartTime(0);
        setActivatedSections(gameState.activatedSections);

        // Resume any ongoing research
        if (getCurrentResearchingTech()) {
            const tech = technologies.find(t => t.name === getCurrentResearchingTech());
            if (tech) {
                const cancelButton = document.querySelector('.cancel-button');
                const elapsedTime = (getResearchProgress() / 100) * tech.duration * 1000;
                setCurrentResearchStartTime(Date.now() - elapsedTime);
                resumeOngoingResearch(tech, cancelButton, getResearchProgress(), getCurrentResearchStartTime());
            }
        }
        addLogEntry('Game state loaded.', 'green');
    } else {
        resetToDefaultState();
    }
}

export function resetToDefaultState() {
	addLogEntry('Game state reset.', 'yellow');

    // Define the event object first
	const event = storyEvents.gameStart;
    
    // Call the initial popup with the full event object
	showStoryPopup(event);

    // Use the same event object for the clickable log's callback
    addLogEntry('A new journey begins... (Click to read)', '#7E57C2', {
        onClick: () => showStoryPopup(event)
    });

    // The rest of the function remains the same
    resources.length = 0;
    resources.push(...getInitialResources());
    resetTechnologies();
    resetBuildings();

    clearInterval(getResearchInterval());
    setResearchInterval(null);
    setResearchProgress(0);
    setCurrentResearchingTech(null);

    setActivatedSections({
        researchSection: false,
        manufacturingSection: false,
        shipyardSection: false,
        galaxyMapSection: false,
    });
}

// This function is unchanged and remains as part of the file.
export function resetGameState() {
    console.log('Resetting game state via page reload');
    localStorage.clear();
    location.reload();
}