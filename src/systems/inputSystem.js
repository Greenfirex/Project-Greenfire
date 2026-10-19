// Zpracování vstupu — rotace kamery středním tlačítkem, zoom kolečkem, klik a tažení na zemi.
// Levá klávesa kreslí (editor) nebo kliká (hra), pravá maže, kontextové menu prohlížeče potlačujeme.
import '@babylonjs/core/Culling/ray';
import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents';
import { worldToCellCoords } from '../utils/gridMath.js';

const ROTATE_SPEED = 0.006;
const DRAG_THRESHOLD = 5;

export default class InputSystem {

  constructor(scene) {
    this.s = scene;
    this.rotating = false;
    this.painting = false;
    this.lastX = 0;
    this.lastCell = null;
    this.onHoverCell = null;
    this.onCellRightClick = null;
    this.onPaintStart = null;
    this.onPaintMove = null;
    this.onPaintEnd = null;
    this.groundPredicate = null;
  }

  attach(camera) {
    this.camera = camera;

    this.s.onPointerObservable.add((info) => {
      const evt = info.event;
      const type = info.type;

      if (type === PointerEventTypes.POINTERDOWN) {
        if (evt.button === 2) {
          this.handleRightClick();
          return;
        }
        if (evt.button === 1) {
          this.rotating = true;
          this.lastX = evt.clientX;
          evt.preventDefault();
          return;
        }
        if (evt.button !== 0) return;
        this.painting = true;
        this.lastCell = null;
        const cell = this.cellAtPointer();
        if (cell) {
          this.lastCell = cell;
          if (this.onPaintStart) this.onPaintStart(cell);
        }
        return;
      }

      if (type === PointerEventTypes.POINTERUP) {
        if (evt.button === 1) {
          this.rotating = false;
          return;
        }
        if (evt.button !== 0) return;
        this.painting = false;
        this.lastCell = null;
        if (this.onPaintEnd) this.onPaintEnd();
        return;
      }

      if (type === PointerEventTypes.POINTERMOVE) {
        if (this.rotating) {
          const dx = evt.clientX - this.lastX;
          this.lastX = evt.clientX;
          if (Math.abs(dx) >= DRAG_THRESHOLD) this.camera.alpha += dx * ROTATE_SPEED;
        }
        const cell = this.cellAtPointer();
        if (this.painting && cell && this.onPaintMove) {
          const same = this.lastCell && this.lastCell.cx === cell.cx && this.lastCell.cz === cell.cz;
          if (!same) {
            this.lastCell = cell;
            this.onPaintMove(cell);
          }
        }
        if (this.onHoverCell) this.onHoverCell(cell);
        return;
      }

      if (type === PointerEventTypes.POINTERWHEEL) {
        evt.preventDefault();
        if (this.onZoom) this.onZoom(evt.deltaY * 0.02);
      }
    });
  }

  suppressContextMenu(canvas) {
    canvas.addEventListener('contextmenu', (evt) => evt.preventDefault());
  }

  pickGround(predicate) {
    const pick = this.s.pick(this.s.pointerX, this.s.pointerY, predicate);
    if (!pick || !pick.hit || !pick.pickedPoint) return null;
    return pick.pickedPoint;
  }

  cellAtPointer() {
    const point = this.pickGround(this.groundPredicate);
    if (!point) return null;
    const { cx, cz } = worldToCellCoords(point.x, point.z);
    return { cx, cz, point };
  }

  pointerInside() {
    const x = Number.isFinite(this.s.pointerX) ? this.s.pointerX : -1;
    const y = Number.isFinite(this.s.pointerY) ? this.s.pointerY : -1;
    return x >= 0 && y >= 0;
  }

  handleRightClick() {
    const cell = this.cellAtPointer();
    if (this.onCellRightClick) this.onCellRightClick(cell);
  }
}