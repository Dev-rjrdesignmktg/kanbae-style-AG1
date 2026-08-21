if ('IntersectionObserver' in window) {
  document.querySelectorAll('[data-kb-split-slider]').forEach((slider) => {
    const slides = slider.querySelectorAll('.kb-split__slide');
    if (slides.length < 2) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          entry.target.classList.toggle('is-active', entry.intersectionRatio > 0.6);
        });
      },
      { root: slider, threshold: [0, 0.6, 1] }
    );

    slides.forEach((slide) => observer.observe(slide));
  });
}
