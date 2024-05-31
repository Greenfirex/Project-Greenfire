export let resources = {
    hydrogen: 0
};

export function addResource(resourceType, amount) {
    if (resources[resourceType] !== undefined) {
        resources[resourceType] += amount;
    }
}

export function getResource(resourceType) {
    return resources[resourceType];
}