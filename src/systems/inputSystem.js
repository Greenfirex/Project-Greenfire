// Zpracování vstupu — rotace kamery tažením, zoom kolečkem, klik a hover na zemi.
// Vystavuje callbacky do scény, sám nezná stav hry.
import '@babylonjs/core/Culling/ray';
import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { worldToCellCoords } from '../utils/gridMath.js';

const ROTATE_SPEED = 0.006;
const DRAG_THRESHOLD = 5;

export default class InputSystem {

  constructor(scene) {
    this.s = scene;
    this.dragging = false;
    this.dragMoved = false;
    this.lastX = 0;
    this.onHoverCell = null;
    this.onCellClick = null;
  }

  attach(camera) {
    this.camera = camera;

    this.s.onPointerObservable.add((info) => {
      const evt = info.event;
      const type = info.type;

      if (type === PointerEventTypes.POINTERDOWN) {
        if (evt.button !== 0) return;
        this.dragging = true;
        this.dragMoved = false;
        this.lastX = evt.clientX;
        return;
      }

      if (type === PointerEventTypes.POINTERUP) {
        if (evt.button !== 0) return;
        const wasDrag = this.dragMoved;
        this.dragging = false;
        this.dragMoved = false;
        if (!wasDrag) this.handleClick();
        return;
      }

      if (type === PointerEventTypes.POINTERMOVE) {
        if (this.dragging) {
          const dx = evt.clientX - this.lastX;
          this.lastX = evt.clientX;
          if (Math.abs(dx) > 0) {
            this.dragMoved = this.dragMoved || Math.abs(dx) >= DRAG_THRESHOLD;
            this.camera.alpha += dx * ROTATE_SPEED;
          }
        }
        this.handleHover();
        return;
      }

      if (type === PointerEventTypes.POINTERWHEEL) {
        evt.preventDefault();
        if (this.onZoom) this.onZoom(evt.deltaY * 0.02);
      }
    });
  }

  pickGround() {
    const pick = this.s.pick(this.s.pointerX, this.s.pointerY, (mesh) => {
      return mesh.name === 'gridGround';
    });
    if (!pick || !pick.hit || !pick.pickedPoint) return null;
    return pick.pickedPoint;
  }

  handleHover() {
    const point = this.pickGround();
    if (!point) {
      if (this.onHoverCell) this.onHoverCell(null);
      return;
    }
    const { cx, cz } = worldToCellCoords(point.x, point.z);
    if (this.onHoverCell) this.onHoverCell({ cx, cz, point });
  }

  handleClick() {
    const point = this.pickGround();
    if (!point) return;
    const { cx, cz } = worldToCellCoords(point.x, point.z);
    if (this.onCellClick) this.onCellClick({ cx, cz, point });
  }
}
