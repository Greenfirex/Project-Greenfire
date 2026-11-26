// Část staveb: dveře v otvorech stěn — křídlo ze svislých prken se dvěma příčkami na pantu, otáčí se dovnitř;
// stejně se chová i posuvný kus nábytku (knihovna na páku). Zavřené jsou pro postavu i tvory zeď;
// které dveře jsou otevřené, drží BuildingSystem (ukládá se).
// Patří k BuildingSystem (sdílí jeho this).
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { createBuffer, meshFromBuffer, pushBox } from '../../utils/buildingGeometry.js';
import { createRng, seedFor } from '../../utils/rng.js';
import {
  OUTLINE_GOLD, OUTLINE_PULSE, OUTLINE_PULSE_SPEED, USE_OUTLINE, USE_PICK_RADIUS, USE_PICK_HEIGHT, USE_REACH, USE_REACH_HEIGHT,
} from '../../utils/outlineStyle.js';

const ease = (t) => t * t * (3 - 2 * t);

export default {
  addDoor(plan, run, opening, storey) {
    const style = plan.walls.door;
    if (!style) return;
    const index = plan.doorList.length;
    const id = `${plan.name}:${plan.layer}:${run.side}:${index}`;
    const rng = createRng(seedFor(0, id, index, 0));
    const hingeEnd = opening.hinge === 1 ? 1 : -1;
    const from = opening.at - opening.width / 2 + style.inset;
    const to = opening.at + opening.width / 2 - style.inset;
    const width = to - from;
    const height = opening.top - opening.bottom - style.gapTop;
    const inward = -run.outward;
    const across = run.at + inward * (plan.walls.log / 2 - style.thickness);
    const local = (along, y, off) => (run.alongX ? new Vector3(along, y, off) : new Vector3(off, y, along));
    const bottom = storey.base + opening.bottom;
    const yaw = run.alongX ? Math.atan2(0, inward) : Math.atan2(inward, 0);
    const axisX = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const latch = run.alongX ? new Vector3(-hingeEnd, 0, 0) : new Vector3(0, 0, -hingeEnd);
    const sign = Vector3.Dot(axisX, latch) >= 0 ? 1 : -1;

    const buffer = createBuffer();
    const shade = 1 + (rng() - 0.5) * style.shadeSpread;
    const base = style.tint.map((value) => value * shade);
    const paint = (x, y, z, up) => plan.paint(base, x, y + bottom, z, up);
    const count = Math.max(2, Math.round(width / style.plank));
    const pitch = width / count;
    for (let k = 0; k < count; k += 1) {
      const drop = rng() * style.ragged;
      pushBox(buffer, {
        center: [sign * pitch * (k + 0.5), (height - drop) / 2, 0],
        size: [pitch - style.gap, height - drop, style.thickness],
        tiltZ: (rng() - 0.5) * style.warp,
        shiftU: rng(),
        shiftV: rng(),
      }, paint, style.tile);
    }
    for (const share of style.battens) {
      pushBox(buffer, {
        center: [sign * width / 2, height * share, (style.thickness + style.battenThick) / 2],
        size: [width * 0.92, style.batten, style.battenThick],
        tiltZ: (rng() - 0.5) * style.warp,
        shiftU: rng(),
      }, paint, style.tile);
    }

    const hinge = new TransformNode(`${plan.name}_door_${index}`, this.s);
    hinge.parent = plan.root;
    hinge.position.copyFrom(local(hingeEnd < 0 ? from : to, bottom, across));
    const middle = Vector3.TransformCoordinates(local(opening.at, bottom, run.at), plan.world);
    const door = { id, kind: 'hinge', node: hinge, yaw, sign, style, pieces: [{ buffer, material: 'planks', handle: true }], part: plan.layer, mesh: null, open: 0, goal: 0, x: middle.x, y: middle.y, z: middle.z };
    plan.doorList.push(door);
    plan.blocks.push({
      alongX: run.alongX,
      at: run.at,
      from: opening.at - opening.width / 2,
      to: opening.at + opening.width / 2,
      bottom: storey.base,
      top: storey.base + opening.top,
      half: plan.walls.log / 2,
      door,
    });
  },

  finishDoors(plan, materials) {
    for (const door of plan.doorList) {
      for (const [index, piece] of door.pieces.entries()) {
        const mesh = meshFromBuffer(`${door.node.name}_${index}`, piece.buffer, this.s);
        if (!mesh) continue;
        mesh.parent = door.node;
        mesh.material = materials[piece.material];
        this.addPartMesh(plan, mesh, door.part, true);
        mesh.isPickable = Boolean(piece.handle);
        if (!piece.handle) continue;
        mesh.metadata.door = door;
        door.mesh = mesh;
      }
      door.pieces = null;
      door.goal = this.openDoors.has(door.id) ? 1 : 0;
      door.open = door.goal;
      this.poseDoor(door);
      this.doors.push(door);
    }
  },

  poseDoor(door) {
    if (door.kind === 'slide') door.node.position.copyFrom(door.home.add(door.axis.scale(this.doorShift(door))));
    else door.node.rotation.y = door.yaw - door.sign * door.style.swing * ease(door.open);
  },

  doorShift(door) {
    return door.kind === 'slide' ? door.slide * ease(door.open) : 0;
  },

  doorAt(pointerX, pointerY, point) {
    return this.pickInteractive(this.doors, 'door', pointerX, pointerY, point);
  },

  pickInteractive(list, key, pointerX, pointerY, point) {
    const hit = list.length ? this.s.pick(pointerX, pointerY, (mesh) => Boolean(mesh.metadata && mesh.metadata[key]) && mesh.isEnabled()) : null;
    if (hit && hit.hit && hit.pickedMesh) return hit.pickedMesh.metadata[key];
    if (!point) return null;
    let best = null;
    let bestGap = USE_PICK_RADIUS;
    for (const thing of list) {
      if (thing.secret || Math.abs(point.y - thing.y) > USE_PICK_HEIGHT) continue;
      const gap = Math.hypot(point.x - thing.x, point.z - thing.z);
      if (gap > bestGap) continue;
      best = thing;
      bestGap = gap;
    }
    return best;
  },

  inReach(thing, position) {
    return Boolean(thing && position)
      && Math.hypot(position.x - thing.x, position.z - thing.z) <= USE_REACH
      && Math.abs(position.y - thing.y) <= USE_REACH_HEIGHT;
  },

  doorHint(door) {
    return door.goal > 0 ? door.style.closeHint : door.style.openHint;
  },

  toggleDoor(door) {
    if (!door) return false;
    door.goal = door.goal > 0 ? 0 : 1;
    door.shutHeard = false;
    if (door.goal) this.openDoors.add(door.id);
    else this.openDoors.delete(door.id);
    return door.goal > 0;
  },

  setHover(thing) {
    this.hovered = thing || null;
  },

  doorsMoving() {
    return this.doors.some((door) => door.open !== door.goal);
  },

  updateInteractive(dt) {
    this.doorTime = (this.doorTime || 0) + dt;
    const pulse = 0.5 + 0.5 * Math.sin(this.doorTime * OUTLINE_PULSE_SPEED);
    for (const thing of this.doors) {
      if (!thing.mesh) continue;
      const lit = thing === this.hovered;
      thing.mesh.renderOutline = lit;
      if (!lit) continue;
      thing.mesh.outlineColor = OUTLINE_GOLD;
      thing.mesh.outlineWidth = USE_OUTLINE + OUTLINE_PULSE * pulse;
    }
    for (const door of this.doors) {
      if (door.open !== door.goal) {
        const step = Math.max(0, dt) / door.style.seconds;
        door.open = door.goal > door.open ? Math.min(door.goal, door.open + step) : Math.max(door.goal, door.open - step);
        this.poseDoor(door);
        if (door.goal === 0 && !door.shutHeard && door.open * door.style.seconds <= this.doorShutLead) {
          door.shutHeard = true;
          if (this.onDoorShut) this.onDoorShut(door);
        }
      }
    }
  },

  serialize() {
    return { open: [...this.openDoors] };
  },

  defaultState() {
    return { open: [] };
  },

  apply(data) {
    const list = data && Array.isArray(data.open) ? data.open.filter((id) => typeof id === 'string') : [];
    this.openDoors = new Set(list);
    for (const door of this.doors) {
      door.goal = this.openDoors.has(door.id) ? 1 : 0;
      door.open = door.goal;
      this.poseDoor(door);
    }
  },
};
