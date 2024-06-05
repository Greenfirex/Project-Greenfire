import { setupMiningSection } from './sections/mining.js';
import { setupResearchSection } from './sections/research.js';

document.addEventListener('DOMContentLoaded', () => {
    preloadImages();
    showSection('mining');
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
    gameArea.innerHTML = '';
    gameArea.className = '';
    gameArea.classList.add(`${sectionId}-bg`);

    if (sectionId === 'mining') {
        setupMiningSection();
    } else if (sectionId === 'research') {
        setupResearchSection();
    }
    // Další sekce podle potřeby
}

// Make the showSection function available globally
window.showSection = showSection;
