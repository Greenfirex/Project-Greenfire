// sections/research.js

import { addLogEntry } from '../log.js';
import { technologies } from '../data/technologies.js';
import { setupTooltip } from '../main.js';

export let currentResearchingTech = null;
export let researchInterval = null;
export let currentResearchDuration = 0;
export let currentResearchStartTime = 0;
export let researchProgress = 0;

const createdTechButtons = new Set();

export function getResearchInterval() {
    return researchInterval;
}

export function setResearchInterval(interval) {
    researchInterval = interval;
}

export function getResearchProgress() {
    return researchProgress;
}

export function setResearchProgress(progress) {
    researchProgress = progress;
}

export function getCurrentResearchingTech() {
    return currentResearchingTech;
}

export function setCurrentResearchingTech(tech) {
    currentResearchingTech = tech;
}

export function getCurrentResearchStartTime() {
    return currentResearchStartTime;
}

export function setCurrentResearchStartTime(time) {
    currentResearchStartTime = time;
}

function createTechButton(name, onClick, container, tooltipData) {
    const button = document.createElement('button');
    button.className = 'tech-button';
    button.dataset.tech = name;
    button.innerText = name;
    button.addEventListener('click', onClick);

    if (tooltipData) {
        setupTooltip(button, tooltipData);
    }

    container.appendChild(button);
}

export function setupResearchSection(researchSection) {
    console.log("--- Starting setupResearchSection ---"); // Log start

    if (!researchSection) {
        researchSection = document.getElementById('researchSection');
    }

    if (researchSection) {
        researchSection.innerHTML = '';
        researchSection.classList.add('research-bg');

        // ... (rest of the progress bar, tabs, etc. code is the same)
        const progressBarContainer = document.createElement('div');
        progressBarContainer.className = 'progress-bar-container';
        const progressBar = document.createElement('div');
        progressBar.className = 'progress-bar';
        const progressInfo = document.createElement('div');
        progressInfo.className = 'progress-info';
        const progressText = document.createElement('p');
        progressText.className = 'progress-text';
        progressText.style.display = 'none';
        progressText.innerText = 'Researching...';
        progressInfo.appendChild(progressText);
        const cancelButton = document.createElement('button');
        cancelButton.className = 'cancel-button';
        cancelButton.textContent = 'Cancel Research';
        cancelButton.style.display = 'none';
        cancelButton.addEventListener('click', cancelResearch);
        progressInfo.appendChild(cancelButton);
        progressBarContainer.appendChild(progressBar);
        progressBarContainer.appendChild(progressInfo);
        researchSection.appendChild(progressBarContainer);
        const tabContainer = document.createElement('div');
        tabContainer.className = 'tab-container';
        const availableTab = document.createElement('button');
        availableTab.className = 'tab active';
        availableTab.textContent = 'Available Tech';
        availableTab.addEventListener('click', () => showTab('available'));
        const researchedTab = document.createElement('button');
        researchedTab.className = 'tab';
        researchedTab.textContent = 'Researched Tech';
        researchedTab.addEventListener('click', () => showTab('researched'));
        tabContainer.appendChild(availableTab);
        tabContainer.appendChild(researchedTab);
        researchSection.appendChild(tabContainer);
        const availableContainer = document.createElement('div');
        availableContainer.className = 'tech-container available active';
        const researchedContainer = document.createElement('div');
        researchedContainer.className = 'tech-container researched';
        // ... (end of unchanged section)

        const categories = ['Mining Tech', 'Bio Tech', 'Social Tech'];
        console.log("Processing categories:", categories);

        categories.forEach(category => {
            console.log(`\nProcessing category: "${category}"`);
            const categoryTechs = technologies.filter(tech => tech.category === category && !tech.isResearched);

            console.log(`Found ${categoryTechs.length} unresearched techs in this category.`);
            if (categoryTechs.length === 0) return; // Skip if no techs

            const categoryContainer = document.createElement('div');
            categoryContainer.className = 'category-container';
            const categoryHeading = document.createElement('h3');
            categoryHeading.className = 'category-heading';
            categoryHeading.textContent = category;
            const buttonGroup = document.createElement('div');
            buttonGroup.className = 'button-group';
            
            let hasVisibleTechs = false; 

            categoryTechs.forEach(tech => {
                console.log(`- Checking prerequisites for: "${tech.name}"`);
                const allPrerequisitesResearched = tech.prerequisites.every(prereq => {
                    const preTech = technologies.find(t => t.name === prereq);
                    return preTech && preTech.isResearched;
                });

                console.log(`-- Prereqs met? ${allPrerequisitesResearched}`);

                if (allPrerequisitesResearched) {
                    console.log(`---> CREATING BUTTON for "${tech.name}"`);
                    createTechButton(tech.name, () => startResearch(tech, cancelButton), buttonGroup, tech);
                    hasVisibleTechs = true;
                }
            });

            console.log(`Category "${category}" has visible techs: ${hasVisibleTechs}`);
            if (hasVisibleTechs) {
                categoryContainer.appendChild(categoryHeading);
                categoryContainer.appendChild(buttonGroup);
                availableContainer.appendChild(categoryContainer);
            }
        });

        technologies.forEach(tech => {
            if (tech.isResearched) {
                const techName = document.createElement('p');
                techName.textContent = tech.name;
                researchedContainer.appendChild(techName);
            }
        });

        researchSection.appendChild(availableContainer);
        researchSection.appendChild(researchedContainer);

        if (currentResearchingTech) {
            updateProgressBar(cancelButton);
            document.querySelectorAll('.tech-button').forEach(button => button.disabled = true);
            if(cancelButton) cancelButton.style.display = 'inline-block';
        }
    } else {
        console.error("Error: researchSection element not found!");
    }
    console.log("--- Finished setupResearchSection ---\n\n");
}

function showTab(tabName) {
    const availableContainer = document.querySelector('.tech-container.available');
    const researchedContainer = document.querySelector('.tech-container.researched');
    const availableTab = document.querySelector('.tab:nth-child(1)');
    const researchedTab = document.querySelector('.tab:nth-child(2)');

    if (tabName === 'available') {
        availableContainer.classList.add('active');
        researchedContainer.classList.remove('active');
        availableTab.classList.add('active');
        researchedTab.classList.remove('active');
    } else {
        availableContainer.classList.remove('active');
        researchedContainer.classList.add('active');
        availableTab.classList.remove('active');
        researchedTab.classList.add('active');
    }
}

function updateProgressBar(cancelButton) {
    const progressBar = document.querySelector('.progress-bar');
    const progressText = document.querySelector('.progress-text');

    if (!getCurrentResearchingTech()) {
        if (progressBar && progressText) {
            progressBar.style.width = '0%';
            progressText.style.display = 'none';
            if (cancelButton) {
                cancelButton.style.display = 'none';
            }
        }
        return;
    }

    if (progressBar && progressText) {
        const elapsedTime = (Date.now() - getCurrentResearchStartTime()) / 1000;
        const totalDuration = currentResearchDuration || 1;
        const progress = Math.min((elapsedTime / totalDuration) * 100, 100);
        setResearchProgress(progress);

        progressText.style.display = 'block';
        progressBar.style.width = `${researchProgress}%`;

        const remainingTime = Math.max(0, totalDuration - elapsedTime);
        progressText.innerText = `${getCurrentResearchingTech()}: ${remainingTime.toFixed(0)}s`;
    }
}

function cancelResearch() {
    clearInterval(getResearchInterval());
    setResearchInterval(null);

    const techName = getCurrentResearchingTech();
    addLogEntry(`${techName} research cancelled.`, 'red');

    setResearchProgress(0);
    setCurrentResearchingTech(null);
    localStorage.removeItem('researchState');

    // CHANGED: Instead of manually re-enabling buttons, just rebuild the section.
    setupResearchSection();
}

function handleResearchCompletion(tech, cancelButton) {
    if (!tech.isResearched) {
        addLogEntry(`${tech.name} research complete!`, 'green');
        tech.isResearched = true;
    }

    setResearchProgress(0);
    setCurrentResearchingTech(null); // Set current tech to null before rebuilding
    
    // CHANGED: The logic for adding new buttons was flawed. 
    // It's much simpler and more reliable to just rebuild the entire research section.
    // This will automatically show newly unlocked techs in their correct categories.
    setupResearchSection(); 
}

export function startResearch(tech, cancelButton) {
    if (getResearchInterval()) {
        clearInterval(getResearchInterval());
        setResearchInterval(null);
    }

    setCurrentResearchingTech(tech.name);
    setResearchProgress(0);
    currentResearchDuration = tech.duration;
    setCurrentResearchStartTime(Date.now());
    updateProgressBar(cancelButton);
    
    if (cancelButton) {
        cancelButton.style.display = 'inline-block';
        cancelButton.dataset.tech = tech.name;
    }

    addLogEntry(`Started researching ${tech.name}.`, 'yellow');

    document.querySelectorAll('.tech-button').forEach(button => {
        button.disabled = true;
    });

    setResearchInterval(setInterval(() => {
        const elapsedTime = (Date.now() - getCurrentResearchStartTime()) / 1000;
        const progress = currentResearchDuration > 0 ? (elapsedTime / currentResearchDuration) * 100 : 0;
        setResearchProgress(progress);
        updateProgressBar(cancelButton);

        if (getResearchProgress() >= 100) {
            clearInterval(getResearchInterval());
            setResearchInterval(null);
            handleResearchCompletion(tech, cancelButton);
        }
    }, 1000));
}

export function resumeOngoingResearch(tech, cancelButton, savedProgress, savedStartTime) {
    if (getResearchInterval()) {
        clearInterval(getResearchInterval());
        setResearchInterval(null);
    }

    setCurrentResearchingTech(tech.name);
    setResearchProgress(savedProgress);
    currentResearchDuration = tech.duration;
    setCurrentResearchStartTime(savedStartTime);
    updateProgressBar(cancelButton);

    if (cancelButton) {
        cancelButton.style.display = 'inline-block';
        cancelButton.dataset.tech = tech.name;
    }

    setResearchInterval(setInterval(() => {
        const elapsedTime = (Date.now() - getCurrentResearchStartTime()) / 1000;
        const progress = currentResearchDuration > 0 ? (elapsedTime / currentResearchDuration) * 100 : 0;
        setResearchProgress(progress);
        updateProgressBar(cancelButton);

        if (getResearchProgress() >= 100) {
            clearInterval(getResearchInterval());
            setResearchInterval(null);
            handleResearchCompletion(tech, cancelButton);
        }
    }, 1000));
}