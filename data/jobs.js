import { gameFlags } from './gameFlags.js';
import { getMorale } from './morale.js';

export let jobs = [
    {
        id: 'foraging',
        name: 'Foraging',
        building: 'Foraging Camp',
        slots: 0,
        assigned: 0,
        // production: Food Rations per second per assigned crew
        produces: 'Food Rations',
        rate: 0.09
    },
    {
        id: 'water_collection',
        name: 'Water Collection',
        building: 'Water Station',
        slots: 0,
        assigned: 0,
        // production: Clean Water per second per assigned crew
        produces: 'Clean Water',
        rate: 0.12
    },
    // Scrap Collector — unlocked by Establish Base Camp; unlimited assignments once unlocked
    {
        id: 'scrap_collector',
        name: 'Scrap Collector',
        building: 'Base Camp',
        slots: 0,
        assigned: 0,
        produces: 'Scrap Metal',
        rate: 0.06,
        unlimited: false
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

// Return the effective per-second production for a job (per assigned crew)
export function getEffectiveJobRate(jobOrId) {
    const job = typeof jobOrId === 'string' ? jobs.find(j => j.id === jobOrId) : jobOrId;
    if (!job) return 0;
    let multiplier = 1.0;
    if (job.id === 'foraging' && gameFlags.improvedForagingTools) multiplier *= 1.25;
    // Rain catchers boost water collection job
    if (job.id === 'water_collection' && gameFlags.rainCatchersInstalled) multiplier *= 1.10;
    // Purification Unit further boosts water collection
    if (job.id === 'water_collection' && gameFlags.purificationUnitInstalled) multiplier *= 1.20;
    // Scavenger Kit improves scrap collection
    if (job.id === 'scrap_collector' && gameFlags.scavengerKitInstalled) multiplier *= 1.20;
    // Global Morale affects all job outputs (but not passive consumption or action drains)
    try {
        const morale = getMorale();
        multiplier *= (morale && morale.multiplier) ? morale.multiplier : 1;
    } catch {}
    // add more job-specific multipliers here as flags are added
    return job.rate * multiplier;
}