export function setupResearchSection() {
    const gameArea = document.getElementById('gameArea');
    const button = document.createElement('button');
    button.className = 'game-button';
    button.textContent = 'Research Tech';
    button.onclick = researchTech;
    gameArea.appendChild(button);
}

function researchTech() {
    console.log('Researching technology...');
    // Logika pro výzkum technologie
}