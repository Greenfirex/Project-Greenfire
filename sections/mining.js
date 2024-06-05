export function setupMiningSection() {
    const gameArea = document.getElementById('gameArea');
    const button = document.createElement('button');
    button.className = 'game-button';
    button.textContent = 'shfgfghrce';
    button.onclick = mineResource;
    gameArea.appendChild(button);
}

function mineResource() {
    console.log('Mining resource...');
    // Logika pro těžbu suroviny
}