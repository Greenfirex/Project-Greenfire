// ==========================================================================
// Location Registry
//
// All known locations are registered here. Each location is a self-contained
// definition file imported below. Adding a new location requires only:
//   1. Create definitions/<siteId>/<location>.js
//   2. Import and call registerLocation() below
//   3. Add locale keys (EN + CS)
// ==========================================================================

import { scoutShipCrewQuarters } from './definitions/scoutShip/scoutShipCrewQuarters.js';
import { scoutShipMainArea } from './definitions/scoutShip/mainArea.js';
import { scoutShipBridge } from './definitions/scoutShip/bridge.js';
import { scoutShipWorkshop } from './definitions/scoutShip/scoutShipWorkshop.js';
import { gammaCrewQuarters } from './definitions/gammaSite/gammaCrewQuarters.js';
import { workshop } from './definitions/gammaSite/workshop.js';
import { gammaSiteLandingSite } from './definitions/gammaSite/landingSite.js';
import { playTravel, startAmbient, stopAmbient } from '../../engine/audio.js';

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

let _currentLocationId = 'scout_ship_crew_quarters';

export function getCurrentLocationId() {
    return _currentLocationId;
}

export function switchToLocation(id) {
    if (locations[id]) {
        // Audio: travel sound + ambient switch
        if (_currentLocationId !== id) {
            try { playTravel(); } catch { /* ignore */ }
            try { stopAmbient(); } catch { /* ignore */ }
        }
        _currentLocationId = id;
        try { startAmbient(id); } catch { /* ignore */ }
        return true;
    }
    return false;
}

// ==========================================================================
// Auto-register all known locations
// ==========================================================================

registerLocation(scoutShipCrewQuarters);
registerLocation(scoutShipMainArea);
registerLocation(scoutShipBridge);
registerLocation(scoutShipWorkshop);
registerLocation(gammaCrewQuarters);
registerLocation(workshop);
registerLocation(gammaSiteLandingSite);
