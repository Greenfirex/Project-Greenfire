// Zpracování vstupu — rotace kamery pravým tažením, zoom kolečkem, klik a tažení na zemi.
// Levá kreslí nebo kliká, pravé kliknutí v editoru odebírá a ve hře bourá; menu potlačujeme.
import '@babylonjs/core/Culling/ray';
import { Plane } from '@babylonjs/core/Maths/math.plane';
import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents';
import { worldToCellCoords } from '../../utils/gridMath.js';
import { MAX_HEIGHT, HEIGHT_STEP } from '../../data/maps/layoutStore.js';

const ROTATE_SPEED = 0.006;
const DRAG_THRESHOLD = 5;
const PICK_TOP = MAX_HEIGHT * HEIGHT_STEP + 2;
const PICK_STEP = 0.5;
const PICK_STEPS = 400;
const PICK_REFINE = 12;
const PICK_NUDGE = 0.05;
const GroundPlane = new Plane(0, 1, 0, 0.002);

export default class InputSystem {

  constructor(scene, game) {
    this.s = scene;
    this.game = game;
    this.rotating = false;
    this.rightRotating = false;
    this.rightDragged = false;
    this.rightStartX = 0;
    this.rightStartY = 0;
    this.painting = false;
    this.lastX = 0;
    this.lastCell = null;
    this.onHoverCell = null;
    this.onCellRightClick = null;
    this.onPaintStart = null;
    this.onPaintMove = null;
    this.onPaintEnd = null;
    this.onLeftDown = null;
    this.onLeftUp = null;
    this.leftDown = false;
    this.groundPredicate = null;
    this.groundHeightAt = null;
    this.pointerMoved = true;
    this.lastMoveX = null;
    this.lastMoveY = null;
    this.shouldPickByRay = null;
  }

  hitsUi(evt) {
    if (!evt || typeof evt.clientX !== 'number') return false;
    const el = document.elementFromPoint(evt.clientX, evt.clientY);
    const inside = Boolean(el && el.closest('#hud-layer'));
    if (inside) console.info(`[click] klik spolkl ${el.className || el.tagName}`);
    return inside;
  }

  isBusy() {
    if (!this.game || !this.game.loaded) return true;
    if (this.game.editor && this.game.editor.active) return false;
    return Boolean(this.game.paused);
  }

  attach(camera, game) {
    this.camera = camera;
    if (game) this.game = game;

    this.s.onPointerObservable.add((info) => {
      const evt = info.event;
      const type = info.type;
      if (type === PointerEventTypes.POINTERDOWN) console.info(`[click] pointerdown button=${evt.button} paused=${this.game ? this.game.paused : 'hra?'} loaded=${this.game ? this.game.loaded : 'hra?'}`);
      const onUi = type === PointerEventTypes.POINTERDOWN && (this.isBusy() || this.hitsUi(evt));

      if (type === PointerEventTypes.POINTERDOWN) {
        if (evt.button === 2) {
          if (onUi) return;
          this.rightRotating = true;
          this.rightDragged = false;
          this.rightStartX = evt.clientX;
          this.rightStartY = evt.clientY;
          this.lastX = evt.clientX;
          evt.preventDefault();
          return;
        }
        if (evt.button === 1) {
          if (onUi) return;
          this.rotating = true;
          this.lastX = evt.clientX;
          evt.preventDefault();
          return;
        }
        if (evt.button !== 0) return;
        if (onUi) return;
        this.painting = true;
        this.lastCell = null;
        this.leftDown = true;
        if (this.onLeftDown) this.onLeftDown();
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
        if (evt.button === 2) {
          if (this.rightRotating) {
            this.rightRotating = false;
            const dragged = this.rightDragged;
            this.rightDragged = false;
            if (!dragged) this.handleRightClick();
          }
          return;
        }
        if (evt.button !== 0) return;
        this.painting = false;
        this.lastCell = null;
        this.leftDown = false;
        if (this.onLeftUp) this.onLeftUp();
        if (this.onPaintEnd) this.onPaintEnd();
        return;
      }

      if (type === PointerEventTypes.POINTERMOVE) {
        if (this.lastMoveX !== evt.clientX || this.lastMoveY !== evt.clientY) {
          this.lastMoveX = evt.clientX;
          this.lastMoveY = evt.clientY;
          this.pointerMoved = true;
        }
        if (this.rotating) {
          const dx = evt.clientX - this.lastX;
          this.lastX = evt.clientX;
          if (Math.abs(dx) >= DRAG_THRESHOLD) this.camera.alpha += dx * ROTATE_SPEED;
        }
        if (this.rightRotating) {
          const dx = evt.clientX - this.lastX;
          this.lastX = evt.clientX;
          const travel = Math.abs(evt.clientX - this.rightStartX) + Math.abs(evt.clientY - this.rightStartY);
          if (travel >= DRAG_THRESHOLD) this.rightDragged = true;
          if (this.rightDragged) this.camera.alpha += dx * ROTATE_SPEED;
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

  takeMoved() {
    const moved = this.pointerMoved;
    this.pointerMoved = false;
    return moved;
  }

  pickGround(predicate) {
    const pick = this.s.pick(this.s.pointerX, this.s.pointerY, predicate);
    if (!pick || !pick.hit || !pick.pickedPoint) return null;
    return pick.pickedPoint;
  }

  cellAtPointer(level = null) {
    const ray = this.s.createPickingRay(this.s.pointerX, this.s.pointerY, null, this.camera);
    const point = this.surfacePoint(ray, level) || (level === null ? this.fallbackPoint(ray) : null);
    if (!point) return null;
    const { cx, cz } = worldToCellCoords(point.x, point.z);
    return { cx, cz, point };
  }

  surfacePoint(ray, level = null) {
    if (!this.groundHeightAt) return null;
    const origin = ray.origin;
    const direction = ray.direction;
    if (direction.y > -1e-4) return null;
    let distance = 0;
    if (origin.y > PICK_TOP) distance = (PICK_TOP - origin.y) / direction.y;
    let previous = distance;
    for (let i = 0; i < PICK_STEPS; i += 1) {
      const px = origin.x + direction.x * distance;
      const pz = origin.z + direction.z * distance;
      const height = this.groundHeightAt(px, pz, level);
      if (!Number.isFinite(height)) return null;
      if (origin.y + direction.y * distance <= height) {
        let low = previous;
        let high = distance;
        for (let k = 0; k < PICK_REFINE; k += 1) {
          const mid = (low + high) * 0.5;
          const probeHeight = this.groundHeightAt(origin.x + direction.x * mid, origin.z + direction.z * mid, level);
          if (origin.y + direction.y * mid <= probeHeight) high = mid;
          else low = mid;
        }
        const hit = origin.add(direction.scale(high + PICK_NUDGE));
        hit.y = this.groundHeightAt(hit.x, hit.z, level);
        return hit;
      }
      previous = distance;
      distance += PICK_STEP;
    }
    return null;
  }

  fallbackPoint(ray) {
    if (this.shouldPickByRay && this.shouldPickByRay()) {
      const distance = ray.intersectsPlane(GroundPlane);
      if (distance === null || !Number.isFinite(distance)) return null;
      return ray.origin.add(ray.direction.scale(distance));
    }
    return this.pickGround(this.groundPredicate);
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