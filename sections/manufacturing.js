export function setupManufacturingSection() {
    let miningSection = document.getElementById('manufacturingSection');
    if (!miningSection) {
        miningSection = document.createElement('div');
        miningSection.id = 'manufacturingSection';
        miningSection.classList.add('game-section');
    }
    miningSection.innerHTML = ''; // Clear any existing content
    miningSection.classList.add('manufacturing-bg'); 
	

// Create and add the header to the mining section
    const header = document.createElement('h2');
    header.textContent = 'Manufacturing';
    header.className = 'section-header';
    miningSection.appendChild(header);
	
	gameArea.appendChild(miningSection);
}