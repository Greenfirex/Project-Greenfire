export let jobs = [
    {
        id: 'foraging',
        name: 'Foraging',
        building: 'Foraging Camp',
        slots: 0,
        assigned: 0,
        // production: Food Rations per second per assigned crew
        produces: 'Food Rations',
        rate: 0.05
    },
    {
        id: 'water_collection',
        name: 'Water Collection',
        building: 'Water Station',
        slots: 0,
        assigned: 0,
        // production: Clean Water per second per assigned crew
        produces: 'Clean Water',
        rate: 0.08
    }
];

export function addSlotsForBuilding(buildingName, count = 1) {
    const job = jobs.find(j => j.building === buildingName);
    if (!job) return;
    job.slots = (job.slots || 0) + count;
}

export function removeSlotsForBuilding(buildingName, count = 1) {
    const job = jobs.find(j => j.building === buildingName);
    if (!job) return;
    job.slots = Math.max(0, (job.slots || 0) - count);
    // If assigned exceeds slots, unassign the excess back to survivors
    if (job.assigned > job.slots) {
        const excess = job.assigned - job.slots;
        job.assigned = job.slots;
        return excess;
    }
    return 0;
}

export function getJobById(id) {
    return jobs.find(j => j.id === id);
}