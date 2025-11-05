// Lightweight Weather engine (v1)
// Rotates through weather types on an in-game schedule and exposes current weather
// Effects: moraleDelta only (integration done in morale.js). UI: header widget via headeroptions.js

import { getTotalIngameMinutes } from '../time.js';
import { gameFlags } from './gameFlags.js';

// Weather type catalog
// durationRange: [minHours, maxHours]
// tempRangeC: [minC, maxC]
export const weatherTypes = [
    { id: 'clear',    label: 'Clear',     icon: '☀', moraleDelta: 0,  durationRange: [6, 12], tempRangeC: [18, 26],   weight: 3, transitions: { overcast: 2, clear: 1 } },
    { id: 'overcast', label: 'Overcast',  icon: '☁', moraleDelta: -2, durationRange: [6, 12], tempRangeC: [16, 22],   weight: 2, transitions: { rain: 2, clear: 1, overcast: 1 } },
    { id: 'rain',     label: 'Rain',      icon: '☂', moraleDelta: +3, durationRange: [6, 10], tempRangeC: [14, 20],   weight: 2, transitions: { overcast: 2, storm: 1 } },
    { id: 'storm',    label: 'Storm',     icon: '⛈', moraleDelta: -8, durationRange: [3, 6],  tempRangeC: [12, 18],   weight: 1, transitions: { rain: 2, overcast: 1 } },
    { id: 'heatwave', label: 'Heatwave',  icon: '♨', moraleDelta: -6, durationRange: [8, 16], tempRangeC: [28, 36],   weight: 1, transitions: { clear: 2, overcast: 1 } },
    { id: 'coldsnap', label: 'Cold Snap', icon: '❄', moraleDelta: -6, durationRange: [8, 16], tempRangeC: [0, 8],     weight: 1, transitions: { overcast: 2, clear: 1 } }
];

function pickRandomInt(min, max) {
    min = Math.ceil(min); max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickWeightedNext(prevId) {
    const prev = weatherTypes.find(w => w.id === prevId);
    if (prev && prev.transitions) {
        const entries = Object.entries(prev.transitions);
        const pool = [];
        for (const [id, w] of entries) {
            for (let i = 0; i < (Number(w) || 1); i++) pool.push(id);
        }
        if (pool.length) {
            const id = pool[pickRandomInt(0, pool.length - 1)];
            const t = weatherTypes.find(w => w.id === id);
            if (t) return t;
        }
    }
    // fallback: pick from global weights
    const pool = [];
    weatherTypes.forEach(t => {
        for (let i = 0; i < (Number(t.weight) || 1); i++) pool.push(t);
    });
    return pool[pickRandomInt(0, pool.length - 1)];
}

function sampleDurationMinutes(type) {
    const [minH, maxH] = type.durationRange || [6, 12];
    const hrs = pickRandomInt(minH, maxH);
    return hrs * 60;
}

function sampleTemperatureC(type) {
    const [minC, maxC] = type.tempRangeC || [15, 25];
    return pickRandomInt(minC, maxC);
}

function ensureInit() {
    if (!gameFlags.weatherCurrentId) gameFlags.weatherCurrentId = 'clear';
    if (!gameFlags.weatherStartMinutes) gameFlags.weatherStartMinutes = getTotalIngameMinutes();
    if (!gameFlags.weatherDurationMinutes) gameFlags.weatherDurationMinutes = 8 * 60;
    if (typeof gameFlags.weatherTempC !== 'number') gameFlags.weatherTempC = 22;
}

export function getWeatherState() {
    ensureInit();
    return {
        id: gameFlags.weatherCurrentId,
        startMinutes: gameFlags.weatherStartMinutes,
        durationMinutes: gameFlags.weatherDurationMinutes,
        tempC: gameFlags.weatherTempC
    };
}

function setWeatherState(id, startMinutes, durationMinutes, tempC) {
    gameFlags.weatherCurrentId = id;
    gameFlags.weatherStartMinutes = startMinutes;
    gameFlags.weatherDurationMinutes = durationMinutes;
    gameFlags.weatherTempC = tempC;
}

function computeNextWeather() {
    ensureInit();
    const prevId = gameFlags.weatherCurrentId;
    const next = pickWeightedNext(prevId);
    const now = getTotalIngameMinutes();
    const dur = sampleDurationMinutes(next);
    const temp = sampleTemperatureC(next);
    setWeatherState(next.id, now, dur, temp);
    return {
        id: next.id,
        label: next.label,
        icon: next.icon,
        moraleDelta: next.moraleDelta,
        startMinutes: now,
        durationMinutes: dur,
        remainingMinutes: dur,
        tempC: temp
    };
}

export function getCurrentWeather() {
    ensureInit();
    const now = getTotalIngameMinutes();
    const type = weatherTypes.find(w => w.id === gameFlags.weatherCurrentId) || weatherTypes[0];
    const start = Number(gameFlags.weatherStartMinutes) || now;
    const duration = Number(gameFlags.weatherDurationMinutes) || sampleDurationMinutes(type);
    const elapsed = Math.max(0, now - start);
    const remaining = Math.max(0, duration - elapsed);
    if (remaining <= 0.01) {
        return computeNextWeather();
    }
    return {
        id: type.id,
        label: type.label,
        icon: type.icon,
        moraleDelta: type.moraleDelta,
        startMinutes: start,
        durationMinutes: duration,
        remainingMinutes: remaining,
        tempC: Number(gameFlags.weatherTempC) || sampleTemperatureC(type)
    };
}

// Optional reset helper
export function resetWeather(initialId = 'clear') {
    const t = weatherTypes.find(w => w.id === initialId) || weatherTypes[0];
    const now = getTotalIngameMinutes();
    const dur = sampleDurationMinutes(t);
    const temp = sampleTemperatureC(t);
    setWeatherState(t.id, now, dur, temp);
}
