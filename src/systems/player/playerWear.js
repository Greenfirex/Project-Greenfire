// Část hratelné postavy: co má na sobě. Klobouk sedí na kosti hlavy; oblečení připravené
// v Blenderu (kabát, kalhoty, boty) se napojí na kostru postavy a ohýbá se s ní.
// Patří k PlayerSystem (sdílí jeho this); jen ho dělí, aby hlavní soubor zůstal přehledný.
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Vector3, Quaternion } from '@babylonjs/core/Maths/math.vector';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { PLAYER_HEAD_BONES, PLAYER_HEAD_TOP, PLAYER_HEAD_FRONT } from '../../data/catalogs/modelCatalog.js';
import { loadModel, instantiateModel, loadImported } from '../../utils/assetLoader.js';

function boneSlots(skeleton) {
  return new Map(skeleton.bones.map((bone) => [bone.name, bone.getIndex()]));
}

export default {
  attachHeadSlot() {
    const skeleton = this.mesh && this.mesh.skeleton;
    const bone = skeleton ? skeleton.bones.find((item) => PLAYER_HEAD_BONES.includes(item.name)) : null;
    const head = bone && bone.getTransformNode();
    if (!head || !this.root) return;
    const nodes = this.root.getDescendants(false);
    const find = (names) => nodes.find((node) => names.includes(node.name)) || null;
    head.computeWorldMatrix(true);
    const toHead = head.getWorldMatrix().clone().invert();
    const local = (node, fallback) => {
      if (!node) return fallback;
      node.computeWorldMatrix(true);
      return Vector3.TransformCoordinates(node.getAbsolutePosition(), toHead);
    };
    const top = local(find(PLAYER_HEAD_TOP), new Vector3(0, 1, 0));
    const ahead = local(find(PLAYER_HEAD_FRONT), new Vector3(0, 0, 1));
    const up = top.normalizeToNew();
    const forward = ahead.subtract(up.scale(Vector3.Dot(ahead, up))).normalize();
    const right = Vector3.Cross(up, forward);
    this.headSlot = new TransformNode('playerHeadSlot', this.s);
    this.headSlot.parent = head;
    this.headSlot.position = Vector3.Zero();
    this.headSlot.rotationQuaternion = Quaternion.RotationQuaternionFromAxis(right, up, forward);
    this.headTop = top.length();
  },

  wear(slot, wear) {
    if ((this.worn[slot] || null) === (wear || null)) return;
    this.worn[slot] = wear || null;
    if (slot === 'head') this.refreshWorn();
    else this.refreshFitted(slot);
  },

  refreshWorn() {
    if (this.wornNode) {
      this.wornNode.dispose(false, false);
      this.wornNode = null;
    }
    const wear = this.worn.head;
    if (!this.headSlot || !wear) return;
    loadModel(this.s, wear.model).then((template) => {
      if (!template || this.worn.head !== wear || this.wornNode) return;
      const meshes = template.getChildMeshes();
      if (!meshes.length) return;
      const min = new Vector3(Infinity, Infinity, Infinity);
      const max = new Vector3(-Infinity, -Infinity, -Infinity);
      for (const mesh of meshes) {
        const box = mesh.getBoundingInfo().boundingBox;
        min.minimizeInPlace(box.minimum);
        max.maximizeInPlace(box.maximum);
      }
      const node = instantiateModel(this.s, template, 'playerWorn_head');
      if (!node) return;
      this.headSlot.computeWorldMatrix(true);
      const slotScale = Math.abs(this.headSlot.absoluteScaling.x) || 1;
      const scale = wear.width / (Math.max(max.x - min.x, 0.001) * slotScale);
      node.parent = this.headSlot;
      node.scaling = new Vector3(scale, scale, scale);
      node.rotation = new Vector3(0, wear.yaw || 0, 0);
      node.position = new Vector3(
        -(min.x + max.x) / 2 * scale,
        this.headTop * wear.seat - min.y * scale,
        -(min.z + max.z) / 2 * scale + (wear.forward || 0) / slotScale,
      );
      for (const mesh of node.getChildMeshes()) {
        mesh.receiveShadows = true;
        mesh.isPickable = false;
      }
      this.wornNode = node;
    });
  },

  refreshAllFitted() {
    for (const slot of Object.keys(this.worn)) {
      if (slot !== 'head') this.refreshFitted(slot);
    }
  },

  refreshFitted(slot) {
    const shown = this.fittedShown[slot];
    if (shown) {
      shown.parent = null;
      shown.setEnabled(false);
      this.fittedShown[slot] = null;
    }
    const wear = this.worn[slot];
    if (!wear || !wear.fitted || !this.mesh) return;
    this.fittedMesh(wear.fitted).then((mesh) => {
      if (!mesh || this.worn[slot] !== wear || this.fittedShown[slot]) return;
      mesh.parent = this.mesh.parent;
      mesh.setEnabled(true);
      this.fittedShown[slot] = mesh;
      if (this.onWornMesh) this.onWornMesh(mesh);
    });
  },

  fittedMesh(url) {
    if (!this.fittedCache[url]) {
      this.fittedCache[url] = loadImported(this.s, url).then((result) => {
        const mesh = result ? result.meshes.find((item) => item.skeleton && item.getTotalVertices() > 0) : null;
        const body = this.mesh;
        if (!mesh || !body || !body.skeleton) return null;
        const slots = boneSlots(body.skeleton);
        const remap = new Map(mesh.skeleton.bones.map((bone) => [bone.getIndex(), slots.get(bone.name) ?? 0]));
        const joints = mesh.getVerticesData(VertexBuffer.MatricesIndicesKind);
        if (joints) {
          mesh.setVerticesData(VertexBuffer.MatricesIndicesKind, Float32Array.from(joints, (joint) => remap.get(joint) ?? 0), false, 4);
        }
        const own = mesh.skeleton;
        mesh.skeleton = body.skeleton;
        own.dispose();
        mesh.position.copyFrom(body.position);
        if (body.rotationQuaternion) mesh.rotationQuaternion = body.rotationQuaternion.clone();
        else mesh.rotation.copyFrom(body.rotation);
        mesh.scaling.copyFrom(body.scaling);
        mesh.isPickable = false;
        mesh.receiveShadows = true;
        return mesh;
      });
    }
    return this.fittedCache[url];
  },
};
