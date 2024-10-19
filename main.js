import { setupMiningSection } from './sections/mining.js';
import { setupResearchSection } from './sections/research.js';
import { resources } from './resources.js';
import { updateResourceInfo } from './resources.js';
import { incrementResources } from './resources.js';
import { loadGameState } from './saveload.js';
import { addLogEntry } from './log.js'
import './headeroptions.js';

let activatedSections = JSON.parse(localStorage.getItem('activatedSections')) || {
    research: false,
    manufacturing: false,
    trade: false,
    other4: false,
    other5: false,
    other6: false
};

// Function to apply activatedSections to buttons on load
function applyActivatedSections() {
    if (activatedSections.research) {
        document.querySelector('.menu-button[data-section="research"]').classList.remove('hidden');
    }
    if (activatedSections.manufacturing) {
        document.querySelector('.menu-button[data-section="manufacturing"]').classList.remove('hidden');
    }
    if (activatedSections.trade) {
        document.querySelector('.menu-button[data-section="trade"]').classList.remove('hidden');
    }
    if (activatedSections.other4) {
        document.querySelector('.menu-button[data-section="other4"]').classList.remove('hidden');
    }
    if (activatedSections.other5) {
        document.querySelector('.menu-button[data-section="other5"]').classList.remove('hidden');
    }
    if (activatedSections.other6) {
        document.querySelector('.menu-button[data-section="other6"]').classList.remove('hidden');
    }
}

// Function to check conditions and show buttons
function checkConditions() {
    const buttons = [
        { button: document.querySelector('.menu-button[data-section="research"]'), threshold: 10, section: 'research', logText: 'New menu section activated: Research' },
        { button: document.querySelector('.menu-button[data-section="manufacturing"]'), threshold: 20, section: 'manufacturing', logText: 'New menu section activated: Manufacturing' },
        { button: document.querySelector('.menu-button[data-section="trade"]'), threshold: 30, section: 'trade', logText: 'New menu section activated: Trade' },
        { button: document.querySelector('.menu-button[data-section="other4"]'), threshold: 40, section: 'other4', logText: 'New menu section activated: Other 4' },
        { button: document.querySelector('.menu-button[data-section="other5"]'), threshold: 50, section: 'other5', logText: 'New menu section activated: Other 5' },
        { button: document.querySelector('.menu-button[data-section="other6"]'), threshold: 60, section: 'other6', logText: 'New menu section activated: Other 6' }
    ];

    const requiredResource = resources.find(resource => resource.name === 'Hydrogen');

    if (requiredResource) {
        buttons.forEach(({ button, threshold, section, logText }) => {
            if (requiredResource.amount >= threshold && !activatedSections[section]) {
                button.classList.remove('hidden');
                addLogEntry(logText, 'blue');
                activatedSections[section] = true;
            }
        });
    }

// Save activated sections state to localStorage
    localStorage.setItem('activatedSections', JSON.stringify(activatedSections));
}

document.addEventListener('DOMContentLoaded', () => {
    preloadImages();
    loadCurrentSection();
    setInterval(updateResourceInfo, 100);
    setInterval(incrementResources, 100);
	loadGameState();
    updateResourceInfo();
	applyActivatedSections();
	setInterval(checkConditions, 1000);
});

function preloadImages() {
    const images = [
        'assets/images/background1.jpg',
        'assets/images/background2.jpg',
        'assets/images/background3.jpg',
        'assets/images/background4.jpg',
        'assets/images/background5.jpg',
	'assets/images/PNG/Button03.png',
        'assets/images/PNG/Button04.png',
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
