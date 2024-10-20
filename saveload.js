import { resources, updateResourceInfo } from './resources.js';
import { technologies } from './sections/technologies.js';
import { getResearchInterval, setResearchProgress, updateProgressBar } from './sections/research.js';
import { applyActivatedSections, checkConditions, activatedSections, setActivatedSections, resetActivatedSections } from './main.js'

const defaultGameState = {
    resources: [
        { name: 'Hydrogen', generationRate: 0.01, amount: 0 },
        { name: 'Iron', generationRate: 0.01, amount: 0 },
        { name: 'Copper', generationRate: 0.01, amount: 0 },
        { name: 'Titanium', generationRate: 0.01, amount: 0 },
        { name: 'Dumbium', generationRate: 0.61, amount: 0 }
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

        if (Array.isArray(gameState.resources)) {
            resources.length = 0;
            resources.push(...gameState.resources);
        }

        if (Array.isArray(gameState.technologies)) {
            technologies.length = 0;
            technologies.push(...gameState.technologies);
        }

        if (gameState.activatedSections) {
            setActivatedSections(gameState.activatedSections);
        }

        applyActivatedSections();
        updateResourceInfo(); // Aktualizace zdrojů na stránce
    }
}


export function resetGameState() {
    console.log('Resetting game state');

    resources.length = 0; // Clear existing resources
    resources.push(...defaultGameState.resources); // Assign default resources
    technologies.length = 0; // Clear existing technologies
    technologies.push(...defaultGameState.technologies); // Assign default technologies
    resetActivatedSections();

    document.querySelectorAll('.menu-button[data-section]').forEach(button => {
        if (button.getAttribute('data-section') !== 'mining') {
            button.classList.add('hidden');
        }
    });

    saveGameState();
    setTimeout(() => {
        console.log('Calling checkConditions post-reset');
        checkConditions();
    }, 100);
	showSection('mining');
}

window.addEventListener('beforeunload', saveGameState);
window.addEventListener('load', loadGameState);