import { resources, updateResourceInfo } from './resources.js';
import { technologies } from './data/technologies.js';
import { buildings } from './data/buildings.js';
import { setupMiningSection } from './sections/mining.js';
import { setupResearchSection } from './sections/research.js';
import { setupManufacturingSection } from './sections/manufacturing.js';
import { loadGameState, saveGameState, resetToDefaultState } from './saveload.js';
import { addLogEntry } from './log.js';
import './headeroptions.js';

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
            // Calculate the new amount
            const newAmount = resourceToProduce.amount + (building.rate * building.count) / 10;
            // FIXED: Use Math.min to ensure the amount does not exceed the capacity
            resourceToProduce.amount = Math.min(newAmount, resourceToProduce.capacity);
        }
    });
    updateResourceInfo();
    checkConditions();
}, 100);

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
        // Logika pro odemykání Xylite
        if (stone.amount >= 5 && !xylite.isDiscovered) {
            xylite.isDiscovered = true;
            addLogEntry('Xylite discovered! Your miners can now find traces of this rare crystal.', 'blue');
            updateResourceInfo();
            setupMiningSection();
        }
    }
    
    // Logika pro odemykání Research sekce
    const researchButton = document.querySelector('.menu-button[data-section="researchSection"]');
    if (stone && researchButton) {
        if (stone.amount >= 10 && !activatedSections['researchSection']) {
            researchButton.classList.remove('hidden');
            addLogEntry('New menu section activated: Research', 'blue');
            activatedSections['researchSection'] = true;
            applyActivatedSections();
        }
    }

    // Nová logika pro odemykání Manufacturing sekce
    const manufacturingButton = document.querySelector('.menu-button[data-section="manufacturingSection"]');
    if (stone && manufacturingButton) {
        if (stone.amount >= 20 && !activatedSections['manufacturingSection']) {
            manufacturingButton.classList.remove('hidden');
            addLogEntry('New menu section activated: Manufacturing', 'blue');
            activatedSections['manufacturingSection'] = true;
            applyActivatedSections();
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

// A single, global tooltip element
let globalTooltip = null;

function getOrCreateTooltip() {
    if (!globalTooltip) {
        globalTooltip = document.createElement('div');
        globalTooltip.className = 'tooltip';
        document.body.appendChild(globalTooltip);
    }
    return globalTooltip;
}

export function setupTooltip(button, tooltipData) {
    const tooltip = getOrCreateTooltip();

    button.addEventListener('mouseenter', (e) => {
        tooltip.innerHTML = ''; // Clear previous content

        // Case 1: Handles simple tooltips like for "Mine Stone"
        if (typeof tooltipData === 'string') {
            tooltip.textContent = tooltipData;
        
        // Case 2: Handles complex tooltips for buildings (looks for .cost)
        } else if (tooltipData && tooltipData.cost && Array.isArray(tooltipData.cost)) {
            
            // --- Cost Section ---
            const costSection = document.createElement('div');
            costSection.className = 'tooltip-section cost';
            const costHeader = document.createElement('h4');
            costHeader.textContent = 'Cost';
            costSection.appendChild(costHeader);
            
            tooltipData.cost.forEach(c => {
                const costItem = document.createElement('p');
                if (c.resource && typeof c.amount !== 'undefined') {
                    costItem.textContent = `${c.resource}: ${c.amount}`;
                    costSection.appendChild(costItem);
                }
            });
            tooltip.appendChild(costSection);

            // --- Generation Section ---
            if (tooltipData.produces) {
                const genSection = document.createElement('div');
                genSection.className = 'tooltip-section generation';
                const genHeader = document.createElement('h4');
                genHeader.textContent = 'Generation';
                genSection.appendChild(genHeader);
                
                const genItem = document.createElement('p');
                genItem.textContent = `${tooltipData.produces}: +${tooltipData.rate}/s`;
                genSection.appendChild(genItem);
                tooltip.appendChild(genSection);
            }

        // NEW!! Case 3: Handles tooltips for technologies (looks for .description)
        } else if (tooltipData && tooltipData.description) {
            
            // --- Title ---
            const title = document.createElement('h4');
            title.className = 'tooltip-title';
            title.textContent = tooltipData.name;
            tooltip.appendChild(title);

            // --- Description ---
            const description = document.createElement('p');
            description.className = 'tooltip-description';
            description.textContent = tooltipData.description;
            tooltip.appendChild(description);

            // --- Duration ---
            const duration = document.createElement('p');
            duration.className = 'tooltip-duration';
            duration.textContent = `Research Time: ${tooltipData.duration}s`;
            tooltip.appendChild(duration);
        }

        // This line makes the tooltip appear
        tooltip.style.visibility = 'visible';
        tooltip.style.left = `${e.clientX + 15}px`;
        tooltip.style.top = `${e.clientY - 30}px`;
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