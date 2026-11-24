// Pozná, kdy chodidlo stojí na zemi, a vybere místo, kde stálo nejklidněji.
// Používá ho hráč i tvorové, aby stopy v písku seděly přesně pod nohou.
export const FOOT_PLANT_RATIO = 0.5;
const FOOT_PLANT_MIN = 0.05;
const FOOT_PLANT_HOLD = 0.25;

export function footTrack() {
  return { prev: null, time: 0, best: null, bestSpeed: Infinity, done: false };
}

export function trackFoot(track, sample, seconds, limit) {
  const prev = track.prev;
  track.prev = sample;
  if (!prev || !(seconds > 0)) return null;
  const speed = Math.hypot(sample.x - prev.x, sample.z - prev.z) / seconds;
  if (speed > limit) return releaseFoot(track);
  track.time += seconds;
  if (speed < track.bestSpeed) {
    track.bestSpeed = speed;
    track.best = sample;
  }
  if (track.done || track.time < FOOT_PLANT_HOLD) return null;
  track.done = true;
  return track.best;
}

export function releaseFoot(track) {
  const print = !track.done && track.best && track.time >= FOOT_PLANT_MIN ? track.best : null;
  track.time = 0;
  track.best = null;
  track.bestSpeed = Infinity;
  track.done = false;
  return print;
}
