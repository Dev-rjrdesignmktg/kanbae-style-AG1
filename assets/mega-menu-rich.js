if (!customElements.get('mega-menu-rich')) {
  class MegaMenuRich extends HTMLElement {
    constructor() {
      super();
      this.details = this.querySelector('details');
      this.summary = this.querySelector('summary');
      this.openDelay = 80;
      this.closeDelay = 250;
      this.hoverEnabled =
        this.hasAttribute('data-hover-enabled') && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

      this.onToggle = this.onToggle.bind(this);
      this.onFocusOut = this.onFocusOut.bind(this);
      this.onKeydown = this.onKeydown.bind(this);
      this.onMouseEnter = this.onMouseEnter.bind(this);
      this.onMouseLeave = this.onMouseLeave.bind(this);
    }

    connectedCallback() {
      this.details.addEventListener('toggle', this.onToggle);
      this.addEventListener('focusout', this.onFocusOut);
      this.addEventListener('keydown', this.onKeydown);

      if (this.hoverEnabled) {
        this.addEventListener('mouseenter', this.onMouseEnter);
        this.addEventListener('mouseleave', this.onMouseLeave);
      }
    }

    disconnectedCallback() {
      this.details.removeEventListener('toggle', this.onToggle);
      this.removeEventListener('focusout', this.onFocusOut);
      this.removeEventListener('keydown', this.onKeydown);
      this.removeEventListener('mouseenter', this.onMouseEnter);
      this.removeEventListener('mouseleave', this.onMouseLeave);
      window.clearTimeout(this.openTimer);
      window.clearTimeout(this.closeTimer);
    }

    onMouseEnter() {
      window.clearTimeout(this.closeTimer);
      this.openTimer = window.setTimeout(() => this.open(), this.openDelay);
    }

    onMouseLeave() {
      window.clearTimeout(this.openTimer);
      this.closeTimer = window.setTimeout(() => this.close(), this.closeDelay);
    }

    onKeydown(event) {
      if (event.key !== 'Escape') return;
      this.close();
      this.summary.focus();
    }

    onFocusOut() {
      setTimeout(() => {
        if (!this.contains(document.activeElement)) this.close();
      });
    }

    onToggle() {
      this.summary.setAttribute('aria-expanded', this.details.open);

      const header = document.querySelector('.header-wrapper');
      if (!header) return;
      header.preventHide = this.details.open;

      if (document.documentElement.style.getPropertyValue('--header-bottom-position-desktop') !== '') return;
      document.documentElement.style.setProperty(
        '--header-bottom-position-desktop',
        `${Math.floor(header.getBoundingClientRect().bottom)}px`
      );
    }

    open() {
      if (this.details.open) return;

      const nav = this.closest('.header__inline-menu');
      if (nav) {
        nav.querySelectorAll('mega-menu-rich, header-menu').forEach((el) => {
          if (el !== this && typeof el.close === 'function') el.close();
        });
      }

      this.details.open = true;
    }

    close() {
      window.clearTimeout(this.openTimer);
      if (!this.details.open) return;
      this.details.open = false;
      this.summary.setAttribute('aria-expanded', 'false');
    }
  }

  customElements.define('mega-menu-rich', MegaMenuRich);
}
