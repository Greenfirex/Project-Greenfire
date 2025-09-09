import { resources, updateResourceInfo } from './resources.js';
import { technologies } from './data/technologies.js';
import { setResearchProgress, getResearchProgress, getCurrentResearchingTech, setCurrentResearchingTech, setResearchInterval, getResearchInterval, getCurrentResearchStartTime, setCurrentResearchStartTime, resumeOngoingResearch, updateProgressBar } from './sections/research.js';
import { applyActivatedSections, activatedSections, setActivatedSections } from './main.js';
import { setupMiningSection } from './sections/mining.js';
import { setupResearchSection } from './sections/research.js';
import { addLogEntry } from './log.js';

// The single source of truth for the default game state
export const defaultGameState = {
    resources: [
        { name: 'Stone', generationRate: 0, amount: 0, isDiscovered: true },
        { name: 'Xylite', generationRate: 0, amount: 0, isDiscovered: false },
    ],
    technologies: [
        { name: 'Quantum Computing', duration: 5, isResearched: false, prerequisites: [], category: 'Social Tech' },
        { name: 'Nano Fabrication', duration: 15, isResearched: false, prerequisites: ['Quantum Computing'], category: 'Bio Tech' },
        { name: 'AI Integration', duration: 20, isResearched: false, prerequisites: ['Quantum Computing'], category: 'Social Tech' },
        { name: 'Testtech', duration: 60, isResearched: false, prerequisites: ['Quantum Computing', 'Nano Fabrication'], category: 'Mining Tech' },
        { name: 'Automated Drills', duration: 30, isResearched: false, prerequisites: ['Quantum Computing'], category: 'Mining Tech' },
        { name: 'Advanced Sonar', duration: 90, isResearched: false, prerequisites: ['Automated Drills'], category: 'Mining Tech' },
        { name: 'Plasma Cutter', duration: 180, isResearched: false, prerequisites: ['Advanced Sonar', 'Nano Fabrication'], category: 'Mining Tech' },
        { name: 'Xeno-Biology', duration: 45, isResearched: false, prerequisites: ['Nano Fabrication'], category: 'Bio Tech' },
        { name: 'Synthetic Crops', duration: 150, isResearched: false, prerequisites: ['Xeno-Biology'], category: 'Bio Tech' },
        { name: 'Genetic Engineering', duration: 250, isResearched: false, prerequisites: ['Synthetic Crops', 'AI Integration'], category: 'Bio Tech' },
        { name: 'Communication Array', duration: 40, isResearched: false, prerequisites: ['Quantum Computing'], category: 'Social Tech' },
        { name: 'Universal Translator', duration: 120, isResearched: false, prerequisites: ['Communication Array'], category: 'Social Tech' },
        { name: 'Galactic Diplomacy', duration: 200, isResearched: false, prerequisites: ['Universal Translator'], category: 'Social Tech' }
    ],
    activatedSections: {
        researchSection: false,
        manufacturingSection: false,
    },
    buildings: [
        { name: 'Quarry', produces: 'Stone', rate: 0.1, count: 0, cost: [{ resource: 'Stone', amount: 10 }] },
        { name: 'Extractor', produces: 'Xylite', rate: 0.05, count: 0, cost: [{ resource: 'Stone', amount: 20 }] },
    ],
};

export function saveGameState() {
    const gameState = {
        resources: resources,
        technologies: technologies, // Save all technology properties, including category
        researchProgress: getResearchProgress(),
        currentResearchingTech: getCurrentResearchingTech(),
        researchInterval: getResearchInterval(),
        activatedSections: activatedSections,
    };
    console.log('Saving game state:', gameState);
    localStorage.setItem('gameState', JSON.stringify(gameState));
    addLogEntry('Game state saved.', 'blue');
}

export function loadGameState() {
    const savedGameState = localStorage.getItem('gameState');
    const logSection = document.getElementById('logSection');
    const logHeaderText = 'Log entries:';
    logSection.innerHTML = logHeaderText;

    if (savedGameState) {
        const gameState = JSON.parse(savedGameState);
        console.log('Loading game state:', gameState);

        resources.length = 0;
        resources.push(...gameState.resources);
        technologies.length = 0;
        technologies.push(...gameState.technologies);
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
        console.log('No saved game state found');
        addLogEntry('No saved game state found.', 'red');
        resetToDefaultState();
    }
}

// A new, clean function to reset the game to its default state
export function resetToDefaultState() {
    console.log('Resetting game state to default');

    // Reset all game data to the default state
    resources.length = 0;
    resources.push(...defaultGameState.resources);
    technologies.length = 0;
    technologies.push(...defaultGameState.technologies);
    
    // Clear any ongoing research
    clearInterval(getResearchInterval());
    setResearchInterval(null);
    setResearchProgress(0);
    setCurrentResearchingTech(null);

    // Reset activated sections
    setActivatedSections(defaultGameState.activatedSections);
    
    updateResourceInfo();
    setupMiningSection();
    setupResearchSection();
    applyActivatedSections();
    addLogEntry('Game state reset.', 'yellow');
}

export function resetGameState() {
    console.log('Resetting game state via page reload');
    localStorage.clear();
    window.location.href = window.location.href;
}
