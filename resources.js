export function updateResourceInfo() {
    const infoPanel = document.getElementById('infoPanel');
    infoPanel.innerHTML = ''; // Vyčistíme info panel

        resources.forEach(resource => {
        const resourceDiv = document.createElement('div');
        resourceDiv.className = 'info-section';
        
        const column1 = document.createElement('div');
        const column2 = document.createElement('div');
        const column3 = document.createElement('div');

        column1.className = 'infocolumn1';
        column2.className = 'infocolumn2';
        column3.className = 'infocolumn3';

        const nameElement = document.createElement('h3');
        nameElement.textContent = resource.name;

        const generationElement = document.createElement('p');
        generationElement.textContent = `${resource.generationRate}/s`;

        const storageElement = document.createElement('p');
        storageElement.textContent = `Stored: ${resource.amount}`;

        column1.appendChild(nameElement);
        column2.appendChild(generationElement);
        column3.appendChild(storageElement);

        resourceDiv.appendChild(column1);
        resourceDiv.appendChild(column2);
        resourceDiv.appendChild(column3);

        infoPanel.appendChild(resourceDiv);
    });
}
export function incrementResources() {
    resources.forEach(resource => {
        resource.amount += resource.generationRate;
        resource.amount = parseFloat(resource.amount.toFixed(2));
    });
}

export let resources = [
    { name: 'Stone', generationRate: 0, amount: 0, isDiscovered: true },
    { name: 'Xylite', generationRate: 0, amount: 0, isDiscovered: false },
];
