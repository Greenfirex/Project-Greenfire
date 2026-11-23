// Část hratelné postavy: drobné pohyby rukou nad animací. Jídlo: levá ruka donese jídlo k puse
// a zase ho spustí, i za chůze (pochodeň se na tu chvíli schová). Použití věci: pravá ruka máchne před sebe.
// Patří k PlayerSystem (sdílí jeho this); jen ho dělí, aby hlavní soubor zůstal přehledný.
import { Vector3, Quaternion } from '@babylonjs/core/Maths/math.vector';
import { getDecoration } from '../../data/catalogs/decorations.js';
import { loadModel, instantiateModel } from '../../utils/assetLoader.js';

const EAT_SECONDS = 1.1;
const EAT_FADE = 0.4;
const EAT_BITE_AT = 0.6;
const MOUTH_UP = 0.25;
const MOUTH_AHEAD = 0.6;
const HAND_AHEAD = 0.45;
const EAT_ELBOW_OUT = 0.7;
const EAT_CURL = -0.6;
const MEAL_UPRIGHT = 0.5;
const MEAL_GRIP = 0.3;
const USE_SECONDS = 0.6;
const USE_REACH = 0.98;
const USE_DROP = 0.04;
const USE_ELBOW_OUT = 0.5;
const USE_CURL = 0.35;

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

export default {
  eat(hold = null) {
    if (!this.ready || this.dead || this.lying || !this.leftArm) return 0;
    if (this.strikeTimer > 0 || this.pickupTimer > 0 || this.igniteTimer > 0) return 0;
    if (this.dodgeTimer > 0 || this.flinchTimer > 0 || this.eatTimer > 0) return 0;
    this.eatTimer = EAT_SECONDS;
    this.eatClock = 0;
    this.showMeal(hold);
    return EAT_BITE_AT;
  },

  eating() {
    return this.eatTimer > 0;
  },

  stopEating() {
    this.eatTimer = 0;
    this.dropMeal();
  },

  tickGestures(dt) {
    if (this.useTimer > 0) this.useTimer = Math.max(0, this.useTimer - dt);
    if (this.eatTimer <= 0) return;
    this.eatClock += dt;
    this.eatTimer -= dt;
    if (this.eatTimer <= 0) this.stopEating();
  },

  prefetchMeal(hold) {
    const deco = hold ? getDecoration(hold.decoration) : null;
    if (!deco || !deco.model) return Promise.resolve(null);
    if (!this.mealTemplates) this.mealTemplates = new Map();
    if (this.mealTemplates.has(deco.model)) return Promise.resolve(this.mealTemplates.get(deco.model));
    return loadModel(this.s, deco.model).then(async (template) => {
      const meshes = template ? template.getChildMeshes().filter((mesh) => mesh.material) : [];
      await Promise.all(meshes.map((mesh) => mesh.material.forceCompilationAsync(mesh).catch(() => null)));
      this.mealTemplates.set(deco.model, template);
      return template;
    });
  },

  showMeal(hold) {
    this.dropMeal();
    const deco = hold ? getDecoration(hold.decoration) : null;
    if (!deco || !deco.model) return;
    const factor = (deco.scale || 1) * (hold.scale || 1);
    const token = {};
    this.mealToken = token;
    const build = (template) => {
      if (this.mealToken !== token || this.eatTimer <= 0) return;
      const node = instantiateModel(this.s, template, 'playerMeal');
      if (!node) return;
      node.scaling.scaleInPlace(factor);
      const bounds = node.getHierarchyBoundingVectors(true);
      node.metadata = { lift: (0.5 - MEAL_GRIP) * (bounds.max.y - bounds.min.y) };
      node.setEnabled(false);
      this.mealNode = node;
    };
    const ready = this.mealTemplates ? this.mealTemplates.get(deco.model) : undefined;
    if (ready !== undefined) build(ready);
    else this.prefetchMeal(hold).then(build);
  },

  dropMeal() {
    this.mealToken = null;
    if (!this.mealNode) return;
    this.mealNode.dispose(false, false);
    this.mealNode = null;
  },

  hideTorchForMeal(hide) {
    const node = this.offNode;
    if (hide) {
      if (node && node.isEnabled()) {
        node.setEnabled(false);
        if (this.torchFire) this.torchFire.detach();
      }
      this.torchHidden = true;
      return;
    }
    if (!this.torchHidden) return;
    this.torchHidden = false;
    if (node) node.setEnabled(true);
    this.refreshTorchFire();
  },

  feedMouth(dt) {
    const eating = this.eatTimer > 0;
    this.eatBlend = clamp01(this.eatBlend + (eating ? dt : -dt) / EAT_FADE);
    this.hideTorchForMeal(this.eatBlend > 0);
    if (!this.eatBlend || !this.leftArm || !this.headSlot || !this.idleNodes || !this.armNodes) return;
    const forward = new Vector3(Math.sin(this.bodyFacing), 0, Math.cos(this.bodyFacing));
    this.refreshNode(this.headSlot);
    const frame = this.headSlot.getWorldMatrix();
    const up = Vector3.TransformNormal(Vector3.Up(), frame);
    const size = up.length() * (this.headTop || 1);
    const ahead = Vector3.TransformNormal(new Vector3(0, 0, 1), frame).normalize();
    up.normalize();
    const mouth = this.headSlot.getAbsolutePosition()
      .add(up.scale(size * MOUTH_UP))
      .add(ahead.scale(size * MOUTH_AHEAD));
    const fist = mouth.add(ahead.scale(size * HAND_AHEAD));
    const pole = Vector3.Down().add(this.weaponSideOut(forward).scale(-EAT_ELBOW_OUT));
    this.reachPoint(this.leftArm, fist, pole, { curl: EAT_CURL }, null, this.eatBlend);
    this.placeMeal(eating && this.eatClock < EAT_BITE_AT ? mouth : null);
  },

  placeMeal(mouth) {
    const node = this.mealNode;
    if (!node) return;
    if (!mouth) {
      node.setEnabled(false);
      return;
    }
    const fist = this.fistCenter(this.leftArm);
    const toward = mouth.subtract(fist).normalize().add(Vector3.Up().scale(MEAL_UPRIGHT)).normalize();
    if (!node.rotationQuaternion) node.rotationQuaternion = Quaternion.Identity();
    Quaternion.FromUnitVectorsToRef(Vector3.Up(), toward, node.rotationQuaternion);
    node.setAbsolutePosition(fist.add(toward.scale(node.metadata ? node.metadata.lift : 0)));
    node.setEnabled(true);
  },

  useToward(x, z) {
    if (!this.ready || this.dead || this.lying || !this.armNodes || !this.root) return;
    if (this.strikeTimer > 0 || this.pickupTimer > 0 || this.dodgeTimer > 0) return;
    if (Number.isFinite(x) && Number.isFinite(z) && !this.wantsMove()) this.faceTo(x, z);
    this.useTimer = USE_SECONDS;
    this.useAt = Number.isFinite(x) && Number.isFinite(z) ? { x, z } : null;
  },

  reachUse() {
    if (this.useTimer <= 0 || !this.armNodes || !this.idleNodes) return;
    const { upper, fore, hand } = this.armNodes;
    if (!upper || !fore || !hand) return;
    const weight = Math.sin(Math.PI * (1 - this.useTimer / USE_SECONDS));
    if (weight <= 0) return;
    const forward = new Vector3(Math.sin(this.bodyFacing), 0, Math.cos(this.bodyFacing));
    this.refreshNode(hand);
    const shoulder = upper.getAbsolutePosition().clone();
    const arm = Vector3.Distance(shoulder, fore.getAbsolutePosition()) + Vector3.Distance(fore.getAbsolutePosition(), hand.getAbsolutePosition());
    let toward = forward;
    if (this.useAt) {
      const flat = new Vector3(this.useAt.x - shoulder.x, 0, this.useAt.z - shoulder.z);
      if (flat.lengthSquared() > 1e-6 && Vector3.Dot(flat.normalize(), forward) > 0.2) toward = flat;
    }
    const point = shoulder.add(toward.scale(arm * USE_REACH)).add(Vector3.Down().scale(arm * USE_DROP));
    const pole = Vector3.Down().add(this.weaponSideOut(forward).scale(USE_ELBOW_OUT));
    this.reachPoint(this.armNodes, point, pole, { curl: USE_CURL }, null, weight);
  },
};
