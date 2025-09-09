import { saveGameState, loadGameState, resetGameState } from './saveload.js';

document.addEventListener('DOMContentLoaded', () => {
    const optionsLink = document.getElementById('optionsLink');
    const optionsMenu = document.getElementById('optionsMenu');
    const closeButton = document.querySelector('.close-button');
    const resetButton = document.getElementById('resetButton');
    const saveLink = document.getElementById('saveLink');
    const loadLink = document.getElementById('loadLink');

    const addClickListener = (element, callback) => {
        if (element) {
            element.addEventListener('click', (event) => {
                event.preventDefault();
                callback();
            });
        } else {
            console.error('Element not found: ', element);
        }
    };

    if (optionsLink && optionsMenu && closeButton && resetButton && saveLink && loadLink) {
        addClickListener(optionsLink, () => {
            optionsMenu.style.display = 'block';
        });

        addClickListener(closeButton, () => {
            optionsMenu.style.display = 'none';
        });

        addClickListener(resetButton, () => {
            if (confirm("Are you sure you want to reset your progress?")) {
                resetGameState();
            }
        });

        addClickListener(saveLink, () => {
            saveGameState();
            console.log('Game state saved');
        });

        addClickListener(loadLink, () => {
            loadGameState();
            console.log('Game state loaded');
        });

        window.addEventListener('click', (event) => {
            if (event.target === optionsMenu) {
                optionsMenu.style.display = 'none';
            }
        });
    } else {
        console.error('One or more elements are missing.');
    }
});

function updateTime() {
    const timeElement = document.getElementById('currentTime');
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    timeElement.textContent = `${hours}:${minutes}:${seconds}`;
}

setInterval(updateTime, 1000);

updateTime();