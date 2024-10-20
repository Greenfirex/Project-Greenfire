self.resources = [];

self.onmessage = function(event) {
    if (event.data.action === 'initializeResources') {
        self.resources = event.data.resources;
        updateResources();
    } else if (event.data.action === 'saveGameState') {
        postMessage({ action: 'saveGameState', resources: resources });
    }
};

function incrementResources() {
    resources.forEach(resource => {
        resource.amount += resource.generationRate;
        resource.amount = parseFloat(resource.amount.toFixed(2));
    });
}

function updateResources() {
    setInterval(() => {
        incrementResources();
        postMessage({ action: 'updateResources', resources: resources });
    }, 100);
}