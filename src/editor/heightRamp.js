// Barevná škála výšek — jediné místo, kde se rozhoduje, jakou barvu která výška má.
// Používá ji okénko Výška i překryvy v mapě, takže barvy vždycky sedí k sobě.
import { HEIGHT_STEP, MIN_HEIGHT, MAX_HEIGHT, formatMeters } from '../data/maps/layoutStore.js';

const RAMP = [
  { meters: -15, color: [0.18, 0.27, 0.42] },
  { meters: -6, color: [0.29, 0.44, 0.56] },
  { meters: 0, color: [0.16, 0.2, 0.21] },
  { meters: 6, color: [0.44, 0.6, 0.37] },
  { meters: 14, color: [0.62, 0.62, 0.5] },
  { meters: 24, color: [0.82, 0.84, 0.86] },
];

export function formatLevel(level) {
  return formatMeters((Number(level) || 0) * HEIGHT_STEP);
}

export function heightRampColor(meters) {
  const value = Number(meters) || 0;
  const first = RAMP[0];
  const last = RAMP[RAMP.length - 1];
  if (value <= first.meters) return first.color.slice();
  for (let index = 1; index < RAMP.length; index += 1) {
    const right = RAMP[index];
    const left = RAMP[index - 1];
    if (value > right.meters) continue;
    const t = (value - left.meters) / (right.meters - left.meters);
    return [
      left.color[0] + (right.color[0] - left.color[0]) * t,
      left.color[1] + (right.color[1] - left.color[1]) * t,
      left.color[2] + (right.color[2] - left.color[2]) * t,
    ];
  }
  return last.color.slice();
}

export function heightRampGradientCss() {
  const stops = RAMP.map((stop) => {
    const rgb = stop.color.map((channel) => Math.round(channel * 255));
    const low = MIN_HEIGHT * HEIGHT_STEP;
    const ratio = Math.max(0, Math.min(1, (stop.meters - low) / (MAX_HEIGHT * HEIGHT_STEP - low)));
    return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]}) ${Math.round(ratio * 100)}%`;
  });
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}