import { resources, updateResourceInfo } from '../resources.js';
import { buildings } from '../data/buildings.js';
import { addLogEntry } from '../log.js';
import { unlockAllSections } from '../main.js';

export function setupMiningSection(miningSection) {
    if (!miningSection) {
        miningSection = document.getElementById('miningSection');
    }

    if (miningSection) {
        miningSection.innerHTML = '';
        miningSection.classList.add('mining-bg');

        const header = document.createElement('h2');
        header.textContent = 'Manual Gathering';
        header.className = 'section-header';
        miningSection.appendChild(header);

        createMiningButton('Mine Resource', mineResource, miningSection);
        createMiningButton('Mine Resource 2', mineResource2, miningSection);
        createMiningButton('Mine Resource 3', mineResource3, miningSection);
        createMiningButton('Mine Resource 4', mineResource4, miningSection);
        createMiningButton('Mine Resource 5', mineResource5, miningSection);
    }
}

function createMiningButton(text, callback, container) {
    const button = document.createElement('button');
    button.className = 'game-button';
    button.textContent = text;
    button.onclick = callback;
    container.appendChild(button);
}

// Manual Mining
function mineStone() {
    const stone = resources.find(r => r.name === 'Stone');
    if (stone) {
        stone.amount += 1;
        updateResourceInfo();
        addLogEntry('Manually mined 1 Stone.', 'blue');

        // Unlock all sections for testing after the first click
        if (stone.amount > 0) {
            unlockAllSections();
        }
    }
}