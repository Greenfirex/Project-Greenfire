// Centralized building construction manager
import { resources, updateResourceInfo } from '../core/resources.js';
import { buildings } from './definitions/buildings.js';
import { allActions as salvageActions } from './definitions/allActions.js';
import { addLogEntry, LogType } from '../core/ingameLog.js';
import { getJobById } from './jobsManager.js';
import { activatedSections, setActivatedSections, applyActivatedSections } from '../core/main.js';
import { addSlotsForBuilding } from './jobsManager.js';

// Active build states keyed by building name
const buildingStates = new Map(); // name -> { startTime, lastTickTime, elapsedSec, durationSec }
let loopHandle = null;

export function getCurrentBuildingCost(building) {
  if (!building || !Array.isArray(building.cost)) return [];
  if (!building.costMultiplier) return building.cost;
  return building.cost.map(c => ({ resource: c.resource, amount: Math.floor(c.amount * Math.pow(building.costMultiplier, building.count)) }));
}

export function canAfford(buildingName) {
  const b = buildings.find(x => x.name === buildingName);
  if (!b) return false;
  const cost = getCurrentBuildingCost(b);
  return cost.every(c => {
    const r = resources.find(res => res.name === c.resource);
    return r && r.amount >= c.amount;
  });
}

export function getAffordabilityShortfalls(buildingName) {
  const b = buildings.find(x => x.name === buildingName);
  if (!b) return [];
  const cost = getCurrentBuildingCost(b);
  const shortages = [];
  cost.forEach(c => {
    const r = resources.find(res => res.name === c.resource);
    if (!r || r.amount < c.amount) shortages.push(`${c.resource}`);
  });
  return shortages;
}

export function getProgress(buildingName) {
  return buildingStates.get(buildingName) || null;
}

export function startBuild(buildingName) {
  const b = buildings.find(x => x.name === buildingName);
  if (!b) return { ok: false, reason: 'Unknown building.' };
  try { if (localStorage.getItem('gamePaused') === 'true') return { ok: false, reason: 'Game is paused.' }; } catch (e) {}
  if (buildingStates.has(buildingName)) return { ok: false, reason: 'Already building.' };
  if (!canAfford(buildingName)) return { ok: false, reason: `Insufficient: ${getAffordabilityShortfalls(buildingName).join(', ')}` };

  // Deduct cost upfront
  const cost = getCurrentBuildingCost(b);
  cost.forEach(c => {
    const r = resources.find(res => res.name === c.resource);
    if (r) r.amount -= c.amount;
  });

  // Fixed base duration (seconds). Scales visually with TIME_SCALE like crash site actions.
  const durationSec = 2; // baseline
  buildingStates.set(buildingName, { startTime: Date.now(), lastTickTime: Date.now(), elapsedSec: 0, durationSec });
  dispatchCustom('building-start', { name: buildingName });
  addLogEntry(`Started constructing ${buildingName}.`, LogType.INFO);
  updateResourceInfo();
  ensureLoop();
  return { ok: true };
}

function ensureLoop() {
  if (loopHandle) return;
  loopHandle = setInterval(tick, 100);
}

function stopLoopIfIdle() {
  if (buildingStates.size === 0 && loopHandle) {
    clearInterval(loopHandle);
    loopHandle = null;
  }
}

function tick() {
  const now = Date.now();
  let paused = false;
  try { paused = (localStorage.getItem('gamePaused') === 'true'); } catch (e) {}
  const timeScale = (typeof window !== 'undefined' && window.TIME_SCALE) ? window.TIME_SCALE : 1;
  for (const [name, state] of Array.from(buildingStates.entries())) {
    const rawDelta = Math.max(0, Math.min((now - (state.lastTickTime || now)) / 1000, 0.25));
    state.lastTickTime = now;
    if (!paused) state.elapsedSec = Math.min(state.durationSec, (state.elapsedSec || 0) + rawDelta * timeScale);

    // Emit progress
    dispatchCustom('building-progress', {
      name,
      elapsedSec: state.elapsedSec,
      durationSec: state.durationSec,
      remainingRealSeconds: Math.max(0, (state.durationSec - state.elapsedSec) / Math.max(1e-9, timeScale)),
      progressPercent: Math.min((state.elapsedSec / Math.max(1e-9, state.durationSec)) * 100, 100)
    });

    if (state.elapsedSec >= state.durationSec) finish(name);
  }
  stopLoopIfIdle();
}

function finish(name) {
  const b = buildings.find(x => x.name === name);
  if (!b) { buildingStates.delete(name); return; }
  buildingStates.delete(name);
  b.count += 1;
  addLogEntry(`Built a new ${name}!`, LogType.SUCCESS);
  applyFirstBuildSideEffects(b);
  applyEffects(b);
  updateResourceInfo();
  dispatchCustom('building-complete', { name });
}

function applyFirstBuildSideEffects(building) {
  if (building.name === 'Foraging Camp' && building.count === 1) {
    const act = (salvageActions || []).find(a => a.id === 'installForagingTools' || a.name === 'Crude Foraging Tools');
    if (act && !act.isUnlocked) {
      act.isUnlocked = true;
      addLogEntry('Upgrade available: Crude Foraging Tools', LogType.UNLOCK);
      if (typeof window !== 'undefined' && typeof window.setupCrashSiteSection === 'function') window.setupCrashSiteSection();
    }
  }
  if (building.name === 'Water Station' && building.count === 1) {
    const fabricRes = resources.find(r => r.name === 'Fabric');
    const act = (salvageActions || []).find(a => a.id === 'installRainCatchers');
    if (fabricRes && fabricRes.isDiscovered && act && !act.isUnlocked) {
      act.isUnlocked = true;
      addLogEntry('Upgrade available: Rain Catchers', LogType.UNLOCK);
      if (typeof window !== 'undefined' && typeof window.setupCrashSiteSection === 'function') window.setupCrashSiteSection();
    } else if (act && !act.isUnlocked) {
      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        const onDiscover = (ev) => {
          if (!ev || !ev.detail || ev.detail.name !== 'Fabric') return;
          const fr = resources.find(r => r.name === 'Fabric');
          if (fr && fr.isDiscovered && act && !act.isUnlocked) {
            act.isUnlocked = true;
            addLogEntry('Upgrade available: Rain Catchers', LogType.UNLOCK);
            if (typeof window.setupCrashSiteSection === 'function') window.setupCrashSiteSection();
          }
        };
        window.addEventListener('resourceDiscovered', onDiscover);
      }
    }
  }
  if (building.name === 'Field Lab' && building.count === 1) {
    if (!activatedSections.researchSection) {
      activatedSections.researchSection = true;
      setActivatedSections(activatedSections);
      applyActivatedSections();
      addLogEntry('The first Field Lab is operational. Research is now available.', LogType.UNLOCK);
    }

    // Unlock Scientist job messaging (slots are granted via the Field Lab's job effect)
    try {
      const sci = getJobById('scientist');
      if (sci) {
        addLogEntry('New job unlocked: Scientist', LogType.UNLOCK);
      }
    } catch (e) { /* non-fatal */ }
  }
}

function applyEffects(building) {
  const applyEffect = (eff) => {
    if (!eff || !eff.type) return;
    if (eff.type === 'job') {
      try {
        addSlotsForBuilding(building.name, 1);
        addLogEntry(`New job slot available: ${building.name} (from ${building.name}).`, LogType.UNLOCK);
        if (typeof updateCrewSection === 'function') updateCrewSection();
      } catch (e) {}
    } else if (eff.type === 'storage') {
      const resourceToUpgrade = resources.find(r => r.name === eff.resource);
      if (resourceToUpgrade) {
        resourceToUpgrade.capacity += eff.value;
        addLogEntry(`${resourceToUpgrade.name} capacity increased by ${eff.value}!`, LogType.INFO);
      }
    }
  };
  if (building.effect) applyEffect(building.effect);
  if (Array.isArray(building.effects)) building.effects.forEach(applyEffect);
}

function dispatchCustom(type, detail) {
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent(type, { detail }));
    }
  } catch (e) { /* ignore */ }
}

// Debug helper (optional)
export function getActiveBuilds() { return Array.from(buildingStates.keys()); }
