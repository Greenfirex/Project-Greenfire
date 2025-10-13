import { saveGameState, loadGameState, resetGameState } from './saveload.js';

document.addEventListener('DOMContentLoaded', () => {

    const optionsLink = document.getElementById('optionsLink');
    const optionsMenu = document.getElementById('optionsMenu');
    const closeButton = optionsMenu?.querySelector('.close-button');
    const resetButton = document.getElementById('resetButton');
    const saveLink = document.getElementById('saveLink');
    const loadLink = document.getElementById('loadLink');

    function showOptionsMenu(event) {
        event.preventDefault();
        if (optionsMenu) {
            optionsMenu.classList.remove('hidden');
        }
    }

    function hideOptionsMenu() {
        if (optionsMenu) {
            optionsMenu.classList.add('hidden');
        }
    }

    // --- Event Listeners ---
    if (optionsLink) {
        optionsLink.addEventListener('click', showOptionsMenu);
    }
    if (closeButton) {
        closeButton.addEventListener('click', hideOptionsMenu);
    }
    if (optionsMenu) {
        optionsMenu.addEventListener('click', (event) => {
            if (event.target === optionsMenu) {
                hideOptionsMenu();
            }
        });
    }
    if (resetButton) {
        resetButton.addEventListener('click', () => {
            if (confirm("Are you sure you want to reset your progress? This cannot be undone.")) {
                localStorage.setItem('isResetting', 'true');
                location.reload();
            }
        });
    }
    if (saveLink) {
        saveLink.addEventListener('click', (e) => {
            e.preventDefault();
            saveGameState();
        });
    }
    if (loadLink) {
        loadLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm("Are you sure you want to load your last save? Any unsaved progress will be lost.")) {
                localStorage.removeItem('isResetting'); // Ensure we're not in a reset loop
                location.reload();
            }
        });
    }
});

// This handles the clock at the top of the screen
function updateTime() {
    const timeElement = document.getElementById('currentTime');
    if (timeElement) {
        const now = new Date();
        timeElement.textContent = now.toLocaleTimeString();
    }
}
setInterval(updateTime, 1000);
updateTime();