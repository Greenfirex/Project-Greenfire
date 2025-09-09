import { setupMiningSection } from './sections/mining.js';
import { setupResearchSection, currentResearchingTech, currentResearchDuration, currentResearchStartTime, setResearchProgress, setResearchInterval, getResearchProgress } from './sections/research.js'
import { setupManufacturingSection } from './sections/manufacturing.js';
import { resources, updateResourceInfo, incrementResources } from './resources.js';
import { loadGameState, saveGameState } from './saveload.js';
import { addLogEntry } from './log.js'
import './headeroptions.js';

document.addEventListener('DOMContentLoaded', () => {
    preloadImages();

    const isResetting = localStorage.getItem('isResetting');
    if (!isResetting) {
        loadGameState(); // 1. Načíst uložený stav hry
    } else {
        localStorage.removeItem('isResetting');
    }

    // 2. Vytvořit a naplnit všechny sekce
    const miningSection = document.createElement('div');
    miningSection.id = 'miningSection';
    miningSection.classList.add('game-section');

    const researchSection = document.createElement('div');
    researchSection.id = 'researchSection';
    researchSection.classList.add('game-section');

    const manufacturingSection = document.createElement('div');
    manufacturingSection.id = 'manufacturingSection';
    manufacturingSection.classList.add('game-section');

    // Přidat sekce do DOMu
    document.getElementById('gameArea').appendChild(miningSection);
    document.getElementById('gameArea').appendChild(researchSection);
    document.getElementById('gameArea').appendChild(manufacturingSection);

    // Naplnit sekce obsahem
    setupMiningSection(miningSection);
    setupResearchSection(researchSection);
    setupManufacturingSection(manufacturingSection);

    // 3. Spustit logiku zobrazení po vytvoření všech sekcí
    loadCurrentSection();

    // 4. Spustit zbytek inicializace
    updateResourceInfo();
    setupMenuButtons();
    applyActivatedSections();

    setInterval(() => {
        incrementResources();
        updateResourceInfo();
        checkConditions();
    }, 100);
});

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        saveGameState();
    }
});

export function setActivatedSections(sections) {
    activatedSections = sections;
    localStorage.setItem('activatedSections', JSON.stringify(activatedSections));
}

export let activatedSections = JSON.parse(localStorage.getItem('activatedSections')) || {
    researchSection: false,
    manufacturingSection: false,
};

// This new function will unlock all sections for testing
export function unlockAllSections() {
    activatedSections.researchSection = true;
    activatedSections.manufacturingSection = true;
    applyActivatedSections(); // Call this to update the menu buttons
}

export function checkConditions() {
}

function setupMenuButtons() {
    const sections = ['miningSection', 'researchSection', 'manufacturingSection'];
    const container = document.querySelector('.menu-buttons-container');
    container.innerHTML = '';
    sections.forEach(section => {
        const button = document.createElement('button');
        button.className = 'menu-button';
        button.dataset.section = section;
        const displayName = section.replace('Section', '').charAt(0).toUpperCase() + section.replace('Section', '').slice(1);
        button.textContent = displayName;
        
        // Přidáme event listener pro přepínání sekcí
        button.addEventListener('click', () => showSection(section));
        
        container.appendChild(button);
    });
}

export function applyActivatedSections() {
    document.querySelectorAll('.menu-button[data-section]').forEach(button => {
        const section = button.getAttribute('data-section');
        
        // Skryjeme tlačítka, pokud nejsou aktivní, kromě Mining, které má být vždy vidět
        if (!activatedSections[section] && section !== 'miningSection') {
            button.classList.add('hidden');
        } else {
            button.classList.remove('hidden');
        }
    });
}

export function handleSectionClick(event) {
    const section = event.currentTarget.getAttribute('data-section');
    showSection(section);
}

export function resetActivatedSections() {
    activatedSections = {
        researchSection: false,
        manufacturingSection: false,
    };
    localStorage.setItem('activatedSections', JSON.stringify(activatedSections));
	applyActivatedSections();

    // Skrytí tlačítek po resetování aktivovaných sekcí
    document.querySelectorAll('.menu-button[data-section]').forEach(button => {
        if (button.getAttribute('data-section') !== 'miningSection') {
            button.classList.add('hidden');
            button.disabled = true;
        }
    });
}

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

window.showSection = function(sectionId) {
    const sections = document.querySelectorAll('.game-section');
    sections.forEach(section => {
        section.classList.add('hidden'); // Add 'hidden' to all sections
    });

    const activeSection = document.getElementById(sectionId);
    if (activeSection) {
        activeSection.classList.remove('hidden'); // Then, remove it from the active one
    }

    localStorage.setItem('currentSection', sectionId);
};

// Function to load the saved section or default to mining
function loadCurrentSection() {
    const savedSection = localStorage.getItem('currentSection');
    
    // Check if a section was saved in localStorage
    if (savedSection) {
        // If a section was saved, show it
        showSection(savedSection);
    } else {
        // If no section was saved, default to the mining section
        showSection('miningSection');
    }
}
