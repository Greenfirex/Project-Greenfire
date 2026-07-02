// ==========================================================================
// Location UI — rendering & event wiring for location panels
// ==========================================================================

import { t } from '../../locales/locales.js';
import { getCurrentLocationId, getLocation } from './locationData.js';
import { gameFlags, isActionNew, flagActionAsNew, markActionSeen, hasLogin, hasMilestone } from '../../engine/gameFlags.js';
import { newBadgeHtml, wireClearUiNewBadge } from '../../ui/components/contentNewBadges.js';
import { setupTooltip } from '../../ui/panels/tooltip.js';
import { getEffectDrains, getEffectDebuffDetails, hasEffect } from '../../engine/effects.js';
import { addToQueue, isInQueue } from '../../engine/queue.js';
import { playActionStart } from '../../engine/audio.js';
import { getItemDefinition } from '../character/items.js';
import { RESOURCE_EMOJIS, RESOURCE_LOCALE_KEYS, getAreaResourceAmount } from '../../engine/resources.js';
import { countItemInBag, getSkillDefinition, hasSkill, getSkillTier } from '../character/character.js';
import {
    activeAction, activeActionId, actionProgress, selectedActionId,
    actionPaused, _fullRebuildNeeded,
    DEFAULT_DRAIN, TAXING_MULT,
    getResourceByName, canAffordAction,
    getUnlockState, setUnlockState, getPoiCollapseState, setPoiCollapseState,
    startAction, pauseAction, resumeAction, cancelActiveAction,
    setSelectedActionId, setFullRebuildNeeded, safeInvokeActionCallback
} from './locationEngine.js';


// ==========================================================================
// Tile rendering
// ==========================================================================

let _hoverActionId = null;

export function setHoveredActionId(actionId) {
    _hoverActionId = actionId;
    // Only update Details tile — don't full-rebuild
    const detailsHost = document.querySelector('#locationsDetailsTile');
    if (detailsHost) {
        detailsHost.innerHTML = renderDetailsTile();
        wireDebuffTooltips(detailsHost);
    }
}

export function clearHoverState() {
    _hoverActionId = null;
}

export function renderLocationTile(location) {
    const imgHtml = location.image ? `<div class="location-location-image" style="max-height:none;flex:1 1 auto;display:flex;align-items:center;justify-content:center;overflow:hidden;"><img src="${location.image}" alt="${t(location.nameKey)}" style="width:100%;height:100%;object-fit:contain;" /></div>` : '';
    return `<div class="location-card location-card-location game-scrollbar"><div class="location-card-header"><h3>${t(location.nameKey)}</h3></div>${imgHtml}</div>`;
}

export function renderDetailsTile() {
    const location = getLocation(getCurrentLocationId());
    // Priority: hover > selected > active running action
    const effectiveId = _hoverActionId || selectedActionId || (activeActionId && activeAction && !activeAction._completed ? activeActionId : null);
    if (effectiveId) {
        const action = (location && location.actions) ? location.actions.find(a => a.id === effectiveId) : null;
        if (action) {
            // Tags row (below action name, shows repeatable/oneTime + category)
            const tagItems = [];
            if (action.targetLocation) {
                tagItems.push('<span class="detail-tag tag-travel">&#x2192; ' + t('tag_travel') + '</span>');
            } else if (action.repeatable) {
                if (typeof action.repeatLimit === 'number' && action.repeatLimit > 0) {
                    const remain = Math.max(0, action.repeatLimit - (action._repeatCount || 0));
                    tagItems.push(`<span class="detail-tag tag-repeatable">&#x21BB; ${remain}&#x00D7; ${t('tag_remaining')}</span>`);
                } else {
                    tagItems.push('<span class="detail-tag tag-repeatable">&#x21BB; ' + t('tag_repeatable') + '</span>');
                }
            } else if (action.oneTime) {
                tagItems.push('<span class="detail-tag tag-onetime">&#x26A1; ' + t('tag_onetime') + '</span>');
            }
            // Category as a tag
            let catLabel = '';
            let catClass = '';
            if (action.category === 'taxing') { catLabel = t('cat_taxing'); catClass = 'detail-category-taxing'; }
            else if (action.category === 'simple') { catLabel = t('cat_simple'); catClass = 'detail-category-simple'; }
            else if (action.category === 'persistent') { catLabel = t('cat_persistent'); catClass = 'detail-category-persistent'; }
            else if (action.category === 'rest') { catLabel = t('cat_rest'); catClass = 'detail-category-rest'; }
            else if (action.category === 'refresh') { catLabel = t('cat_refresh'); catClass = 'detail-category-refresh'; }
            if (catLabel) tagItems.push(`<span class="detail-category detail-tag ${catClass}">${catLabel}</span>`);
            const tagsHtml = tagItems.length > 0 ? `<div class="detail-tags">${tagItems.join('')}</div>` : '';

            // Duration
            const isInfiniteAction = !action.durationSeconds || action.durationSeconds <= 0;
            const isActionRunning = activeActionId === effectiveId && !action._completed;
            // Get saved persistent progress (survives death loops and stop/cancel)
            const savedProgress = (action.category === 'persistent' && action.id && gameFlags.persistentProgress)
                ? (Number(gameFlags.persistentProgress[action.id]) || 0)
                : 0;
            // If the player remembers this action, use the shorter remembered duration
            const isRememberedDetail = !!(action.durationIfRemembered && typeof action.remembersCondition === 'function' && action.remembersCondition({
                gameFlags, getCurrentLocationId, getUnlockState, hasLogin: function(){}, hasMilestone: function(n){ return !!(gameFlags?.loopKnowledge?.milestones?.[n]); }, countItemInBag: function(){ return 0; }, t
            }));
            const baseDurationSeconds = isRememberedDetail ? (action.durationIfRemembered || action.durationSeconds) : (action.durationSeconds || 0);
            const effectiveTotalSecs = Math.max(1, baseDurationSeconds);
            const effectiveProgress = isActionRunning ? actionProgress : savedProgress;
            const effectiveRemainingSecs = Math.max(0, effectiveTotalSecs - effectiveProgress);
            const effectiveProgressPct = effectiveTotalSecs > 0 ? Math.min(100, Math.round((effectiveProgress / effectiveTotalSecs) * 100)) : 0;

            const detailRemainingMins = Math.round(effectiveRemainingSecs || 0);
            const rememberedClass = isRememberedDetail ? ' drain-time-remembered' : '';
            let durationHtml = '';
            if (isInfiniteAction) {
                durationHtml = `<div class="detail-section"><div class="detail-section-label">&#x23F1; ${t('detail_duration')}</div><div class="detail-section-value">${t('action_duration_ongoing')}</div></div>`;
            } else {
                durationHtml = `<div class="detail-section"><div class="detail-section-label">&#x23F1; ${t('detail_duration')}</div><div class="detail-section-value${rememberedClass}">${t('action_duration_label', { minutes: detailRemainingMins })}</div></div>`;
            }

            // Costs — resource name + remaining count (dynamic during running)
            const costDurationMins = action.durationSeconds > 0 ? Math.max(1, Math.round(action.durationSeconds || 0)) : 1;
            const mult = action.category === 'taxing' ? TAXING_MULT : 1;
            const isRest = action.category === 'rest';
            const isRefresh = action.category === 'refresh';
            // Compute per-second gain rate (1 real sec = 1 in-game min)
            let gainPerSecRate = 0;
            let gainResourceName = null;
            if ((isRest || isRefresh) && Array.isArray(action.rewards)) {
                for (const r of action.rewards) {
                    if (r.type === 'resource') {
                        gainResourceName = r.name;
                        gainPerSecRate = (Number(r.amount) || 0) / Math.max(1, action.durationSeconds || 1);
                        break;
                    }
                }
            }
            const baseRates = action.drainRates || DEFAULT_DRAIN;
            const costItems = Object.entries(baseRates)
                .filter(([resName]) => {
                    // Skip resource being gained in costs display
                    if (isRest && resName === 'Stamina') return false;
                    if (isRefresh && resName === 'Drinking Water') return false;
                    // Hide costs when resource is depleted, but keep Stamina when exhausted (shown as Health)
                    const r = getResourceByName(resName);
                    if (r && r.amount <= 0) {
                        if (resName === 'Stamina' && hasEffect('exhausted')) return true;
                        return false;
                    }
                    return true;
                })
                .map(([resName, baseRate]) => {
                    const effectDrains = getEffectDrains();
                    const rateMultiplier = resName === 'Stamina' ? mult : 1;
                    const baseActionRate = baseRate * rateMultiplier;
                    const effectDrainRate = effectDrains[resName] || 0;
                    // If exhausted, Stamina-targeted effect drains redirect to Health — include
                    // both the direct Stamina debuffs AND the exhausted -1.0 Health drain.
                    const isExhausted = (resName === 'Stamina' && hasEffect('exhausted'));
                    let extraHealthDrain = 0;
                    if (isExhausted) {
                        extraHealthDrain = Math.abs(effectDrains['Health'] || 0);
                    }
                    const rate = baseActionRate + Math.abs(effectDrainRate) + extraHealthDrain;
                    const isDebuffed = effectDrains[resName] && effectDrains[resName] < 0;
                    const totalCost = rate * costDurationMins;
                    const progressPct = Math.min(1, effectiveProgress / Math.max(1, effectiveTotalSecs));
                    const remain = totalCost * (1 - progressPct);

                    // If exhausted, Stamina cost becomes Health cost
                    const displayResName = isExhausted ? 'Health' : resName;
                    const displayNameLocale = t((RESOURCE_LOCALE_KEYS || {})[displayResName] || displayResName);
                    const emoji = RESOURCE_EMOJIS[displayResName] || '';
                    const displayName = emoji ? `${emoji} ${displayNameLocale}` : displayNameLocale;
                    const cssSuffix = isExhausted ? 'health' : (/stamina/i.test(resName) ? 'stamina' : (/food/i.test(resName) ? 'food' : 'water'));
                    const cssClass = `detail-cost-${cssSuffix}`;
                    const debuffBadge = isDebuffed ? `<span class="detail-cost-debuff-badge" data-debuff-for="${displayResName}">&#x26A0;</span>` : '';

                    return `<div class="detail-cost ${cssClass}"><span class="detail-cost-label">${displayName}</span><span class="detail-cost-dots"></span><span class="detail-cost-right"><span class="detail-cost-remain" data-cost-res="${resName}" data-cost-total="${totalCost.toFixed(2)}" style="font-weight:bold;">${remain.toFixed(2)}</span> <span class="detail-cost-rate"${isDebuffed ? ' style="color:#E74C3C;"' : ''}>[-${rate.toFixed(2)}/min]</span>${debuffBadge}</span></div>`;
                }).join('');
            // If Health-draining effects are active AND player is NOT exhausted,
            // show a separate Health cost row. When exhausted, the Stamina row absorbs Health.
            let healthCostHtml = '';
            if (!hasEffect('exhausted')) {
                const effectDrains = getEffectDrains();
                const healthEffectDrain = effectDrains['Health'];
                if (healthEffectDrain !== undefined && healthEffectDrain < 0) {
                    const healthRate = Math.abs(healthEffectDrain);
                    const healthTotalCost = healthRate * costDurationMins;
                    const healthProgressPct = Math.min(1, effectiveProgress / Math.max(1, effectiveTotalSecs));
                    const healthRemain = healthTotalCost * (1 - healthProgressPct);
                    const healthLoc = t((RESOURCE_LOCALE_KEYS || {})['Health'] || 'Health');
                    const healthEmoji = RESOURCE_EMOJIS['Health'] || '';
                    const healthDisplayName = healthEmoji ? `${healthEmoji} ${healthLoc}` : healthLoc;
                    healthCostHtml = `<div class="detail-cost detail-cost-health"><span class="detail-cost-label">${healthDisplayName}</span><span class="detail-cost-dots"></span><span class="detail-cost-right"><span class="detail-cost-remain" data-cost-res="Health" data-cost-total="${healthTotalCost.toFixed(2)}" style="font-weight:bold;">${healthRemain.toFixed(2)}</span> <span class="detail-cost-rate" style="color:#E74C3C;">[-${healthRate.toFixed(2)}/min]</span><span class="detail-cost-debuff-badge" data-debuff-for="Health">&#x26A0;</span></span></div>`;
                }
            }
            // Area resource drain (e.g., area_water used by drink_water)
            let areaDrainHtml = '';
            if (action.drainsAreaResource) {
                const dr = action.drainsAreaResource;
                const areaName = dr.resource || '';
                const areaLabel = t('area_' + areaName.replace('area_', '')) || areaName;
                const drainAmt = dr.amount || 1;
                const drainPerMin = drainAmt / Math.max(1, action.durationSeconds || 0);
                areaDrainHtml = `<div class="detail-cost detail-cost-water"><span class="detail-cost-label">💦 ${areaLabel}</span><span class="detail-cost-dots"></span><span class="detail-cost-right"><span class="detail-cost-rate" style="color:#E74C3C;">[-${drainPerMin.toFixed(2)}/min]</span></span></div>`;
            }
            const costsHtml = (costItems || healthCostHtml || areaDrainHtml) ? `<div class="detail-section"><div class="detail-section-label"><span style="color:#f44336;">&#x2B07;</span> ${t('detail_costs')}</div>${costItems}${areaDrainHtml}${healthCostHtml}</div>` : '';

            // Gains section for rest/refresh actions (matches costs row structure)
            let gainsHtml = '';
            if ((isRest || isRefresh) && Array.isArray(action.rewards)) {
                const gainRows = action.rewards
                    .filter(r => r.type === 'resource')
                    .map(r => {
                        const gainName = r.name;
                        const gainNameLoc = t((RESOURCE_LOCALE_KEYS || {})[gainName] || gainName);
                        const gainRate = (Number(r.amount) || 0) / Math.max(1, action.durationSeconds || 1);
                        const gainCssClass = /stamina/i.test(gainName) ? 'detail-cost-stamina' : (/food/i.test(gainName) ? 'detail-cost-food' : (/water/i.test(gainName) ? 'detail-cost-water' : 'detail-cost-health'));
                        const gainEmoji = RESOURCE_EMOJIS[gainName] || '';
                        const gainDisplay = gainEmoji ? `${gainEmoji} ${gainNameLoc}` : gainNameLoc;
                        return `<div class="detail-cost detail-cost-gain ${gainCssClass}"><span class="detail-cost-label">${gainDisplay}</span><span class="detail-cost-dots"></span><span class="detail-cost-right"><span class="detail-cost-rate" style="color:#4caf50;">[+${gainRate.toFixed(2)}/min]</span></span></div>`;
                    }).join('');
                if (gainRows) {
                    gainsHtml = `<div class="detail-section"><div class="detail-section-label" style="color:#4caf50;">&#x2B06; ${t('detail_gains')}</div>${gainRows}</div>`;
                }
            }

            // Requirements section (item prerequisite)
            let requirementsHtml = '';
            const requiredIds = [];
            if (action.requiredItems && Array.isArray(action.requiredItems)) {
                requiredIds.push(...action.requiredItems);
            } else if (action.requiresItem) {
                requiredIds.push(action.requiresItem);
            }
            const rows = [];
            if (requiredIds.length > 0) {
                requiredIds.forEach(id => {
                    const def = getItemDefinition(id);
                    if (!def) return;
                    const name = (def.nameKey && t(def.nameKey)) || def.name;
                    const has = countItemInBag(id) > 0;
                    const color = has ? '#4caf50' : '#ff9800';
                    const label = has ? `✓ ${name}` : `✗ ${name}`;
                    rows.push(`<div class="detail-cost detail-cost-requirement"><span class="detail-cost-label" style="color:${color};">${label}</span><span class="detail-cost-dots"></span><span class="detail-cost-right"><span class="detail-cost-rate">[Quest]</span></span></div>`);
                });
            }
            // Skill requirement
            if (action.requiredSkill) {
                const { skill: skillId, tier } = action.requiredSkill;
                const def = getSkillDefinition(skillId);
                const tierDef = def?.tiers.find(t => t.tier === tier);
                const skillName = tierDef ? t(tierDef.nameKey) : skillId;
                const satisfied = hasSkill(skillId, tier);
                const color = satisfied ? '#4caf50' : '#ff9800';
                const label = satisfied ? `✓ ${skillName}` : `✗ ${skillName}`;
                const tierLabel = t('skill_tier_label', { tier: toRoman(tier) });
                rows.push(`<div class="detail-cost detail-cost-requirement"><span class="detail-cost-label" style="color:${color};">${label}</span><span class="detail-cost-dots"></span><span class="detail-cost-right"><span class="detail-cost-rate">[${t('detail_skill_tag')}] [${tierLabel}]</span></span></div>`);
            }
            if (rows.length > 0) {
                requirementsHtml = `<div class="detail-section"><div class="detail-section-label">&#x1F4CB; ${t('detail_requirements')}</div>${rows.join('')}</div>`;
            }

            // Rewards (hidden for rest/refresh since gains show the continuous rate)
            let rewardsHtml = '';
            if (action.rewards && action.rewards.length && !isRest && !isRefresh) {
                const rewardItems = action.rewards.map(r => {
                    if (r.type === 'item') {
                        const itemId = String(r.name || '').toLowerCase().replace(/\s+/g, '_');
                        const itemDef = getItemDefinition(itemId);
                        const itemName = itemDef ? itemDef.name : r.name;
                        const itemIcon = itemDef ? itemDef.icon : '';
                        const imgTag = itemIcon ? `<img src="${itemIcon}" alt="${itemName}" class="detail-reward-icon" />` : '';
                        return `<div class="detail-reward">${imgTag}<span>+${r.amount || 1} ${itemName}</span></div>`;
                    }
                    return `<div class="detail-reward">+${r.amount || 0} ${r.name}</div>`;
                }).join('');
                rewardsHtml = `<div class="detail-section"><div class="detail-section-label">&#x2B50; ${t('detail_rewards')}</div>${rewardItems}</div>`;
            }

            return `<div class="location-card location-card-details game-scrollbar"><div class="location-card-header"><h3>${t(action.nameKey)}</h3></div>${tagsHtml}<p class="location-location-desc">${t(action.descKey)}</p>${durationHtml}${gainsHtml}${costsHtml}${requirementsHtml}${rewardsHtml}</div>`;
        }
    }

    // Show location description with POI names already highlighted via <span class="poi-highlight"> in locale strings
    if (location) {
        return `<div class="location-card location-card-details game-scrollbar"><div class="location-card-header"><h3>${t('crash_details')}</h3></div><p class="location-location-desc" id="locationsDetailDesc">${t(location.descriptionKey)}</p></div>`;
    }

    return `<div class="location-card location-card-details game-scrollbar"><div class="location-card-header"><h3>${t('crash_details')}</h3></div><p class="location-location-desc" id="locationsDetailDesc"></p></div>`;
}

// ==========================================================================
// Actions tile rendering (always uses POI groups)
// ==========================================================================

export function renderActionsTile(location) {
    // Load unlock state for this location
    const unlockState = getUnlockState(location.id);

    // Restore _completed and _repeatCount from persisted unlock state
    (location.actions || []).forEach(a => {
        if (unlockState[a.id]) a._completed = true;
        const rcKey = a.id + '_repeatCount';
        if (unlockState[rcKey] !== undefined && a.repeatLimit > 0) {
            a._repeatCount = Number(unlockState[rcKey]) || 0;
        }
    });

    // Build availability context for isAvailable callbacks
    const availCtx = {
        gameFlags,
        getCurrentLocationId,
        getUnlockState,
        hasLogin,
        hasMilestone,
        countItemInBag,
        t,
    };

    // Filter actions — isAvailable callback is the single source of truth for visibility
    const actions = (location.actions || []).filter(a => {
        if (a._completed || unlockState[a.id]) return false;
        // Hide action if it requires an area resource that is depleted
        if (a.requiresAreaResource) {
            const locId = getCurrentLocationId();
            if (getAreaResourceAmount(locId, a.requiresAreaResource) <= 0) return false;
        }
        // Delegate to isAvailable callback if defined
        if (typeof a.isAvailable === 'function') {
            return !!safeInvokeActionCallback(a.isAvailable, availCtx, a, 'isAvailable');
        }
        // Explicit no-callback = always visible
        return true;

    });

    // Auto-flag actions that have never been tracked in uiSeen as "new"
    actions.forEach(a => {
        const key = `action:${a.id}`;
        if (!gameFlags.uiSeen || !Object.prototype.hasOwnProperty.call(gameFlags.uiSeen, key)) {
            flagActionAsNew(a.id);
        }
    });

    // DEBUG: Log unlock state
    console.log(`Location: ${location.id}, Unlock State:`, unlockState, `Filtered Actions:`, actions.map(a => a.id));

    return renderActionsTileWithPOIs(location, actions);
}

function renderActionsTileWithPOIs(location, actions) {
    const pois = location.pois || [];
    const poiCollapseState = getPoiCollapseState(location.id);

    // Group actions by POI
    const actionsByPoi = {};
    const ungroupedActions = [];

    pois.forEach(poi => {
        actionsByPoi[poi.id] = [];
    });

    actions.forEach(action => {
        let assigned = false;
        for (const poi of pois) {
            if (poi.actions && poi.actions.includes(action.id)) {
                actionsByPoi[poi.id].push(action);
                assigned = true;
                break;
            }
        }
        if (!assigned) {
            ungroupedActions.push(action);
        }
    });

    // Render POI sections
    let poisHtml = '';
    pois.forEach(poi => {
        const poiActions = actionsByPoi[poi.id] || [];

        // TRAVEL POI: only render if it has actions
        if (poi.id === 'travel') {
            if (poiActions.length === 0) return;
            const isCollapsed = poiCollapseState[poi.id] === true;
            const collapseIcon = isCollapsed ? '▶' : '▼';
            const buttonsHtml = poiActions.map(action => renderActionButton(action)).join('');
            poisHtml += `
                <div class="location-poi-section${isCollapsed ? ' poi-collapsed' : ''}" data-poi-id="${poi.id}">
                    <div class="location-poi-header" data-poi-id="${poi.id}" style="background: rgba(var(--glow-r), var(--glow-g), var(--glow-b), 0.12); border-color: rgba(var(--glow-r), var(--glow-g), var(--glow-b), 0.35);">
                        <span class="location-poi-icon">${collapseIcon}</span>
                        <span class="location-poi-name" style="color: rgb(var(--glow-r), var(--glow-g), var(--glow-b));">${t(poi.nameKey)}</span>
                    </div>
                    <div class="location-poi-actions">
                        ${buttonsHtml}
                    </div>
                </div>
            `;
            return;
        }

        // Skip other POIs if they have no actions
        if (poiActions.length === 0) return;

        const isCollapsed = poiCollapseState[poi.id] === true;
        const collapseIcon = isCollapsed ? '▶' : '▼';

        const buttonsHtml = poiActions.map(action => renderActionButton(action)).join('');

        poisHtml += `
            <div class="location-poi-section${isCollapsed ? ' poi-collapsed' : ''}" data-poi-id="${poi.id}">
                <div class="location-poi-header" data-poi-id="${poi.id}">
                    <span class="location-poi-icon">${collapseIcon}</span>
                    <span class="location-poi-name" style="color: rgb(var(--glow-r), var(--glow-g), var(--glow-b));">${t(poi.nameKey)}</span>
                </div>
                <div class="location-poi-actions">
                    ${buttonsHtml}
                </div>
            </div>
        `;
    });

    // Render ungrouped actions if any
    let ungroupedHtml = '';
    if (ungroupedActions.length > 0) {
        const buttonsHtml = ungroupedActions.map(action => renderActionButton(action)).join('');
        ungroupedHtml = `
            <div class="location-poi-section location-poi-other">
                <div class="location-poi-header">
                    <span class="location-poi-name">${t('poi_other_actions')}</span>
                </div>
                <div class="location-poi-actions">
                    ${buttonsHtml}
                </div>
            </div>
        `;
    }

    return `<div class="location-card location-card-actions game-scrollbar"><div class="location-card-header"><h3>${t('crash_actions')}</h3></div><div class="location-actions-list location-actions-with-pois">${poisHtml}${ungroupedHtml}</div></div>`;
}

// ==========================================================================
// Action button rendering (shared by POI and ungrouped actions)
// ==========================================================================

export function renderActionButton(action) {
    const actionId = action.id;
    const isRunning = activeActionId === actionId && !action._completed;
    const isSelected = selectedActionId === actionId;
    const pct = isRunning ? Math.min(100, Math.round((actionProgress / (action.durationSeconds || 1)) * 100)) : 0;
    // If the player remembers this action from a previous loop, show the shorter duration
    const isRemembered = !!(action.durationIfRemembered && typeof action.remembersCondition === 'function' && action.remembersCondition({
        gameFlags, getCurrentLocationId, getUnlockState, hasLogin: function(){}, hasMilestone: function(n){ return !!(gameFlags?.loopKnowledge?.milestones?.[n]); }, countItemInBag: function(){ return 0; }, t
    }));
    const effectiveDuration = isRemembered ? (action.durationIfRemembered || action.durationSeconds) : (action.durationSeconds || 0);
    const durationMins = Math.round(effectiveDuration);
    let tagHtml = '';
    if (action.targetLocation) tagHtml = '<span class="location-action-tag tag-travel">&#x2192;</span>';
    else if (action.repeatable) tagHtml = '<span class="location-action-tag tag-repeatable">&#x21BB;</span>';
    else if (action.oneTime) tagHtml = '<span class="location-action-tag tag-onetime">1&#x00D7;</span>';
    const isInfiniteAction = !action.durationSeconds || action.durationSeconds <= 0;
    const rememberedClass = isRemembered ? ' drain-time-remembered' : '';
    const durationLabel = durationMins > 0 ? `<span class="location-action-btn-cost drain-time${rememberedClass}">&#x23F1; ${durationMins}m</span>` : (isInfiniteAction ? `<span class="location-action-btn-cost drain-time">&#x221E;</span>` : '');
    let playPauseHtml = '';
    const isPaused = isRunning && actionPaused;
    if (!isRunning || isPaused) playPauseHtml = `<span class="location-play-icon" data-action-play="${actionId}">&#9654;</span>`;
    else playPauseHtml = `<span class="location-pause-icon" data-action-pause="${actionId}">&#9208;</span>`;
    // Stop button for cancellable running actions (persistent actions hide stop — pause saves progress)
    if (isRunning && action.cancellable !== false && action.category !== 'persistent') {
        playPauseHtml += `<span class="location-stop-icon" data-action-stop="${actionId}">&#9209;</span>`;
    }
    // Saved persistent progress for progress bar even when not running
    const savedPersistentProgress = (action.category === 'persistent' && action.id && gameFlags.persistentProgress)
        ? (Number(gameFlags.persistentProgress[action.id]) || 0)
        : 0;
    let progressHtml = '';
    if (isRunning && !isInfiniteAction) {
        const remaining = Math.max(0, (action.durationSeconds || 1) - actionProgress);
        progressHtml = `<div class="location-action-progress" style="--progress:${pct}%"></div><span class="location-action-remaining">${remaining.toFixed(1)}s</span>`;
    } else if (isRunning && isInfiniteAction) {
        progressHtml = `<span class="location-action-ongoing">${t('action_progress_ongoing')}</span>`;
    } else if (!isRunning && savedPersistentProgress > 0 && !isInfiniteAction) {
        const savedPct = Math.min(100, Math.round((savedPersistentProgress / (action.durationSeconds || 1)) * 100));
        const remaining = Math.max(0, (action.durationSeconds || 1) - savedPersistentProgress);
        progressHtml = `<div class="location-action-progress" style="--progress:${savedPct}%"></div><span class="location-action-remaining">${remaining.toFixed(1)}s</span>`;
    }
    const costsRowHtml = durationLabel ? `<span class="location-action-costs-row">${durationLabel}</span>` : '';
    // Show "!" badge if action is newly unlocked and not yet seen by the player
    const showNewBadge = isActionNew(actionId);
    return `<button type="button" class="location-action-btn${isSelected ? ' is-selected' : ''}${isRunning ? ' is-running' : ''}${action.targetLocation ? ' btn-travel' : ''}${action.oneTime && !action.repeatable && !action.targetLocation ? ' btn-onetime' : ''}${action.repeatable && !action.targetLocation ? ' btn-repeatable' : ''}${action.category === 'persistent' ? ' btn-persistent' : ''}${showNewBadge ? ' has-new-badge' : ''}" data-action-id="${actionId}">${newBadgeHtml(showNewBadge)}<span class="location-action-btn-name">${tagHtml}${t(action.nameKey)}</span>${costsRowHtml}${progressHtml}${playPauseHtml}</button>`;
}

// ==========================================================================
// Tooltip wiring
// ==========================================================================

export function wireDebuffTooltips(detailsHost) {
    detailsHost.querySelectorAll('.detail-cost-debuff-badge').forEach(badge => {
        // Enable touch-tap tooltips on mobile so the debuff badge shows its
        // tooltip without triggering deselection.
        badge.dataset.tooltipTouchTap = 'true';
        // Stop click from bubbling to deselection handlers on the parent panel.
        badge.addEventListener('click', (e) => { e.stopPropagation(); });
        const targetResource = badge.dataset.debuffFor || 'Stamina';
        const contextExhausted = hasEffect('exhausted');
        setupTooltip(badge, () => {
            const details = getEffectDebuffDetails();
            if (!details.length) return '<p>No active debuffs.</p>';
            let html = '<h4>Active Effects</h4>';
            let hasRelevant = false;
            details.forEach(d => {
                if (!d.debuffs) return;
                const parts = [];
                const isStaminaEffect = Object.keys(d.debuffs).some(k => k === 'Stamina');
                const isHealthEffect = Object.keys(d.debuffs).some(k => k === 'Health');
                // Filter: Health row shows Health effects + Stamina effects (when exhausted, Stamina redirects to Health)
                // Stamina row shows own Stamina effects only (not Health)
                const isRelevant = (targetResource === 'Health' && (isHealthEffect || (contextExhausted && isStaminaEffect)))
                    || (targetResource === 'Stamina' && isStaminaEffect && !contextExhausted);
                if (!isRelevant) return;
                hasRelevant = true;
                for (const [resName, rate] of Object.entries(d.debuffs)) {
                    const sign = rate >= 0 ? '+' : '';
                    // When exhausted and showing for Health, rename Stamina effects to Health
                    const showAsHealth = (resName === 'Stamina' && contextExhausted && targetResource === 'Health');
                    const displayResName = showAsHealth ? 'Health' : resName;
                    parts.push(`${displayResName} ${sign}${rate.toFixed(1)}/min`);
                }
                if (parts.length) {
                    const name = t(d.nameKey);
                    html += `<div class="tooltip-section"><p><strong>${d.icon} ${name}</strong></p>`;
                    parts.forEach(p => { html += `<p class="tooltip-detail">• ${p}</p>`; });
                    html += '</div>';
                }
            });
            if (!hasRelevant) return '<p>No active debuffs for this resource.</p>';
            return html;
        });
    });
}

// ==========================================================================
// UI refresh + event wiring
// ==========================================================================

export function refreshUI() {
    setFullRebuildNeeded(false);
    const location = getLocation(getCurrentLocationId());
    if (!location) return;
    const locationHost = document.querySelector('#locationsLocationTile');
    const detailsHost = document.querySelector('#locationsDetailsTile');
    const actionsHost = document.querySelector('#locationsActionsTile');
    if (locationHost && (!locationHost.dataset.renderedId || locationHost.dataset.renderedId !== location.id)) {
        locationHost.innerHTML = renderLocationTile(location);
        locationHost.dataset.renderedId = location.id;

        // On compact/mobile, set location image as background (replaces logo via CSS variable).
        // Must use absolute URL because CSS variables in external files resolve relative to the CSS file.
        try {
            const ls = document.getElementById('locationsSection');
            if (ls && location.image) {
                const imgUrl = new URL(location.image, window.location.href).href;
                ls.style.setProperty('--location-bg', `url(${imgUrl})`);
            }
        } catch { /* ignore */ }
    }
    if (detailsHost) { detailsHost.innerHTML = renderDetailsTile(); wireDebuffTooltips(detailsHost); }

    // Click/tap on details panel deselects action (return to location description).
    if (detailsHost) {
        if (detailsHost._deselectHandler) {
            detailsHost.removeEventListener('click', detailsHost._deselectHandler);
        }
        detailsHost._deselectHandler = (e) => {
            if (e.target.closest('.tooltip, button, a, input, .debuff-icon, .detail-cost-debuff-badge')) return;
            if (selectedActionId !== null) {
                _hoverActionId = null;
                setSelectedActionId(null);
                setFullRebuildNeeded(true);
                refreshUI();
            }
        };
        detailsHost.addEventListener('click', detailsHost._deselectHandler);
    }

    if (actionsHost) {
        // Preserve scroll position before rebuild (prevents mobile tap-to-select from jumping to top)
        const actionsCard = actionsHost.querySelector('.location-card-actions');
        const scrollTop = actionsCard ? actionsCard.scrollTop : 0;

        actionsHost.innerHTML = renderActionsTile(location);
        wireActionButtons(actionsHost);

        if (scrollTop > 0) {
            const newCard = actionsHost.querySelector('.location-card-actions');
            if (newCard) newCard.scrollTop = scrollTop;
        }
    }

    // Tap anywhere on game area (outside action buttons) deselects action.
    const gameArea = document.getElementById('gameArea');
    if (gameArea && !gameArea.dataset.wiredDeselect) {
        gameArea.dataset.wiredDeselect = '1';
        gameArea.addEventListener('click', (e) => {
            if (e.target.closest('.location-action-btn, .tooltip, button, a, input, .debuff-icon, .detail-cost-debuff-badge')) return;
            if (selectedActionId !== null) {
                _hoverActionId = null;
                setSelectedActionId(null);
                setFullRebuildNeeded(true);
                refreshUI();
            }
        });
    }
}

function wireActionButtons(actionsHost) {
    if (!actionsHost.dataset.wired) {
        actionsHost.dataset.wired = '1';
        actionsHost.addEventListener('click', (e) => {
            const list = actionsHost.querySelector('.location-actions-list');
            if (list && (e.target === list || e.target.closest('.location-actions-list') === e.target)) {
                setSelectedActionId(null); setFullRebuildNeeded(true); refreshUI();
            }
        });
    }

    // Wire POI collapse headers
    actionsHost.querySelectorAll('.location-poi-header').forEach(header => {
        header.addEventListener('click', (e) => {
            const poiId = header.dataset.poiId;
            if (!poiId) return;

            const location = getLocation(getCurrentLocationId());
            if (!location) return;

            const poiSection = header.closest('.location-poi-section');
            if (!poiSection) return;

            const isCurrentlyCollapsed = poiSection.classList.contains('poi-collapsed');
            setPoiCollapseState(location.id, poiId, !isCurrentlyCollapsed);

            setFullRebuildNeeded(true);
            refreshUI();
        });
    });

    actionsHost.querySelectorAll('.location-action-btn').forEach(btn => {
        // Hover shows action details in Details tile
        btn.addEventListener('mouseenter', () => {
            const actionId = btn.dataset.actionId;
            if (actionId) setHoveredActionId(actionId);
        });
        btn.addEventListener('mouseleave', () => {
            setHoveredActionId(null);
        });
        btn.addEventListener('click', (e) => {
        const actionId = btn.dataset.actionId;
        // Clear "new" badge on any interaction with this button
        if (actionId) { markActionSeen(actionId, true); }
        const playIcon = e.target.closest('.location-play-icon'); const pauseIcon = e.target.closest('.location-pause-icon'); const stopIcon = e.target.closest('.location-stop-icon');
        if (playIcon) {
            e.stopPropagation(); e.preventDefault();
            // If another action is running, queue this one instead of blocking
            if (activeAction && !activeAction._completed && activeActionId !== actionId) {
                const loc = getLocation(getCurrentLocationId());
                const act = loc?.actions?.find(a => a.id === actionId);
                if (act) {
                    // Don't queue one-time actions more than once — just select to review
                    if (act.oneTime && isInQueue(actionId)) {
                        setSelectedActionId(actionId);
                        setFullRebuildNeeded(true); refreshUI();
                        return;
                    }
                    addToQueue({
                        actionId: act.id,
                        locationId: getCurrentLocationId(),
                        nameKey: act.nameKey,
                        durationSeconds: act.durationSeconds || 0,
                    });
                }
                return;
            }
            playActionStart();
            if (activeActionId === actionId && actionPaused) resumeAction();
            else startAction(actionId);
            return;
        }
        if (pauseIcon) { e.stopPropagation(); e.preventDefault(); pauseAction(); return; }
        if (stopIcon) { e.stopPropagation(); e.preventDefault(); cancelActiveAction(); return; }
        e.stopPropagation();
        if (selectedActionId === actionId && activeActionId !== actionId) setSelectedActionId(null);
        else if (activeActionId === actionId && actionPaused) setSelectedActionId(actionId);
        else setSelectedActionId(actionId);
        setFullRebuildNeeded(true); refreshUI();
    }); });
    // Wire hover to clear "!" badges (persists so badges don't reappear on rebuild)
    const newBadgeBtns = actionsHost.querySelectorAll('.location-action-btn.has-new-badge');
    newBadgeBtns.forEach(btn => {
        wireClearUiNewBadge(btn, { actionId: btn.dataset.actionId });
        // Staggered unlock animation for newly revealed actions
        const index = Array.from(newBadgeBtns).indexOf(btn);
        btn.classList.add('action-unlocking');
        btn.style.animationDelay = `${index * 80}ms`;
        btn.addEventListener('animationend', function onAnimEnd() {
            btn.classList.remove('action-unlocking');
            btn.style.animationDelay = '';
            btn.removeEventListener('animationend', onAnimEnd);
        }, { once: true });
    });
}

function toRoman(num) {
    const map = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V' };
    return map[num] || String(num);
}

export function updateActionButtonsDynamic() {
    if (_fullRebuildNeeded) { refreshUI(); return; }
    const location = getLocation(getCurrentLocationId()); if (!location) return;
    const actionsHost = document.querySelector('#locationsActionsTile'); if (!actionsHost) return;

    // Live-update cost remaining spans in details panel when:
    // - NOT hovering any action (showing selected/active), OR
    // - hovering the currently running action
    if ((!_hoverActionId || _hoverActionId === activeActionId) && activeAction && activeActionId && !activeAction._completed) {
        const totalSecs = activeAction.durationSeconds || 1;
        const pct = Math.min(1, actionProgress / totalSecs);
        document.querySelectorAll('.detail-cost-remain[data-cost-res]').forEach(span => {
            const total = parseFloat(span.dataset.costTotal) || 0;
            const remain = total * (1 - pct);
            span.textContent = remain.toFixed(2);
        });
    }

    actionsHost.querySelectorAll('.location-action-btn').forEach(btn => {
        const actionId = btn.dataset.actionId; const action = location.actions.find(a => a.id === actionId); if (!action) return;
        const isRunning = activeActionId === actionId && !action._completed; const isSelected = selectedActionId === actionId;
        btn.classList.toggle('is-selected', !!isSelected); btn.classList.toggle('is-running', !!isRunning);
        const progBar = btn.querySelector('.location-action-progress');
        if (progBar) {
            if (isRunning) {
                const pct = Math.min(100, Math.round((actionProgress / (action.durationSeconds || 1)) * 100));
                progBar.style.setProperty('--progress', `${pct}%`);
                progBar.style.display = '';
            } else {
                // Keep visible for persistent actions with saved progress
                const savedProgress = (action.category === 'persistent' && action.id && gameFlags.persistentProgress)
                    ? (Number(gameFlags.persistentProgress[action.id]) || 0)
                    : 0;
                if (savedProgress > 0) {
                    const savedPct = Math.min(100, Math.round((savedProgress / (action.durationSeconds || 1)) * 100));
                    progBar.style.setProperty('--progress', `${savedPct}%`);
                    progBar.style.display = '';
                } else {
                    progBar.style.display = 'none';
                }
            }
        }
        const remainingEl = btn.querySelector('.location-action-remaining');
        if (remainingEl) { if (isRunning) { const remaining = Math.max(0, (action.durationSeconds || 1) - actionProgress); remainingEl.textContent = `${remaining.toFixed(1)}s`; remainingEl.style.display = ''; } else remainingEl.style.display = 'none'; }
        const playIcon = btn.querySelector('.location-play-icon'); const pauseIcon = btn.querySelector('.location-pause-icon');
        const isPaused = isRunning && actionPaused;
        if (playIcon) { const show = !isRunning || isPaused; playIcon.style.display = show ? '' : 'none'; }
        if (pauseIcon) pauseIcon.style.display = (isRunning && !isPaused) ? '' : 'none';
    });
}