// Názvy pro přetahování myší mezi batohem, oknem postavy a lištou dole, aby si okna rozuměla.
export const SLOT_DRAG_TYPE = 'x-greenfire/slot';
export const BAG_DRAG_TYPE = 'x-greenfire/bag';
export const HAND_DRAG_TYPE = 'x-greenfire/hand';
export const BAR_DRAG_TYPE = 'x-greenfire/bar';

export function wearDragType(slot) {
  return `x-greenfire/wear-${slot}`;
}
