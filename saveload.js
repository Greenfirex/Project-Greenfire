import { resources, updateResourceInfo, incrementResources } from './resources.js';
import { technologies } from './sections/technologies.js';
import { getResearchInterval, setResearchProgress, updateProgressBar } from './sections/research.js';
import { applyActivatedSections, checkConditions, activatedSections, setActivatedSections, resetActivatedSections, handleSectionClick } from './main.js'

const defaultGameState = {
    resources: [
        { name: 'Hydrogen', generationRate: 5.00, amount: 0 },
        { name: 'Iron', generationRate: 0.06, amount: 0 },
        { name: 'Copper', generationRate: 0.01, amount: 0 },
        { name: 'Titanium', generationRate: 0.02, amount: 0 },
        { name: 'Dumbium', generationRate: 0.01, amount: 0 }
    ],
    technologies: [
        { name: 'Quantum Computing', duration: 5, isResearched: false, prerequisites: [] },
        { name: 'Nano Fabrication', duration: 120, isResearched: false, prerequisites: ['Quantum Computing'] },
        { name: 'AI Integration', duration: 180, isResearched: false, prerequisites: ['Quantum Computing'] }
    ],
    activatedSections: {
        research: false,
        manufacturing: false,
        trade: false,
        other4: false,
        other5: false,
        other6: false
    }
};

export function saveGameState() {
    console.log('Saving game state');
    const gameState = {
        resources,
        technologies,
        activatedSections
    };
    localStorage.setItem('gameState', JSON.stringify(gameState));
}

export function loadGameState() {
    const savedGameState = localStorage.getItem('gameState');
    if (savedGameState) {
        const gameState = JSON.parse(savedGameState);
        console.log('Parsed gameState:', gameState);

        if (Array.isArray(gameState.resources)) {
            resources.length = 0;
            resources.push(...gameState.resources);
            console.log('Loaded resources:', resources);
        }

        if (Array.isArray(gameState.technologies)) {
            technologies.length = 0;
            technologies.push(...gameState.technologies);
            console.log('Loaded technologies:', technologies);
        }

        if (gameState.activatedSections) {
            setActivatedSections(gameState.activatedSections);
            console.log('Loaded activated sections:', activatedSections);
        }

        applyActivatedSections();
        updateResourceInfo();
    }
}

export function resetGameState() {
    console.log('Resetting game state');
    resources.length = 0;
    resources.push(...defaultGameState.resources);
    console.log('Resources reset');

    technologies.length = 0;
    technologies.push(...defaultGameState.technologies);
    console.log('Technologies reset');

    resetActivatedSections();
    console.log('Activated sections reset');

    saveGameState();
	
	// Clear research state
    localStorage.removeItem('researchState');
    console.log('Research state cleared');

    // Check conditions and apply activated sections
    checkConditions();
    applyActivatedSections();

    // Ensure the mining section is activated by default
    showSection('mining');

    // Reapply event listeners to buttons
    reapplyEventListeners();

    console.log('Game state reset and sections applied');
}

function reapplyEventListeners() {
    document.querySelectorAll('.menu-button[data-section]').forEach(button => {
        button.removeEventListener('click', handleSectionClick); // Remove existing listeners
        button.addEventListener('click', handleSectionClick); // Reattach click event
    });
}

window.addEventListener('beforeunload', saveGameState);
window.addEventListener('load', loadGameState);