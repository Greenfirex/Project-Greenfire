import { setupTooltip, refreshCurrentTooltip } from '../panels/tooltip.js';
// Legacy building system stubs (removed during refactor).
const buildings = [];
const startBuild = () => ({ ok: false, reason: 'Building system unavailable' });
const getCurrentBuildingCost = (b) => b?.cost || [];
const canAfford = () => false;
const getAffordabilityShortfalls = () => [];
const getProgress = () => null;
import { addLogEntry, LogType } from '../../engine/ingameLog.js';
import { updateResourceInfo } from '../../engine/resources.js';
import { newBadgeHtml, wireClearUiNewBadge } from './contentNewBadges.js';

// Create a building button and wire tooltip + click handler
export function createBuildingButton(building, container) {
  if (!building) return null;
  let btn = document.createElement('button');
  const showNew = !!building.uiNew;

  btn.className = 'image-button' + (showNew ? ' has-new-badge' : '');
  btn.dataset.building = building.name;

  btn.innerHTML = `
    <div class="action-progress-bar"></div>
    ${newBadgeHtml(showNew)}
    <span class="building-count">(${building.count})</span>
    <span class="building-name">${building.name}</span>
  `;
  // Dynamic tooltip provider: escalated current cost
  setupTooltip(btn, () => ({ ...building, cost: getCurrentBuildingCost(building) }));

  // DON'T set initial affordability here - let updateBuildingButtonsState handle it
  // This prevents race conditions where buttons are created unaffordable then updated affordable

  btn.addEventListener('click', () => {
    const result = startBuild(building.name);
    if (!result.ok) {
      addLogEntry(result.reason || `Cannot build ${building.name}.`, LogType.INFO);
      return;
    }
    refreshCurrentTooltip();
    // Immediate UI prep
    const nameEl = btn.querySelector('.building-name');
    if (nameEl && !btn.dataset.originalLabel) btn.dataset.originalLabel = nameEl.textContent || building.name;
    const bar = btn.querySelector('.action-progress-bar');
    if (bar) {
      try { bar.style.transition = 'none'; bar.style.width = '0%'; void bar.offsetWidth; bar.style.transition = ''; } catch (e) { bar.style.width = '0%'; }
      // Give immediate visual feedback
      bar.style.width = '1%';
    }
    btn.classList.add('running');
    btn.disabled = true;
    // Show initial countdown immediately
    const prog = getProgress(building.name);
    const timeScale = (typeof window !== 'undefined' && window.TIME_SCALE) ? window.TIME_SCALE : 1;
    if (nameEl && prog) {
      const remainingRealSeconds = Math.max(0, (prog.durationSec - (prog.elapsedSec || 0)) / Math.max(1e-9, timeScale));
      nameEl.textContent = `${remainingRealSeconds.toFixed(1)}s`;
    }
  });

  // Clear "new" badge after the player notices the button (persistent via uiSeen).
  if (showNew) wireClearUiNewBadge(btn, { legacyObj: building, legacyProp: 'uiNew' });

  container.appendChild(btn);
  
  // Immediately apply affordability state after creation
  // Schedule for next tick to ensure DOM is ready
  setTimeout(() => {
    try {
      updateBuildingButtonsState(btn.closest('body') || document);
    } catch (e) {}
  }, 0);
  
  return btn;
}

export function updateBuildingButtonsState(scope = document) {
  buildings.forEach(b => {
    const btn = scope.querySelector(`.image-button[data-building="${b.name}"]`);
    if (!btn) return;
    
    // Check if there's an active build for this building
    const prog = getProgress(b.name);
    const isActuallyRunning = !!prog;
    
    // If button has 'running' class but no active progress, clear it first
    if (btn.classList.contains('running') && !isActuallyRunning) {
      btn.classList.remove('running');
      const bar = btn.querySelector('.action-progress-bar');
      if (bar) bar.style.width = '0%';
      const labelEl = btn.querySelector('.building-name');
      if (labelEl && btn.dataset.originalLabel) {
        labelEl.textContent = btn.dataset.originalLabel;
        delete btn.dataset.originalLabel;
      }
    }
    
    const countEl = btn.querySelector('.building-count'); 
    if (countEl) countEl.textContent = `(${b.count})`;
    
    // Only replace name if not actually running
    const nameEl = btn.querySelector('.building-name');
    if (nameEl && !isActuallyRunning) nameEl.textContent = b.name;

    // Recompute affordability from live state
    const afford = canAfford(b.name);
    
    btn.dataset.affordable = afford ? 'true' : 'false';
    btn.classList.toggle('unaffordable', !afford);
    
    const nameEl2 = btn.querySelector('.building-name');
    if (!afford) {
      btn.setAttribute('aria-disabled', 'true');
      // Only disable if not currently building
      if (!isActuallyRunning) btn.disabled = true;
      if (nameEl2) nameEl2.style.fontWeight = '600';
      btn.dataset.shortfall = getAffordabilityShortfalls(b.name).join(', ');
    } else {
      btn.removeAttribute('aria-disabled');
      // Enable if not currently building
      if (!isActuallyRunning) {
        btn.disabled = false;
      }
      if (nameEl2) {
        nameEl2.style.fontWeight = '';
      }
      delete btn.dataset.shortfall;
    }
  });
}

// Rehydrate a button if a build is already in progress
export function rehydrateBuildingButton(btn, buildingName) {
  if (!btn) return;
  const prog = getProgress(buildingName);
  if (!prog) return;
  btn.classList.add('running');
  btn.disabled = true;
  const bar = btn.querySelector('.action-progress-bar');
  const labelEl = btn.querySelector('.building-name');
  const timeScale = (typeof window !== 'undefined' && window.TIME_SCALE) ? window.TIME_SCALE : 1;
  const progressPercent = Math.min((prog.elapsedSec / Math.max(1e-9, prog.durationSec)) * 100, 100);
  if (bar) bar.style.width = `${progressPercent}%`;
  if (labelEl) {
    if (!btn.dataset.originalLabel) btn.dataset.originalLabel = labelEl.textContent || buildingName;
    const remainingRealSeconds = Math.max(0, (prog.durationSec - prog.elapsedSec) / Math.max(1e-9, timeScale));
    labelEl.textContent = `${remainingRealSeconds.toFixed(1)}s`;
  }
}

// Event listeners: progress & completion
function onProgress(ev) {
  const { name, progressPercent, remainingRealSeconds } = ev.detail || {};
  if (!name) return;
  const btn = document.querySelector(`.image-button[data-building="${name}"]`);
  if (!btn) return;
  const bar = btn.querySelector('.action-progress-bar'); if (bar) bar.style.width = `${progressPercent}%`;
  const labelEl = btn.querySelector('.building-name');
  if (labelEl) labelEl.textContent = `${remainingRealSeconds.toFixed(1)}s`;
}

function onComplete(ev) {
  const { name } = ev.detail || {};
  if (!name) return;
  const btn = document.querySelector(`.image-button[data-building="${name}"]`);
  if (!btn) return;
  btn.classList.remove('running');
  btn.disabled = false;
  const bar = btn.querySelector('.action-progress-bar'); if (bar) { try { bar.style.transition = 'none'; bar.style.width = '0%'; void bar.offsetWidth; bar.style.transition=''; } catch (e) { bar.style.width = '0%'; } }
  const labelEl = btn.querySelector('.building-name'); if (labelEl && btn.dataset.originalLabel) labelEl.textContent = btn.dataset.originalLabel;
  delete btn.dataset.originalLabel;
  updateBuildingButtonsState(document);
  updateResourceInfo();
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('building-progress', onProgress);
  window.addEventListener('building-complete', onComplete);
  // Refresh affordability instantly when resources change
  window.addEventListener('resources-updated', () => {
    try { updateBuildingButtonsState(document); } catch (_) {}
  });
  // Expose state updater globally for legacy callers (gameFlags, main.js)
  if (typeof window.updateBuildingButtonsState !== 'function') {
    window.updateBuildingButtonsState = () => updateBuildingButtonsState(document);
  }

  // Lightweight periodic affordability refresh to ensure UI reverts
  // when resources change outside of explicit events.
  // Run unconditionally at low cadence; update is cheap.
  try {
    setInterval(() => {
      try { updateBuildingButtonsState(document); } catch (_) {}
    }, 500);
  } catch (_) {}
}
