import { resources, updateResourceInfo } from './resources.js';
import { technologies } from './sections/technologies.js';
import { researchInterval } from './sections/research.js';

export function saveGameState() {
  const gameState = {
    resources: resources.map(resource => ({
      name: resource.name,
      generationRate: resource.generationRate,
      amount: resource.amount
    })),
    researchedTechnologies: technologies.filter(tech => tech.isResearched)
  };
  localStorage.setItem('gameState', JSON.stringify(gameState));
}

export function loadGameState() {
  const savedGameState = localStorage.getItem('gameState');
  if (savedGameState) {
    const gameState = JSON.parse(savedGameState);
    gameState.resources.forEach((savedResource, index) => {
      resources[index].amount = savedResource.amount;
      resources[index].generationRate = savedResource.generationRate;
    });
    gameState.researchedTechnologies.forEach(savedTech => {
      const tech = technologies.find(t => t.name === savedTech.name);
      if (tech) {
        tech.isResearched = true;
        const techButton = document.querySelector(`.tech-button[data-tech='${tech.name}']`);
        if (techButton) {
          techButton.style.display = 'none'; // Hide the button for researched technologies
        }
      }
    });
    updateResourceInfo();
  }
}

export function resetGameState() {
  resources.forEach(resource => {
    resource.amount = 0;
    resource.generationRate = 0.01;
  });

  // Reset research progress and show all tech buttons again
  technologies.forEach(tech => {
    tech.isResearched = false;
  });

  const techButtons = document.querySelectorAll('.tech-button');
  techButtons.forEach(button => {
    button.style.display = 'inline-block';
  });

  clearInterval(researchInterval);
  researchProgress = 0;
  updateProgressBar(); // Ensure progress bar resets

  saveGameState(); // Save the reset state
  updateResourceInfo(); // Update the UI
  location.reload();  // Enforce page refresh
}

// Save the game state before unloading the page
window.addEventListener('beforeunload', saveGameState);

// Load the game state when the page loads
window.addEventListener('load', loadGameState);