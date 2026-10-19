// Private image previews use fresh, short-lived Storage URLs. URLs are never
// persisted in reminder data, localStorage, analytics, or a public bucket.
export function isPreviewableImage(file) {
  const type = String(file?.contentType || '').toLowerCase();
  if (type) return /^image\/(png|jpeg|webp|gif)$/.test(type);
  return /\.(png|jpe?g|webp|gif)$/i.test(file?.name || '');
}

export function createAttachmentController({ document, getSessionKey, getFile, signUrl, toast }) {
  const overlay = document.getElementById('imagePreview');
  const image = document.getElementById('imagePreviewImage');
  const title = document.getElementById('imagePreviewTitle');
  const status = document.getElementById('imagePreviewStatus');
  const closeButton = document.getElementById('imagePreviewClose');
  const retryButton = document.getElementById('imagePreviewRetry');
  const modal = document.getElementById('modal');
  let sequence = 0, activeId = null, source = null, savedOverflow = '', wasInert = false;
  let sessionKey = getSessionKey();
  const thumbnails = new Set();

  async function privateUrl(file, owner) {
    if (!owner || owner !== getSessionKey()) throw new Error('Sign in to view private attachments.');
    const value = await signUrl(file);
    if (owner !== getSessionKey()) throw new Error('Your account changed. Reopen the reminder.');
    const url = new URL(value);
    if (url.protocol !== 'https:') throw new Error('Invalid private attachment URL.');
    return url.href;
  }
  function close(restoreFocus = true) {
    const opened = activeId !== null;
    ++sequence; activeId = null;
    overlay.classList.add('hidden');
    image.onload = image.onerror = null;
    image.removeAttribute('src'); image.alt = ''; image.hidden = true;
    title.textContent = ''; status.textContent = ''; retryButton.hidden = true;
    if (opened) {
      modal.inert = wasInert;
      document.body.style.overflow = savedOverflow;
      if (restoreFocus && source?.isConnected) source.focus();
    }
    source = null;
    return opened;
  }
  function syncSession() {
    if (sessionKey === getSessionKey()) return;
    sessionKey = getSessionKey(); close(false);
    for (const button of thumbnails) {
      const img = button.querySelector('img');
      img.onload = img.onerror = null; img.removeAttribute('src'); img.hidden = true;
      button.querySelector('[data-attachment-status]').textContent = 'Reopen to view';
    }
    thumbnails.clear();
  }
  async function open(id, button) {
    syncSession();
    const file = getFile(id), owner = getSessionKey();
    if (!file || !isPreviewableImage(file)) { toast('This image is no longer available.'); return; }
    if (!owner) { toast('Sign in to view private attachments.'); return; }
    if (activeId === null) {
      savedOverflow = document.body.style.overflow; wasInert = modal.inert;
      source = button || document.activeElement;
    }
    activeId = id;
    const ticket = ++sequence;
    const current = () => ticket === sequence && owner === getSessionKey() && activeId === id;
    modal.inert = true; document.body.style.overflow = 'hidden';
    overlay.classList.remove('hidden'); closeButton.focus();
    title.textContent = file.name || 'Image attachment';
    image.hidden = true; image.removeAttribute('src'); image.alt = file.name || 'Reminder image';
    status.textContent = 'Loading private image…'; retryButton.hidden = true;
    const failed = () => {
      if (!current()) return;
      image.hidden = true; image.removeAttribute('src');
      status.textContent = 'Could not load this private image. Check your connection and try again.';
      retryButton.hidden = false;
    };
    try {
      const url = await privateUrl(file, owner);
      if (!current()) return;
      image.onload = () => { if (current()) { image.hidden = false; status.textContent = ''; } };
      image.onerror = failed;
      image.src = url;
    } catch { failed(); }
  }
  async function hydrate(root) {
    syncSession();
    for (const previous of thumbnails) if (!previous.isConnected) thumbnails.delete(previous);
    const owner = getSessionKey();
    await Promise.all([...root.querySelectorAll('[data-image-attachment]')].map(async button => {
      thumbnails.add(button);
      const id = button.dataset.imageAttachment, file = getFile(id);
      const img = button.querySelector('img'), label = button.querySelector('[data-attachment-status]');
      button.onclick = () => open(id, button);
      const current = () => button.isConnected && root.contains(button) && owner === getSessionKey();
      const failed = () => {
        if (!current()) return;
        img.hidden = true; img.removeAttribute('src'); label.textContent = 'Preview unavailable · Tap to retry';
      };
      if (!owner) { label.textContent = 'Sign in to view'; return; }
      try {
        const url = await privateUrl(file, owner);
        if (!current()) return;
        img.onload = () => { if (current()) { img.hidden = false; label.textContent = 'Tap to expand'; } };
        img.onerror = failed;
        img.src = url;
      } catch { failed(); }
    }));
  }
  closeButton.addEventListener('click', () => close());
  retryButton.addEventListener('click', () => { if (activeId !== null) open(activeId, source); });
  overlay.addEventListener('click', event => { if (event.target.closest('[data-close-image]')) close(); });
  // Capture Escape before the existing reminder-modal shortcut; one press must
  // close only the expanded image, leaving details and unsaved edits intact.
  document.addEventListener('keydown', event => {
    if (activeId === null) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(); }
    else if (event.key === 'Tab') {
      const controls = retryButton.hidden ? [closeButton] : [closeButton, retryButton];
      const index = controls.indexOf(document.activeElement);
      event.preventDefault(); controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length].focus();
    }
  }, true);
  return { hydrate, open, close, syncSession };
}
