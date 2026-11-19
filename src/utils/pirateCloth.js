// Kreslené obrázky pirátských věcí na stavbách: vybledlá roztrhaná vlajka s lebkou a zkříženými
// hnáty a stará rybářská síť s plováky. Kreslí se jednou v kódu, s průhlednými dírami.
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
