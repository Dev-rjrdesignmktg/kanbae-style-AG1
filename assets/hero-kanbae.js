if (!customElements.get('kb-hero-video')) {
  customElements.define(
    'kb-hero-video',
    class KbHeroVideo extends HTMLElement {
      connectedCallback() {
        this.video = this.querySelector('video');
        if (!this.video) return;

        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reducedMotion) return;

        this.video.muted = true;
        this.video.setAttribute('muted', '');
        this.video.setAttribute('playsinline', '');
        this.video.setAttribute('webkit-playsinline', '');

        this.video.addEventListener(
          'playing',
          () => this.classList.add('kb-hero-video--ready'),
          { once: true }
        );

        const start = () => this.video.play().catch(() => {});
        const requestStart = () => {
          if ('requestIdleCallback' in window) {
            window.requestIdleCallback(start, { timeout: 2000 });
          } else {
            window.setTimeout(start, 300);
          }
        };

        if (document.readyState === 'complete') {
          requestStart();
        } else {
          window.addEventListener('load', requestStart, { once: true });
        }
      }
    }
  );
}
