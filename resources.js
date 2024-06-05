let resources = {
    hydrogen: 0
};

function mineResource() {
    resources.hydrogen += 1;
    updateResourceDisplay();
}

function updateResourceDisplay() {
    const infoPanel = document.getElementById('infoPanel');
    infoPanel.innerHTML = `<h2>Resources Info</h2>
    <ul>
        <li id="hydrogen">Hydrogen: <span>${resources.hydrogen}</span></li>
        <li id="resource2">Resource 2: <span>50</span></li>
        <li id="resource3">Resource 3: <span>75</span></li>
        <!-- Zde můžete pokračovat s dalšími surovinami -->
    </ul>
        
    `;
}
