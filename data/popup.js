// This function will be available globally for other scripts to import
export let showStoryPopup;

// This ensures all code inside only runs after the page is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    const storyPopup = document.getElementById('storyPopup');
    const popupTitle = document.getElementById('popupTitle');
    const popupMessage = document.getElementById('popupMessage');
    const popupCloseButton = storyPopup.querySelector('.popup-close');

    /**
     * Shows the story popup with a specific title and message.
     */
    showStoryPopup = function(title, message) {
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
        if (event.target === storyPopup) {
            hideStoryPopup();
        }
    });
});