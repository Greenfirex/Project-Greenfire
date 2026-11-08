// Převod bodu ve světě na místo na obrazovce — kam nad tvora nakreslit číslo nebo ukazatel zdraví.
import { Vector3, Matrix } from '@babylonjs/core/Maths/math.vector';
import { Viewport } from '@babylonjs/core/Maths/math.viewport';

const IDENTITY = Matrix.Identity();
const VIEWPORT = new Viewport(0, 0, 1, 1);
const POINT = new Vector3();
const PROJECTED = new Vector3();

export function screenPointOf(scene, camera, rect, x, y, z) {
  if (!camera || !rect || !rect.width || !rect.height) return null;
  camera.viewport.toGlobalToRef(rect.width, rect.height, VIEWPORT);
  POINT.set(x, y, z);
  const projected = Vector3.ProjectToRef(POINT, IDENTITY, scene.getTransformMatrix(), VIEWPORT, PROJECTED);
  if (!Number.isFinite(projected.x) || !Number.isFinite(projected.y)) return null;
  return { x: projected.x, y: projected.y };
}
