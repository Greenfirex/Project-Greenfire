export let resources = {
    hydrogen: 0,
    oxygen: 0,
    helium: 0,
    lithium: 0
};

export function addResource(resource, amount) {
    if (resources[resource] !== undefined) {
        resources[resource] += amount;
    }
}

export function getResource(resource) {
    return resources[resource] || 0;
}