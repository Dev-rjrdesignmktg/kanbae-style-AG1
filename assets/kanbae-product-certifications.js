if (!customElements.get('kanbae-certifications')) {
  class KanbaeCertifications extends HTMLElement {
    connectedCallback() {
      this.abort = new AbortController();
      this.track = this.querySelector('[data-certs-track]');
      this.items = this.track ? Array.from(this.track.children) : [];
      this.dots = Array.from(this.querySelectorAll('[data-certs-dot]'));
      this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      this.initDots();
      this.initSpotlight();
      this.initEditorSupport();
    }

    disconnectedCallback() {
      this.abort?.abort();
      this.observer?.disconnect();
    }

    /* Mobile slider: keep dots in sync with the visible card */
    initDots() {
      if (!this.dots.length || !('IntersectionObserver' in window)) return;

      this.observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) this.setActiveDot(this.items.indexOf(entry.target));
          });
        },
        { root: this.track, threshold: 0.6 }
      );
      this.items.forEach((item) => this.observer.observe(item));

      this.dots.forEach((dot, index) => {
        dot.addEventListener('click', () => this.scrollToItem(index), { signal: this.abort.signal });
      });
    }

    setActiveDot(index) {
      this.dots.forEach((dot, i) => {
        if (i === index) dot.setAttribute('aria-current', 'true');
        else dot.removeAttribute('aria-current');
      });
    }

    scrollToItem(index) {
      const item = this.items[index];
      if (!item || !this.track) return;
      const offset = parseFloat(getComputedStyle(this.track).scrollPaddingInlineStart) || 0;
      this.track.scrollTo({
        left: item.offsetLeft - offset,
        behavior: this.reducedMotion ? 'auto' : 'smooth',
      });
    }

    /* Premium hover (fine pointers only): cursor-following spotlight and
       border glow, plus a subtle 3D tilt toward the pointer */
    initSpotlight() {
      if (this.reducedMotion || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

      const maxTilt = 4; // degrees
      const { signal } = this.abort;

      this.querySelectorAll('.kb-certs__card').forEach((card) => {
        card.addEventListener(
          'pointermove',
          (event) => {
            const rect = card.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            const px = x / rect.width - 0.5;
            const py = y / rect.height - 0.5;

            card.style.setProperty('--mx', `${x}px`);
            card.style.setProperty('--my', `${y}px`);
            card.style.setProperty('--rx', `${(-py * maxTilt).toFixed(2)}deg`);
            card.style.setProperty('--ry', `${(px * maxTilt).toFixed(2)}deg`);
          },
          { passive: true, signal }
        );

        card.addEventListener(
          'pointerleave',
          () => {
            card.style.setProperty('--rx', '0deg');
            card.style.setProperty('--ry', '0deg');
          },
          { passive: true, signal }
        );
      });
    }

    /* Theme editor: bring the selected block into view inside the slider */
    initEditorSupport() {
      if (!window.Shopify?.designMode || !this.dots.length) return;

      document.addEventListener(
        'shopify:block:select',
        (event) => {
          const index = this.items.indexOf(event.target);
          if (index > -1) this.scrollToItem(index);
        },
        { signal: this.abort.signal }
      );
    }
  }

  customElements.define('kanbae-certifications', KanbaeCertifications);
}
