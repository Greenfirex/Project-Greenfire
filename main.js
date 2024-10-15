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

let topOffset = 0; // Initialize top offset

    resources.forEach(resource => {
        const resourceDiv = document.createElement('div');
        resourceDiv.className = 'resource-info';
        resourceDiv.style.top = topOffset + 'px'; // Set top offset
        topOffset += 20;

// Create three columns
        const column1 = document.createElement('div');
        const column2 = document.createElement('div');
        const column3 = document.createElement('div');

// Set class names for columns
        column1.className = 'infocolumn1';
        column2.className = 'infocolumn2';
        column3.className = 'infocolumn3';

        const nameElement = document.createElement('h3');
        nameElement.textContent = resource.name;

        const generationElement = document.createElement('p');
        generationElement.textContent = `${resource.generationRate}/s`;

        const storageElement = document.createElement('p');
        storageElement.textContent = `Stored: ${resource.amount}`;

// Append elements to columns
        column1.appendChild(nameElement);
        column2.appendChild(generationElement);
        column3.appendChild(storageElement);

// Append columns to resourceDiv
        resourceDiv.appendChild(column1);
        resourceDiv.appendChild(column2);
        resourceDiv.appendChild(column3);

        infoPanel.appendChild(resourceDiv);
    });
}
function incrementResources() {
    resources.forEach(resource => {
        resource.amount += resource.generationRate;
        resource.amount = parseFloat(resource.amount.toFixed(2));
    });
}

// Make the showSection function available globally
window.showSection = showSection;
