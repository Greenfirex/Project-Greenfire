export function setupManufacturingSection(manufacturingSection) {
    if (!manufacturingSection) {
        manufacturingSection = document.getElementById('manufacturingSection');
    }

    if (manufacturingSection) {
        manufacturingSection.innerHTML = '';
        manufacturingSection.classList.add('manufacturing-bg');

        const header = document.createElement('h2');
        header.textContent = 'Manufacturing';
        header.className = 'section-header';
        manufacturingSection.appendChild(header);

        gameArea.appendChild(manufacturingSection);
    }
}