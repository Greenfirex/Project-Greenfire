// ==========================================================================
// Location: Scout Ship — Bridge / Cockpit
// ==========================================================================

import { setMilestone, hasMilestone } from '../../../../engine/gameFlags.js';
import { hasEffect, removeEffect } from '../../../../engine/effects.js';

export const scoutShipBridge = {
    id: 'scout_ship_bridge',
    siteId: 'scout_ship',
    nameKey: 'loc_scout_ship_bridge',
    image: 'assets/images/localmap/cockpit.png',
    descriptionKey: 'loc_scout_ship_bridge_desc',
    pois: [
        {
            id: 'navigation',
            nameKey: 'poi_navigation',
            actions: ['check_navigation', 'scan_planet_surface', 'scan_gamma_site', 'set_course_gamma', 'land_ship']
        },
        {
            id: 'controls',
            nameKey: 'poi_controls',
            actions: ['check_status']
        },
        {
            id: 'engineering',
            nameKey: 'poi_engineering',
            actions: ['check_bridge_terminal', 'check_reactor_status', 'optimize_reactor', 'remove_engine_panel', 'install_rover_fuel_cell', 'hack_bridge_terminal', 'use_bridge_terminal_login', 'enter_known_credentials_bridge']
        },
        {
            id: 'travel',
            nameKey: 'poi_travel',
            actions: ['go_to_main_area']
        }
    ],
    actions: [
        {
            id: 'check_navigation',
            nameKey: 'action_check_navigation',
            descKey: 'action_check_navigation_desc',
            drain: [{ resource: 'Stamina', amount: 2 }],
            durationSeconds: 8,
            oneTime: true,
            getResultKey(ctx) {
                const m = ctx.gameFlags.loopKnowledge?.milestones || {};
                if (m.gamma_coordinates_known) return 'result_check_navigation_coords';
                if (hasMilestone('planet_scanned')) return 'result_check_navigation_known';
                if (hasMilestone('navigation_checked')) return 'result_check_navigation_loop';
                return 'result_check_navigation_first';
            },
            onComplete(ctx) {
                if (!hasMilestone('navigation_checked')) {
                    setMilestone('navigation_checked', () => ctx.persistLoopKnowledge());
                    ctx.flagActionAsNew('scan_planet_surface');
                    ctx.setFullRebuildNeeded(true);
                }
            },
        },
        {
            id: 'scan_planet_surface',
            nameKey: 'action_scan_planet_surface',
            descKey: 'action_scan_planet_surface_desc',
            category: 'persistent',
            drain: [],
            durationSeconds: 120,
            oneTime: true,
            isAvailable(ctx) {
                const m = ctx.gameFlags.loopKnowledge?.milestones || {};
                if (m.gamma_coordinates_known) return false;
                return hasMilestone('navigation_checked') && !hasMilestone('planet_scanned');
            },
            resultKey: 'result_scan_planet_surface',
            onComplete(ctx) {
                setMilestone('planet_scanned', () => ctx.persistLoopKnowledge());
                ctx.setFullRebuildNeeded(true);
            },
        },
        {
            id: 'scan_gamma_site',
            nameKey: 'action_scan_gamma_site',
            descKey: 'action_scan_gamma_site_desc',
            category: 'persistent',
            drain: [],
            durationSeconds: 60,
            oneTime: true,
            isAvailable(ctx) {
                const m = ctx.gameFlags.loopKnowledge?.milestones || {};
                return !!m.gamma_coordinates_known && !hasMilestone('gamma_site_confirmed_on_scanner');
            },
            resultKey: 'result_scan_gamma_site',
            onComplete(ctx) {
                setMilestone('gamma_site_confirmed_on_scanner', () => ctx.persistLoopKnowledge());
                ctx.setFullRebuildNeeded(true);
            },
        },
        {
            id: 'check_bridge_terminal',
            nameKey: 'action_check_bridge_terminal',
            descKey: 'action_check_bridge_terminal_desc',
            drain: [{ resource: 'Stamina', amount: 3 }],
            durationSeconds: 15,
            oneTime: true,
            isAvailable(ctx) {
                if (hasMilestone('bridge_terminal_access')) return false;
                return true;
            },
            getResultKey(ctx) {
                const m = ctx.gameFlags.loopKnowledge?.milestones || {};
                const loop = ctx.gameFlags.loopCount || 0;
                const alreadyChecked = m.bridge_terminal_checked;
                const known = hasMilestone('crew_terminal_access');

                if (!alreadyChecked) {
                    if (known) return 'result_check_bridge_terminal_first_has_login';
                    return 'result_check_bridge_terminal';
                }
                if (loop >= 2) return 'result_check_bridge_terminal_loop2';
                if (loop >= 1) return 'result_check_bridge_terminal_loop1';
                return 'result_check_bridge_terminal_known';
            },
            onComplete(ctx) {
                setMilestone('bridge_terminal_checked', () => ctx.persistLoopKnowledge());
                const loc = ctx.getLocation(ctx.getCurrentLocationId());
                if (!loc) return;
                const unlockState = ctx.getUnlockState(loc.id);
                unlockState['check_bridge_terminal'] = true;
                ctx.setUnlockState(loc.id, unlockState);
                ctx.setFullRebuildNeeded(true);
            }
        },
        {
            id: 'check_reactor_status',
            nameKey: 'action_check_reactor_status',
            descKey: 'action_check_reactor_status_desc',
            drain: [{ resource: 'Stamina', amount: 3 }],
            durationSeconds: 15,
            oneTime: true,
            suppressCompletionLog: true,
            isAvailable(ctx) {
                return hasMilestone('bridge_terminal_access');
            },
            revealsAreaSupplies: true,
            getResultKey(ctx) {
                return null;
            },
            unlocks: ['optimize_reactor'],
            onComplete(ctx) {
                setMilestone('fuel_scanned', () => ctx.persistLoopKnowledge());
                const bridgeList = ctx.areaResources['scout_ship_bridge'];
                const fuel = bridgeList && Array.isArray(bridgeList) ? bridgeList.find(r => r.name === 'area_fuel') : null;
                const currentFuel = fuel ? Math.round(fuel.amount) : 0;
                const FUEL_DRAIN_PER_MIN = ctx.gameFlags.reactorOptimized ? 1.20 : 1.80;
                const projectedMins = Math.round(currentFuel / FUEL_DRAIN_PER_MIN);
                let resultKey = 'result_check_reactor_status';
                ctx.addLogEntry(ctx.t(resultKey, { fuel: currentFuel, minutes: projectedMins }), ctx.LogType.SUCCESS);
                ctx.setFullRebuildNeeded(true);
            }
        },
        {
            id: 'hack_bridge_terminal',
            nameKey: 'action_hack_bridge_terminal',
            descKey: 'action_hack_bridge_terminal_desc',
            category: 'persistent',
            drain: [],
            durationSeconds: 180,
            oneTime: true,
            resultKey: 'result_hack_bridge_terminal',
            isAvailable(ctx) {
                const us = ctx.getUnlockState(ctx.getCurrentLocationId());
                if (!us['check_bridge_terminal']) return false;
                if (hasMilestone('bridge_terminal_access')) return false;
                return true;
            },
            hides: ['use_bridge_terminal_login', 'enter_known_credentials_bridge'],
            onComplete(ctx) {
                setMilestone('bridge_terminal_hacked', () => ctx.persistLoopKnowledge());
                setMilestone('bridge_terminal_access', () => ctx.persistLoopKnowledge());
                const us = ctx.getUnlockState(ctx.getCurrentLocationId());
                us['hack_bridge_terminal'] = true;
                ctx.setUnlockState(ctx.getCurrentLocationId(), us);
                ctx.setFullRebuildNeeded(true);
            },
        },
        {
            id: 'use_bridge_terminal_login',
            nameKey: 'action_use_bridge_terminal_login',
            descKey: 'action_use_bridge_terminal_login_desc',
            drain: [{ resource: 'Stamina', amount: 1 }],
            durationSeconds: 3,
            oneTime: true,
            resultKey: 'result_use_bridge_terminal_login',
            requiresItem: 'terminal_login_note',
            isAvailable(ctx) {
                const us = ctx.getUnlockState(ctx.getCurrentLocationId());
                if (!us['check_bridge_terminal']) return false;
                if (!hasMilestone('login_note_found')) return false;
                if (ctx.countItemInBag('terminal_login_note') <= 0) return false;
                if (hasMilestone('bridge_terminal_access')) return false;
                if (hasMilestone('crew_terminal_access')) return false;
                return true;
            },
            hides: ['hack_bridge_terminal', 'enter_known_credentials_bridge'],
            onComplete(ctx) {
                setMilestone('bridge_terminal_note_used', () => ctx.persistLoopKnowledge());
                setMilestone('bridge_terminal_access', () => ctx.persistLoopKnowledge());
                const us = ctx.getUnlockState(ctx.getCurrentLocationId());
                us['use_bridge_terminal_login'] = true;
                ctx.setUnlockState(ctx.getCurrentLocationId(), us);
                ctx.setFullRebuildNeeded(true);
            },
        },
        {
            id: 'enter_known_credentials_bridge',
            nameKey: 'action_enter_known_credentials_bridge',
            descKey: 'action_enter_known_credentials_bridge_desc',
            drain: [{ resource: 'Stamina', amount: 1 }],
            durationSeconds: 3,
            oneTime: true,
            isAvailable(ctx) {
                const us = ctx.getUnlockState(ctx.getCurrentLocationId());
                if (!us['check_bridge_terminal']) return false;
                // Visible when player already has crew access (knows the password from crew quarters)
                if (!hasMilestone('crew_terminal_access')) return false;
                if (hasMilestone('bridge_terminal_access')) return false;
                return true;
            },
            getResultKey(ctx) {
                const loop = ctx.gameFlags.loopCount || 0;
                if (loop >= 2) return 'result_enter_known_credentials_bridge_loop2';
                return 'result_enter_known_credentials_bridge';
            },
            hides: ['hack_bridge_terminal', 'use_bridge_terminal_login'],
            onComplete(ctx) {
                setMilestone('bridge_terminal_access', () => ctx.persistLoopKnowledge());
                const us = ctx.getUnlockState(ctx.getCurrentLocationId());
                us['enter_known_credentials_bridge'] = true;
                ctx.setUnlockState(ctx.getCurrentLocationId(), us);
                ctx.setFullRebuildNeeded(true);
            },
        },
        {
            id: 'optimize_reactor',
            nameKey: 'action_optimize_reactor',
            descKey: 'action_optimize_reactor_desc',
            category: 'taxing',
            drain: [{ resource: 'Stamina', amount: 4 }],
            durationSeconds: 30,
            durationIfRemembered: 10,
            oneTime: true,
            remembersCondition(ctx) { return hasMilestone('reactor_optimized'); },
            isAvailable(ctx) {
                const us = ctx.getUnlockState(ctx.getCurrentLocationId());
                return !!us['check_reactor_status'];
            },
            onStart(ctx) {
                if (!hasMilestone('bridge_terminal_access')) {
                    ctx.addLogEntry(ctx.t('log_need_terminal_login'), ctx.LogType.ERROR);
                    return { block: true };
                }
                if (ctx.gameFlags.reactorOptimized) return { block: true };
                if (hasMilestone('reactor_optimized')) {
                    ctx.action.durationSeconds = ctx.action.durationIfRemembered;
                }
            },
            getResultKey(ctx) {
                return hasMilestone('reactor_optimized') ? 'result_optimize_reactor_known' : 'result_optimize_reactor';
            },
            hides: ['optimize_reactor_remote'],
            onComplete(ctx) {
                ctx.gameFlags.reactorOptimized = true;
                const alreadyKnew = hasMilestone('reactor_optimized');
                setMilestone('reactor_optimized', () => ctx.persistLoopKnowledge());
                if (alreadyKnew) {
                    setMilestone('reactor_remote_hint_seen', () => ctx.persistLoopKnowledge());
                    ctx.addLogEntry(ctx.t('log_reactor_terminal_hint'), ctx.LogType.UNLOCK);
                }
                const bridgeLoc = ctx.getLocation('scout_ship_bridge');
                if (bridgeLoc) {
                    const a = (bridgeLoc.actions || []).find(a => a.id === 'optimize_reactor');
                    if (a) a._completed = true;
                }
                const crewLoc = ctx.getLocation('scout_ship_crew_quarters');
                if (crewLoc) {
                    const a = (crewLoc.actions || []).find(a => a.id === 'optimize_reactor_remote');
                    if (a) a._completed = true;
                }
                ctx.setFullRebuildNeeded(true);
            }
        },
        {
            id: 'check_status',
            nameKey: 'action_check_status',
            descKey: 'action_check_status_desc',
            drain: [{ resource: 'Stamina', amount: 1 }],
            durationSeconds: 8,
            repeatable: true,
            resultKey: 'result_check_status'
        },
        // ==========================================================================
        // Rover fuel cell chain — bridge side
        // ==========================================================================

        {
            id: 'remove_engine_panel',
            nameKey: 'action_remove_engine_panel',
            descKey: 'action_remove_engine_panel_desc',
            category: 'simple',
            drain: [{ resource: 'Stamina', amount: 3 }],
            durationSeconds: 20,
            durationIfRemembered: 8,
            oneTime: true,
            requiredItems: ['repair_tools'],
            remembersCondition(ctx) { return hasMilestone('engine_panel_removed'); },
            isAvailable(ctx) {
                if (!hasMilestone('bridge_terminal_access')) return false;
                if (!ctx.gameFlags.roverFuelCellExtracted) return false;
                if (ctx.gameFlags.enginePanelRemoved) return false;
                return true;
            },
            onStart(ctx) {
                const hasTools = ctx.countItemInBag('repair_tools') > 0;
                if (!hasTools) {
                    ctx.addLogEntry(ctx.t('log_need_item', { item: ctx.t('item_repair_tools') }), ctx.LogType.ERROR);
                    return { block: true };
                }
                if (hasMilestone('engine_panel_removed')) {
                    ctx.action.durationSeconds = ctx.action.durationIfRemembered;
                }
            },
            getResultKey(ctx) {
                return hasMilestone('engine_panel_removed') ? 'result_remove_engine_panel_known' : 'result_remove_engine_panel';
            },
            unlocks: ['install_rover_fuel_cell'],
            onComplete(ctx) {
                ctx.gameFlags.enginePanelRemoved = true;
                setMilestone('engine_panel_removed', () => ctx.persistLoopKnowledge());
                // Cross-location: study_ship_manual is in workshop — must be unlocked manually
                const workshopLoc = ctx.getLocation('scout_ship_workshop');
                if (workshopLoc) {
                    const studyA = (workshopLoc.actions || []).find(a => a.id === 'study_ship_manual');
                    if (studyA) {
                        studyA._completed = false;
                        ctx.flagActionAsNew('study_ship_manual');
                    }
                }
                ctx.setFullRebuildNeeded(true);
            },
        },
        {
            id: 'install_rover_fuel_cell',
            nameKey: 'action_install_rover_fuel_cell',
            descKey: 'action_install_rover_fuel_cell_desc',
            category: 'taxing',
            drain: [{ resource: 'Stamina', amount: 5 }],
            durationSeconds: 30,
            durationIfRemembered: 12,
            oneTime: true,
            requiresItem: 'rover_fuel_cell',
            remembersCondition(ctx) { return hasMilestone('rover_fuel_cell_installed'); },
            isAvailable(ctx) {
                if (!ctx.gameFlags.enginePanelRemoved) return false;
                if (ctx.gameFlags.roverFuelCellInstalled) return false;
                return true;
            },
            onStart(ctx) {
                if (!hasMilestone('ship_manual_studied')) {
                    ctx.addLogEntry(ctx.t('log_need_ship_manual'), ctx.LogType.ERROR);
                    return { block: true };
                }
                if (hasMilestone('rover_fuel_cell_installed')) {
                    ctx.action.durationSeconds = ctx.action.durationIfRemembered;
                }
            },
            getResultKey(ctx) {
                const loop = ctx.gameFlags.loopCount || 0;
                if (loop >= 2 && hasMilestone('rover_fuel_cell_installed')) return 'result_install_rover_fuel_cell_loop2';
                return hasMilestone('rover_fuel_cell_installed') ? 'result_install_rover_fuel_cell_known' : 'result_install_rover_fuel_cell';
            },
            onComplete(ctx) {
                ctx.gameFlags.roverFuelCellInstalled = true;
                setMilestone('rover_fuel_cell_installed', () => ctx.persistLoopKnowledge());
                // Add 300 fuel to bridge area_fuel
                const bridgeList = ctx.areaResources['scout_ship_bridge'];
                if (bridgeList && Array.isArray(bridgeList)) {
                    const fuel = bridgeList.find(r => r.name === 'area_fuel');
                    if (fuel) {
                        fuel.amount = Math.min(fuel.capacity, fuel.amount + 300);
                    }
                }
                // Restore life support if it was down
                if (hasEffect('life_support_failure')) {
                    removeEffect('life_support_failure');
                }
                if (hasEffect('oxygen_depleted')) {
                    removeEffect('oxygen_depleted');
                }
                ctx.addLogEntry(ctx.t('log_lifesupport_restored'), ctx.LogType.SUCCESS);
                ctx.setFullRebuildNeeded(true);
            },
        },
        {
            id: 'set_course_gamma',
            nameKey: 'action_set_course_gamma',
            descKey: 'action_set_course_gamma_desc',
            category: 'simple',
            drain: [{ resource: 'Stamina', amount: 1 }],
            durationSeconds: 5,
            oneTime: true,
            resultKey: 'result_set_course_gamma',
            addsEffect: 'on_route_gamma',
        isAvailable(ctx) {
            const m = ctx.gameFlags.loopKnowledge?.milestones || {};
            if (!m.gamma_coordinates_known) return false;
            if (!hasMilestone('gamma_site_confirmed_on_scanner')) return false;
            if (!hasMilestone('bridge_terminal_access')) return false;
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
        },
        // ==========================================================================
        // Land ship — manual landing after on_route_gamma countdown expires
        // ==========================================================================
        {
            id: 'land_ship',
            nameKey: 'action_land_ship',
            descKey: 'action_land_ship_desc',
            category: 'taxing',
            drain: [{ resource: 'Stamina', amount: 5 }],
            durationSeconds: 20,
            oneTime: true,
            isAvailable(ctx) {
                return hasMilestone('arrived_at_gamma');
            },
            getResultKey(ctx) {
                return hasMilestone('ship_landed') ? 'result_land_ship_again' : 'result_land_ship';
            },
            onComplete(ctx) {
                setMilestone('ship_landed', () => ctx.persistLoopKnowledge());
                // Remove the on_route_gamma effect (stops fuel drain)
                try { removeEffect('on_route_gamma'); } catch { /* ignore */ }
                // Unlock exit_ship in mainArea (cross-location unlock)
                const mainLoc = ctx.getLocation('scout_ship_main_area');
                if (mainLoc) {
                    const exitA = (mainLoc.actions || []).find(a => a.id === 'exit_ship');
                    if (exitA) {
                        exitA._completed = false;
                        ctx.flagActionAsNew('exit_ship');
                    }
                }
                ctx.setFullRebuildNeeded(true);
            },
        }
    ]
};
