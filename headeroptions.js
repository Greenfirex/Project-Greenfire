import { resetGameState, loadGameState } from './saveload.js';

document.addEventListener('DOMContentLoaded', () => {
  const optionsLink = document.getElementById('optionsLink');
  const optionsMenu = document.getElementById('optionsMenu');
  const closeButton = document.querySelector('.close-button');
  const resetButton = document.getElementById('resetButton');

  if (optionsLink && optionsMenu && closeButton && resetButton) {
    optionsLink.addEventListener('click', (event) => {
      event.preventDefault();
      optionsMenu.style.display = 'block';
    });

    closeButton.addEventListener('click', () => {
      optionsMenu.style.display = 'none';
    });

    resetButton.addEventListener('click', () => {
      if (confirm("Are you sure you want to reset your progress?")) {
        import('./saveload.js').then(module => {
          module.resetGameState();
          optionsMenu.style.display = 'none';
        });
      }
    });
// Close the popup if the user clicks outside of it
    window.addEventListener('click', (event) => {
      if (event.target === optionsMenu) {
        optionsMenu.style.display = 'none';
      }
    });
  } else {
    console.error('One or more elements are missing.');
  }
});