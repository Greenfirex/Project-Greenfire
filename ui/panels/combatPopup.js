import { getCombatEncounter } from '../../data/definitions/combatEncounters.js';
import { resources } from '../../core/resources.js';
import { addLogEntry, LogType } from '../../core/ingameLog.js';
import { characterState, computeCharacterStats } from '../../data/character.js';
import { consumeFirstItemFromBag, countItemInBag } from '../../data/character.js';
import { setupTooltip } from './tooltip.js';
import { getCombatStartPaused } from '../../core/settings.js';
import { pauseGame, resumeGame, getIsPaused } from '../footer.js';

let active = null;
let _escHandler = null;

function ensureOverlay() {
    let overlay = document.getElementById('combatPopup');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'combatPopup';
    // Reuse the Story popup overlay visuals while keeping combat-specific layout rules.
    overlay.className = 'combat-popup-overlay story-popup-overlay hidden';
    overlay.innerHTML = `
        <div class="combat-popup-content story-popup-content" role="dialog" aria-modal="true" aria-label="Combat">
            <div class="combat-popup-header story-popup-header">
                <h2 class="combat-title"></h2>
                <div class="combat-subtitle"></div>
            </div>

            <div class="combat-popup-body">
                <div class="combat-bars">
                    <div class="combat-bar-group">
                        <div class="combat-bar-top">
                            <div class="combat-bar-label">You</div>
                        </div>
                        <div class="combat-bar" data-bar="player" role="img" aria-label="Player health">
                            <div class="combat-bar-fill player"></div>
                            <div class="combat-bar-overlay" data-overlay="player"></div>
                        </div>
                        <div class="combat-bar combat-bar-secondary" data-bar="player-stamina" role="img" aria-label="Player stamina">
                            <div class="combat-bar-fill stamina"></div>
                            <div class="combat-bar-overlay" data-overlay="player-stamina"></div>
                        </div>
                        <div class="combat-mini-inline" aria-label="Player stats">
                            <div class="combat-orbit" data-orbit="player">
                                <img class="combat-portrait player" data-portrait="player" alt="" />

                                <div class="combat-stat-icon pos-tr" data-stat="hit" data-who="player">
                                    <div class="svg" aria-hidden="true">${svgIcon('target')}</div>
                                    <div class="val" data-stat-value="player-hit"></div>
                                </div>
                                <div class="combat-stat-icon pos-tl" data-stat="crit" data-who="player">
                                    <div class="svg" aria-hidden="true">${svgIcon('burst')}</div>
                                    <div class="val" data-stat-value="player-crit"></div>
                                </div>
                                <div class="combat-stat-icon pos-mr" data-stat="evasion" data-who="player">
                                    <div class="svg" aria-hidden="true">${svgIcon('swirl')}</div>
                                    <div class="val" data-stat-value="player-evasion"></div>
                                </div>
                                <div class="combat-stat-icon pos-ml" data-stat="armor" data-who="player">
                                    <div class="svg" aria-hidden="true">${svgIcon('shield')}</div>
                                    <div class="val" data-stat-value="player-armor"></div>
                                </div>
                                <div class="combat-stat-icon pos-br" data-stat="damage" data-who="player">
                                    <div class="svg" aria-hidden="true">${svgIcon('sword')}</div>
                                    <div class="val" data-stat-value="player-damage"></div>
                                </div>
                                <div class="combat-stat-icon pos-bl" data-stat="attackSpeed" data-who="player">
                                    <div class="svg" aria-hidden="true">${svgIcon('clock')}</div>
                                    <div class="val" data-stat-value="player-attackSpeed"></div>
                                </div>
                            </div>

                            <div class="combat-ability-row" aria-label="Player abilities">
                                <button class="combat-ability-btn" type="button" data-action="ability-placeholder" disabled aria-disabled="true">...</button>
                                <button class="combat-ability-btn combat-stim-icon" type="button" data-action="stim" aria-label="Use Stimpack">
                                    <span class="svg" aria-hidden="true">${svgIcon('stim')}</span>
                                    <span class="combat-stim-count" data-stim-count></span>
                                </button>
                                <button class="combat-ability-btn" type="button" data-action="heavy-strike">Heavy Strike</button>
                            </div>
                        </div>
                    </div>
                    <div class="combat-float-lane" aria-label="Combat controls">
                        <button class="combat-pause-toggle" type="button" data-action="toggle-pause" aria-label="Toggle pause">
                            <span class="combat-pause-icon" aria-hidden="true"></span>
                            <span class="combat-pause-text" aria-hidden="true">Paused</span>
                        </button>
                    </div>
                    <div class="combat-bar-group">
                        <div class="combat-bar-top">
                            <div class="combat-bar-label" data-enemy-label>Enemy</div>
                            <span class="combat-bar-top-spacer" aria-hidden="true"></span>
                        </div>
                        <div class="combat-bar" data-bar="enemy" role="img" aria-label="Enemy health">
                            <div class="combat-bar-fill enemy"></div>
                            <div class="combat-bar-overlay" data-overlay="enemy"></div>
                        </div>
                        <div class="combat-bar combat-bar-secondary" data-bar="enemy-stamina" role="img" aria-label="Enemy stamina">
                            <div class="combat-bar-fill stamina"></div>
                            <div class="combat-bar-overlay" data-overlay="enemy-stamina"></div>
                        </div>
                        <div class="combat-mini-inline" aria-label="Enemy stats">
                            <div class="combat-orbit" data-orbit="enemy">
                                <img class="combat-portrait enemy" data-portrait="enemy" alt="" />

                                <div class="combat-stat-icon pos-tl" data-stat="hit" data-who="enemy">
                                    <div class="svg" aria-hidden="true">${svgIcon('target')}</div>
                                    <div class="val" data-stat-value="enemy-hit"></div>
                                </div>
                                <div class="combat-stat-icon pos-tr" data-stat="crit" data-who="enemy">
                                    <div class="svg" aria-hidden="true">${svgIcon('burst')}</div>
                                    <div class="val" data-stat-value="enemy-crit"></div>
                                </div>
                                <div class="combat-stat-icon pos-ml" data-stat="evasion" data-who="enemy">
                                    <div class="svg" aria-hidden="true">${svgIcon('swirl')}</div>
                                    <div class="val" data-stat-value="enemy-evasion"></div>
                                </div>
                                <div class="combat-stat-icon pos-mr" data-stat="armor" data-who="enemy">
                                    <div class="svg" aria-hidden="true">${svgIcon('shield')}</div>
                                    <div class="val" data-stat-value="enemy-armor"></div>
                                </div>
                                <div class="combat-stat-icon pos-bl" data-stat="damage" data-who="enemy">
                                    <div class="svg" aria-hidden="true">${svgIcon('sword')}</div>
                                    <div class="val" data-stat-value="enemy-damage"></div>
                                </div>
                                <div class="combat-stat-icon pos-br" data-stat="attackSpeed" data-who="enemy">
                                    <div class="svg" aria-hidden="true">${svgIcon('clock')}</div>
                                    <div class="val" data-stat-value="enemy-attackSpeed"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="combat-log" aria-label="Combat log" aria-hidden="false"></div>
            </div>

            <div class="combat-popup-actions">
                <button class="menu-button combat-btn" data-action="retreat">Retreat</button>
                <button class="menu-button combat-btn combat-btn-primary" data-action="close" disabled aria-disabled="true">Close (Esc)</button>
            </div>
        </div>
    `;

    // Ensure it lives directly under body so stacking contexts don't hide it
    document.body.appendChild(overlay);

    // Register icon tooltips once per overlay creation.
    try { initCombatStatTooltips(overlay); } catch (e) { /* ignore */ }

    // Very high z-index to outrank other overlays
    overlay.style.zIndex = '2147483100';
    const content = overlay.querySelector('.combat-popup-content');
    if (content) content.style.zIndex = '2147483101';

    return overlay;
}

function svgIcon(kind) {
    switch (kind) {
        case 'target':
            return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v3M21 12h-3M12 21v-3M3 12h3"/></svg>`;
        case 'burst':
            return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l1.8 5.2L19 5l-2.2 5.2L22 12l-5.2 1.8L19 19l-5.2-2.2L12 22l-1.8-5.2L5 19l2.2-5.2L2 12l5.2-1.8L5 5l5.2 2.2L12 2z"/></svg>`;
        case 'swirl':
            return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9"/><path d="M21 3v6h-6"/><path d="M12 7a5 5 0 1 0 5 5"/></svg>`;
        case 'shield':
            return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l8 4v6c0 5-3.4 9.4-8 10-4.6-.6-8-5-8-10V6l8-4z"/></svg>`;
        case 'sword':
            return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3l7 7-9 9H5v-7l9-9z"/><path d="M16 5l3 3"/><path d="M6 18l3 3"/></svg>`;
        case 'clock':
        default:
            return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/></svg>`;
        case 'stim':
            return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2h4"/><path d="M12 2v6"/><path d="M9 8h6"/><path d="M8 8v12"/><path d="M16 8v12"/><path d="M8 14h8"/></svg>`;
    }
}

const STAT_TOOLTIP_TEXT = {
    hit: 'Hit Chance — chance to land an attack before evasion.\nCapped at: 95%.',
    crit: 'Crit Chance — chance for a critical hit (+50% damage).\nCapped at: 100%.',
    evasion: 'Evasion — reduces the enemy\'s chance to hit you (multiplies by 1 − evasion).\nCapped at: 75%.',
    armor: 'Armor — reduces damage taken with diminishing returns.\nDamage taken = round(damage × 20/(armor+20)).\nExamples: armor 0→100%, 10→67%, 20→50%, 40→33%.',
    damage: 'Damage — attack damage range.\nNo cap.',
    attackSpeed: 'Attack Speed — seconds per attack (lower is faster).\nMinimum: 0.20s per attack.',
};

const COMBAT_CAPS = {
    minAttackSpeedSec: 0.2,
    maxHitChancePct: 95,
    defaultHitChancePct: 75,
    maxEvasion: 0.75,
};

function initCombatStatTooltips(overlay) {
    const icons = Array.from(overlay.querySelectorAll('.combat-stat-icon'));
    icons.forEach(icon => {
        const stat = icon.dataset.stat;
        const who = icon.dataset.who;
        const label = STAT_TOOLTIP_TEXT[stat] || stat;
        const prefix = who === 'enemy' ? 'Enemy: ' : 'You: ';
        setupTooltip(icon, `${prefix}${label}`);
        try { icon.dataset.tooltipPriority = '2500'; } catch (e) { /* ignore */ }
    });
}

function getResource(name) {
    return (resources || []).find(r => r && r.name === name) || null;
}

function clamp01(x) {
    if (!Number.isFinite(x)) return 0;
    return Math.max(0, Math.min(1, x));
}

function randIntInclusive(min, max) {
    const a = Math.floor(Number(min) || 0);
    const b = Math.floor(Number(max) || 0);
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    if (hi <= lo) return lo;
    return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function applyArmorMitigation(damage, armor) {
    const dmg = Math.max(0, Number(damage) || 0);
    const a = Math.max(0, Number(armor) || 0);
    // Light mitigation curve: armor 0 => 100%; armor 10 => ~66%; armor 30 => ~40%
    const mitigation = a / (a + 20);
    return Math.max(0, Math.round(dmg * (1 - mitigation)));
}

function setBar(overlay, which, current, max, opts = {}) {
    const bar = overlay.querySelector(`.combat-bar[data-bar="${which}"] .combat-bar-fill`);
    const overlayText = overlay.querySelector(`.combat-bar-overlay[data-overlay="${which}"]`);
    const barRoot = overlay.querySelector(`.combat-bar[data-bar="${which}"]`);
    const pct = max > 0 ? clamp01(current / max) : 0;
    const cur = Math.max(0, Math.floor(current));
    const cap = Math.max(0, Math.floor(max));
    if (bar) bar.style.width = `${Math.round(pct * 100)}%`;
    if (overlayText) overlayText.textContent = `${cur} / ${cap}`;
    if (barRoot) {
        const who = String(which || '').toLowerCase().startsWith('enemy') ? 'Enemy' : 'Player';
        const label = (opts && opts.label) ? String(opts.label) : (String(which || '').includes('stamina') ? 'stamina' : 'health');
        barRoot.setAttribute('aria-label', `${who} ${label}: ${cur} / ${cap}`);
    }
}

function appendLog(overlay, line) {
    const log = overlay.querySelector('.combat-log');
    if (!log) return;
    const p = document.createElement('div');
    p.className = 'combat-log-line';
    p.textContent = line;
    log.appendChild(p);
    log.scrollTop = log.scrollHeight;
}

function appendLogWithTime(overlay, elapsedMs, line, kind = 'neutral') {
    const log = overlay.querySelector('.combat-log');
    if (!log) return;
    const row = document.createElement('div');
    const safeKind = String(kind || 'neutral').toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
    row.className = `combat-log-line kind-${safeKind}`;

    const t = document.createElement('span');
    t.className = 'combat-log-time';
    t.textContent = `[${formatCombatTime(elapsedMs)}]`;

    const msg = document.createElement('span');
    msg.textContent = line;

    row.appendChild(t);
    row.appendChild(msg);
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
}

function spawnCombatFloatText(overlay, text, opts = {}) {
    const lane = overlay?.querySelector?.('.combat-float-lane');
    if (!lane) return;
    const value = String(text ?? '').trim();
    if (!value) return;

    const who = (opts.who === 'enemy') ? 'enemy' : 'player';
    const kind = String(opts.kind || 'neutral');

    const el = document.createElement('div');
    el.className = `combat-float-text kind-${kind} from-${who}`;
    el.textContent = value;

    // Slight jitter so repeated hits don't overlap perfectly.
    const baseX = who === 'player' ? 20 : -20;
    const jitterX = randIntInclusive(-8, 8);
    const rot = randIntInclusive(-5, 5);
    el.style.setProperty('--x', `${baseX + jitterX}px`);
    el.style.setProperty('--rot', `${rot}deg`);

    lane.appendChild(el);

    const cleanup = () => {
        try { el.remove(); } catch {}
    };
    el.addEventListener('animationend', cleanup, { once: true });
    // Fallback cleanup in case animationend doesn't fire.
    setTimeout(cleanup, 1200);
}

function triggerSilhouetteAttack(overlay, who) {
    const el = overlay.querySelector(`.combat-portrait[data-portrait="${who}"]`);
    if (!el) return;
    el.classList.remove('attack');
    // Force reflow so re-adding restarts the animation.
    void el.offsetWidth;
    el.classList.add('attack');
}

function triggerEnemyDefeatedFx(overlay) {
    const orbit = overlay?.querySelector('.combat-orbit[data-orbit="enemy"]');
    if (!orbit) return;
    orbit.classList.remove('enemy-defeated');
    // Force reflow so re-adding restarts the animation.
    void orbit.offsetWidth;
    orbit.classList.add('enemy-defeated');
}

function fmtPct01(chance01) {
    const n = Number(chance01);
    if (!Number.isFinite(n)) return '0%';
    return `${Math.round(Math.max(0, Math.min(1, n)) * 100)}%`;
}

function setStatValue(overlay, who, stat, value) {
    const el = overlay.querySelector(`[data-stat-value="${who}-${stat}"]`);
    if (el) el.textContent = String(value ?? '');
}

function setMiniStats(overlay, { player = {}, enemy = {} } = {}) {
    setStatValue(overlay, 'player', 'hit', player.hit ?? '');
    setStatValue(overlay, 'player', 'crit', player.crit ?? '');
    setStatValue(overlay, 'player', 'evasion', player.evasion ?? '');
    setStatValue(overlay, 'player', 'armor', player.armor ?? '');
    setStatValue(overlay, 'player', 'damage', player.damage ?? '');
    setStatValue(overlay, 'player', 'attackSpeed', player.attackSpeed ?? '');

    setStatValue(overlay, 'enemy', 'hit', enemy.hit ?? '');
    setStatValue(overlay, 'enemy', 'crit', enemy.crit ?? '');
    setStatValue(overlay, 'enemy', 'evasion', enemy.evasion ?? '');
    setStatValue(overlay, 'enemy', 'armor', enemy.armor ?? '');
    setStatValue(overlay, 'enemy', 'damage', enemy.damage ?? '');
    setStatValue(overlay, 'enemy', 'attackSpeed', enemy.attackSpeed ?? '');
}

function formatCombatTime(ms) {
    const totalMs = Math.max(0, Math.floor(Number(ms) || 0));
    const totalSeconds = Math.floor(totalMs / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    const cs = Math.floor((totalMs % 1000) / 10); // centiseconds
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function setCloseButtonState(overlay, { enabled, label = 'Close (Esc)' } = {}) {
    const btn = overlay.querySelector('button[data-action="close"]');
    if (!btn) return;
    btn.textContent = label;
    btn.disabled = !enabled;
    btn.setAttribute('aria-disabled', btn.disabled ? 'true' : 'false');
}

function setCombatButtonsEnabled(overlay, enabled) {
    const stimBtn = overlay.querySelector('button[data-action="stim"]');
    const retreatBtn = overlay.querySelector('button[data-action="retreat"]');
    const heavyBtn = overlay.querySelector('button[data-action="heavy-strike"]');
    if (stimBtn) stimBtn.disabled = !enabled;
    if (retreatBtn) retreatBtn.disabled = !enabled;
    if (heavyBtn) heavyBtn.disabled = !enabled;
}

function setPauseUi(overlay, paused) {
    if (!overlay) return;
    overlay.classList.toggle('combat-paused', !!paused);

    const btn = overlay.querySelector('button[data-action="toggle-pause"]');
    if (btn) {
        btn.setAttribute('aria-label', paused ? 'Resume combat' : 'Pause combat');
        btn.setAttribute('title', paused ? 'Resume' : 'Pause');
    }
}

function attachEsc(overlay, onRetreat) {
    if (_escHandler) return;
    _escHandler = (e) => {
        if (e.key === 'Escape' || e.key === 'Esc') {
            e.preventDefault();
            onRetreat();
        }
    };
    document.addEventListener('keydown', _escHandler);
}

function detachEsc() {
    if (_escHandler) {
        document.removeEventListener('keydown', _escHandler);
        _escHandler = null;
    }
}

function show() {
    const overlay = ensureOverlay();
    overlay.classList.remove('hidden');
    overlay.style.display = '';
    // Allow tooltips inside combat popup (used for stat icons).
    try { window.dispatchEvent(new CustomEvent('popup-open', { detail: { source: 'combat', allowTooltips: true, tooltipRootId: 'combatPopup' } })); } catch {}
    overlay.setAttribute('tabindex', '-1');
    try { overlay.focus({ preventScroll: true }); } catch {}
    return overlay;
}

function hide() {
    const overlay = document.getElementById('combatPopup');
    if (overlay) {
        overlay.classList.add('hidden');
        overlay.style.display = 'none';
    }
    detachEsc();
    try { window.dispatchEvent(new CustomEvent('popup-close')); } catch {}
}

function computePlayerDps(stats) {
    const min = Number(stats?.damageMin ?? stats?.damage ?? 1);
    const max = Number(stats?.damageMax ?? stats?.damage ?? 2);
    const avg = (Number.isFinite(min) && Number.isFinite(max)) ? (min + max) / 2 : 1;
    // attackSpeed is seconds per attack (lower is faster). Clamp to combat caps.
    const interval = Math.max(COMBAT_CAPS.minAttackSpeedSec, Number(stats?.attackSpeed ?? 1));
    const critChance = clamp01((Number(stats?.critChance ?? 0)) / 100);
    // Crit is modeled as a small expected-value bonus (simple & stable)
    const expectedCritBonus = 0.5 * critChance; // +50% damage when crit, expected value
    const attacksPerSecond = 1 / interval;
    return Math.max(0.1, avg * Math.max(0.1, attacksPerSecond) * (1 + expectedCritBonus));
}

function computeDamageTakenPerSecond(enemyDps, armor) {
    const a = Math.max(0, Number(armor) || 0);
    // Light mitigation curve: armor 0 => 100%; armor 10 => ~66%; armor 30 => ~40%
    const mitigation = a / (a + 20);
    return Math.max(0, enemyDps * (1 - mitigation));
}

function clampPercentToChance(pct) {
    const n = Number(pct);
    if (!Number.isFinite(n)) return 0;
    return clamp01(n / 100);
}

function setStimButtonState(overlay) {
    const btn = overlay.querySelector('.combat-stim-icon');
    if (!btn) return;
    const count = countItemInBag('stimpack');
    btn.disabled = count <= 0;

    const countEl = overlay.querySelector('[data-stim-count]');
    if (countEl) countEl.textContent = count > 0 ? String(count) : '';

    // Tooltip explains effect + remaining count.
    const heal = 25;
    setupTooltip(btn, () => {
        if (count <= 0) return 'No Stimpack available.';
        return `Use Stimpack: +${heal} Health (consumes 1).\nRemaining: ${count}.`;
    });

    try { btn.dataset.tooltipPriority = '2600'; } catch (e) { /* ignore */ }
}

export function showCombatPopup(encounterId, opts = {}) {
    const def = getCombatEncounter(encounterId);
    if (!def) {
        console.warn('Unknown encounter:', encounterId);
        return Promise.resolve({ outcome: 'error' });
    }

    // If a combat is already active, refuse to start a new one.
    if (active) return Promise.resolve({ outcome: 'busy' });

    const overlay = show();
    const content = overlay.querySelector('.combat-popup-content');
    const title = overlay.querySelector('.combat-title');
    const subtitle = overlay.querySelector('.combat-subtitle');
    const enemyLabel = overlay.querySelector('[data-enemy-label]');

    if (title) title.textContent = 'Combat Encounter';
    if (subtitle) subtitle.textContent = '';
    if (enemyLabel) enemyLabel.textContent = def.name;
    if (content) content.classList.toggle('compact-header', true);

    // Portraits
    const playerPortrait = overlay.querySelector('[data-portrait="player"]');
    const enemyPortrait = overlay.querySelector('[data-portrait="enemy"]');
    if (playerPortrait) playerPortrait.setAttribute('src', 'assets/images/inventorycharacter.png');
    const enemyPortraitSrc = def?.enemy?.portrait || '';
    if (enemyPortrait) {
        if (enemyPortraitSrc) {
            enemyPortrait.classList.remove('hidden');
            enemyPortrait.setAttribute('src', enemyPortraitSrc);

            // Optional per-enemy portrait scaling (useful when some sprites read too large).
            // Scale is applied against the default CSS height (164px).
            try {
                const scale = Number(def?.enemy?.portraitScale);
                if (Number.isFinite(scale) && scale > 0) {
                    enemyPortrait.style.height = `${Math.round(164 * scale)}px`;
                } else {
                    enemyPortrait.style.removeProperty('height');
                }
            } catch { /* ignore */ }
        } else {
            enemyPortrait.classList.add('hidden');
            enemyPortrait.removeAttribute('src');
            try { enemyPortrait.style.removeProperty('height'); } catch {}
        }
    }

    // Reset log
    const log = overlay.querySelector('.combat-log');
    if (log) log.innerHTML = '';

    // Snapshot resources
    const health = getResource('Health');
    const stamina = getResource('Stamina');

    const playerMaxHp = health ? Number(health.capacity ?? 0) : 0;
    const playerHpStart = health ? Number(health.amount ?? 0) : 0;

    const playerMaxStamina = stamina ? Number(stamina.capacity ?? 0) : 0;
    const playerStaminaStart = stamina ? Number(stamina.amount ?? 0) : 0;

    const enemyMaxHp = Number(def?.enemy?.maxHp ?? 10);

    const enemyMaxStamina = Math.max(0, Number(def?.enemy?.maxStamina ?? def?.enemy?.stats?.stamina ?? def?.enemy?.stamina ?? 100));
    let enemyStamina = enemyMaxStamina;

    const stats = computeCharacterStats(characterState);
    // Survival debuffs also apply to combat.
    const foodRes = resources.find(r => r.name === 'Food Rations');
    const waterRes = resources.find(r => r.name === 'Clean Water');
    const isHungry = !!(foodRes && Number(foodRes.amount) <= 0);
    const isThirsty = !!(waterRes && Number(waterRes.amount) <= 0);

    // attackSpeed is seconds per attack (lower is faster). Clamp to combat caps.
    let playerAttackSpeed = Math.max(COMBAT_CAPS.minAttackSpeedSec, Number(stats?.attackSpeed ?? 1));
    let playerHitChancePct = Number(stats?.hitChance ?? COMBAT_CAPS.defaultHitChancePct);
    if (isHungry) playerHitChancePct -= 10;
    // Thirst slows attacks: increase time between attacks by ~17.6%.
    if (isThirsty) playerAttackSpeed *= (1 / 0.85);

    // Enforce caps after modifiers.
    playerAttackSpeed = Math.max(COMBAT_CAPS.minAttackSpeedSec, playerAttackSpeed);
    playerHitChancePct = Math.max(0, Math.min(COMBAT_CAPS.maxHitChancePct, playerHitChancePct));

    const playerHitChance = clampPercentToChance(playerHitChancePct);
    const baseEnemyHitChance = clampPercentToChance(Math.min(COMBAT_CAPS.maxHitChancePct, (def?.enemy?.hitChance ?? def?.enemy?.stats?.hitChance ?? 80)));
    const evasionChance = Math.min(COMBAT_CAPS.maxEvasion, clamp01((Number(stats?.evasion ?? 0)) / 100));
    const enemyHitChance = Math.max(0, Math.min(1, baseEnemyHitChance * (1 - evasionChance)));
    const playerCritChance = clamp01((Number(stats?.critChance ?? 0)) / 100);

    const enemyStatsDef = def?.enemy?.stats || {};
    const enemyCritChance = clamp01((Number(enemyStatsDef?.critChance ?? 0)) / 100);
    const enemyEvasion = Math.min(COMBAT_CAPS.maxEvasion, clamp01((Number(enemyStatsDef?.evasion ?? 0)) / 100));
    const enemyArmor = Math.max(0, Math.floor(Number(enemyStatsDef?.armor ?? 0)));
    const enemyDamageMin = Math.max(0, Math.floor(Number(enemyStatsDef?.damageMin ?? 0)));
    const enemyDamageMax = Math.max(enemyDamageMin, Math.floor(Number(enemyStatsDef?.damageMax ?? enemyDamageMin)));
    const enemyAttackSpeed = Math.max(0, Number(enemyStatsDef?.attackSpeed ?? 0));

    // Back-compat: if an encounter only specifies DPS, synthesize a basic range.
    const fallbackEnemyDps = Math.max(0, Number(def?.enemy?.dps ?? 1.5));
    const enemyAttackSpeedFinal = Math.max(COMBAT_CAPS.minAttackSpeedSec, (enemyAttackSpeed > 0 ? enemyAttackSpeed : 1));
    const enemyDamageMinFinal = (enemyDamageMin > 0 || enemyDamageMax > 0) ? enemyDamageMin : Math.max(1, Math.floor(fallbackEnemyDps));
    const enemyDamageMaxFinal = (enemyDamageMin > 0 || enemyDamageMax > 0) ? enemyDamageMax : Math.max(enemyDamageMinFinal, Math.ceil(fallbackEnemyDps));

    let playerHp = Math.max(0, playerHpStart);
    let enemyHp = Math.max(1, enemyMaxHp);

    setBar(overlay, 'player', playerHp, Math.max(1, playerMaxHp));
    setBar(overlay, 'enemy', enemyHp, Math.max(1, enemyMaxHp));
    setBar(overlay, 'player-stamina', playerStaminaStart, Math.max(1, playerMaxStamina), { label: 'stamina' });
    setBar(overlay, 'enemy-stamina', enemyStamina, Math.max(1, enemyMaxStamina), { label: 'stamina' });

    const combatStartPerf = performance.now();

    // Attack speed is modeled as seconds per attack.
    const playerIntervalMs = Math.max(50, Math.round(playerAttackSpeed * 1000));
    const enemyIntervalMs = Math.max(50, Math.round(enemyAttackSpeedFinal * 1000));
    let nextPlayerAttackAt = combatStartPerf + playerIntervalMs;
    let nextEnemyAttackAt = combatStartPerf + enemyIntervalMs;

    // Mini stats panel (static snapshot for this encounter)
    setMiniStats(overlay, {
        player: {
            hit: fmtPct01(playerHitChance),
            crit: fmtPct01(clamp01((Number(stats?.critChance ?? 0)) / 100)),
            evasion: fmtPct01(evasionChance),
            armor: String(Math.max(0, Math.floor(Number(stats?.armor ?? 0)))),
            damage: `${Math.floor(Number(stats?.damageMin ?? 0))}-${Math.floor(Number(stats?.damageMax ?? 0))}`,
            attackSpeed: `${playerAttackSpeed.toFixed(2)}s`,
        },
        enemy: {
            hit: fmtPct01(enemyHitChance),
            crit: fmtPct01(enemyCritChance),
            evasion: fmtPct01(enemyEvasion),
            armor: String(enemyArmor),
            damage: `${enemyDamageMinFinal}-${enemyDamageMaxFinal}`,
            attackSpeed: `${enemyAttackSpeedFinal.toFixed(2)}s`,
        }
    });

    appendLogWithTime(overlay, 0, `Engaged: ${def.name}.`, 'system');

    // Optional slight stamina cost over time (does not block prototype)
    const staminaCostPerSecond = 0.15;
    const HEAVY_STRIKE_STAMINA_COST = 25;
    const HEAVY_STRIKE_DAMAGE_MULT = 2.0;

    let last = performance.now();
    let raf = null;

    const finish = (outcome) => {
        if (raf) cancelAnimationFrame(raf);
        raf = null;
        active = null;

        try {
            window.removeEventListener('game-pause', onGamePause);
            window.removeEventListener('game-resume', onGameResume);
        } catch (e) { /* ignore */ }

        // Apply final HP to the Health resource
        if (health) {
            health.amount = Math.max(0, Math.min(Number(health.capacity ?? playerMaxHp), playerHp));
        }

        // Freeze UI in an end-state and wait for explicit acknowledgement.
        setCombatButtonsEnabled(overlay, false);
        setCloseButtonState(overlay, { enabled: true, label: 'Close (Esc)' });
        return outcome;
    };

    let resolvePromise = null;
    let finalOutcome = null;
    let pausedByCombat = false;

    const closeAndResolve = () => {
        const out = finalOutcome || { outcome: 'unknown' };
        // If combat paused the game, restore normal play on close.
        try {
            if (pausedByCombat && getIsPaused()) resumeGame(false);
        } catch (e) { /* ignore */ }
        hide();
        if (typeof resolvePromise === 'function') resolvePromise(out);
    };

    const onRetreat = () => {
        if (!active) return;
        const elapsedMs = performance.now() - combatStartPerf;
        appendLogWithTime(overlay, elapsedMs, 'You retreat.', 'system');
        addLogEntry(`Retreated from combat: ${def.name}.`, LogType.INFO);
        finalOutcome = finish({ outcome: 'retreat' });
    };

    const promise = new Promise((resolve) => {
        resolvePromise = resolve;

        const stimBtn = overlay.querySelector('.combat-stim-icon');
        const retreatBtn = overlay.querySelector('button[data-action="retreat"]');
        const closeBtn = overlay.querySelector('button[data-action="close"]');
        const pauseBtn = overlay.querySelector('button[data-action="toggle-pause"]');
        const heavyBtn = overlay.querySelector('button[data-action="heavy-strike"]');
        const placeholderBtn = overlay.querySelector('button[data-action="ability-placeholder"]');

        let combatPaused = false;

        const togglePauseAction = () => {
            if (finalOutcome) return;
            if (!active) return;

            // Toggle global pause (stops the game) and combat pauses via the events.
            try {
                if (getIsPaused()) {
                    resumeGame(false);
                } else {
                    pauseGame(false);
                    pausedByCombat = true;
                }
            } catch (err) {
                // Fallback: local pause only.
                combatPaused = !combatPaused;
                setPauseUi(overlay, combatPaused);
                if (combatPaused) {
                    if (raf) cancelAnimationFrame(raf);
                    raf = null;
                } else {
                    last = performance.now();
                    nextPlayerAttackAt = last + playerIntervalMs;
                    nextEnemyAttackAt = last + enemyIntervalMs;
                    if (!raf) raf = requestAnimationFrame(loop);
                }
            }
        };

        const syncAbilityButtons = () => {
            if (placeholderBtn) {
                placeholderBtn.disabled = true;
                placeholderBtn.setAttribute('aria-disabled', 'true');
                try { setupTooltip(placeholderBtn, 'Ability slot (coming soon).'); } catch {}
            }

            const staminaRes = stamina;
            const curStamina = staminaRes ? Number(staminaRes.amount ?? 0) : 0;
            const hasStamina = !!staminaRes;
            const enough = hasStamina && curStamina >= HEAVY_STRIKE_STAMINA_COST - 1e-9;

            if (heavyBtn) {
                const shouldDisable = !active || !!finalOutcome || combatPaused || !enough;
                heavyBtn.disabled = shouldDisable;
                heavyBtn.setAttribute('aria-disabled', shouldDisable ? 'true' : 'false');
                try {
                    setupTooltip(heavyBtn, () => {
                        if (!hasStamina) return 'Heavy Strike: requires Stamina.';
                        if (combatPaused) return 'Heavy Strike is unavailable while paused.';
                        if (!enough) return `Heavy Strike: costs ${HEAVY_STRIKE_STAMINA_COST} Stamina. (Need ${Math.max(0, Math.ceil(HEAVY_STRIKE_STAMINA_COST - curStamina))} more)`;
                        return `Heavy Strike: costs ${HEAVY_STRIKE_STAMINA_COST} Stamina. Deals heavy damage.`;
                    });
                } catch {}
            }
        };

        const onGamePause = () => {
            if (!active || finalOutcome) return;
            if (raf) cancelAnimationFrame(raf);
            raf = null;
            combatPaused = true;
            setPauseUi(overlay, true);
            try { syncAbilityButtons(); } catch (e) { /* ignore */ }
            // Reset scheduling so resume doesn't "catch up" on missed attacks.
            last = performance.now();
            nextPlayerAttackAt = last + playerIntervalMs;
            nextEnemyAttackAt = last + enemyIntervalMs;
        };

        const onGameResume = () => {
            if (!active || finalOutcome) return;
            combatPaused = false;
            setPauseUi(overlay, false);
            try { syncAbilityButtons(); } catch (e) { /* ignore */ }
            last = performance.now();
            nextPlayerAttackAt = last + playerIntervalMs;
            nextEnemyAttackAt = last + enemyIntervalMs;
            if (!raf) raf = requestAnimationFrame(loop);
        };

        try {
            window.addEventListener('game-pause', onGamePause);
            window.addEventListener('game-resume', onGameResume);
        } catch (e) { /* ignore */ }

        const useStim = () => {
            if (!active) return;
            const healthRes = getResource('Health');
            if (!healthRes) return;
            if (countItemInBag('stimpack') <= 0) return;
            const consumed = consumeFirstItemFromBag('stimpack');
            if (!consumed) return;
            const heal = 25;
            playerHp = Math.min(playerMaxHp || 100, playerHp + heal);
            healthRes.amount = playerHp;
            const elapsedMs = performance.now() - combatStartPerf;
            appendLogWithTime(overlay, elapsedMs, `Used Stimpack (+${heal} Health).`, 'item');
            spawnCombatFloatText(overlay, `+${heal}`, { who: 'player', kind: 'item' });
            setStimButtonState(overlay);
            setBar(overlay, 'player', playerHp, Math.max(1, playerMaxHp));
            syncAbilityButtons();
        };

        const useHeavyStrike = () => {
            if (!active || finalOutcome) return;
            if (combatPaused) return;
            if (!stamina) return;

            const curStamina = Number(stamina.amount ?? 0);
            if (!Number.isFinite(curStamina) || curStamina < HEAVY_STRIKE_STAMINA_COST) return;

            stamina.amount = Math.max(0, curStamina - HEAVY_STRIKE_STAMINA_COST);

            const base = randIntInclusive(stats?.damageMin ?? 1, stats?.damageMax ?? 2);
            const raw = Math.max(0, Math.round(base * HEAVY_STRIKE_DAMAGE_MULT));
            const dealt = applyArmorMitigation(raw, enemyArmor);
            enemyHp = Math.max(0, enemyHp - dealt);

            const elapsedMs = performance.now() - combatStartPerf;
            appendLogWithTime(overlay, elapsedMs, `You HEAVY STRIKE for ${dealt} damage.`, 'player-crit');
            spawnCombatFloatText(overlay, `${dealt}!`, { who: 'player', kind: 'player-crit' });
            triggerSilhouetteAttack(overlay, 'player');

            setBar(overlay, 'enemy', enemyHp, Math.max(1, enemyMaxHp));
            setBar(
                overlay,
                'player-stamina',
                Number(stamina.amount ?? 0),
                Math.max(1, Number((stamina.capacity ?? playerMaxStamina) || 0)),
                { label: 'stamina' }
            );
            syncAbilityButtons();

            if (enemyHp <= 0) {
                try { triggerEnemyDefeatedFx(overlay); } catch {}
                appendLogWithTime(overlay, elapsedMs, `Victory.`, 'win');
                addLogEntry(`Defeated: ${def.name}.`, LogType.SUCCESS);
                finalOutcome = finish({ outcome: 'win' });
            }
        };

        if (stimBtn) {
            stimBtn.onclick = (e) => { e.preventDefault(); useStim(); };
        }
        if (heavyBtn) {
            heavyBtn.onclick = (e) => { e.preventDefault(); useHeavyStrike(); };
        }
        if (retreatBtn) {
            retreatBtn.onclick = (e) => { e.preventDefault(); onRetreat(); };
        }
        if (pauseBtn) {
            pauseBtn.onclick = (e) => {
                e.preventDefault();
                togglePauseAction();
            };
        }

        if (closeBtn) {
            // Disabled until combat resolves.
            setCloseButtonState(overlay, { enabled: false, label: 'Close (Esc)' });
            closeBtn.onclick = (e) => {
                e.preventDefault();
                if (!finalOutcome) return;
                closeAndResolve();
            };
        }

        setStimButtonState(overlay);
        syncAbilityButtons();
        // If the game is already paused, begin with combat paused too.
        try {
            if (getIsPaused()) {
                combatPaused = true;
                setPauseUi(overlay, true);
            } else {
                setPauseUi(overlay, false);
            }
        } catch (e) { /* ignore */ }

        attachEsc(overlay, () => {
            // Esc closes only after combat is resolved; otherwise it toggles pause.
            if (finalOutcome) closeAndResolve();
            else togglePauseAction();
        });

        active = { encounterId, startedAt: Date.now() };
        setCombatButtonsEnabled(overlay, true);
        try { syncAbilityButtons(); } catch (e) { /* ignore */ }

        // Option: start combat paused (also pauses the game so nothing continues ticking behind the overlay).
        try {
            const startPaused = (typeof getCombatStartPaused === 'function') ? !!getCombatStartPaused() : true;
            if (startPaused && !getIsPaused()) {
                combatPaused = true;
                setPauseUi(overlay, true);
                pauseGame(false);
                pausedByCombat = true;
            }
        } catch (e) { /* ignore */ }

        function loop(now) {
            if (!active) return;
            if (combatPaused) return;

            const dt = Math.max(0, Math.min((now - last) / 1000, 0.5));
            last = now;

            // Resolve combat by true time-based scheduling (attack every X seconds).
            // Handle multiple events per frame in case the tab was inactive.
            const effectivePlayerHitChance = clamp01(playerHitChance * (1 - enemyEvasion));
            const effectiveEnemyHitChance = enemyHitChance;

            let safety = 0;
            while (active && safety < 1000) {
                const nextAt = Math.min(nextPlayerAttackAt, nextEnemyAttackAt);
                if (now < nextAt) break;
                const elapsedMs = nextAt - combatStartPerf;

                const playerDue = nextPlayerAttackAt <= nextAt + 0.0001;
                const enemyDue = nextEnemyAttackAt <= nextAt + 0.0001;

                // If both happen at the same instant, resolve player first for consistency.
                if (playerDue && active) {
                    const hit = Math.random() < effectivePlayerHitChance;
                    const crit = hit && (Math.random() < playerCritChance);
                    if (hit) {
                        const raw = randIntInclusive(stats?.damageMin ?? 1, stats?.damageMax ?? 2);
                        const withCrit = crit ? Math.round(raw * 1.5) : raw;
                        const dealt = applyArmorMitigation(withCrit, enemyArmor);
                        enemyHp = Math.max(0, enemyHp - dealt);
                        appendLogWithTime(overlay, elapsedMs, crit ? `You CRIT for ${dealt} damage.` : `You hit for ${dealt} damage.`, crit ? 'player-crit' : 'player-hit');
                        spawnCombatFloatText(overlay, crit ? `${dealt}!` : `${dealt}`, { who: 'player', kind: crit ? 'player-crit' : 'player-hit' });
                        triggerSilhouetteAttack(overlay, 'player');
                    } else {
                        appendLogWithTime(overlay, elapsedMs, 'You miss.', 'player-miss');
                        spawnCombatFloatText(overlay, 'MISS', { who: 'player', kind: 'player-miss' });
                        triggerSilhouetteAttack(overlay, 'player');
                    }

                    setBar(overlay, 'enemy', enemyHp, Math.max(1, enemyMaxHp));
                    nextPlayerAttackAt += playerIntervalMs;
                    if (enemyHp <= 0) {
                        try { triggerEnemyDefeatedFx(overlay); } catch (e) { /* ignore */ }
                        appendLogWithTime(overlay, elapsedMs, `Victory.`, 'win');
                        addLogEntry(`Defeated: ${def.name}.`, LogType.SUCCESS);
                        finalOutcome = finish({ outcome: 'win' });
                        return;
                    }
                }

                if (enemyDue && active) {
                    const hit = Math.random() < effectiveEnemyHitChance;
                    const crit = hit && (Math.random() < enemyCritChance);
                    if (hit) {
                        const raw = randIntInclusive(enemyDamageMinFinal, enemyDamageMaxFinal);
                        const withCrit = crit ? Math.round(raw * 1.5) : raw;
                        const taken = applyArmorMitigation(withCrit, stats?.armor ?? 0);
                        playerHp = Math.max(0, playerHp - taken);
                        appendLogWithTime(overlay, elapsedMs, crit ? `${def.name} CRITS for ${taken} damage.` : `${def.name} hits for ${taken} damage.`, crit ? 'enemy-crit' : 'enemy-hit');
                        spawnCombatFloatText(overlay, crit ? `${taken}!` : `${taken}`, { who: 'enemy', kind: crit ? 'enemy-crit' : 'enemy-hit' });
                        triggerSilhouetteAttack(overlay, 'enemy');
                    } else {
                        appendLogWithTime(overlay, elapsedMs, `${def.name} misses.`, 'enemy-miss');
                        spawnCombatFloatText(overlay, 'MISS', { who: 'enemy', kind: 'enemy-miss' });
                        triggerSilhouetteAttack(overlay, 'enemy');
                    }

                    setBar(overlay, 'player', playerHp, Math.max(1, playerMaxHp));
                    nextEnemyAttackAt += enemyIntervalMs;
                    if (playerHp <= 0) {
                        appendLogWithTime(overlay, elapsedMs, `You are down.`, 'lose');
                        addLogEntry(`Defeated by: ${def.name}.`, LogType.ERROR);
                        finalOutcome = finish({ outcome: 'lose' });
                        return;
                    }
                }

                safety++;
            }

            // Optional stamina drain
            if (stamina) {
                stamina.amount = Math.max(0, Number(stamina.amount ?? 0) - staminaCostPerSecond * dt);
            }

            setBar(overlay, 'player', playerHp, Math.max(1, playerMaxHp));
            setBar(overlay, 'enemy', enemyHp, Math.max(1, enemyMaxHp));
            if (stamina) {
                setBar(
                    overlay,
                    'player-stamina',
                    Number(stamina.amount ?? 0),
                    Math.max(1, Number((stamina.capacity ?? playerMaxStamina) || 0)),
                    { label: 'stamina' }
                );
            } else {
                setBar(overlay, 'player-stamina', 0, Math.max(1, playerMaxStamina || 0), { label: 'stamina' });
            }
            setBar(overlay, 'enemy-stamina', enemyStamina, Math.max(1, enemyMaxStamina), { label: 'stamina' });
            try { syncAbilityButtons(); } catch (e) { /* ignore */ }

            // Win/lose is resolved inside the turn loop where attacks happen.

            raf = requestAnimationFrame(loop);
        }

        if (!combatPaused) raf = requestAnimationFrame(loop);
    });

    return promise;
}

// Pause combat ticks when the game is paused
window.addEventListener('game-pause', () => {
    // Nothing special needed; the loop is rAF and will keep running.
    // But we can freeze by clearing active and treating as retreat.
    // For prototype: do nothing; players can still use retreat.
});
