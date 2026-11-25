// Část hratelné postavy: drobné pohyby rukou nad animací. Jídlo: levá ruka donese jídlo k puse
// a zase ho spustí, i za chůze (pochodeň se na tu chvíli schová). Použití věci: pravá ruka máchne před sebe.
// Patří k PlayerSystem (sdílí jeho this); jen ho dělí, aby hlavní soubor zůstal přehledný.
import { Vector3, Quaternion, Matrix } from '@babylonjs/core/Maths/math.vector';
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
const PALM_AT = 0.5;
const FIST_AT = 0.85;
const WRAP_CURL = -1.4;
const MEAL_THICKNESS = 0.012;
const PALM_DEPTH = 0.02;
const FINGER_JOINTS = 3;
const FINGER_PAD = 0.01;
const FINGER_TIP = 0.9;
const FINGER_STEPS = 8;
const USE_SECONDS = 0.6;
const USE_REACH = 0.98;
const USE_DROP = 0.04;
const USE_ELBOW_OUT = 0.5;
const USE_CURL = 0.35;

function mealModel(hold) {
  if (!hold) return null;
  const grip = Number.isFinite(hold.grip) ? hold.grip : MEAL_GRIP;
  if (hold.model) return { model: hold.model, scale: hold.scale || 1, grip };
  const deco = getDecoration(hold.decoration);
  return deco && deco.model ? { model: deco.model, scale: (deco.scale || 1) * (hold.scale || 1), grip } : null;
}

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
    this.mealCurl = !hold ? EAT_CURL : Number.isFinite(hold.curl) ? hold.curl : WRAP_CURL;
    this.mealThickness = hold && Number.isFinite(hold.thickness) ? hold.thickness : MEAL_THICKNESS;
    this.mealInPalm = Boolean(hold && hold.palm);
    this.mealTurn = hold && Number.isFinite(hold.turn) ? hold.turn : 0;
    this.mealPalmAt = hold && Number.isFinite(hold.at) ? hold.at : PALM_AT;
    this.mealThumbward = hold && Number.isFinite(hold.thumbward) ? hold.thumbward : 0;
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
    const meal = mealModel(hold);
    if (!meal) return Promise.resolve(null);
    if (!this.mealTemplates) this.mealTemplates = new Map();
    if (this.mealTemplates.has(meal.model)) return Promise.resolve(this.mealTemplates.get(meal.model));
    return loadModel(this.s, meal.model).then((template) => {
      this.mealTemplates.set(meal.model, template);
      return template;
    });
  },

  showMeal(hold) {
    this.dropMeal();
    const meal = mealModel(hold);
    if (!meal) return;
    const factor = meal.scale;
    const token = {};
    this.mealToken = token;
    const build = (template) => {
      if (this.mealToken !== token || this.eatTimer <= 0) return;
      const node = instantiateModel(this.s, template, 'playerMeal');
      if (!node) return;
      node.scaling.scaleInPlace(factor);
      const bounds = node.getHierarchyBoundingVectors(true);
      const size = bounds.max.subtract(bounds.min);
      const local = 1 / (node.scaling.x || 1);
      node.metadata = {
        lift: (0.5 - meal.grip) * size.y,
        below: meal.grip * size.y,
        above: (1 - meal.grip) * size.y,
        radius: Math.min(size.x, size.y, size.z) * 0.5,
        center: bounds.min.add(bounds.max).scale(0.5 * local),
        half: size.scale(0.5 * local),
      };
      node.setEnabled(false);
      this.mealNode = node;
    };
    const ready = this.mealTemplates ? this.mealTemplates.get(meal.model) : undefined;
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
    this.reachPoint(this.leftArm, fist, pole, { curl: this.mealCurl ?? EAT_CURL }, null, this.eatBlend);
    this.aimMealFist(mouth, this.eatBlend);
    this.placeMeal(eating && this.eatClock < EAT_BITE_AT ? mouth : null);
  },

  mealToward(mouth) {
    const fist = this.fistCenter(this.leftArm);
    return mouth.subtract(fist).normalize().add(Vector3.Up().scale(MEAL_UPRIGHT)).normalize();
  },

  mealAxis(mouth) {
    const arm = this.leftArm;
    return arm.gripFront && arm.gripBack ? this.gripAxis({}, arm) : this.mealToward(mouth);
  },

  aimMealFist(mouth, weight) {
    const arm = this.leftArm;
    if (!arm.gripFront || !arm.gripBack) return;
    const now = this.gripAxis({}, arm);
    const wanted = this.mealToward(mouth);
    const axis = Vector3.Cross(now, wanted);
    if (axis.lengthSquared() < 1e-8) return;
    const angle = Math.acos(Math.max(-1, Math.min(1, Vector3.Dot(now, wanted))));
    this.turnBone(arm.hand, axis.normalize(), angle * weight);
  },

  placeMeal(mouth) {
    const node = this.mealNode;
    if (!node) return;
    if (!mouth) {
      node.setEnabled(false);
      return;
    }
    const hand = this.palmFrame();
    if (!hand) return;
    if (!node.rotationQuaternion) node.rotationQuaternion = Quaternion.Identity();
    if (this.mealInPalm) this.placeInPalm(node, hand);
    else this.placeInFist(node, hand, mouth);
    node.setEnabled(true);
  },

  palmFrame() {
    const arm = this.leftArm;
    this.fistCenter(arm);
    const [knuckleNode, tipNode] = arm.fist;
    const wrist = arm.hand.getAbsolutePosition();
    const knuckle = knuckleNode.getAbsolutePosition();
    const fingers = knuckle.subtract(wrist).normalize();
    const palm = tipNode.getAbsolutePosition().subtract(knuckle);
    palm.subtractInPlace(fingers.scale(Vector3.Dot(palm, fingers)));
    if (palm.lengthSquared() < 1e-8) return null;
    palm.normalize();
    const thumbward = Vector3.Cross(palm, fingers).normalize();
    if (arm.thumb && Vector3.Dot(arm.thumb.getAbsolutePosition().subtract(knuckle), thumbward) < 0) thumbward.scaleInPlace(-1);
    return { wrist, knuckle, fingers, palm, thumbward };
  },

  placeInFist(node, hand, mouth) {
    const along = this.mealAxis(mouth);
    const channel = Vector3.Lerp(hand.wrist, hand.knuckle, FIST_AT).add(hand.palm.scale(this.mealThickness + PALM_DEPTH));
    const face = mouth.subtract(channel);
    face.subtractInPlace(along.scale(Vector3.Dot(face, along)));
    if (face.lengthSquared() < 1e-8) Quaternion.FromUnitVectorsToRef(Vector3.Up(), along, node.rotationQuaternion);
    else {
      face.normalize();
      Quaternion.RotationQuaternionFromAxisToRef(Vector3.Cross(along, face), along, face, node.rotationQuaternion);
    }
    node.setAbsolutePosition(channel.add(along.scale(node.metadata ? node.metadata.lift : 0)));
    const reach = this.mealThickness + FINGER_PAD;
    const shape = node.metadata || {};
    this.wrapFingers((point) => {
      const offset = point.subtract(channel);
      const height = Vector3.Dot(offset, along);
      if (height < -(shape.below ?? Infinity) || height > (shape.above ?? Infinity)) return false;
      return offset.subtract(along.scale(height)).length() < reach;
    });
  },

  placeInPalm(node, hand) {
    const shape = node.metadata || {};
    const half = shape.half || Vector3.One();
    const [long, mid, short] = ['x', 'y', 'z'].sort((a, b) => half[b] - half[a]);
    const turn = this.mealTurn || 0;
    const lengthwise = hand.fingers.scale(Math.cos(turn)).add(hand.thumbward.scale(Math.sin(turn)));
    const axes = { [long]: lengthwise, [short]: hand.palm, [mid]: Vector3.Cross(hand.palm, lengthwise) };
    if (Vector3.Dot(axes.x, Vector3.Cross(axes.y, axes.z)) < 0) axes[mid] = axes[mid].scale(-1);
    Quaternion.RotationQuaternionFromAxisToRef(axes.x, axes.y, axes.z, node.rotationQuaternion);
    const target = Vector3.Lerp(hand.wrist, hand.knuckle, this.mealPalmAt ?? PALM_AT)
      .add(hand.palm.scale((shape.radius || 0) + PALM_DEPTH))
      .add(hand.thumbward.scale(this.mealThumbward || 0));
    node.setAbsolutePosition(target);
    if (shape.center) {
      node.computeWorldMatrix(true);
      const offset = Vector3.TransformCoordinates(shape.center, node.getWorldMatrix()).subtract(target);
      node.setAbsolutePosition(target.subtract(offset));
    }
    if (!shape.half) return;
    node.computeWorldMatrix(true);
    const toLocal = Matrix.Invert(node.getWorldMatrix());
    const pad = FINGER_PAD / (node.scaling.x || 1);
    this.wrapFingers((point) => {
      const local = Vector3.TransformCoordinates(point, toLocal).subtract(shape.center);
      return (local.x / (half.x + pad)) ** 2 + (local.y / (half.y + pad)) ** 2 + (local.z / (half.z + pad)) ** 2 < 1;
    });
  },

  wrapFingers(touches) {
    const arm = this.leftArm;
    if (arm.fingers.length % FINGER_JOINTS) return;
    const side = Vector3.TransformNormal(Vector3.Right(), arm.hand.getWorldMatrix()).normalize();
    const curl = (this.mealCurl ?? EAT_CURL) * (arm.curlSign || 1) * this.eatBlend;
    for (let start = 0; start < arm.fingers.length; start += FINGER_JOINTS) {
      const bones = arm.fingers.slice(start, start + FINGER_JOINTS);
      const pose = (share) => {
        for (const bone of bones) {
          const rest = arm.fingerRest.get(bone);
          if (rest) bone.rotationQuaternion.copyFrom(rest);
          this.turnBone(bone, side, curl * share);
          bone.computeWorldMatrix(true);
        }
      };
      const blocked = (share) => {
        pose(share);
        const joints = bones.map((bone) => bone.getAbsolutePosition());
        const last = joints[joints.length - 1];
        const tip = last.add(last.subtract(joints[joints.length - 2]).scale(FINGER_TIP));
        return [...joints.slice(1), tip].some(touches);
      };
      if (!blocked(1)) continue;
      let open = 0;
      let shut = 1;
      for (let step = 0; step < FINGER_STEPS; step++) {
        const mid = (open + shut) / 2;
        if (blocked(mid)) shut = mid;
        else open = mid;
      }
      pose(open);
    }
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
