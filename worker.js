self.resources = [];

self.onmessage = function(event) {
    if (event.data.action === 'initializeResources') {
        self.resources = event.data.resources;
        updateResources();
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