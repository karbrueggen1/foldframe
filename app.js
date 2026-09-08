'use strict';

// Inner-display aspect ratios from Samsung's model comparison (2026-08-12).
// Both models use native inner-display proportions in each orientation.
// Export at the long display edge: landscape stays native, portrait scales down.
const devices = {
  fold8: { name: 'Galaxy Fold 8', width: 2448, portraitRatio: 1848 / 2448, portraitLabel: '77:102', landscapeLabel: '102:77' },
  ultra: { name: 'Galaxy Fold 8 Ultra', width: 2504, portraitRatio: 2256 / 2504, portraitLabel: '282:313', landscapeLabel: '313:282' },
};
const slots = [
  { id: 'portrait', title: 'Top photo', position: 'TOP' },
  { id: 'landscape', title: 'Bottom photo', position: 'BOTTOM' },
];
const state = Object.fromEntries(slots.map(slot => [slot.id, { image: null, x: 50, y: 50, zoom: 1, version: 0 }]));
let device = 'fold8';
const canvas = document.querySelector('#preview');
const ctx = canvas.getContext('2d');
const download = document.querySelector('#download');
const message = document.querySelector('#message');

document.querySelector('#uploads').innerHTML = slots.map((slot, index) => `
  <div class="upload-card" id="${slot.id}-card">
    <div class="upload-top"><strong>${index + 1}. ${slot.title}</strong><span class="format">${slot.position}</span></div>
    <label class="drop-zone" id="${slot.id}-drop">
      <span class="upload-icon" aria-hidden="true">↑</span>
      <span class="file-title" id="${slot.id}-name">Choose a photo or drop it here</span>
      <span class="upload-recommendation" id="${slot.id}-recommendation"></span>
      <span class="file-meta">JPG, PNG or WebP · up to 25 MB</span>
      <input type="file" id="${slot.id}-file" accept="image/jpeg,image/png,image/webp" aria-label="Upload ${slot.title}" aria-describedby="${slot.id}-recommendation">
    </label>
    <div class="adjustments" id="${slot.id}-adjust" hidden>
      <label><span>Horizontal</span><input aria-label="${slot.title}: horizontal crop position" type="range" min="0" max="100" value="50" data-slot="${slot.id}" data-key="x"></label>
      <label><span>Vertical</span><input aria-label="${slot.title}: vertical crop position" type="range" min="0" max="100" value="50" data-slot="${slot.id}" data-key="y"></label>
      <label><span>Zoom</span><input aria-label="${slot.title}: Zoom" type="range" min="1" max="3" step="0.01" value="1" data-slot="${slot.id}" data-key="zoom"></label>
      <button class="reset" type="button" data-reset="${slot.id}">Reset crop</button>
    </div>
  </div>`).join('');

function resetCrop(id) {
  Object.assign(state[id], { x: 50, y: 50, zoom: 1 });
  syncControls(id);
}

function syncControls(id) {
  document.querySelectorAll(`[data-slot="${id}"]`).forEach(input => { input.value = state[id][input.dataset.key]; });
}

async function upload(id, file) {
  if (!file) return;
  endDrag();
  const version = ++state[id].version;
  message.textContent = '';
  let image;
  try {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Please choose a JPG, PNG or WebP file.');
    if (file.size > 25 * 1024 * 1024) throw new Error('This photo is too large. The limit is 25 MB.');
    image = await createImageBitmap(file);
    if (version !== state[id].version) { image.close(); return; }
    if (image.width * image.height > 60_000_000) throw new Error('Please use a photo with no more than 60 megapixels.');
    state[id].image?.close();
    state[id].image = image;
    resetCrop(id);
    document.querySelector(`#${id}-name`).textContent = `${file.name} · ${image.width} × ${image.height}`;
    document.querySelector(`#${id}-adjust`).hidden = false;
    render();
  } catch (error) {
    image?.close();
    if (version === state[id].version) message.textContent = error instanceof DOMException ? 'This photo could not be read. Please try another file.' : error.message;
  }
}

function drawSlot(context, id, width, height, top) {
  const item = state[id];
  if (item.image) {
    const img = item.image;
    const scale = Math.max(width / img.width, height / img.height) * item.zoom;
    const sw = width / scale;
    const sh = height / scale;
    context.drawImage(img, (img.width - sw) * item.x / 100, (img.height - sh) * item.y / 100, sw, sh, 0, top, width, height);
    return;
  }
  context.fillStyle = id === 'portrait' ? '#c4d1b6' : '#778a68';
  context.fillRect(0, top, width, height);
  context.fillStyle = id === 'portrait' ? '#aaba98' : '#647959';
  context.beginPath();
  context.arc(width * .82, top + height * .28, width * .44, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#263820';
  context.textAlign = 'center';
  context.font = `500 ${width * .075}px system-ui`;
  context.fillText(id === 'portrait' ? 'Your top photo' : 'Your bottom photo', width / 2, top + height * .55);
  context.font = `${width * .05}px system-ui`;
  context.fillText(id === 'portrait' ? devices[device].portraitLabel : devices[device].landscapeLabel, width / 2, top + height * .55 + width * .095);
}

function render() {
  const { width, name, portraitRatio, portraitLabel, landscapeLabel } = devices[device];
  const topHeight = Math.round(width / portraitRatio);
  const bottomHeight = Math.round(width * portraitRatio);
  slots.forEach(slot => {
    const isPortrait = slot.id === 'portrait';
    const height = isPortrait ? topHeight : bottomHeight;
    document.querySelector(`#${slot.id}-card .format`).textContent = slot.position;
    document.querySelector(`#${slot.id}-recommendation`).textContent = `Recommended: ${isPortrait ? 'Portrait' : 'Landscape'} · ${width} × ${height} px or larger`;
  });
  canvas.width = width;
  canvas.height = topHeight + bottomHeight;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  drawSlot(ctx, 'portrait', width, topHeight, 0);
  drawSlot(ctx, 'landscape', width, bottomHeight, topHeight);
  const count = slots.filter(slot => state[slot.id].image).length;
  document.querySelector('#badge').textContent = `${count} / 2 photos`;
  document.querySelector('#resolution').textContent = `${width} × ${canvas.height} px`;
  document.querySelector('#device-info').textContent = `${name} · ${width} × ${canvas.height} px · portrait + landscape`;
  document.querySelector('#export-hint').textContent = count === 2 ? `Top ${portraitLabel} + bottom ${landscapeLabel}. Your phone may crop the wallpaper when applying it.` : 'Upload both photos to get started.';
  download.disabled = count !== 2;
}

slots.forEach(({ id }) => {
  document.querySelector(`#${id}-file`).addEventListener('change', event => {
    upload(id, event.target.files[0]);
    event.target.value = '';
  });
  const zone = document.querySelector(`#${id}-drop`);
  zone.addEventListener('dragover', event => { event.preventDefault(); zone.classList.add('drag'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag'));
  zone.addEventListener('drop', event => {
    event.preventDefault();
    zone.classList.remove('drag');
    if (event.dataTransfer.files.length !== 1) { message.textContent = 'Please drop one photo in each field.'; return; }
    upload(id, event.dataTransfer.files[0]);
  });
});
document.querySelectorAll('[data-slot]').forEach(input => input.addEventListener('input', () => {
  endDrag();
  state[input.dataset.slot][input.dataset.key] = Number(input.value);
  render();
}));
document.querySelectorAll('[data-reset]').forEach(button => button.addEventListener('click', () => { endDrag(); resetCrop(button.dataset.reset); render(); }));
document.querySelectorAll('[name="device"]').forEach(input => input.addEventListener('change', () => { endDrag(); device = input.value; render(); }));
download.addEventListener('click', () => {
  if (!slots.every(slot => state[slot.id].image)) return;
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const random = Array.from(crypto.getRandomValues(new Uint8Array(4)), value => alphabet[value % alphabet.length]).join('');
  const filename = `galaxy-${device === 'ultra' ? 'fold8-ultra' : 'fold8'}-collage-${random}-${canvas.width}x${canvas.height}.png`;
  canvas.toBlob(blob => {
    if (!blob) { message.textContent = 'Export failed. Please try again.'; return; }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }, 'image/png');
});
const clamp = value => Math.max(0, Math.min(100, value));
const pointers = new Map();
let drag = null;

function endDrag() {
  const ids = [...pointers.keys()];
  pointers.clear();
  drag = null;
  ids.forEach(id => { if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id); });
  canvas.classList.remove('dragging');
}

function gesturePosition() {
  const points = [...pointers.values()];
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
    distance: points.length === 2 ? Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y) : 0,
  };
}

// Rebase whenever a finger is added or lifted, keeping transitions jump-free.
function beginGesture(id) {
  const rect = canvas.getBoundingClientRect();
  const topHeight = Math.round(canvas.width / devices[device].portraitRatio);
  const height = id === 'portrait' ? topHeight : canvas.height - topHeight;
  const top = id === 'portrait' ? 0 : topHeight;
  const item = state[id];
  const baseScale = Math.max(canvas.width / item.image.width, height / item.image.height);
  const scale = baseScale * item.zoom;
  const point = gesturePosition();
  const localX = (point.x - rect.left) * canvas.width / rect.width;
  const localY = (point.y - rect.top) * canvas.height / rect.height - top;
  drag = {
    id, rect, height, top, baseScale, zoom: item.zoom, distance: point.distance,
    anchorX: (item.image.width - canvas.width / scale) * item.x / 100 + localX / scale,
    anchorY: (item.image.height - height / scale) * item.y / 100 + localY / scale,
  };
}

canvas.addEventListener('pointerdown', event => {
  if (event.button !== 0 || pointers.size >= 2) return;
  if (pointers.size && (event.pointerType !== 'touch' || [...pointers.values()][0].type !== 'touch')) return;
  const rect = canvas.getBoundingClientRect();
  const topHeight = Math.round(canvas.width / devices[device].portraitRatio);
  const id = (event.clientY - rect.top) * canvas.height / rect.height < topHeight ? 'portrait' : 'landscape';
  if (!state[id].image || (drag && drag.id !== id)) return;
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, type: event.pointerType });
  canvas.setPointerCapture(event.pointerId);
  beginGesture(id);
  canvas.classList.add('dragging');
  event.preventDefault();
});

canvas.addEventListener('pointermove', event => {
  if (!drag || !pointers.has(event.pointerId)) return;
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, type: event.pointerType });
  const point = gesturePosition();
  const item = state[drag.id];
  if (pointers.size === 2 && drag.distance > 0.01) {
    item.zoom = Math.max(1, Math.min(3, drag.zoom * point.distance / drag.distance));
  }
  const scale = drag.baseScale * item.zoom;
  const localX = (point.x - drag.rect.left) * canvas.width / drag.rect.width;
  const localY = (point.y - drag.rect.top) * canvas.height / drag.rect.height - drag.top;
  const overflowX = item.image.width - canvas.width / scale;
  const overflowY = item.image.height - drag.height / scale;
  // Keep the image point under the finger midpoint anchored while zooming.
  item.x = overflowX > 0.01 ? clamp((drag.anchorX - localX / scale) / overflowX * 100) : 50;
  item.y = overflowY > 0.01 ? clamp((drag.anchorY - localY / scale) / overflowY * 100) : 50;
  syncControls(drag.id);
  render();
  event.preventDefault();
});

['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => canvas.addEventListener(type, event => {
  if (!pointers.has(event.pointerId)) return;
  const id = drag.id;
  pointers.delete(event.pointerId);
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  if (pointers.size) beginGesture(id);
  else endDrag();
}));
window.addEventListener('resize', endDrag);
window.addEventListener('blur', endDrag);
render();
