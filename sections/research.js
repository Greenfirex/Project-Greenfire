import { addLogEntry } from '../log.js';
import { technologies } from './technologies.js';

export let researchProgress = 0;
export let researchInterval;

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

export function setupResearchSection() {
  const gameArea = document.getElementById('gameArea');
  gameArea.innerHTML = ''; // Clear any existing content

  const researchSection = document.createElement('div');
  researchSection.id = 'researchSection';

  // Progress bar container
  const progressBarContainer = document.createElement('div');
  progressBarContainer.className = 'progress-bar-container';

  // Progress bar wrapper
  const progressBarWrapper = document.createElement('div');
  progressBarWrapper.className = 'progress-bar-wrapper';

  // Progress bar
  const progressBar = document.createElement('div');
  progressBar.className = 'progress-bar';
  progressBarWrapper.appendChild(progressBar);
  progressBarContainer.appendChild(progressBarWrapper);

  // Progress info (text and cancel button)
  const progressInfo = document.createElement('div');
  progressInfo.className = 'progress-info';

  // Progress text
  const progressText = document.createElement('p');
  progressText.className = 'progress-text';
  progressText.innerText = 'Research Progress: 0%';
  progressInfo.appendChild(progressText);

  // Cancel button
  const cancelButton = document.createElement('button');
  cancelButton.className = 'cancel-button';
  cancelButton.textContent = 'Cancel Research';
  cancelButton.style.display = 'none'; // Hidden initially
  cancelButton.addEventListener('click', cancelResearch);
  progressInfo.appendChild(cancelButton);

  progressBarContainer.appendChild(progressInfo);
  researchSection.appendChild(progressBarContainer);

  // Tabs for available and researched tech
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

  // Tech containers
  const availableContainer = document.createElement('div');
  availableContainer.className = 'tech-container available active';

  const researchedContainer = document.createElement('div');
  researchedContainer.className = 'tech-container researched';

  technologies.forEach(tech => {
    if (tech.isResearched) {
      const techName = document.createElement('p');
      techName.textContent = tech.name;
      researchedContainer.appendChild(techName);
    } else {
      const allPrerequisitesResearched = tech.prerequisites.every(prereq => {
        return technologies.find(t => t.name === prereq).isResearched;
      });

      if (allPrerequisitesResearched) {
        createTechButton(tech.name, () => startResearch(tech, cancelButton), availableContainer);
      }
    }
  });

  researchSection.appendChild(availableContainer);
  researchSection.appendChild(researchedContainer);

  gameArea.appendChild(researchSection);
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

function createTechButton(text, callback, container) {
  const button = document.createElement('button');
  button.className = 'tech-button';
  button.textContent = text;
  button.dataset.tech = text; // Set data-tech attribute
  button.addEventListener('click', callback);
  container.appendChild(button);
}

function startResearch(tech, cancelButton) {
  if (researchInterval) {
    clearInterval(researchInterval); // Clear any existing interval
  }
  researchProgress = 0;
  updateProgressBar(cancelButton);
  const increment = (100 / (tech.duration * 1000 / 30));
  const techButton = document.querySelector(`.tech-button[data-tech='${tech.name}']`); // Select the button
  techButton.style.display = 'none'; // Skryjeme tlačítko při zahájení výzkumu
  cancelButton.style.display = 'inline-block'; // Show cancel button
  cancelButton.dataset.tech = tech.name;
  addLogEntry(`Started researching ${tech.name}.`, 'yellow');

  researchInterval = setInterval(() => {
    researchProgress += increment;
    if (researchProgress >= 100) {
      researchProgress = 100; // Cap at 100%
      clearInterval(researchInterval);
      addLogEntry(`${tech.name} research complete!`, 'green');
      cancelButton.style.display = 'none';
      // Hide progress bar immediately to avoid visual jump from 100% to 0%
      const progressBar = document.querySelector('.progress-bar');
      progressBar.style.transition = 'none';
      progressBar.style.width = '0';
      
      setTimeout(() => {
        progressBar.style.transition = 'width 0.6s linear';
        updateProgressBar(cancelButton);
      }, 50);
      researchProgress = 0;
      if (techButton) {
        techButton.style.display = 'none'; // Hide the button upon completion
      }
      tech.isResearched = true; // Mark technology as researched
      
      // Add the tech name to the researched tab
      const researchedContainer = document.querySelector('.tech-container.researched');
      const techName = document.createElement('p');
      techName.textContent = tech.name;
      researchedContainer.appendChild(techName);
      // Check for new available technologies
      const availableContainer = document.querySelector('.tech-container.available');
	  const newAvailableTechs = [];
      technologies.forEach(t => {
        if (!t.isResearched) {
          const allPrerequisitesResearched = t.prerequisites.every(prereq => {
            return technologies.find(tech => tech.name === prereq).isResearched;
          });

          if (allPrerequisitesResearched) {
            createTechButton(t.name, () => startResearch(t, cancelButton), availableContainer);
			newAvailableTechs.push(t.name);
          }
        }
      });
      // Log new available technologies
      if (newAvailableTechs.length > 0) {
        addLogEntry(`New technologies available: ${newAvailableTechs.join(', ')}.`, 'blue');
      }
    } else {
      updateProgressBar(cancelButton);
    }
  }, 30); // Update interval based on 30ms steps
}


export function updateProgressBar(cancelButton) {
  const progressBar = document.querySelector('.progress-bar');
  const progressText = document.querySelector('.progress-text');
  if (progressBar && progressText) {  // Add null checks
        progressBar.style.width = `${researchProgress}%`;
        progressText.innerText = `Research Progress: ${Math.floor(researchProgress)}%`;

        if (cancelButton && researchProgress > 0 && researchProgress < 100) {
            cancelButton.style.display = 'inline-block';
        } else if (cancelButton) {
            cancelButton.style.display = 'none';
        }
    } else {
        console.error('Progress bar elements not found.');  // Log an error if elements are missing
    }
}

function cancelResearch() {
    clearInterval(researchInterval);
    researchProgress = 0;
    addLogEntry('Research cancelled.', 'red');
    
    const progressBar = document.querySelector('.progress-bar');
    const progressText = document.querySelector('.progress-text');
    progressBar.style.transition = 'none';
    progressBar.style.width = '0';

    setTimeout(() => {
        progressBar.style.transition = 'width 0.6s linear';
        updateProgressBar();
    }, 50);

    const cancelButton = document.querySelector('.cancel-button');
    if (cancelButton) {
        cancelButton.style.display = 'none';
    }

    const techButton = document.querySelector(`.tech-button[data-tech="${cancelButton.dataset.tech}"]`);
    if (techButton) {
        techButton.style.display = 'inline-block'; // Zobrazíme tlačítko zpět při zrušení výzkumu
    }
}

