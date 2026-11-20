// Blikání plamene — síla se plynule přelévá k náhodně voleným hodnotám v rozsahu, ne skokem,
// aby se dvě blízká světla (pochodeň a lucerna) nepřeblikávala trhaně.
const FOLLOW_PER_SECOND = 9;

export function createFlicker(low, high, interval) {
  return { low, high, interval, timer: 0, goal: 1, value: 1 };
}

export function stepFlicker(flicker, dt) {
  flicker.timer -= dt;
  if (flicker.timer <= 0) {
    flicker.timer = flicker.interval * (0.6 + Math.random() * 0.8);
    flicker.goal = flicker.low + Math.random() * (flicker.high - flicker.low);
  }
  flicker.value += (flicker.goal - flicker.value) * Math.min(1, Math.max(0, dt) * FOLLOW_PER_SECOND);
  return flicker.value;
}
