// ==========================================================================
// Location Registry
//
// All known locations are registered here. Each location is a self-contained
// definition file imported below. Adding a new location requires only:
//   1. Create definitions/<siteId>/<location>.js
//   2. Import and call registerLocation() below
//   3. Add locale keys (EN + CS)
// ==========================================================================

import { crewQuarters } from './definitions/gammaSite/crewQuarters.js';
import { workshop } from './definitions/gammaSite/workshop.js';

const locations = {};

/**
 * Register a location definition.
 * @param {object} def - { id, siteId, nameKey, image, descriptionKey, actions }
 */
export function registerLocation(def) {
    if (!def || !def.id) return;
    locations[def.id] = def;
}

export function getLocation(id) {
    return locations[id];
}

export function getAllLocations() {
    return { ...locations };
}

// ==========================================================================
// Current location state
// ==========================================================================

let _currentLocationId = 'crew_quarters';

export function getCurrentLocationId() {
    return _currentLocationId;
}

export function switchToLocation(id) {
    if (locations[id]) {
        _currentLocationId = id;
        return true;
    }
    return false;
}

// ==========================================================================
// Auto-register all known locations
// ==========================================================================

registerLocation(crewQuarters);
registerLocation(workshop);
