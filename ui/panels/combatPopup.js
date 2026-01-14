import { getCombatEncounter } from '../../data/definitions/combatEncounters.js';
import { resources } from '../../core/resources.js';
import { addLogEntry, LogType } from '../../core/ingameLog.js';
import { characterState, computeCharacterStats } from '../../data/character.js';
import { consumeFirstItemFromBag, countItemInBag } from '../../data/character.js';

let active = null;
let _escHandler = null;

function ensureOverlay() {
    let overlay = document.getElementById('combatPopup');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'combatPopup';
    overlay.className = 'combat-popup-overlay hidden';
    overlay.innerHTML = `
        <div class="combat-popup-content" role="dialog" aria-modal="true" aria-label="Combat">
            <span class="combat-popup-close" title="Close">&times;</span>
            <div class="combat-popup-header">
                <h2 class="combat-title"></h2>
                <div class="combat-subtitle"></div>
            </div>

            <div class="combat-popup-body">
                <div class="combat-bars">
                    <div class="combat-bar-group">
                        <div class="combat-bar-label">You</div>
                        <div class="combat-bar" data-bar="player"><div class="combat-bar-fill player"></div></div>
                        <div class="combat-bar-text" data-text="player"></div>
                    </div>
                    <div class="combat-bar-group">
                        <div class="combat-bar-label" data-enemy-label>Enemy</div>
                        <div class="combat-bar" data-bar="enemy"><div class="combat-bar-fill enemy"></div></div>
                        <div class="combat-bar-text" data-text="enemy"></div>
                    </div>
                </div>

                <div class="combat-log" aria-label="Combat log"></div>
            </div>

            <div class="combat-popup-actions">
                <button class="menu-button combat-btn" data-action="stim">Use Stimpack</button>
                <button class="menu-button combat-btn" data-action="retreat">Retreat</button>
                <button class="menu-button combat-btn combat-btn-primary hidden" data-action="continue">Continue</button>
            </div>
        </div>
    `;

    // Ensure it lives directly under body so stacking contexts don't hide it
    document.body.appendChild(overlay);

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

function getResource(name) {
    return (resources || []).find(r => r && r.name === name) || null;
}

function clamp01(x) {
    if (!Number.isFinite(x)) return 0;
    return Math.max(0, Math.min(1, x));
}

function setBar(overlay, which, current, max) {
    const bar = overlay.querySelector(`.combat-bar[data-bar="${which}"] .combat-bar-fill`);
    const text = overlay.querySelector(`.combat-bar-text[data-text="${which}"]`);
    const pct = max > 0 ? clamp01(current / max) : 0;
    if (bar) bar.style.width = `${Math.round(pct * 100)}%`;
    if (text) text.textContent = `${Math.max(0, Math.floor(current))} / ${Math.max(0, Math.floor(max))}`;
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

function appendLogWithTime(overlay, elapsedMs, line) {
    const log = overlay.querySelector('.combat-log');
    if (!log) return;
    const row = document.createElement('div');
    row.className = 'combat-log-line';

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

function formatCombatTime(ms) {
    const total = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
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
    try { window.dispatchEvent(new CustomEvent('popup-open')); } catch {}
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
    const speed = Number(stats?.attackSpeed ?? 1);
    const critChance = clamp01((Number(stats?.critChance ?? 0)) / 100);
    // Crit is modeled as a small expected-value bonus (simple & stable)
    const expectedCritBonus = 0.5 * critChance; // +50% damage when crit, expected value
    return Math.max(0.1, avg * Math.max(0.1, speed) * (1 + expectedCritBonus));
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
    const btn = overlay.querySelector('button[data-action="stim"]');
    if (!btn) return;
    const count = countItemInBag('stimpack');
    btn.disabled = count <= 0;
    btn.textContent = count > 0 ? `Use Stimpack (${count})` : 'Use Stimpack';
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
    const title = overlay.querySelector('.combat-title');
    const subtitle = overlay.querySelector('.combat-subtitle');
    const enemyLabel = overlay.querySelector('[data-enemy-label]');
    const close = overlay.querySelector('.combat-popup-close');

    if (title) title.textContent = def.name;
    if (subtitle) subtitle.textContent = def.description || '';
    if (enemyLabel) enemyLabel.textContent = def.name;

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
    const playerDps = computePlayerDps(stats);
    const enemyDps = Number(def?.enemy?.dps ?? 1.5);
    const takenDps = computeDamageTakenPerSecond(enemyDps, stats.armor);

    const playerHitChance = clampPercentToChance(stats?.hitChance ?? 80);
    const enemyHitChance = clampPercentToChance(def?.enemy?.hitChance ?? 80);

    // Slow down combat pacing to feel more readable.
    // Prefer per-encounter tuning when provided.
    const simSpeed = Math.max(0.05, Math.min(1, Number(def?.rules?.simSpeed ?? opts.simSpeed ?? 0.25)));

    let playerHp = Math.max(0, playerHpStart);
    let enemyHp = Math.max(1, enemyMaxHp);

    setBar(overlay, 'player', playerHp, Math.max(1, playerMaxHp));
    setBar(overlay, 'enemy', enemyHp, Math.max(1, enemyMaxHp));

    const combatStartPerf = performance.now();
    let roundAccumulator = 0;

    appendLogWithTime(overlay, 0, `Engaged: ${def.name}.`);

    // Optional slight stamina cost over time (does not block prototype)
    const staminaCostPerSecond = 0.15;

    let last = performance.now();
    let raf = null;

    const finish = (outcome) => {
        if (raf) cancelAnimationFrame(raf);
        raf = null;
        active = null;

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

    const closeAndResolve = () => {
        const out = finalOutcome || { outcome: 'unknown' };
        hide();
        if (typeof resolvePromise === 'function') resolvePromise(out);
    };

    const onRetreat = () => {
        if (!active) return;
        const elapsedMs = performance.now() - combatStartPerf;
        appendLogWithTime(overlay, elapsedMs, 'You retreat.');
        addLogEntry(`Retreated from combat: ${def.name}.`, LogType.INFO);
        finalOutcome = finish({ outcome: 'retreat' });
    };

    const promise = new Promise((resolve) => {
        resolvePromise = resolve;

        const stimBtn = overlay.querySelector('button[data-action="stim"]');
        const retreatBtn = overlay.querySelector('button[data-action="retreat"]');
        const continueBtn = overlay.querySelector('button[data-action="continue"]');

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
            appendLogWithTime(overlay, elapsedMs, `Used Stimpack (+${heal} Health).`);
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
                if (!finalOutcome) return;
                closeAndResolve();
            };
        }

        setStimButtonState(overlay);
        setContinueVisible(overlay, false);

        attachEsc(overlay, () => {
            // While active: retreat. After finished: close.
            if (active) onRetreat();
            else if (finalOutcome) closeAndResolve();
        });

        active = { encounterId, startedAt: Date.now() };
        setCombatButtonsEnabled(overlay, true);

        function loop(now) {
            if (!active) return;

            const dt = Math.max(0, Math.min((now - last) / 1000, 0.25));
            last = now;

            const simDt = dt * simSpeed;

            // Resolve combat in discrete 1-second rounds so hit/miss is readable.
            roundAccumulator += simDt;
            while (roundAccumulator >= 1 && active) {
                roundAccumulator -= 1;

                const elapsedMs = now - combatStartPerf;

                const playerHit = Math.random() < playerHitChance;
                const enemyHit = Math.random() < enemyHitChance;

                const dealt = playerHit ? Math.max(0, Math.round(playerDps)) : 0;
                const taken = enemyHit ? Math.max(0, Math.round(takenDps)) : 0;

                if (dealt > 0) {
                    enemyHp = Math.max(0, enemyHp - dealt);
                    appendLogWithTime(overlay, elapsedMs, `You hit for ${dealt} damage.`);
                } else {
                    appendLogWithTime(overlay, elapsedMs, 'You miss.');
                }

                if (taken > 0) {
                    playerHp = Math.max(0, playerHp - taken);
                    appendLogWithTime(overlay, elapsedMs, `${def.name} hits for ${taken} damage.`);
                } else {
                    appendLogWithTime(overlay, elapsedMs, `${def.name} misses.`);
                }
            }

            // Optional stamina drain
            if (stamina) {
                stamina.amount = Math.max(0, Number(stamina.amount ?? 0) - staminaCostPerSecond * simDt);
            }

            setBar(overlay, 'player', playerHp, Math.max(1, playerMaxHp));
            setBar(overlay, 'enemy', enemyHp, Math.max(1, enemyMaxHp));

            if (enemyHp <= 0) {
                appendLogWithTime(overlay, performance.now() - combatStartPerf, `Victory.`);
                addLogEntry(`Defeated: ${def.name}.`, LogType.SUCCESS);
                finalOutcome = finish({ outcome: 'win' });
                return;
            }

            if (playerHp <= 0) {
                appendLogWithTime(overlay, performance.now() - combatStartPerf, `You are down.`);
                addLogEntry(`Defeated by: ${def.name}.`, LogType.ERROR);
                finalOutcome = finish({ outcome: 'lose' });
                return;
            }

            raf = requestAnimationFrame(loop);
        }

        raf = requestAnimationFrame(loop);
    });

    return promise;
}

// Pause combat ticks when the game is paused
window.addEventListener('game-pause', () => {
    // Nothing special needed; the loop is rAF and will keep running.
    // But we can freeze by clearing active and treating as retreat.
    // For prototype: do nothing; players can still use retreat.
});
