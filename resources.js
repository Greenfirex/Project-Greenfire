let resources = {
    hydrogen: 0
};

function mineResource() {
    resources.hydrogen += 1;
    updateResourceDisplay();
}

function updateResourceDisplay() {
    const infoPanel = document.getElementById('infoPanel');
    infoPanel.innerHTML = `
        <p>Hydrogen: ${resources.hydrogen}</p>
    `;
}
