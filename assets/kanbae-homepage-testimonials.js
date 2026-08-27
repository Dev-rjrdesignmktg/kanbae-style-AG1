document.querySelectorAll('[data-kb-ht-slider]').forEach((root) => {
  const viewport = root.querySelector('[data-kb-ht-viewport]');
  const track = root.querySelector('[data-kb-ht-track]');
  const prevBtn = root.querySelector('[data-kb-ht-prev]');
  const nextBtn = root.querySelector('[data-kb-ht-next]');
  if (!viewport || !track) return;

  const originalItems = Array.from(track.children);
  if (originalItems.length < 2) return;

  function cloneSet() {
    return originalItems.map((item) => {
      const clone = item.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      clone.removeAttribute('id');
      clone.querySelectorAll('a, button').forEach((el) => el.setAttribute('tabindex', '-1'));
      return clone;
    });
  }

  // Surround the real cards with a cloned copy on each side. The track is
  // moved with `transform`, not scrolled, so wrapping is just changing a
  // number we own — there is no native scroll position for the browser to
  // fight or re-settle, which is what caused visible resets before.
  cloneSet()
    .reverse()
    .forEach((clone) => track.insertBefore(clone, track.firstChild));
  cloneSet().forEach((clone) => track.appendChild(clone));

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const transition = prefersReducedMotion ? 'none' : 'transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)';

  let step = 0;
  let setSpan = 0;
  let position = 0;

  function measure() {
    step = originalItems[1].offsetLeft - originalItems[0].offsetLeft;
    setSpan = step * originalItems.length;
  }

  function render(animate) {
    track.style.transition = animate ? transition : 'none';
    track.style.transform = `translate3d(${position}px, 0, 0)`;
  }

  // Keeps position within one buffer set of the middle copy. Only ever
  // called right after a visible move has finished, so the correction
  // itself is always applied instantly (no transition) and lands on
  // identical cloned content — invisible to the viewer.
  function wrap() {
    if (setSpan <= 0) return false;
    let wrapped = false;
    while (position <= -setSpan * 1.5) {
      position += setSpan;
      wrapped = true;
    }
    while (position > -setSpan * 0.5) {
      position -= setSpan;
      wrapped = true;
    }
    return wrapped;
  }

  measure();
  position = -setSpan;
  render(false);

  track.addEventListener('transitionend', (event) => {
    if (event.target !== track || event.propertyName !== 'transform') return;
    if (wrap()) render(false);
  });

  window.addEventListener('resize', () => {
    measure();
    position = -setSpan;
    render(false);
  });

  function goTo(direction) {
    position -= direction * step;
    render(true);
    if (prefersReducedMotion && wrap()) render(false);
  }

  if (prevBtn) prevBtn.addEventListener('click', () => goTo(-1));
  if (nextBtn) nextBtn.addEventListener('click', () => goTo(1));

  // Drag / swipe support
  let dragging = false;
  let pointerId = null;
  let dragStartX = 0;
  let dragStartPosition = 0;

  viewport.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    dragging = true;
    pointerId = event.pointerId;
    dragStartX = event.clientX;
    dragStartPosition = position;
    viewport.setPointerCapture(pointerId);
    viewport.classList.add('kb-ht__viewport--dragging');
    track.style.transition = 'none';
  });

  viewport.addEventListener('pointermove', (event) => {
    if (!dragging || event.pointerId !== pointerId) return;
    position = dragStartPosition + (event.clientX - dragStartX);
    track.style.transform = `translate3d(${position}px, 0, 0)`;
  });

  function endDrag(event) {
    if (!dragging || event.pointerId !== pointerId) return;
    dragging = false;
    pointerId = null;
    viewport.classList.remove('kb-ht__viewport--dragging');
    position = Math.round(position / step) * step;
    render(true);
    if (prefersReducedMotion && wrap()) render(false);
  }

  viewport.addEventListener('pointerup', endDrag);
  viewport.addEventListener('pointercancel', endDrag);
});
