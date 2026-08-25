if (!customElements.get('kanbae-faq-accordion')) {
  customElements.define(
    'kanbae-faq-accordion',
    class KanbaeFaqAccordion extends HTMLElement {
      connectedCallback() {
        this.exclusive = this.dataset.exclusive === 'true';
        this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        this.items = Array.from(this.querySelectorAll(':scope > .kb-faq__item'));

        this.items.forEach((details) => {
          const summary = details.querySelector(':scope > summary');
          summary.addEventListener('click', (event) => this.onSummaryClick(event, details));
        });
      }

      onSummaryClick(event, details) {
        if (this.reduceMotion || details.dataset.animating === 'true') return;
        event.preventDefault();

        if (details.open) {
          this.collapse(details);
        } else {
          if (this.exclusive) {
            this.items.forEach((item) => {
              if (item !== details && item.open && item.dataset.animating !== 'true') {
                this.collapse(item);
              }
            });
          }
          this.expand(details);
        }
      }

      collapse(details) {
        const content = details.querySelector(':scope > .kb-faq__content');
        const startHeight = `${content.offsetHeight}px`;
        details.dataset.animating = 'true';

        const animation = content.animate(
          { height: [startHeight, '0px'] },
          { duration: 350, easing: 'cubic-bezier(0.65, 0, 0.35, 1)' }
        );

        animation.onfinish = () => {
          details.removeAttribute('open');
          details.dataset.animating = 'false';
        };
      }

      expand(details) {
        details.setAttribute('open', '');
        const content = details.querySelector(':scope > .kb-faq__content');
        const endHeight = `${content.offsetHeight}px`;
        details.dataset.animating = 'true';

        const animation = content.animate(
          { height: ['0px', endHeight] },
          { duration: 350, easing: 'cubic-bezier(0.65, 0, 0.35, 1)' }
        );

        animation.onfinish = () => {
          details.dataset.animating = 'false';
        };
      }
    }
  );
}
