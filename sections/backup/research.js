import { addLogEntry } from '../log.js';

let researchProgress = 0;
let researchInterval;

export const technologies = [
  { name: 'Quantum Computing', duration: 5, isResearched: false }, // Add isResearched field
  { name: 'Nano Fabrication', duration: 120, isResearched: false },
  { name: 'AI Integration', duration: 180, isResearched: false }
];

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

  // Available technologies
  const techContainer = document.createElement('div');
  techContainer.className = 'tech-container';

  technologies.forEach(tech => {
    if (!tech.isResearched) {
      createTechButton(tech.name, () => startResearch(tech, cancelButton), techContainer);
    }
  });
  researchSection.appendChild(techContainer);
  gameArea.appendChild(researchSection);
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
  cancelButton.style.display = 'inline-block'; // Show cancel button
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
    } else {
      updateProgressBar(cancelButton);
    }
  }, 30); // Update interval based on 30ms steps
}


function updateProgressBar(cancelButton) {
  const progressBar = document.querySelector('.progress-bar');
  const progressText = document.querySelector('.progress-text');
  progressBar.style.width = `${researchProgress}%`;
  progressText.innerText = `Research Progress: ${Math.floor(researchProgress)}%`;
if (researchProgress > 0 && researchProgress < 100) {
    cancelButton.style.display = 'inline-block';
  } else {
    cancelButton.style.display = 'none';
  }
}

function cancelResearch() {
  clearInterval(researchInterval);
  
  // Hide progress bar immediately to avoid visual jump from current progress to 0%
  const progressBar = document.querySelector('.progress-bar');
  progressBar.style.transition = 'none';
  progressBar.style.width = '0';
  
  setTimeout(() => {
    progressBar.style.transition = 'width 0.6s linear';
    updateProgressBar();
  }, 50);

  researchProgress = 0;
  addLogEntry('Research cancelled.', 'red');

  const cancelButton = document.querySelector('.cancel-button');
  if (cancelButton) {
    cancelButton.style.display = 'none';
  }
}
