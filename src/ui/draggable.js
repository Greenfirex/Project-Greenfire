// Tažení panelů — za celou plochu, nebo jen za předanou rukojeť (hlavičku).
// Tlačítka a pole zůstávají klikací; pozici drží v inline stylu, z viewportu panel neuteče.
const SKIP = 'button, input, select, textarea, label, a, output';

export function makeDraggable(root, handle = null) {
  if (!root || root.dataset.dragReady === '1') return root;
  root.dataset.dragReady = '1';
  const target = root;
  const grip = handle || root;

  grip.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    if (event.target.closest(SKIP)) return;
    const rect = target.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    target.style.transform = 'none';
    target.style.right = 'auto';
    target.style.bottom = 'auto';
    target.style.left = `${rect.left}px`;
    target.style.top = `${rect.top}px`;
    target.setPointerCapture(event.pointerId);
    target.classList.add('is-dragging');

    const move = (evt) => {
      const maxX = window.innerWidth - rect.width;
      const maxY = window.innerHeight - rect.height;
      const left = Math.max(0, Math.min(maxX, evt.clientX - offsetX));
      const top = Math.max(0, Math.min(maxY, evt.clientY - offsetY));
      target.style.left = `${left}px`;
      target.style.top = `${top}px`;
    };

    const stop = (evt) => {
      target.classList.remove('is-dragging');
      if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', stop);
      target.removeEventListener('pointercancel', stop);
      if (evt) evt.preventDefault();
    };

    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', stop);
    target.addEventListener('pointercancel', stop);
  });

  return target;
}
