document.addEventListener('DOMContentLoaded', () => {
    const changelogBtn = document.getElementById('changelogBtn');
    const changelogPopup = document.getElementById('changelogPopup');
    const closeBtn = changelogPopup?.querySelector('.changelog-close');
    const changelogBody = document.getElementById('changelogBody');

    let changelogLoaded = false; // Use a simple flag

    async function loadChangelog() {
        if (changelogLoaded) return; // Only load the content once
        
        try {
            const response = await fetch('./CHANGELOG.md');
            if (!response.ok) { // Check if the file was found
                throw new Error('Changelog.md not found');
            }
            const markdownText = await response.text();
            changelogBody.innerHTML = marked.parse(markdownText);
            changelogLoaded = true; // Set the flag
        } catch (error) {
            changelogBody.innerHTML = 'Error: Could not load changelog.';
            console.error('Error fetching changelog:', error);
        }
    }

    changelogBtn?.addEventListener('click', () => {
        changelogPopup.classList.remove('hidden');
        loadChangelog();
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