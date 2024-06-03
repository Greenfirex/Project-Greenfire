document.addEventListener('DOMContentLoaded', () => {
    showSection('mining');
});

function showSection(sectionId) {
    const sections = document.querySelectorAll('.game-section');
    sections.forEach(section => section.classList.remove('active'));

    document.getElementById(`${sectionId}Section`).classList.add('active');

    const gameArea = document.getElementById('gameArea');
    gameArea.className = ''; // Remove all current background classes
    gameArea.classList.add(`${sectionId}-bg`); // Add the new background class
}