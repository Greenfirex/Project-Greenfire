import { setupMiningSection } from './sections/mining.js';
import { setupResearchSection } from './sections/research.js';
import { resources } from './resources.js';
import { updateResourceInfo } from './resources.js';
import { incrementResources } from './resources.js';
import { loadGameState } from './saveLoad.js';
import './headerOptions.js';

document.addEventListener('DOMContentLoaded', () => {
    preloadImages();
    loadCurrentSection();
    setInterval(updateResourceInfo, 100);
    setInterval(incrementResources, 100);

    loadGameState();
    updateResourceInfo();
});

function preloadImages() {
    const images = [
        'assets/images/background1.jpg',
        'assets/images/background2.jpg',
        'assets/images/background3.jpg',
        'assets/images/background4.jpg',
        'assets/images/background5.jpg',
	'../assets/images/PNG/Button03.png',
        '../assets/images/PNG/Button04.png',
    ];
    
    images.forEach((image) => {
        const img = new Image();
        img.src = image;
    });
}

function showSection(sectionId) {
    const gameArea = document.getElementById('gameArea');
    gameArea.innerHTML = ''; //
    gameArea.className = ''; //

    // Save the current section to localStorage
    localStorage.setItem('currentSection', sectionId);

    // Add the correct background class based on the section
    if (sectionId === 'mining') {
        gameArea.classList.add('mining-bg');
        setupMiningSection();
    } else if (sectionId === 'research') {
        gameArea.classList.add('research-bg');
        setupResearchSection();
    } else if (sectionId === 'manufacturing') {
        gameArea.classList.add('manufacturing-bg');
    } 
    // Add more sections as needed
}

// Function to load the saved section
function loadCurrentSection() {
  const savedSection = localStorage.getItem('currentSection');
  if (savedSection) {
    showSection(savedSection);
  } else {
    // Default to mining section if no section is saved
    showSection('mining');
  }
}

// Make the showSection function available globally
window.showSection = showSection;
