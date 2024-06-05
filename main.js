import { setupMiningSection } from './sections/mining.js';
import { setupResearchSection } from './sections/research.js';
import { resources } from './resources.js';

document.addEventListener('DOMContentLoaded', () => {
    preloadImages();
    showSection('mining');
    setInterval(updateResourceInfo, 100);
    setInterval(incrementResources, 100);
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
    gameArea.innerHTML = ''; // Clear any existing content
    gameArea.className = ''; // Remove all current background classes

    // Add the correct background class based on the section
    if (sectionId === 'mining') {
        gameArea.classList.add('mining-bg');
        setupMiningSection();
    } else if (sectionId === 'research') {
        gameArea.classList.add('research-bg');
        setupResearchSection();
    } 
    // Add more sections as needed
}

// Přidání informací o surovinách
function updateResourceInfo() {
    const infoPanel = document.getElementById('infoPanel');
    infoPanel.innerHTML = ''; // Vyčistíme info panel

    resources.forEach(resource => {
        const resourceDiv = document.createElement('div');
        resourceDiv.className = 'resource-info';

        const name = document.createElement('h3');
        name.textContent = resource.name;

        const generation = document.createElement('p');
        generation.textContent = `Generation: ${resource.generationRate} per second`;

        const storage = document.createElement('p');
        storage.textContent = `Stored: ${resource.amount}`;

        resourceDiv.appendChild(name);
        resourceDiv.appendChild(generation);
        resourceDiv.appendChild(storage);

        infoPanel.appendChild(resourceDiv);
    });
}
function incrementResources() {
    resources.forEach(resource => {
        resource.amount += resource.generationRate;
    });
}

// Make the showSection function available globally
window.showSection = showSection;
