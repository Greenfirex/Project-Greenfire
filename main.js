import { resources, updateResourceInfo } from './resources.js';
import { technologies } from './data/technologies.js';
import { buildings } from './data/buildings.js';
import { setupMiningSection } from './sections/mining.js';
import { setupResearchSection } from './sections/research.js';
import { setupManufacturingSection } from './sections/manufacturing.js';
import { loadGameState, saveGameState, resetToDefaultState } from './saveload.js';
import { addLogEntry } from './log.js';
import './headeroptions.js';

export function unlockAllSections() {
    activatedSections.researchSection = true;
    activatedSections.manufacturingSection = true;
    applyActivatedSections();
}

document.addEventListener('DOMContentLoaded', () => {
    preloadAssets().then(() => {
        // Až se načtou všechny prvky, schováme preloader a spustíme hru
        document.getElementById('preloader').classList.add('hidden');
        startGame();
    });
});

document.addEventListener('beforeunload', () => {
    saveGameState();
});

function startGame() {
    const isResetting = localStorage.getItem('isResetting');
    if (!isResetting) {
        loadGameState();
    } else {
        localStorage.removeItem('isResetting');
        resetToDefaultState();
    }

    const miningSection = document.createElement('div');
    miningSection.id = 'miningSection';
    miningSection.classList.add('game-section');

    const researchSection = document.createElement('div');
    researchSection.id = 'researchSection';
    researchSection.classList.add('game-section');

    const manufacturingSection = document.createElement('div');
    manufacturingSection.id = 'manufacturingSection';
    manufacturingSection.classList.add('game-section');

    document.getElementById('gameArea').appendChild(miningSection);
    document.getElementById('gameArea').appendChild(researchSection);
    document.getElementById('gameArea').appendChild(manufacturingSection);

    setupMiningSection(miningSection);
    setupResearchSection(researchSection);
    setupManufacturingSection(manufacturingSection);

    loadCurrentSection();

    updateResourceInfo();
    setupMenuButtons();
    applyActivatedSections();

    setInterval(() => {
        buildings.forEach(building => {
            const resourceToProduce = resources.find(r => r.name === building.produces);
            if (resourceToProduce) {
                resourceToProduce.amount += (building.rate * building.count) / 10;
            }
        });
        updateResourceInfo();
        checkConditions();
    }, 100);
}

export function setActivatedSections(sections) {
    activatedSections = sections;
    localStorage.setItem('activatedSections', JSON.stringify(activatedSections));
}

export let activatedSections = JSON.parse(localStorage.getItem('activatedSections')) || {
    researchSection: false,
    manufacturingSection: false,
};

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

        button.addEventListener('click', () => showSection(section));

        container.appendChild(button);
    });
}

export function applyActivatedSections() {
    document.querySelectorAll('.menu-button[data-section]').forEach(button => {
        const section = button.getAttribute('data-section');
        if (!activatedSections[section] && section !== 'miningSection') {
            button.classList.add('hidden');
        } else {
            button.classList.remove('hidden');
        }
    });
}

export function checkConditions() {
    const stone = resources.find(r => r.name === 'Stone');
    const xylite = resources.find(r => r.name === 'Xylite');

    if (stone && xylite) {
        if (stone.amount >= 5 && !xylite.isDiscovered) {
            xylite.isDiscovered = true;
            addLogEntry('Xylite discovered! Your miners can now find traces of this rare crystal.', 'blue');
            updateResourceInfo();
            setupMiningSection();
        }
    }
}

function preloadAssets() {
    const images = [
        'assets/images/background1.jpg',
        'assets/images/background2.jpg',
        'assets/images/background3.jpg',
        'assets/images/background4.jpg',
        'assets/images/background5.jpg',
        'assets/images/PNG/Button03.png',
        'assets/images/PNG/Button04.png',
    ];

    const promises = images.map(src => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = () => resolve();
            img.src = src;
        });
    });

    return Promise.all(promises);
}

export function setupTooltip(button, tooltipText) {
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.textContent = tooltipText;
    document.body.appendChild(tooltip);

    button.addEventListener('mouseenter', () => {
        tooltip.style.visibility = 'visible';
    });

    button.addEventListener('mouseleave', () => {
        tooltip.style.visibility = 'hidden';
    });

    button.addEventListener('mousemove', (e) => {
        tooltip.style.left = `${e.clientX + 15}px`;
        tooltip.style.top = `${e.clientY - 30}px`;
    });
}

window.showSection = function(sectionId) {
    const sections = document.querySelectorAll('.game-section');
    sections.forEach(section => {
        section.classList.add('hidden');
    });

    const activeSection = document.getElementById(sectionId);
    if (activeSection) {
        activeSection.classList.remove('hidden');
    }
    localStorage.setItem('currentSection', sectionId);
};

function loadCurrentSection() {
    const savedSection = localStorage.getItem('currentSection');
    if (savedSection) {
        showSection(savedSection);
    } else {
        showSection('miningSection');
    }
}