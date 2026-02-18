// Job runtime logic and mutations
import { jobs } from './definitions/jobs.js';
import { gameFlags } from './gameFlags.js';
import { getMorale } from './morale.js';

// Re-export jobs array for backward compatibility
export { jobs };

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
    // Salvaged cooking equipment slightly improves camp foraging/water collection efficiency.
    if ((job.id === 'foraging' || job.id === 'water_collection') && gameFlags.cafeteriaCookerInstalled) multiplier *= 1.10;
    // Rain catchers boost water collection job
    if (job.id === 'water_collection' && gameFlags.rainCatchersInstalled) multiplier *= 1.10;
    // Purification Unit further boosts water collection
    if (job.id === 'water_collection' && gameFlags.purificationUnitInstalled) multiplier *= 1.15;
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

export function resetJobs() {
    jobs.forEach(job => {
        job.slots = 0;
        job.assigned = 0;
    });
}
