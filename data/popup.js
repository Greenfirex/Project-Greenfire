const storyPopup = document.getElementById('storyPopup');
const popupTitle = document.getElementById('popupTitle');
const popupMessage = document.getElementById('popupMessage');
const popupCloseButton = storyPopup.querySelector('.popup-close');

/**
 * Shows the story popup with a specific title and message.
 * @param {string} title - The title to display in the popup.
 * @param {string} message - The story message to display.
 */
export function showStoryPopup(title, message) {
    if (!storyPopup || !popupTitle || !popupMessage) { return; }

    popupTitle.textContent = title;
    popupMessage.textContent = message;
    storyPopup.classList.remove('hidden');
}

function hideStoryPopup() {
    storyPopup.classList.add('hidden');
}

// Add event listeners to close the popup
popupCloseButton.addEventListener('click', hideStoryPopup);
storyPopup.addEventListener('click', (event) => {
    // Only close if the user clicks on the overlay itself, not the content window
    if (event.target === storyPopup) {
        hideStoryPopup();
    }
});