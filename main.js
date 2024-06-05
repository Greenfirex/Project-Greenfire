document.addEventListener('DOMContentLoaded', () => {
    preloadImages();
    showSection('mining');
});

function preloadImages() {
    const images = [
        'assets/images/background1.jpg',
        'assets/images/background2.jpg',
        'assets/images/background3.jpg',
        'assets/images/background4.jpg',
        'assets/images/background5.jpg',
	'../assets/images/PNG/Button03.png',
        '../assets/images/PNG/Button04.png',
    ];
    
    images.forEach((image) => {
        const img = new Image();
        img.src = image;
    });
}

function showSection(sectionId) {
const gameArea = document.getElementById('gameArea');
    gameArea.innerHTML = ''; // Vymaže předchozí tlačítka
    gameArea.className = ''; // Odstraní všechny aktuální třídy pozadí
    gameArea.classList.add(`${sectionId}-bg`); // Přidá novou třídu pozadí

    // Dynamicky přidá tlačítka podle aktuální sekce
    if (sectionId === 'mining') {
        createGameButton('Mine Resource', mineResource);
    } else if (sectionId === 'other1') {
        createGameButton('Other Action 1', otherAction1);
    } else if (sectionId === 'other2') {
        createGameButton('Other Action 2', otherAction2);
    }
    // Další sekce podle potřeby

}    

function createGameButton(text, callback) {
    const gameArea = document.getElementById('gameArea');
    const button = document.createElement('button');
    button.className = 'game-button';
    button.textContent = text;
    button.onclick = callback;
    gameArea.appendChild(button);
}