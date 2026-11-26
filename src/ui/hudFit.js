// Přizpůsobení rozhraní šířce okna — na užším okně se rozhraní samo zmenší (do 80 %), pak lišta nástrojů
// ukáže méně slotů (nejméně 5), a když se nevejde ani to, rozhraní se zmenšuje dál (nejvýš na 60 %),
// aby se spodek nepřekrýval s logem a panelem vpravo.
import { HOTBAR_SLOTS } from '../data/catalogs/items.js';

const BESIDE_BAR = 646;
const BAR_FRAME = 34;
const SLOT_WIDTH = 58;
const MIN_SLOTS = 5;
const COMFORT_FIT = 0.8;
const MIN_FIT = 0.6;

const neededWidth = (slots) => BESIDE_BAR + BAR_FRAME + slots * SLOT_WIDTH;

export function fitHud(userScale) {
  const width = window.innerWidth || neededWidth(HOTBAR_SLOTS);
  let scale = Math.min(userScale, Math.max(COMFORT_FIT, width / neededWidth(HOTBAR_SLOTS)));
  if (width / scale < neededWidth(MIN_SLOTS)) scale = Math.min(userScale, Math.max(MIN_FIT, width / neededWidth(MIN_SLOTS)));
  document.documentElement.style.setProperty('--ui-scale', String(scale));
  const room = Math.floor((width / scale - BESIDE_BAR - BAR_FRAME) / SLOT_WIDTH);
  return Math.max(MIN_SLOTS, Math.min(HOTBAR_SLOTS, room));
}
