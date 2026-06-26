// ==========================================================================
// Location: Scout Ship — Workshop
// ==========================================================================

import { hasLogin, setMilestone, hasMilestone } from '../../../../engine/gameFlags.js';

function persistLoopKnowledge(ctx) {
    try {
        const state = JSON.parse(localStorage.getItem('gameState') || '{}');
        if (!state.gameFlags) state.gameFlags = {};
        if (!state.gameFlags.loopKnowledge) state.gameFlags.loopKnowledge = { milestones: {} };
        state.gameFlags.loopKnowledge = { milestones: { ...ctx.gameFlags.loopKnowledge?.milestones } };
        localStorage.setItem('gameState', JSON.stringify(state));
    } catch { /* ignore */ }
}

export const scoutShipWorkshop = {
    id: 'scout_ship_workshop',
    siteId: 'scout_ship',
    nameKey: 'loc_scout_ship_workshop',
    image: 'assets/images/localmap/workshop.png',
    descriptionKey: 'loc_scout_ship_workshop_desc',
    pois: [
        {
            id: 'workbench',
            nameKey: 'poi_workbench',
            actions: ['repair_ship_systems', 'search_for_login_note', 'grab_tools']
        },
        {
            id: 'prototype_bench',
            nameKey: 'poi_prototype_bench',
            actions: ['tinker_device']
        },
        {
            id: 'fabricator',
            nameKey: 'poi_fabricator',
            actions: ['fabricate_parts']
        },
        {
            id: 'travel',
            nameKey: 'poi_travel',
            actions: ['go_to_main_area']
        }
    ],
    actions: [
        {
            id: 'repair_ship_systems',
            nameKey: 'action_repair_ship_systems',
            descKey: 'action_repair_ship_systems_desc',
            category: 'taxing',
            drain: [{ resource: 'Stamina', amount: 6 }],
            rewards: [{ type: 'resource', name: 'Food Rations', amount: 1 }, { type: 'resource', name: 'Drinking Water', amount: 1 }],
            durationSeconds: 30,
            repeatable: true,
            resultKey: 'result_repair_ship_systems'
        },
        {
            id: 'search_for_login_note',
            nameKey: 'action_search_for_login_note',
            descKey: 'action_search_for_login_note_desc',
            drain: [{ resource: 'Stamina', amount: 2 }],
            rewards: [{ type: 'item', name: 'Terminal Login Note', amount: 1 }],
            durationSeconds: 10,
            oneTime: true,
            resultKey: 'result_search_for_login_note',
            onComplete(ctx) {
                setMilestone('login_note_found', () => persistLoopKnowledge(ctx));
                // If terminals were already examined, retroactively unhide "Use Login Note"
                try {
                    const crewLoc = ctx.getLocation('scout_ship_crew_quarters');
                    if (crewLoc) {
                        const crewUs = ctx.getUnlockState('scout_ship_crew_quarters');
                        if (crewUs['check_terminal']) {
                            const useA = (crewLoc.actions || []).find(a => a.id === 'use_terminal_login');
                            if (useA && useA._completed) { useA._completed = false; ctx.flagActionAsNew('use_terminal_login'); }
                        }
                    }
                } catch { /* ignore */ }
                try {
                    const bridgeLoc = ctx.getLocation('scout_ship_bridge');
                    if (bridgeLoc) {
                        const bridgeUs = ctx.getUnlockState('scout_ship_bridge');
                        if (bridgeUs['check_bridge_terminal']) {
                            const useA = (bridgeLoc.actions || []).find(a => a.id === 'use_bridge_terminal_login');
                            if (useA && useA._completed) { useA._completed = false; ctx.flagActionAsNew('use_bridge_terminal_login'); }
                        }
                    }
                } catch { /* ignore */ }
                ctx.setFullRebuildNeeded(true);
            }
        },
        {
            id: 'tinker_device',
            nameKey: 'action_tinker_device',
            descKey: 'action_tinker_device_desc',
            category: 'persistent',
            drain: [],
            durationSeconds: 300,
            oneTime: true,
            resultKey: 'result_tinker_device'
        },
        {
            id: 'fabricate_parts',
            nameKey: 'action_fabricate_parts',
            descKey: 'action_fabricate_parts_desc',
            category: 'simple',
            drain: [{ resource: 'Stamina', amount: 4 }],
            rewards: [{ type: 'resource', name: 'Food Rations', amount: 2 }],
            durationSeconds: 20,
            oneTime: true,
            resultKey: 'result_fabricate_parts'
        },
        {
            id: 'grab_tools',
            nameKey: 'action_grab_tools',
            descKey: 'action_grab_tools_desc',
            drain: [{ resource: 'Stamina', amount: 1 }],
            rewards: [{ type: 'item', name: 'Repair Tools', amount: 1 }],
            durationSeconds: 5,
            oneTime: true,
            resultKey: 'result_grab_tools',
            isAvailable(ctx) {
                // Requires: player attempted recycler repair AND read the book
                if (!ctx.gameFlags.recyclerAttempted) return false;
                if (!hasMilestone('book_read')) return false;
                return true;
            }
        },
        {
            id: 'go_to_main_area',
            nameKey: 'action_go_to_main_area',
            descKey: 'action_go_to_main_area_desc',
            drain: [],
            durationSeconds: 3,
            repeatable: true,
            targetLocation: 'scout_ship_main_area',
            resultKey: 'result_go_to_main_area'
        }
    ]
};