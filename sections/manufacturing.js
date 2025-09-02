export function setupManufacturingSection(manufacturingSection) {
    miningSection.innerHTML = ''; // Clear any existing content
    miningSection.classList.add('manufacturing-bg'); 
// Create and add the header to the mining section
    const header = document.createElement('h2');
    header.textContent = 'Manufacturing';
    header.className = 'section-header';
    miningSection.appendChild(header);
	
	gameArea.appendChild(miningSection);
}