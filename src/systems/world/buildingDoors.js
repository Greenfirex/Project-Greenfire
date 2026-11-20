// Část staveb: dveře v otvorech stěn — křídlo ze svislých prken se dvěma příčkami na pantu, otáčí se dovnitř.
// Zavřené jsou pro postavu i tvory zeď; které dveře jsou otevřené, drží BuildingSystem (ukládá se).
// Patří k BuildingSystem (sdílí jeho this).
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { createBuffer, meshFromBuffer, pushBox } from '../../utils/buildingGeometry.js';
import { createRng, seedFor } from '../../utils/rng.js';
import { OUTLINE_GOLD, OUTLINE_PULSE, OUTLINE_PULSE_SPEED } from '../../utils/outlineStyle.js';

const DOOR_PICK_RADIUS = 0.8;
const DOOR_PICK_HEIGHT = 1.5;
const DOOR_REACH = 2.2;
const DOOR_REACH_HEIGHT = 1.2;
const DOOR_OUTLINE = 0.03;

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
    const door = { id, hinge, yaw, sign, style, buffer, part: plan.layer, mesh: null, open: 0, goal: 0, x: middle.x, y: middle.y, z: middle.z };
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

  finishDoors(plan, material) {
    for (const door of plan.doorList) {
      const mesh = meshFromBuffer(`${door.hinge.name}_leaf`, door.buffer, this.s);
      door.buffer = null;
      if (!mesh) continue;
      mesh.parent = door.hinge;
      mesh.material = material;
      this.addPartMesh(plan, mesh, door.part, true);
      mesh.isPickable = true;
      mesh.metadata.door = door;
      door.mesh = mesh;
      door.goal = this.openDoors.has(door.id) ? 1 : 0;
      door.open = door.goal;
      this.poseDoor(door);
      this.doors.push(door);
    }
  },

  poseDoor(door) {
    door.hinge.rotation.y = door.yaw - door.sign * door.style.swing * ease(door.open);
  },

  doorAt(pointerX, pointerY, point) {
    const hit = this.doors.length ? this.s.pick(pointerX, pointerY, (mesh) => Boolean(mesh.metadata && mesh.metadata.door) && mesh.isEnabled()) : null;
    if (hit && hit.hit && hit.pickedMesh) return hit.pickedMesh.metadata.door;
    if (!point) return null;
    let best = null;
    let bestGap = DOOR_PICK_RADIUS;
    for (const door of this.doors) {
      if (Math.abs(point.y - door.y) > DOOR_PICK_HEIGHT) continue;
      const gap = Math.hypot(point.x - door.x, point.z - door.z);
      if (gap > bestGap) continue;
      best = door;
      bestGap = gap;
    }
    return best;
  },

  doorInReach(door, position) {
    return Boolean(door && position)
      && Math.hypot(position.x - door.x, position.z - door.z) <= DOOR_REACH
      && Math.abs(position.y - door.y) <= DOOR_REACH_HEIGHT;
  },

  doorLabel(door) {
    return door.style.label;
  },

  toggleDoor(door) {
    if (!door) return false;
    door.goal = door.goal > 0 ? 0 : 1;
    door.shutHeard = false;
    if (door.goal) this.openDoors.add(door.id);
    else this.openDoors.delete(door.id);
    return door.goal > 0;
  },

  setDoorHover(door) {
    this.hoverDoor = door || null;
  },

  updateDoors(dt) {
    this.doorTime = (this.doorTime || 0) + dt;
    const pulse = 0.5 + 0.5 * Math.sin(this.doorTime * OUTLINE_PULSE_SPEED);
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
      if (!door.mesh) continue;
      const lit = door === this.hoverDoor;
      door.mesh.renderOutline = lit;
      if (!lit) continue;
      door.mesh.outlineColor = OUTLINE_GOLD;
      door.mesh.outlineWidth = DOOR_OUTLINE + OUTLINE_PULSE * pulse;
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
