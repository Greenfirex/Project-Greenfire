// Kreslené obrázky pirátských věcí na stavbách: vybledlá roztrhaná vlajka s lebkou a zkříženými
// hnáty, stará rybářská síť s plováky a mapa pokladu s ostrovem a křížkem. Kreslí se jednou v kódu, s průhlednými dírami.
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { createRng } from './rng.js';

function bone(ctx, angle, length, thick) {
  ctx.save();
  ctx.rotate(angle);
  ctx.fillRect(-length / 2, -thick / 2, length, thick);
  for (const end of [-1, 1]) {
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(end * length / 2, side * thick * 0.55, thick * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

export function pirateFlagTexture(scene, name, colors) {
  const width = 256;
  const height = 176;
  const texture = new DynamicTexture(name, { width, height }, scene, true);
  const ctx = texture.getContext();
  const rng = createRng(1717);
  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle = colors.cloth;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  for (let x = 0; x <= width * 0.72; x += 16) ctx.lineTo(x, rng() * 6);
  for (let y = 0; y <= height; y += 12) ctx.lineTo(width * (0.72 + rng() * 0.26), y);
  for (let x = width * 0.72; x >= 0; x -= 16) ctx.lineTo(x, height - rng() * 8);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = 0.18;
  ctx.fillStyle = colors.stain;
  for (let i = 0; i < 9; i++) {
    ctx.beginPath();
    ctx.arc(rng() * width * 0.8, rng() * height, 10 + rng() * 28, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.translate(width * 0.36, height * 0.47);
  ctx.fillStyle = colors.bone;
  bone(ctx, 0.62, 118, 11);
  bone(ctx, -0.62, 118, 11);
  ctx.beginPath();
  ctx.arc(0, -14, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-18, 6, 36, 22);
  ctx.fillStyle = colors.cloth;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(side * 11, -14, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(0, -4);
  ctx.lineTo(-4, 4);
  ctx.lineTo(4, 4);
  ctx.closePath();
  ctx.fill();
  for (let x = -12; x <= 12; x += 8) ctx.fillRect(x - 1, 14, 2, 14);
  ctx.restore();

  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.arc(rng() * width * 0.85, rng() * height, 3 + rng() * 9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  texture.hasAlpha = true;
  texture.update();
  return texture;
}

export function fishingNetTexture(scene, name, colors) {
  const size = 256;
  const texture = new DynamicTexture(name, size, scene, true);
  const ctx = texture.getContext();
  const rng = createRng(4242);
  const cells = 9;
  const step = size / cells;
  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = colors.rope;
  ctx.lineWidth = 2.2;
  for (let i = -cells; i <= cells * 2; i++) {
    for (let j = 0; j < cells; j++) {
      for (const dir of [1, -1]) {
        if (rng() < 0.06) continue;
        const x = i * step + (dir > 0 ? j * step : (cells - j) * step);
        ctx.beginPath();
        ctx.moveTo(x, j * step);
        ctx.lineTo(x + dir * step, (j + 1) * step);
        ctx.stroke();
      }
    }
  }
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, 2);
  ctx.lineTo(size, 2);
  ctx.stroke();
  ctx.fillStyle = colors.float;
  for (let x = step / 2; x < size; x += step * 2.2) {
    ctx.beginPath();
    ctx.ellipse(x, 6, 9, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  texture.hasAlpha = true;
  texture.update();
  return texture;
}

export function treasureMapTexture(scene, name, colors) {
  const width = 256;
  const height = 192;
  const texture = new DynamicTexture(name, { width, height }, scene, true);
  const ctx = texture.getContext();
  const rng = createRng(9137);
  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle = colors.paper;
  ctx.beginPath();
  const edge = 26;
  for (let k = 0; k <= edge * 4; k += 1) {
    const t = k / edge;
    const side = Math.floor(t) % 4;
    const f = t - Math.floor(t);
    const bite = 3 + rng() * 6;
    const point = [
      [f * width, bite],
      [width - bite, f * height],
      [width - f * width, height - bite],
      [bite, height - f * height],
    ][side];
    if (k === 0) ctx.moveTo(point[0], point[1]);
    else ctx.lineTo(point[0], point[1]);
  }
  ctx.closePath();
  ctx.fill();

  const shade = ctx.createRadialGradient(width / 2, height / 2, height * 0.25, width / 2, height / 2, width * 0.62);
  shade.addColorStop(0, 'rgba(0,0,0,0)');
  shade.addColorStop(1, colors.burn);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, width, height);
  for (let i = 0; i < 6; i += 1) {
    ctx.fillStyle = colors.stain;
    ctx.beginPath();
    ctx.ellipse(rng() * width, rng() * height, 6 + rng() * 16, 4 + rng() * 10, rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  const cx = width * 0.47;
  const cy = height * 0.5;
  ctx.beginPath();
  for (let k = 0; k <= 40; k += 1) {
    const angle = (k / 40) * Math.PI * 2;
    const r = 52 + Math.sin(angle * 3 + 1.3) * 12 + Math.sin(angle * 7) * 5 + rng() * 4;
    const x = cx + Math.cos(angle) * r * 1.35;
    const y = cy + Math.sin(angle) * r * 0.85;
    if (k === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = colors.land;
  ctx.fill();
  ctx.strokeStyle = colors.ink;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = colors.ink;
  for (const [x, y] of [[cx - 40, cy - 12], [cx - 28, cy + 14], [cx + 22, cy - 22], [cx + 6, cy + 20]]) {
    ctx.fillRect(x - 1, y - 7, 2, 9);
    for (const lean of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x, y - 7);
      ctx.lineTo(x + lean * 6, y - 3);
      ctx.stroke();
    }
  }
  ctx.beginPath();
  ctx.moveTo(cx - 70, cy + 4);
  ctx.lineTo(cx - 58, cy - 10);
  ctx.lineTo(cx - 46, cy + 4);
  ctx.stroke();

  ctx.setLineDash([4, 5]);
  ctx.beginPath();
  ctx.moveTo(cx - 60, cy + 30);
  ctx.bezierCurveTo(cx - 20, cy + 40, cx - 10, cy - 5, cx + 30, cy + 2);
  ctx.bezierCurveTo(cx + 45, cy + 5, cx + 48, cy + 18, cx + 46, cy + 22);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = colors.mark;
  ctx.lineWidth = 4;
  for (const dir of [1, -1]) {
    ctx.beginPath();
    ctx.moveTo(cx + 46 - 8, cy + 22 - 8 * dir);
    ctx.lineTo(cx + 46 + 8, cy + 22 + 8 * dir);
    ctx.stroke();
  }

  ctx.strokeStyle = colors.ink;
  ctx.lineWidth = 1.5;
  const rx = width - 34;
  const ry = 34;
  for (let k = 0; k < 8; k += 1) {
    const angle = (k / 8) * Math.PI * 2;
    const r = k % 2 === 0 ? 16 : 8;
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(rx + Math.cos(angle) * r, ry + Math.sin(angle) * r);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(rx, ry, 5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';

  texture.hasAlpha = true;
  texture.update();
  return texture;
}
