// Společný vzhled obrysů — dekorace pod kurzorem, ostražitý tvor i klidný tvor či krab pod myší pulzují stejně.
// Taky vzdálenost, odkud se nad věcmi, které jde sebrat rukou (drobnosti, truhly, mrtvoly), objeví třpyt.
import { Color3 } from '@babylonjs/core/Maths/math.color';

export const OUTLINE_GOLD = new Color3(1, 0.78, 0.25);
export const OUTLINE_CALM = new Color3(0.45, 0.88, 0.78);
export const OUTLINE_PULSE = 0.012;
export const OUTLINE_PULSE_SPEED = 4.5;
export const OUTLINE_FADE_SPEED = 8;
export const PICKUP_REACH = 4;
