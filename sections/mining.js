import { resources, updateResourceInfo } from '../resources.js';
import { buildings } from '../data/buildings.js';
import { addLogEntry } from '../log.js';
import { setupTooltip } from '../main.js';

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

        const manualCategory = document.createElement('div');
        manualCategory.className = 'mining-category-container';

        const manualButtons = document.createElement('div');
        manualButtons.className = 'button-group';

        createMiningButton('Mine Stone', mineStone, manualButtons, 'Gain 1 Stone');

        manualCategory.appendChild(manualButtons);
        miningSection.appendChild(manualCategory);

        const miningHeader = document.createElement('h2');
        miningHeader.textContent = 'Mining';
        miningHeader.className = 'section-header';
        miningSection.appendChild(miningHeader);

        const miningCategory = document.createElement('div');
        miningCategory.className = 'mining-category-container';

        const miningButtons = document.createElement('div');
        miningButtons.className = 'button-group';

        const quarryBuildingData = buildings.find(b => b.name === 'Quarry');
        const extractorBuildingData = buildings.find(b => b.name === 'Extractor');

        createMiningButton('Build Quarry', buildQuarry, miningButtons, quarryBuildingData);

        const xylite = resources.find(r => r.name === 'Xylite');
        if (xylite && xylite.isDiscovered) {
            createMiningButton('Build Extractor', buildExtractor, miningButtons, extractorBuildingData);
        }

        miningCategory.appendChild(miningButtons);
        miningSection.appendChild(miningCategory);
    }
}

function createMiningButton(buttonText, callback, container, tooltipData) {
    const button = document.createElement('button');
    button.className = 'game-button';
    button.textContent = buttonText;
    button.addEventListener('click', callback); // Using addEventListener is more modern

    if (tooltipData) {
        setupTooltip(button, tooltipData);
    }

    container.appendChild(button);
}

function mineStone() {
    const stone = resources.find(r => r.name === 'Stone');
    if (stone) {
        stone.amount += 1;
        updateResourceInfo();
        addLogEntry('Manually mined 1 Stone.', 'blue');
    }
}

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