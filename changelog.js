document.addEventListener('DOMContentLoaded', () => {
    const changelogBtn = document.getElementById('changelogBtn');
    const changelogPopup = document.getElementById('changelogPopup');
    const closeBtn = changelogPopup?.querySelector('.changelog-close');
    const changelogBody = document.getElementById('changelogBody');

    // Function to load and render the changelog
    async function loadChangelog() {
        if (changelogBody.innerHTML !== '') return; // Don't load it twice
        try {
            const response = await fetch('./CHANGELOG.md');
            const markdownText = await response.text();
            // Use the 'marked' library we imported to convert the text to HTML
            changelogBody.innerHTML = marked.parse(markdownText);
        } catch (error) {
            changelogBody.innerHTML = 'Error: Could not load changelog.';
            console.error('Error fetching changelog:', error);
        }
    }

    changelogBtn?.addEventListener('click', () => {
        loadChangelog(); // Load the content when the popup is opened
        changelogPopup.classList.remove('hidden');
    });

    closeBtn?.addEventListener('click', () => {
        changelogPopup.classList.add('hidden');
    });

    changelogPopup?.addEventListener('click', (e) => {
        if (e.target === changelogPopup) {
            changelogPopup.classList.add('hidden');
        }
    });
});