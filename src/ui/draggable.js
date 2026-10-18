// Tažení panelů v editoru za jejich plochu; tlačítka a pole zůstávají klikací.
// Pozici drží v inline stylu panelu, do viewportu panel nepustí.
const SKIP = 'button, input, select, textarea, label, a, output';

export function makeDraggable(root) {
  if (!root || root.dataset.dragReady === '1') return root;
  root.dataset.dragReady = '1';
  const target = root;

  target.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    if (event.target.closest(SKIP)) return;
    const rect = target.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
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
