// ==========================================================================
// Audio Utility — synthesized UI & ambient sound effects (Web Audio API)
// No external files required. Lazily initializes AudioContext on first use.
// ==========================================================================

let _ctx = null;
let _masterGain = null;      // master volume node
let _ambientNodes = null;     // { osc, gain, noiseSource } for current ambient
let _ambientInterval = null;  // interval ID for ambient beeps
let _alarmNodes = null;       // { osc, gain, lfo } for alarm
let _alarmInterval = null;    // interval ID for alarm pulsing
let _criticalInterval = null; // interval ID for critical warning
let _muted = false;
let _volume = 0.5;            // 0.0 - 1.0, default 50%

// ==========================================================================
// Core utilities
// ==========================================================================

function getContext() {
    if (!_ctx) {
        try {
            _ctx = new (window.AudioContext || window.webkitAudioContext)();
            _masterGain = _ctx.createGain();
            _masterGain.gain.value = _muted ? 0 : _volume;
            _masterGain.connect(_ctx.destination);
        } catch {
            _ctx = null;
        }
    }
    if (_ctx && _ctx.state === 'suspended') {
        try { _ctx.resume(); } catch { /* ignore */ }
    }
    return _ctx;
}

function getMasterGain() {
    getContext(); // ensure _masterGain exists
    return _masterGain;
}

function playTone(frequency, type, duration, volume = 0.15, frequencyEnd = null) {
    const ctx = getContext();
    if (!ctx || _muted) return;

    try {
        const now = ctx.currentTime;
        const master = getMasterGain();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(frequency, now);
        if (frequencyEnd !== null) {
            osc.frequency.linearRampToValueAtTime(frequencyEnd, now + duration);
        }

        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(gain);
        gain.connect(master);

        osc.start(now);
        osc.stop(now + duration + 0.01);
    } catch {
        // Silently ignore
    }
}

function playNoise(duration, volume = 0.08, lowFreq = 300, highFreq = 3000) {
    const ctx = getContext();
    if (!ctx || _muted) return;

    try {
        const now = ctx.currentTime;
        const master = getMasterGain();

        // Create white noise using a buffer
        const bufferSize = ctx.sampleRate * duration;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        // Bandpass filter
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(lowFreq, now);
        filter.frequency.linearRampToValueAtTime(highFreq, now + duration * 0.3);
        filter.frequency.linearRampToValueAtTime(lowFreq, now + duration);
        filter.Q.value = 1.5;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(volume, now);
        gain.gain.setValueAtTime(volume, now + duration * 0.2);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(master);

        noise.start(now);
        noise.stop(now + duration + 0.01);
    } catch {
        // Silently ignore
    }
}

// ==========================================================================
// UI Sounds — action feedback
// ==========================================================================

/**
 * Play a short, crisp "tick" sound for action button press.
 */
export function playActionStart() {
    playTone(800, 'sine', 0.05, 0.25);
}

/**
 * Play a short "error" / "denied" sound for disabled/invalid button clicks.
 */
export function playActionDenied() {
    const ctx = getContext();
    if (!ctx || _muted) return;

    try {
        const now = ctx.currentTime;
        const master = getMasterGain();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'square';
        osc.frequency.value = 180;

        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        osc.connect(gain);
        gain.connect(master);

        osc.start(now);
        osc.stop(now + 0.15);
    } catch {
        // Silently ignore
    }
}

/**
 * Two-tone ascending "complete" chime — satisfying "task done" feedback.
 */
export function playActionComplete() {
    const ctx = getContext();
    if (!ctx || _muted) return;

    try {
        const now = ctx.currentTime;
        const master = getMasterGain();

        // First tone: E5 (660 Hz) for 80ms
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.value = 660;
        gain1.gain.setValueAtTime(0.18, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc1.connect(gain1);
        gain1.connect(master);
        osc1.start(now);
        osc1.stop(now + 0.09);

        // Second tone: A5 (880 Hz) for 100ms — "success"
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.value = 880;
        gain2.gain.setValueAtTime(0.15, now + 0.06);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        osc2.connect(gain2);
        gain2.connect(master);
        osc2.start(now + 0.06);
        osc2.stop(now + 0.17);
    } catch {
        // Silently ignore
    }
}

// ==========================================================================
// Log entry sounds
// ==========================================================================

/**
 * Play a sound effect for a new log entry, varying by LogType.
 * @param {string} logType - one of 'error', 'success', 'info', 'unlock'
 */
export function playLogEntry(logType) {
    switch (logType) {
        case 'error':
            // Sharp buzz — low square wave
            playTone(150, 'square', 0.15, 0.10);
            break;
        case 'success':
            // Gentle mid ping
            playTone(800, 'sine', 0.08, 0.10);
            break;
        case 'unlock':
            // Bright, shiny "item get" — triangle wave arpeggio
            playUnlockSound();
            break;
        case 'info':
            // Very subtle low tick
            playTone(500, 'sine', 0.04, 0.06);
            break;
        default:
            break;
    }
}

function playUnlockSound() {
    const ctx = getContext();
    if (!ctx || _muted) return;

    try {
        const now = ctx.currentTime;
        const master = getMasterGain();
        const notes = [660, 880, 1047]; // E5, A5, C6 — major triad (lower)

        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = freq;
            const t = now + i * 0.05;
            gain.gain.setValueAtTime(0.10, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
            osc.connect(gain);
            gain.connect(master);
            osc.start(t);
            osc.stop(t + 0.13);
        });
    } catch {
        // Silently ignore
    }
}

// ==========================================================================
// Effect sounds
// ==========================================================================

/**
 * Descending tone — warning that something bad was added.
 */
export function playEffectAdded(effectId) {
    playTone(600, 'sawtooth', 0.2, 0.08, 250);
}

/**
 * Ascending tone — relief that an effect was removed.
 */
export function playEffectRemoved(effectId) {
    playTone(300, 'sine', 0.25, 0.10, 600);
}

// ==========================================================================
// Travel sound
// ==========================================================================

/**
 * Short "whoosh" for moving between locations.
 */
export function playTravel() {
    playNoise(0.3, 0.08, 200, 2500);
}

// ==========================================================================
// Critical warning — periodic low pulse when resources are low
// ==========================================================================

/**
 * Start periodic critical warning beep (call when resource < 25%).
 * Safe to call repeatedly — only one instance runs at a time.
 */
export function startCriticalWarning() {
    if (_criticalInterval) return; // Already running

    function beep() {
        playTone(110, 'square', 0.25, 0.12, 80);
    }

    beep(); // First beep immediately
    _criticalInterval = setInterval(beep, 10000); // Every 10 seconds
}

/**
 * Stop the critical warning beeps.
 */
export function stopCriticalWarning() {
    if (_criticalInterval) {
        clearInterval(_criticalInterval);
        _criticalInterval = null;
    }
}

// ==========================================================================
// Alarm sound — pulsing warning (for alarm effect)
// ==========================================================================

/**
 * Start pulsing alarm sound.
 */
export function playAlarm() {
    if (_alarmInterval) return; // Already playing

    const ctx = getContext();
    if (!ctx || _muted) return;

    function pulse() {
        playTone(330, 'square', 0.3, 0.10, 550);
    }

    pulse();
    _alarmInterval = setInterval(pulse, 2000);
}

/**
 * Stop the alarm sound.
 */
export function stopAlarm() {
    if (_alarmInterval) {
        clearInterval(_alarmInterval);
        _alarmInterval = null;
    }
}

// ==========================================================================
// Ambient system — per-location background sound
// ==========================================================================

const AMBIENT_CONFIG = {
    scout_ship_crew_quarters: {
        noiseVolume: 0.03,
        lowFreq: 80,
        highFreq: 200,
        humFreq: 60,
        humVolume: 0.04,
        beepInterval: 8000,   // occasional electronic beep
        beepFreq: 800,
    },
    scout_ship_bridge: {
        noiseVolume: 0.04,
        lowFreq: 60,
        highFreq: 300,
        humFreq: 50,
        humVolume: 0.06,
        beepInterval: 5000,   // more frequent instrument pings
        beepFreq: 1000,
    },
    scout_ship_main_area: {
        noiseVolume: 0.03,
        lowFreq: 100,
        highFreq: 400,
        humFreq: 70,
        humVolume: 0.04,
        beepInterval: 12000,  // distant recycler hum
        beepFreq: 300,
    },
    scout_ship_workshop: {
        noiseVolume: 0.025,
        lowFreq: 150,
        highFreq: 500,
        humFreq: 55,
        humVolume: 0.03,
        beepInterval: 6000,   // mechanical clicks
        beepFreq: 500,
    },
};

/**
 * Start ambient sound for a location. Stops any previous ambient first.
 * @param {string} locationId
 */
export function startAmbient(locationId) {
    stopAmbient();

    const config = AMBIENT_CONFIG[locationId];
    if (!config) return;

    const ctx = getContext();
    if (!ctx || _muted) return;

    try {
        const master = getMasterGain();

        // --- Low-frequency hum (continuous oscillator) ---
        const humOsc = ctx.createOscillator();
        const humGain = ctx.createGain();
        humOsc.type = 'sine';
        humOsc.frequency.value = config.humFreq;
        humGain.gain.value = config.humVolume;
        humOsc.connect(humGain);
        humGain.connect(master);
        humOsc.start();

        // --- Filtered noise (ventilation / engine rumble) ---
        const bufferSize = ctx.sampleRate * 2; // 2-second loop
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noiseSource = ctx.createBufferSource();
        noiseSource.buffer = buffer;
        noiseSource.loop = true;

        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.value = config.highFreq;
        noiseFilter.Q.value = 0.7;

        const noiseGain = ctx.createGain();
        noiseGain.gain.value = config.noiseVolume;

        noiseSource.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(master);
        noiseSource.start();

        _ambientNodes = { humOsc, humGain, noiseSource, noiseGain };

        // --- Occasional beeps / clicks ---
        _ambientInterval = setInterval(() => {
            if (_muted) return;
            const cfg = AMBIENT_CONFIG[locationId];
            if (!cfg) return;
            playTone(cfg.beepFreq, 'sine', 0.06, 0.04);
        }, config.beepInterval);

    } catch {
        // Silently ignore
    }
}

/**
 * Stop current ambient sound.
 */
export function stopAmbient() {
    if (_ambientInterval) {
        clearInterval(_ambientInterval);
        _ambientInterval = null;
    }

    if (_ambientNodes) {
        try {
            _ambientNodes.humOsc.stop();
            _ambientNodes.noiseSource.stop();
        } catch {
            // Already stopped
        }
        _ambientNodes = null;
    }
}

// ==========================================================================
// Volume control
// ==========================================================================

/**
 * Set master volume level.
 * @param {number} vol - 0.0 to 1.0
 */
export function setMasterVolume(vol) {
    _volume = Math.max(0, Math.min(1, vol));
    const master = _masterGain;
    if (master && !_muted) {
        try { master.gain.value = _volume; } catch { /* ignore */ }
    }
}

/**
 * Get current volume (0.0 - 1.0).
 */
export function getMasterVolume() {
    return _volume;
}

/**
 * Mute or unmute all audio.
 * @param {boolean} muted
 */
export function setMuted(muted) {
    _muted = muted;
    const master = _masterGain;
    if (master) {
        try { master.gain.value = muted ? 0 : _volume; } catch { /* ignore */ }
    }

    // Stop periodic sounds when muted
    if (muted) {
        stopAlarm();
        stopCriticalWarning();
    }
}

/**
 * Check if audio is muted.
 */
export function isMuted() {
    return _muted;
}