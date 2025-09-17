// Find the popup elements on the page
const storyPopup = document.getElementById('storyPopup');
const popupTitle = document.getElementById('popupTitle');
const popupMessage = document.getElementById('popupMessage');
// Important: Check that storyPopup exists before trying to find the button inside it
const popupCloseButton = storyPopup ? storyPopup.querySelector('.popup-close') : null;

/**
 * Shows the story popup with a specific title and message.
 */
export function showStoryPopup(title, message) {
    if (!storyPopup || !popupTitle || !popupMessage) {
        console.error("Popup HTML elements not found!");
        return;
    }

    popupTitle.textContent = title;
    popupMessage.textContent = message;
    storyPopup.classList.remove('hidden');
}

/**
 * Hides the story popup.
 */
function hideStoryPopup() {
    if (storyPopup) {
        storyPopup.classList.add('hidden');
    }
}

// Attach the event listeners, but only if all the elements were found
if (storyPopup && popupCloseButton) {
    popupCloseButton.addEventListener('click', hideStoryPopup);
    storyPopup.addEventListener('click', (event) => {
        // Only close if the click is on the dark background, not the popup window itself
        if (event.target === storyPopup) {
            hideStoryPopup();
        }
    });
} else {
    console.error("Could not attach popup close listeners. Check your HTML structure.");
}