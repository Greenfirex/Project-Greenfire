import { resources, getInitialResources, resetResources } from './resources.js';
import { technologies, resetTechnologies } from './data/technologies.js';
import { buildings, getInitialBuildings, resetBuildings } from './data/buildings.js'; 
import { setResearchProgress, getResearchProgress, getCurrentResearchingTech, setCurrentResearchingTech, setResearchInterval, getResearchInterval, getCurrentResearchStartTime, setCurrentResearchStartTime, resumeOngoingResearch } from './sections/research.js';
import { activatedSections, setActivatedSections } from './main.js';
import { showStoryPopup } from './popup.js';
import { storyEvents } from './data/storyEvents.js';
import { addLogEntry, LogType } from './log.js';

export function saveGameState() {
    const research = getCurrentResearchingTech();
    const gameState = {
        resources: resources,
        technologies: technologies,
        researchProgress: getResearchProgress(),
        currentResearchingTech: research,
        activatedSections: activatedSections,
        buildings: buildings,
    };
    localStorage.setItem('gameState', JSON.stringify(gameState));
    addLogEntry('Game state saved.', LogType.INFO);
}

export function loadGameState() {
    const savedGameState = localStorage.getItem('gameState');
    
    const logContent = document.getElementById('logContent');
    if (logContent) {
        logContent.innerHTML = '';
    }

    if (savedGameState) {
        const gameState = JSON.parse(savedGameState);
        
        // --- Smart Loading for Resources ---
        const defaultResources = getInitialResources();
        defaultResources.forEach(defaultResource => {
            const savedResource = gameState.resources.find(r => r.name === defaultResource.name);
            if (savedResource) {
                Object.assign(defaultResource, savedResource);
            }
        });
        resources.length = 0;
        resources.push(...defaultResources);

        // --- Smart Loading for Buildings ---
        const defaultBuildings = getInitialBuildings();
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
        
        // --- NEW: Smart Loading for Technologies ---
        if (gameState.technologies) {
            technologies.forEach(tech => {
                const savedTech = gameState.technologies.find(t => t.name === tech.name);
                if (savedTech) {
                    // Update the game's tech object with the saved data (e.g., isResearched: true)
                    Object.assign(tech, savedTech);
                }
            });
        }
        
        // --- Load the rest of the game state ---
        setResearchProgress(gameState.researchProgress ?? 0);
        setCurrentResearchingTech(gameState.currentResearchingTech);
        setResearchInterval(null);
        setCurrentResearchStartTime(0);
        setActivatedSections(gameState.activatedSections);

        const techName = getCurrentResearchingTech();
        if (techName) {
            const tech = technologies.find(t => t.name === techName);
            if (tech) {
                const cancelButton = document.querySelector('.cancel-button');
                const elapsedTime = (getResearchProgress() / 100) * tech.duration * 1000;
                setCurrentResearchStartTime(Date.now() - elapsedTime);
                resumeOngoingResearch(tech, cancelButton, getResearchProgress(), getCurrentResearchStartTime());
            }
        }
        addLogEntry('Game state loaded.', LogType.INFO);
    } else {
        resetToDefaultState();
    }
}

export function resetToDefaultState() {
	addLogEntry('Game state reset.', LogType.INFO);

	const event = storyEvents.gameStart;
	showStoryPopup(event);

	addLogEntry('A new journey begins... (Click to read)', LogType.STORY, {
        onClick: () => showStoryPopup(event)
    });

    // MODIFIED: Use the dedicated reset functions for consistency.
    resetResources();
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

export function resetGameState() {
    console.log('Resetting game state via page reload');
    localStorage.clear();
    location.reload();
}