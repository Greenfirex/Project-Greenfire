import { resources, updateResourceInfo, incrementResources } from './resources.js';
import { technologies } from './sections/technologies.js';
import { setupResearchSection, setResearchProgress, getResearchProgress, getCurrentResearchingTech, setCurrentResearchingTech, startResearch, researchInterval } from './sections/research.js';
import { applyActivatedSections, checkConditions, activatedSections, setActivatedSections, resetActivatedSections, handleSectionClick } from './main.js'
import { setupMiningSection } from './sections/mining.js';
import { addLogEntry } from './log.js';

const defaultGameState = {
    resources: [
        { name: 'Hydrogen', generationRate: 3.00, amount: 0 },
    ],
    technologies: [
      { name: 'Quantum Computing', duration: 5, isResearched: false, prerequisites: [] }, // No prerequisites
      { name: 'Nano Fabrication', duration: 15, isResearched: false, prerequisites: ['Quantum Computing'] },
      { name: 'AI Integration', duration: 20, isResearched: false, prerequisites: ['Quantum Computing'] },
      { name: 'Testtech', duration: 30, isResearched: false, prerequisites: ['Quantum Computing', 'AI Integration'] }
    ],
    activatedSections: {
        researchSection: false,
        manufacturingSection: false,
    }
};

export function saveGameState() {
    console.log('Saving game state');
    const gameState = {
    resources: resources,
    technologies: technologies,
    researchProgress: getResearchProgress(),
    currentResearchingTech: getCurrentResearchingTech(),
    activatedSections: activatedSections
    };
    localStorage.setItem('gameState', JSON.stringify(gameState));
    console.log('Game state saved');
    addLogEntry('Game has been saved.', 'blue');
}

export function loadGameState() {
    const savedGameState = localStorage.getItem('gameState');
    if (savedGameState) {
    const gameState = JSON.parse(savedGameState);
    resources.length = 0;
    resources.push(...gameState.resources);
    technologies.length = 0;
    technologies.push(...gameState.technologies);
    setResearchProgress(gameState.researchProgress);
    setCurrentResearchingTech(gameState.currentResearchingTech);
    setActivatedSections(gameState.activatedSections);
    updateResourceInfo();
    setupMiningSection();
    setupResearchSection();
    applyActivatedSections();

    if (getCurrentResearchingTech()) {
      const tech = technologies.find(t => t.name === getCurrentResearchingTech());
      if (tech) {
        const cancelButton = document.querySelector('.cancel-button');
        setResearchProgress(gameState.researchProgress); // Ensure correct progress
        currentResearchDuration = tech.duration; // Set correct duration
        currentResearchStartTime = Date.now() - (gameState.researchProgress / 100) * tech.duration * 1000; // Calculate start time based on progress
        startResearch(tech, cancelButton); // Restart research with correct values
      }
    }
    addLogEntry('Game state loaded.', 'green');
  } else {
    console.log('No saved game state found');
    addLogEntry('No saved game state found.', 'red');
  }
}

export function resetGameState() {
    console.log('Resetting game state');

    // Load default game state
    resources.length = 0;
    resources.push(...defaultGameState.resources);
    console.log('Resources reset');

    technologies.length = 0;
    technologies.push(...defaultGameState.technologies);
    console.log('Technologies reset');

    resetActivatedSections();
    console.log('Activated sections reset');

    // Clear any ongoing research
    clearInterval(researchInterval);
    researchProgress = 0;
    currentResearchingTech = null;

    // Ensure no sections remain active
    const sections = document.querySelectorAll('.game-section');
    sections.forEach(section => {
        section.classList.add('hidden');
    });

    // Reinitialize all sections
    setupMiningSection();
    setupResearchSection();

    // Enable mining section by default
    showSection('miningSection');

    // Save default game state
    saveGameState();
    console.log('Default game state saved');
}

function autosaveGameState() {
    saveGameState();
    console.log('Autosave completed at', new Date().toLocaleTimeString());
}

// Start the autosave interval when the page loads
document.addEventListener('DOMContentLoaded', () => {
    setInterval(autosaveGameState, 5 * 60 * 1000); // Autosave every 5 minutes
});

window.addEventListener('beforeunload', saveGameState);
window.addEventListener('load', loadGameState);

