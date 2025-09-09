import { resources, updateResourceInfo } from '../resources.js';
import { buildings } from '../data/buildings.js';
import { addLogEntry } from '../log.js';
import { unlockAllSections } from '../main.js';

// Helper function to create a button
function createMiningButton(text, callback, container) {
    const button = document.createElement('button');
    button.className = 'game-button';
    button.textContent = text;
    button.onclick = callback;
    container.appendChild(button);
}

// Manual Mining: adds 1 Stone on click
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

// Building Logic: builds a Quarry
function buildQuarry() {
    const quarry = buildings.find(b => b.name === 'Quarry');
    const stone = resources.find(r => r.name === 'Stone');

    if (!quarry || !stone) {
        addLogEntry('Could not find Quarry or Stone.', 'red');
        return;
    }

    const cost = quarry.cost.find(c => c.resource === 'Stone');

    if (cost && stone.amount >= cost.amount) {
        stone.amount -= cost.amount;
        quarry.count += 1;
        addLogEntry('Built a new Quarry! Automatic Stone production has increased.', 'green');
        updateResourceInfo();
    } else {
        addLogEntry('Not enough Stone to build a Quarry.', 'red');
    }
}

// Building Logic: builds an Extractor
function buildExtractor() {
    const extractor = buildings.find(b => b.name === 'Extractor');
    const stone = resources.find(r => r.name === 'Stone');

    if (!extractor || !stone) {
        addLogEntry('Could not find Extractor or Stone.', 'red');
        return;
    }

    const cost = extractor.cost.find(c => c.resource === 'Stone');

    if (cost && stone.amount >= cost.amount) {
        stone.amount -= cost.amount;
        extractor.count += 1;
        addLogEntry('Built a new Extractor! Automatic Xylite production has increased.', 'green');
        updateResourceInfo();
    } else {
        addLogEntry('Not enough Stone to build an Extractor.', 'red');
    }
}

// The main function that sets up the mining section
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

        // Connect the specific functions to the buttons
        createMiningButton('Mine Stone', mineStone, miningSection);
        createMiningButton('Build Quarry', buildQuarry, miningSection);
        createMiningButton('Build Extractor', buildExtractor, miningSection);
    }
}