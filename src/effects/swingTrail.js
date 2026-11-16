// Vítr za zbraní — průsvitný pruh, který se při prudkém máchnutí táhne za špičkou zbraně a rychle zmizí.
// Kreslí se jen v rychlé části rány; pomalý nápřah, chůze ani obyčejné držení zbraně stopu nenechají.
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3, Matrix } from '@babylonjs/core/Maths/math.vector';

const SAMPLES = 24;
const STEPS = 3;
const COLUMNS = (SAMPLES - 1) * STEPS + 1;
const LIFE = 0.14;
const SPEED_FROM = 5;
const SPEED_FULL = 12;
const TIP_ALPHA = 0.4;
const INNER_SHARE = 0.35;
const COLOR = new Color3(0.9, 0.95, 1);

export default class SwingTrail {

  constructor(scene, root) {
    this.s = scene;
    this.root = root;
    this.samples = [];
    this.node = null;
    this.inner = null;
    this.tip = null;
    this.lastReach = null;
    this.positions = new Float32Array(COLUMNS * 2 * 3);
    this.colors = new Float32Array(COLUMNS * 2 * 4);
    this.mesh = this.makeMesh();
  }

  makeMesh() {
    const material = new StandardMaterial('swingTrailMaterial', this.s);
    material.disableLighting = true;
    material.emissiveColor = COLOR;
    material.diffuseColor = Color3.Black();
    material.specularColor = Color3.Black();
    material.backFaceCulling = false;
    material.disableDepthWrite = true;
    const indices = [];
    for (let column = 0; column < COLUMNS - 1; column++) {
      const a = column * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const mesh = new Mesh('swingTrail', this.s);
    mesh.setVerticesData(VertexBuffer.PositionKind, this.positions, true);
    mesh.setVerticesData(VertexBuffer.ColorKind, this.colors, true, 4);
    mesh.setIndices(indices);
    mesh.hasVertexAlpha = true;
    mesh.isPickable = false;
    mesh.alwaysSelectAsActiveMesh = true;
    mesh.material = material;
    material.forceCompilation(mesh);
    mesh.setEnabled(false);
    return mesh;
  }

  measure(node) {
    if (this.node === node) return;
    this.node = null;
    this.samples.length = 0;
    this.lastReach = null;
    node.computeWorldMatrix(true);
    const toNode = Matrix.Invert(node.getWorldMatrix());
    let low = Infinity;
    let high = -Infinity;
    for (const mesh of node.getChildMeshes(false)) {
      mesh.computeWorldMatrix(true);
      for (const corner of mesh.getBoundingInfo().boundingBox.vectorsWorld) {
        const y = Vector3.TransformCoordinates(corner, toNode).y;
        low = Math.min(low, y);
        high = Math.max(high, y);
      }
    }
    if (!Number.isFinite(low) || high <= low) return;
    this.node = node;
    this.inner = new Vector3(0, low + (high - low) * INNER_SHARE, 0);
    this.tip = new Vector3(0, high, 0);
  }

  update(dt, node, swinging) {
    for (const sample of this.samples) sample.age += dt;
    while (this.samples.length && this.samples[0].age > LIFE) this.samples.shift();
    if (node) this.measure(node);
    else {
      this.node = null;
      this.lastReach = null;
    }
    if (this.node && dt > 0) this.addSample(dt, swinging);
    this.redraw();
  }

  addSample(dt, swinging) {
    const world = this.node.getWorldMatrix();
    const inner = Vector3.TransformCoordinates(this.inner, world);
    const tip = Vector3.TransformCoordinates(this.tip, world);
    const reach = tip.subtract(this.root.getAbsolutePosition());
    const speed = this.lastReach ? Vector3.Distance(reach, this.lastReach) / dt : 0;
    this.lastReach = reach;
    const strength = swinging ? Math.max(0, Math.min(1, (speed - SPEED_FROM) / (SPEED_FULL - SPEED_FROM))) : 0;
    this.samples.push({ inner, tip, age: 0, strength });
    if (this.samples.length > SAMPLES) this.samples.shift();
  }

  redraw() {
    const points = this.samples;
    const visible = points.length > 1 && points.some((sample) => sample.strength > 0);
    this.mesh.setEnabled(visible);
    if (!visible) return;
    const inner = points.map((sample) => sample.inner);
    const tip = points.map((sample) => sample.tip);
    const fade = points.map((sample) => sample.strength * (1 - sample.age / LIFE));
    const last = points.length - 1;
    let column = 0;
    for (let i = 0; i < last; i++) {
      for (let step = 0; step < STEPS; step++) this.writeColumn(column++, inner, tip, fade, i, step / STEPS);
    }
    this.writeColumn(column++, inner, tip, fade, last - 1, 1);
    for (; column < COLUMNS; column++) this.copyColumn(column, column - 1);
    this.mesh.updateVerticesData(VertexBuffer.PositionKind, this.positions);
    this.mesh.updateVerticesData(VertexBuffer.ColorKind, this.colors);
  }

  writeColumn(column, inner, tip, fade, i, t) {
    const last = inner.length - 1;
    const a = Math.max(0, i - 1);
    const d = Math.min(last, i + 2);
    const near = Vector3.CatmullRom(inner[a], inner[i], inner[i + 1], inner[d], t);
    const far = Vector3.CatmullRom(tip[a], tip[i], tip[i + 1], tip[d], t);
    const alpha = Math.max(0, fade[i] + (fade[i + 1] - fade[i]) * t);
    this.writeVertex(column * 2, near, 0);
    this.writeVertex(column * 2 + 1, far, alpha * TIP_ALPHA);
  }

  writeVertex(index, point, alpha) {
    this.positions.set([point.x, point.y, point.z], index * 3);
    this.colors.set([1, 1, 1, alpha], index * 4);
  }

  copyColumn(column, from) {
    this.positions.copyWithin(column * 6, from * 6, from * 6 + 6);
    this.colors.set([1, 1, 1, 0, 1, 1, 1, 0], column * 8);
  }

  dispose() {
    if (this.mesh.material) this.mesh.material.dispose();
    this.mesh.dispose();
  }
}
