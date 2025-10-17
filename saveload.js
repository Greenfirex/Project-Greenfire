import { resources, getInitialResources, resetResources } from './resources.js';
import { technologies, resetTechnologies } from './data/technologies.js';
import { buildings, getInitialBuildings, resetBuildings } from './data/buildings.js'; 
import { setResearchProgress, getResearchProgress, getCurrentResearchingTech, setCurrentResearchingTech, setResearchInterval, getResearchInterval, getCurrentResearchStartTime, setCurrentResearchStartTime, resumeOngoingResearch } from './sections/research.js';
import { activatedSections, setActivatedSections } from './main.js';
import { showStoryPopup } from './popup.js';
import { storyEvents } from './data/storyEvents.js';
import { addLogEntry } from './log.js';

export function saveGameState() {
    const research = getCurrentResearchingTech();
    const gameState = {
        resources: resources,
        technologies: technologies,
        researchProgress: getResearchProgress(),
        currentResearchingTech: research ? research.name : null, 
        activatedSections: activatedSections,
        buildings: buildings,
    };
    localStorage.setItem('gameState', JSON.stringify(gameState));
    addLogEntry('Game state saved.', LogType.INFO);
}

export function loadGameState() {
    const savedGameState = localStorage.getItem('gameState');
    
    // MODIFIED: Find the inner content area, not the whole section
    const logContent = document.getElementById('logContent');
    // Clear only the scrollable content, leaving the header
    if (logContent) {
        logContent.innerHTML = '';
    }

    if (savedGameState) {
        const gameState = JSON.parse(savedGameState);
        
        // --- Smart Loading Logic (unchanged) ---
        const defaultResources = getInitialResources();
        const defaultBuildings = getInitialBuildings();
        defaultResources.forEach(defaultResource => {
            const savedResource = gameState.resources.find(r => r.name === defaultResource.name);
            if (savedResource) {
                Object.assign(defaultResource, savedResource);
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
        
        // --- Load the rest of the game state (unchanged) ---
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