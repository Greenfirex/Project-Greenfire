// Kreslený obrázek čela uříznuté klády — letokruhy, tmavý okraj a pár prasklin od středu.
// Kreslí se jednou v kódu, takže na čela klád není potřeba žádný soubor.
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { createRng } from './rng.js';

const SIZE = 256;

function wobblyCircle(ctx, cx, cy, radius, rng, wobble) {
  const steps = 48;
  const phase = rng() * Math.PI * 2;
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    const r = radius * (1 + wobble * Math.sin(angle * 3 + phase) + wobble * 0.5 * Math.sin(angle * 7 - phase));
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export function logEndTexture(scene, name, colors) {
  const texture = new DynamicTexture(name, SIZE, scene, true);
  const ctx = texture.getContext();
  const rng = createRng(7919);
  const half = SIZE / 2;
  const cx = half + (rng() - 0.5) * SIZE * 0.08;
  const cy = half + (rng() - 0.5) * SIZE * 0.08;

  ctx.fillStyle = colors.bark;
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = colors.wood;
  wobblyCircle(ctx, half, half, half * 0.9, rng, 0.015);
  ctx.fill();

  ctx.strokeStyle = colors.ring;
  for (let r = half * 0.86; r > 4; r -= half * (0.045 + rng() * 0.04)) {
    ctx.globalAlpha = 0.35 + rng() * 0.4;
    ctx.lineWidth = 1 + rng() * 2;
    wobblyCircle(ctx, cx, cy, r, rng, 0.02);
    ctx.stroke();
  }

  ctx.globalAlpha = 0.8;
  ctx.strokeStyle = colors.crack;
  for (let i = 0; i < 4; i++) {
    const angle = rng() * Math.PI * 2;
    const length = half * (0.35 + rng() * 0.5);
    ctx.lineWidth = 1.5 + rng() * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * length, cy + Math.sin(angle) * length);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  texture.update();
  return texture;
}
