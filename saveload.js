import { resources, updateResourceInfo, incrementResources } from './resources.js';
import { technologies } from './data/technologies.js';
import { setupResearchSection, setResearchProgress, getResearchProgress, getCurrentResearchingTech, setCurrentResearchingTech, startResearch, setResearchInterval, getResearchInterval, getCurrentResearchStartTime, setCurrentResearchStartTime, resumeOngoingResearch, updateProgressBar } from './sections/research.js';
import { applyActivatedSections, checkConditions, activatedSections, setActivatedSections, resetActivatedSections, handleSectionClick } from './main.js'
import { setupMiningSection } from './sections/mining.js';
import { addLogEntry } from './log.js';

const defaultGameState = {
  resources: [
    { name: 'Hydrogen', generationRate: 1.00, amount: 0 },
  ],
  technologies: [
    { name: 'Quantum Computing', duration: 5, isResearched: false, prerequisites: [] },
    { name: 'Nano Fabrication', duration: 120, isResearched: false, prerequisites: ['Quantum Computing'] },
    { name: 'AI Integration', duration: 180, isResearched: false, prerequisites: ['Nano Fabrication'] }
  ],
  activatedSections: {
    researchSection: false,
    manufacturingSection: false,
  }
};

export function saveDefaultGameState() {
const defaultGameState = {
    resources: [
        { name: 'Hydrogen', generationRate: 1.00, amount: 0 },
    ],
    technologies: [
      { name: 'Quantum Computing', duration: 5, isResearched: false, prerequisites: [] },
      { name: 'Nano Fabrication', duration: 120, isResearched: false, prerequisites: ['Quantum Computing'] },
      { name: 'AI Integration', duration: 180, isResearched: false, prerequisites: ['Nano Fabrication'] }
    ]
  };
  localStorage.setItem('gameState', JSON.stringify(defaultGameState));
}

export function saveGameState() {
  const gameState = {
    resources: resources,
      technologies: technologies.map(tech => ({
      name: tech.name,
      duration: tech.duration,
      isResearched: tech.isResearched, // Ensure this is saved
      prerequisites: tech.prerequisites
    })),
    researchProgress: getResearchProgress(),
    currentResearchingTech: getCurrentResearchingTech(),
    researchInterval: getResearchInterval(),
    activatedSections: activatedSections
  };

  console.log('Saving game state:', gameState);
  localStorage.setItem('gameState', JSON.stringify(gameState));
  addLogEntry('Game state saved.', 'blue');
}

export function loadGameState() {
    const savedGameState = localStorage.getItem('gameState');
    // Clear the in-game log except for the header
    const logSection = document.getElementById('logSection');
    const logHeaderText = 'Log entries:'; // Store the header text
    logSection.innerHTML = logHeaderText; // Clear existing log entries, keep the header
    
if (savedGameState) {
    const gameState = JSON.parse(savedGameState);
    console.log('Loading game state:', gameState);
    resources.length = 0;
    resources.push(...gameState.resources);
    technologies.length = 0;
    technologies.push(...gameState.technologies.map(tech => ({
      name: tech.name,
      duration: tech.duration,
      isResearched: tech.isResearched, // Ensure this is restored
      prerequisites: tech.prerequisites
    })));

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
        const elapsedTime = (gameState.researchProgress / 100) * tech.duration * 1000; // Calculate elapsed time based on progress
        setCurrentResearchStartTime(Date.now() - elapsedTime); 
        resumeOngoingResearch(tech, cancelButton, getResearchProgress(), getCurrentResearchStartTime()); // Use the new resume function
		updateProgressBar(cancelButton);
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

  // Set a flag indicating the game is being reset
  localStorage.setItem('isResetting', 'true');

  // Clear local storage
  localStorage.removeItem('gameState');
  console.log('Game state storage cleared');

  // Load default game state
  resources.length = 0;
  resources.push(...defaultGameState.resources);
  console.log('Resources reset');
  technologies.length = 0;
  technologies.push(...defaultGameState.technologies);
  console.log('Technologies reset');

  // Reset activated sections
  Object.keys(activatedSections).forEach(key => {
    activatedSections[key] = defaultGameState.activatedSections[key];
  });
  localStorage.setItem('activatedSections', JSON.stringify(activatedSections));
  applyActivatedSections();
  console.log('Activated sections reset');

  // Clear any ongoing research
  clearInterval(getResearchInterval());
  setResearchInterval(null);
  setResearchProgress(0);
  setCurrentResearchingTech(null);

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
  saveDefaultGameState(); // Separate function to save the default state

  console.log('Default game state saved');

   // Log the reset action
  addLogEntry('Game state reset.', 'yellow');

  // Enforce page refresh
  window.location.href = window.location.href; 
}

