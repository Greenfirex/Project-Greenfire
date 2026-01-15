import { getCombatEncounter } from '../../data/definitions/combatEncounters.js';
import { resources } from '../../core/resources.js';
import { addLogEntry, LogType } from '../../core/ingameLog.js';
import { characterState, computeCharacterStats } from '../../data/character.js';
import { consumeFirstItemFromBag, countItemInBag } from '../../data/character.js';
import { setupTooltip } from './tooltip.js';
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
            <span class="combat-popup-close" title="Close">&times;</span>
            <div class="combat-popup-header story-popup-header">
                <h2 class="combat-title"></h2>
                <div class="combat-subtitle"></div>
            </div>

            <div class="combat-popup-body">
                <div class="combat-bars">
                    <div class="combat-bar-group">
                        <div class="combat-bar-top">
                            <div class="combat-bar-label">You</div>
                            <button class="combat-stim-icon" type="button" data-action="stim" aria-label="Use Stimpack">
                                <span class="svg" aria-hidden="true">${svgIcon('stim')}</span>
                                <span class="combat-stim-count" data-stim-count></span>
                            </button>
                        </div>
                        <div class="combat-bar" data-bar="player" role="img" aria-label="Player health">
                            <div class="combat-bar-fill player"></div>
                            <div class="combat-bar-overlay" data-overlay="player"></div>
                        </div>
                        <div class="combat-mini-inline" aria-label="Player stats">
                            <div class="combat-orbit" data-orbit="player">
                                <img class="combat-portrait player" data-portrait="player" alt="" />

                                <div class="combat-stat-icon pos-tl" data-stat="hit" data-who="player">
                                    <div class="svg" aria-hidden="true">${svgIcon('target')}</div>
                                    <div class="val" data-stat-value="player-hit"></div>
                                </div>
                                <div class="combat-stat-icon pos-tr" data-stat="crit" data-who="player">
                                    <div class="svg" aria-hidden="true">${svgIcon('burst')}</div>
                                    <div class="val" data-stat-value="player-crit"></div>
                                </div>
                                <div class="combat-stat-icon pos-ml" data-stat="evasion" data-who="player">
                                    <div class="svg" aria-hidden="true">${svgIcon('swirl')}</div>
                                    <div class="val" data-stat-value="player-evasion"></div>
                                </div>
                                <div class="combat-stat-icon pos-mr" data-stat="armor" data-who="player">
                                    <div class="svg" aria-hidden="true">${svgIcon('shield')}</div>
                                    <div class="val" data-stat-value="player-armor"></div>
                                </div>
                                <div class="combat-stat-icon pos-bl" data-stat="damage" data-who="player">
                                    <div class="svg" aria-hidden="true">${svgIcon('sword')}</div>
                                    <div class="val" data-stat-value="player-damage"></div>
                                </div>
                                <div class="combat-stat-icon pos-br" data-stat="attackSpeed" data-who="player">
                                    <div class="svg" aria-hidden="true">${svgIcon('clock')}</div>
                                    <div class="val" data-stat-value="player-attackSpeed"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="combat-bar-group">
                        <div class="combat-bar-label" data-enemy-label>Enemy</div>
                        <div class="combat-bar" data-bar="enemy" role="img" aria-label="Enemy health">
                            <div class="combat-bar-fill enemy"></div>
                            <div class="combat-bar-overlay" data-overlay="enemy"></div>
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

                <div class="combat-log" aria-label="Combat log"></div>
            </div>

            <div class="combat-popup-actions">
                <button class="menu-button combat-btn" data-action="retreat">Retreat</button>
                <button class="menu-button combat-btn combat-btn-primary" data-action="continue">Pause</button>
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

    // Close button is disabled during active combat. After combat, it acts like Continue/Close.
    const close = overlay.querySelector('.combat-popup-close');
    if (close) close.addEventListener('click', () => {
        // Prefer the explicit Continue handler if present.
        const cont = overlay.querySelector('button[data-action="continue"]');
        if (cont && !cont.classList.contains('hidden') && !cont.disabled) {
            cont.click();
            return;
        }
        if (!active) hide();
    });

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
    hit: 'Hit Chance — chance to land an attack.',
    crit: 'Crit Chance — chance for a critical hit (extra damage).',
    evasion: 'Evasion — reduces the enemy\'s chance to hit you.',
    armor: 'Armor — reduces damage taken.',
    damage: 'Damage — attack damage range.',
    attackSpeed: 'Attack Speed — time between attacks (seconds). Lower is faster.',
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

function setBar(overlay, which, current, max) {
    const bar = overlay.querySelector(`.combat-bar[data-bar="${which}"] .combat-bar-fill`);
    const overlayText = overlay.querySelector(`.combat-bar-overlay[data-overlay="${which}"]`);
    const barRoot = overlay.querySelector(`.combat-bar[data-bar="${which}"]`);
    const pct = max > 0 ? clamp01(current / max) : 0;
    const cur = Math.max(0, Math.floor(current));
    const cap = Math.max(0, Math.floor(max));
    if (bar) bar.style.width = `${Math.round(pct * 100)}%`;
    if (overlayText) overlayText.textContent = `${cur} / ${cap}`;
    if (barRoot) barRoot.setAttribute('aria-label', `${which === 'enemy' ? 'Enemy' : 'Player'} health: ${cur} / ${cap}`);
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

function triggerSilhouetteAttack(overlay, who) {
    const el = overlay.querySelector(`.combat-portrait[data-portrait="${who}"]`);
    if (!el) return;
    el.classList.remove('attack');
    // Force reflow so re-adding restarts the animation.
    void el.offsetWidth;
    el.classList.add('attack');
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

function setContinueVisible(overlay, visible, label = 'Continue') {
    const btn = overlay.querySelector('button[data-action="continue"]');
    if (!btn) return;
    btn.textContent = label;
    btn.classList.toggle('hidden', !visible);
}

function setCombatButtonsEnabled(overlay, enabled) {
    const stimBtn = overlay.querySelector('button[data-action="stim"]');
    const retreatBtn = overlay.querySelector('button[data-action="retreat"]');
    if (stimBtn) stimBtn.disabled = !enabled;
    if (retreatBtn) retreatBtn.disabled = !enabled;
}

function attachEsc(overlay, onRetreat) {
    if (_escHandler) return;
    _escHandler = (e) => {
        if (e.key === 'Escape' || e.key === 'Esc') {
            e.preventDefault();
            if (active) onRetreat();
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
    // attackSpeed is seconds per attack.
    const interval = Math.max(0.05, Number(stats?.attackSpeed ?? 1));
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
    const close = overlay.querySelector('.combat-popup-close');

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
        } else {
            enemyPortrait.classList.add('hidden');
            enemyPortrait.removeAttribute('src');
        }
    }

    // Disable close during combat
    if (close) close.classList.add('disabled');

    // Reset log
    const log = overlay.querySelector('.combat-log');
    if (log) log.innerHTML = '';

    // Snapshot resources
    const health = getResource('Health');
    const stamina = getResource('Stamina');

    const playerMaxHp = health ? Number(health.capacity ?? 0) : 0;
    const playerHpStart = health ? Number(health.amount ?? 0) : 0;

    const enemyMaxHp = Number(def?.enemy?.maxHp ?? 10);

    const stats = computeCharacterStats(characterState);
    // Survival debuffs also apply to combat.
    const foodRes = resources.find(r => r.name === 'Food Rations');
    const waterRes = resources.find(r => r.name === 'Clean Water');
    const isHungry = !!(foodRes && Number(foodRes.amount) <= 0);
    const isThirsty = !!(waterRes && Number(waterRes.amount) <= 0);

    // attackSpeed is seconds per attack.
    let playerAttackSpeed = Math.max(0.05, Number(stats?.attackSpeed ?? 1));
    let playerHitChancePct = Number(stats?.hitChance ?? 80);
    if (isHungry) playerHitChancePct -= 10;
    // Thirst slows attacks: increase time between attacks by ~17.6%.
    if (isThirsty) playerAttackSpeed *= (1 / 0.85);

    const playerHitChance = clampPercentToChance(playerHitChancePct);
    const baseEnemyHitChance = clampPercentToChance(def?.enemy?.hitChance ?? def?.enemy?.stats?.hitChance ?? 80);
    const evasionChance = clamp01((Number(stats?.evasion ?? 0)) / 100);
    const enemyHitChance = Math.max(0, Math.min(1, baseEnemyHitChance * (1 - evasionChance)));
    const playerCritChance = clamp01((Number(stats?.critChance ?? 0)) / 100);

    const enemyStatsDef = def?.enemy?.stats || {};
    const enemyCritChance = clamp01((Number(enemyStatsDef?.critChance ?? 0)) / 100);
    const enemyEvasion = clamp01((Number(enemyStatsDef?.evasion ?? 0)) / 100);
    const enemyArmor = Math.max(0, Math.floor(Number(enemyStatsDef?.armor ?? 0)));
    const enemyDamageMin = Math.max(0, Math.floor(Number(enemyStatsDef?.damageMin ?? 0)));
    const enemyDamageMax = Math.max(enemyDamageMin, Math.floor(Number(enemyStatsDef?.damageMax ?? enemyDamageMin)));
    const enemyAttackSpeed = Math.max(0, Number(enemyStatsDef?.attackSpeed ?? 0));

    // Back-compat: if an encounter only specifies DPS, synthesize a basic range.
    const fallbackEnemyDps = Math.max(0, Number(def?.enemy?.dps ?? 1.5));
    const enemyAttackSpeedFinal = enemyAttackSpeed > 0 ? enemyAttackSpeed : 1;
    const enemyDamageMinFinal = (enemyDamageMin > 0 || enemyDamageMax > 0) ? enemyDamageMin : Math.max(1, Math.floor(fallbackEnemyDps));
    const enemyDamageMaxFinal = (enemyDamageMin > 0 || enemyDamageMax > 0) ? enemyDamageMax : Math.max(enemyDamageMinFinal, Math.ceil(fallbackEnemyDps));

    let playerHp = Math.max(0, playerHpStart);
    let enemyHp = Math.max(1, enemyMaxHp);

    setBar(overlay, 'player', playerHp, Math.max(1, playerMaxHp));
    setBar(overlay, 'enemy', enemyHp, Math.max(1, enemyMaxHp));

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
            evasion: fmtPct01(clamp01((Number(stats?.evasion ?? 0)) / 100)),
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
        setContinueVisible(overlay, true, outcome?.outcome === 'win' ? 'Continue' : 'Close');
        if (close) close.classList.remove('disabled');
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
        const continueBtn = overlay.querySelector('button[data-action="continue"]');

        let combatPaused = false;

        const setPauseBtnLabel = () => {
            if (!continueBtn) return;
            if (finalOutcome) return; // finish() sets label to Continue/Close
            continueBtn.textContent = combatPaused ? 'Resume' : 'Pause';
        };

        const onGamePause = () => {
            if (!active || finalOutcome) return;
            if (raf) cancelAnimationFrame(raf);
            raf = null;
            combatPaused = true;
            // Reset scheduling so resume doesn't "catch up" on missed attacks.
            last = performance.now();
            nextPlayerAttackAt = last + playerIntervalMs;
            nextEnemyAttackAt = last + enemyIntervalMs;
            setPauseBtnLabel();
        };

        const onGameResume = () => {
            if (!active || finalOutcome) return;
            combatPaused = false;
            last = performance.now();
            nextPlayerAttackAt = last + playerIntervalMs;
            nextEnemyAttackAt = last + enemyIntervalMs;
            setPauseBtnLabel();
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
            setStimButtonState(overlay);
            setBar(overlay, 'player', playerHp, Math.max(1, playerMaxHp));
        };

        if (stimBtn) {
            stimBtn.onclick = (e) => { e.preventDefault(); useStim(); };
        }
        if (retreatBtn) {
            retreatBtn.onclick = (e) => { e.preventDefault(); onRetreat(); };
        }
        if (continueBtn) {
            continueBtn.onclick = (e) => {
                e.preventDefault();
                if (finalOutcome) {
                    closeAndResolve();
                    return;
                }
                if (!active) return;

                // Toggle global pause (stops the game) and combat pauses via the events.
                try {
                    if (getIsPaused()) {
                        resumeGame(false);
                        pausedByCombat = false;
                    } else {
                        pauseGame(false);
                        pausedByCombat = true;
                    }
                } catch (err) {
                    // If pause helpers fail for any reason, still locally toggle combat.
                    combatPaused = !combatPaused;
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
                setPauseBtnLabel();
            };
        }

        setStimButtonState(overlay);
        setContinueVisible(overlay, true, 'Pause');
        // If the game is already paused, begin with combat paused too.
        try {
            if (getIsPaused()) {
                combatPaused = true;
                setPauseBtnLabel();
            }
        } catch (e) { /* ignore */ }

        attachEsc(overlay, () => {
            // While active: retreat. After finished: close.
            if (active) onRetreat();
            else if (finalOutcome) closeAndResolve();
        });

        active = { encounterId, startedAt: Date.now() };
        setCombatButtonsEnabled(overlay, true);

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
                        triggerSilhouetteAttack(overlay, 'player');
                    } else {
                        appendLogWithTime(overlay, elapsedMs, 'You miss.', 'player-miss');
                        triggerSilhouetteAttack(overlay, 'player');
                    }

                    setBar(overlay, 'enemy', enemyHp, Math.max(1, enemyMaxHp));
                    nextPlayerAttackAt += playerIntervalMs;
                    if (enemyHp <= 0) {
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
                        triggerSilhouetteAttack(overlay, 'enemy');
                    } else {
                        appendLogWithTime(overlay, elapsedMs, `${def.name} misses.`, 'enemy-miss');
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
