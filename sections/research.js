import { addLogEntry } from '../log.js';
import { technologies } from '../data/technologies.js';

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

export function setupResearchSection(researchSection) {
    if (!researchSection) {
        researchSection = document.getElementById('researchSection');
    }

    if (researchSection) {
        researchSection.innerHTML = '';
        researchSection.classList.add('research-bg');

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

        // --- THE NEW LOGIC STARTS HERE ---
        
        // Get unique categories and their order
        const categories = ['Mining Tech', 'Bio Tech', 'Social Tech'];

        categories.forEach(category => {
            const categoryHeading = document.createElement('h3');
            categoryHeading.className = 'category-heading';
            categoryHeading.textContent = category;
            availableContainer.appendChild(categoryHeading);

            const categoryTechs = technologies.filter(tech => tech.category === category);
            
            categoryTechs.forEach(tech => {
                if (!tech.isResearched) {
                    const allPrerequisitesResearched = tech.prerequisites.every(prereq => {
                        const preTech = technologies.find(t => t.name === prereq);
                        return preTech && preTech.isResearched;
                    });
                    if (allPrerequisitesResearched) {
                        createTechButton(tech.name, () => startResearch(tech, cancelButton), availableContainer);
                    }
                }
            });
        });

        // Add researched techs without categories to the researched container
        technologies.forEach(tech => {
            if (tech.isResearched) {
                const techName = document.createElement('p');
                techName.textContent = tech.name;
                researchedContainer.appendChild(techName);
            }
        });
        
        researchSection.appendChild(availableContainer);
        researchSection.appendChild(researchedContainer);
    }
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

function createTechButton(name, onClick, container) {
  const button = document.createElement('button');
  button.className = 'tech-button';
  button.dataset.tech = name;
    button.innerText = name;
    button.addEventListener('click', onClick);
    container.appendChild(button);
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

  const techButton = document.querySelector(`.tech-button[data-tech='${tech.name}']`); // Select the button
  if (techButton) {
    techButton.style.display = 'none'; // Hide the button on start
  }

  if (cancelButton) {
    cancelButton.style.display = 'inline-block'; // Show cancel button
    cancelButton.dataset.tech = tech.name;
  }

  addLogEntry(`Started researching ${tech.name}.`, 'yellow');

  // Disable all other tech buttons
  document.querySelectorAll('.tech-button').forEach(button => {
    if (button.dataset.tech !== tech.name) {
      button.disabled = true;
    }
  });

  setResearchInterval(setInterval(() => {
    const elapsedTime = (Date.now() - getCurrentResearchStartTime()) / 1000;
    const progress = currentResearchDuration > 0 ? (elapsedTime / currentResearchDuration) * 100 : 0;
    setResearchProgress(progress);
    updateProgressBar(cancelButton);

    if (getResearchProgress() >= 100) {
	handleResearchCompletion(tech, cancelButton);
    }
  }, 1000)); // Update every second
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

  // Ensure the cancel button is displayed correctly
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
      setResearchProgress(100);
      clearInterval(getResearchInterval());
      setResearchInterval(null);
      addLogEntry(`${tech.name} research complete!`, 'green');
	  handleResearchCompletion(tech, cancelButton);
    }
  }, 1000));
}

export function updateProgressBar(cancelButton) {
const progressBar = document.querySelector('.progress-bar');
const progressText = document.querySelector('.progress-text');

if (!getCurrentResearchingTech()) {
    // Skryje text a progress bar
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
    
    // Zobrazí text, který má být viditelný jen při probíhajícím výzkumu
    progressText.style.display = 'block';
    
    progressBar.style.width = `${researchProgress}%`;
    
    const remainingTime = Math.max(0, totalDuration - elapsedTime);
    progressText.innerText = `${getCurrentResearchingTech()}: ${remainingTime.toFixed(0)}s`;
}
}

function cancelResearch() {
    // 1. Zastavíme interval výzkumu
    clearInterval(getResearchInterval());
    setResearchInterval(null);

    const techName = getCurrentResearchingTech();
    addLogEntry(`${techName} research cancelled.`, 'red');

    // 2. Resetujeme stav výzkumu
    setResearchProgress(0);
    setCurrentResearchingTech(null);
    localStorage.removeItem('researchState'); // Vymažeme uložený stav výzkumu

    // 3. Resetujeme vizuální prvky
    const progressBar = document.querySelector('.progress-bar');
    const progressText = document.querySelector('.progress-text');
	const cancelButton = document.querySelector('.cancel-button');
	
    if (progressBar && progressText) {
        progressBar.style.transition = 'none';
        progressBar.style.width = '0'; // Reset na 0 %
        progressText.style.display = 'none';
    }
  
    if (cancelButton) {
        cancelButton.style.display = 'none';
    }

    // 4. Znovu zobrazíme všechna dostupná tlačítka pro výzkum
    document.querySelectorAll('.tech-button').forEach(button => {
    button.disabled = false;
    
    const techName = button.getAttribute('data-tech');
    const tech = technologies.find(t => t.name === techName);

    // Zkontrolujeme, zda se má tlačítko zobrazit: splňuje předpoklady a není již prozkoumaná
    if (tech && !tech.isResearched && tech.prerequisites.every(prereq => {
        const preTech = technologies.find(t => t.name === prereq);
        return preTech && preTech.isResearched;
    })) {
        button.style.display = 'inline-block';
    } else {
        button.style.display = 'none'; // Skryjeme tlačítko, pokud už je technologie prozkoumána
    }
});
}

function handleResearchCompletion(tech, cancelButton) {
    if (!tech.isResearched) {
        addLogEntry(`${tech.name} research complete!`, 'green');
        tech.isResearched = true;

        // Add the tech name to the researched tab
        const researchedContainer = document.querySelector('.tech-container.researched');
        const techName = document.createElement('p');
        techName.textContent = tech.name;
        researchedContainer.appendChild(techName);

        // Check for new available technologies
        const availableContainer = document.querySelector('.tech-container.available');
        const newAvailableTechs = [];
        technologies.forEach(t => {
            const techButton = document.querySelector(`.tech-button[data-tech='${t.name}']`);
            if (!t.isResearched && !techButton) {
                const allPrerequisitesResearched = t.prerequisites.every(prereq => {
                    const preTech = technologies.find(tech => tech.name === prereq);
                    return preTech && preTech.isResearched;
                });
                if (allPrerequisitesResearched) {
                    createTechButton(t.name, () => startResearch(t, cancelButton), availableContainer);
                    newAvailableTechs.push(t.name);
                }
            }
        });

        if (newAvailableTechs.length > 0) {
            addLogEntry(`New technologies available: ${newAvailableTechs.join(', ')}.`, 'blue');
        }
    }

    setResearchProgress(0);
    updateProgressBar(cancelButton);
    if (cancelButton) {
        cancelButton.style.display = 'none';
    }

    // Enable all tech buttons after research completion
    document.querySelectorAll('.tech-button').forEach(button => {
        button.disabled = false;
    });

    // Hide the button upon completion if it exists
    const techButton = document.querySelector(`.tech-button[data-tech='${tech.name}']`);
    if (techButton) {
        techButton.style.display = 'none';
        createdTechButtons.delete(tech.name);
    }

    setCurrentResearchingTech(null);
}