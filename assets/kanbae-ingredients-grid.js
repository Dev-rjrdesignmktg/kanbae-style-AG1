document.querySelectorAll('[data-kb-ing-facts-tab]').forEach((tab) => {
  tab.addEventListener('click', () => {
    const modal = tab.closest('.kb-ing-facts-modal');
    if (!modal) return;

    modal.querySelectorAll('[data-kb-ing-facts-tab]').forEach((otherTab) => {
      const isActive = otherTab === tab;
      otherTab.classList.toggle('is-active', isActive);
      otherTab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    const targetId = tab.dataset.target;
    modal.querySelectorAll('[data-kb-ing-facts-panel]').forEach((panel) => {
      panel.classList.toggle('is-active', panel.id === targetId);
    });
  });
});

document.querySelectorAll('[data-kb-ing-marquee]').forEach((marquee) => {
  const track = marquee.querySelector('[data-kb-ing-track]');
  if (!track) return;

  const originalItems = Array.from(track.children);
  if (originalItems.length < 2) return;

  originalItems.forEach((item) => {
    const clone = item.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    clone.querySelectorAll('a, button').forEach((el) => el.setAttribute('tabindex', '-1'));
    track.appendChild(clone);
  });

  marquee.classList.add('kb-ing__marquee--active');

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const baseSpeed = prefersReducedMotion ? 0 : parseFloat(marquee.dataset.speed) || 0;

  let loopWidth = 0;
  let position = 0;
  let paused = false;
  let dragging = false;
  let inView = true;
  let pointerId = null;
  let dragStartX = 0;
  let dragStartPosition = 0;
  let resumeTimer = null;
  let lastTime = null;

  function measure() {
    loopWidth = track.scrollWidth / 2;
  }
  measure();
  window.addEventListener('resize', measure);
  window.addEventListener('load', measure);

  function wrap() {
    if (loopWidth <= 0) return;
    while (position <= -loopWidth) position += loopWidth;
    while (position > 0) position -= loopWidth;
  }

  function render() {
    track.style.transform = `translate3d(${position}px, 0, 0)`;
  }

  function tick(time) {
    if (lastTime === null) lastTime = time;
    const dt = (time - lastTime) / 1000;
    lastTime = time;
    if (!paused && !dragging && inView && baseSpeed > 0) {
      position -= baseSpeed * dt;
      wrap();
      render();
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          inView = entry.isIntersecting;
        });
      },
      { threshold: 0.05 }
    ).observe(marquee);
  }

  function scheduleResume(delay) {
    if (resumeTimer) clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => {
      paused = false;
    }, delay);
  }

  marquee.addEventListener('pointerenter', () => {
    if (!dragging) paused = true;
  });
  marquee.addEventListener('pointerleave', () => {
    if (!dragging) scheduleResume(200);
  });
  marquee.addEventListener('focusin', () => {
    paused = true;
  });
  marquee.addEventListener('focusout', () => {
    scheduleResume(200);
  });

  marquee.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    dragging = true;
    paused = true;
    pointerId = event.pointerId;
    dragStartX = event.clientX;
    dragStartPosition = position;
    marquee.setPointerCapture(pointerId);
    marquee.classList.add('kb-ing__marquee--dragging');
  });

  marquee.addEventListener('pointermove', (event) => {
    if (!dragging || event.pointerId !== pointerId) return;
    position = dragStartPosition + (event.clientX - dragStartX);
    wrap();
    render();
  });

  function endDrag(event) {
    if (!dragging || event.pointerId !== pointerId) return;
    dragging = false;
    pointerId = null;
    marquee.classList.remove('kb-ing__marquee--dragging');
    scheduleResume(500);
  }

  marquee.addEventListener('pointerup', endDrag);
  marquee.addEventListener('pointercancel', endDrag);
});
