// Kdy postava nebo tvor do překážky nenarazí kvůli výšce — překážka je celá pod chodidly (přešlápne ji),
// nebo celá nad hlavou (třeba věc v patře nad přízemím). Platí pro bloky staveb i pro dekorace.
export const FEET_CLEAR = 0.25;
export const BODY_HEIGHT = 1.6;

export function missesBody(bottom, top, feetY) {
  if (!Number.isFinite(feetY)) return Number.isFinite(bottom);
  return feetY + FEET_CLEAR >= top || feetY + BODY_HEIGHT <= bottom;
}
