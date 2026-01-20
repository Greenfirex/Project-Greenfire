import { resources } from '../core/resources.js';
import { buildings } from '../data/definitions/buildings.js';

export function setupManufacturingSection(manufacturingSection) {
    if (!manufacturingSection) {
        manufacturingSection = document.getElementById('manufacturingSection');
    }
    if (!manufacturingSection) return;

    const workshop = Array.isArray(buildings) ? buildings.find(b => b && b.name === 'Workshop') : null;
    const hasWorkshop = !!(workshop && (workshop.count || 0) > 0);
    const bp = Array.isArray(resources) ? resources.find(r => r && r.name === 'Worker Drone Blueprint') : null;
    const hasBlueprint = !!(bp && (Number(bp.amount) || 0) > 0);

    manufacturingSection.innerHTML = `
        <h2>Manufacturing</h2>
        <p>Feature coming soon...</p>
        <h3>Blueprints</h3>
        ${hasBlueprint
            ? `<p><strong>Worker Drone Blueprint</strong> acquired.${hasWorkshop ? '' : ' Build a Workshop to use it.'}</p>`
            : `<p>No blueprints acquired yet.</p>`}
    `;
}