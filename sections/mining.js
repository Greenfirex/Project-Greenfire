import { resources, updateResourceInfo } from '../resources.js';
import { buildings } from '../data/buildings.js';
import { addLogEntry } from '../log.js';
import { setupTooltip } from '../main.js';

function createMiningButton(buttonText, callback, container, buildingData) {
    const button = document.createElement('button');
    button.className = 'game-button';
    button.textContent = buttonText;
    button.onclick = callback;

    if (buildingData) {
        setupTooltip(button, buildingData);
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

export function setupMiningSection(miningSection) {
    if (!miningSection) {
        miningSection = document.getElementById('miningSection');
    }

    if (miningSection) {
        miningSection.innerHTML = '';
        miningSection.classList.add('mining-bg');

        // Nadpis kategorie 1: Manual Gathering
        const manualGatheringHeader = document.createElement('h2');
        manualGatheringHeader.textContent = 'Manual Gathering';
        manualGatheringHeader.className = 'section-header';
        miningSection.appendChild(manualGatheringHeader);

        // Kontejner pro tlačítka manuální těžby
        const manualButtons = document.createElement('div');
        manualButtons.className = 'button-group';
        
        // Přidání tlačítka "Mine Stone" do skupiny pro manuální těžbu
        createMiningButton('Mine Stone', mineStone, manualButtons);
        
        miningSection.appendChild(manualButtons);

        // Nadpis kategorie 2: Mining
        const miningHeader = document.createElement('h2');
        miningHeader.textContent = 'Mining';
        miningHeader.className = 'section-header';
        miningSection.appendChild(miningHeader);

        // Kontejner pro tlačítka těžby (budovy)
        const miningButtons = document.createElement('div');
        miningButtons.className = 'button-group';
        
        // Tlačítko pro stavbu Quarry
        createMiningButton('Build Quarry', buildQuarry, miningButtons);
        
        // Tlačítko pro stavbu Extractor (podmíněně viditelné)
        const xylite = resources.find(r => r.name === 'Xylite');
        if (xylite && xylite.isDiscovered) {
            createMiningButton('Build Extractor', buildExtractor, miningButtons);
        }
        
        miningSection.appendChild(miningButtons);
    }
}