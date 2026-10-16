/**
 * <kanbae-ingredients-breakdown>
 * Tabs (desktop/tablet/mobile chips) + accordion (mobile) controller.
 */
(() => {
  if (customElements.get('kanbae-ingredients-breakdown')) return;

  const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

  class KanbaeIngredientsBreakdown extends HTMLElement {
    connectedCallback() {
      this.items = [...this.querySelectorAll('[data-kb-ib-item]')];
      if (!this.items.length) return;

      this.tablist = this.querySelector('[data-kb-ib-tablist]');
      this.stage = this.querySelector('[data-kb-ib-stage]');
      this.tabs = [...this.querySelectorAll('[data-kb-ib-tab]')];
      this.panels = this.items.map((item) => item.querySelector('[data-kb-ib-panel]'));
      this.triggers = this.items.map((item) => item.querySelector('[data-kb-ib-trigger]'));

      this.active = 0;
      this.lastActive = 0;
      this.animations = [];
      this.pauseReasons = new Set();
      this.controller = new AbortController();
      const { signal } = this.controller;

      this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.mobileQuery = window.matchMedia('(max-width: 749px)');
      this.desktopQuery = window.matchMedia('(min-width: 990px)');

      // Tabs
      this.tabs.forEach((tab, index) => {
        tab.addEventListener('click', () => this.select(index, { user: true }), { signal });
        tab.addEventListener('keydown', (event) => this.onTabKeydown(event, index), { signal });
      });

      // Accordion triggers
      this.triggers.forEach((trigger, index) => {
        trigger.addEventListener('click', () => this.select(index, { user: true }), { signal });
      });

      this.mobileQuery.addEventListener('change', () => this.applyMode(), { signal });
      this.desktopQuery.addEventListener('change', () => this.applyMode(), { signal });

      // Theme editor: show the selected ingredient block
      document.addEventListener(
        'shopify:block:select',
        (event) => {
          const index = this.items.findIndex((item) => item === event.target || item.contains(event.target));
          if (index === -1) return;
          this.stopAutoplay();
          if (!(this.isAccordion && this.active === index)) this.select(index);
        },
        { signal }
      );

      this.setupFactsDialog(signal);
      this.applyMode();
      this.setupAutoplay(signal);
    }

    disconnectedCallback() {
      this.controller?.abort();
      this.observer?.disconnect();
      this.animations?.forEach((animation) => animation.cancel());
      document.documentElement.classList.remove('kb-ib-lock');
    }

    get isAccordion() {
      return this.dataset.mobileLayout === 'accordion' && this.mobileQuery.matches;
    }

    /* ---------- Mode (tabs vs accordion) ---------- */
    applyMode() {
      const accordion = this.isAccordion;

      // Swap ARIA semantics so the visible control labels the panel
      this.panels.forEach((panel, index) => {
        if (accordion) {
          panel.setAttribute('role', 'region');
          panel.setAttribute('aria-labelledby', this.triggers[index].id);
          panel.removeAttribute('tabindex');
        } else {
          panel.setAttribute('role', 'tabpanel');
          panel.setAttribute('aria-labelledby', this.tabs[index].id);
          panel.setAttribute('tabindex', '0');
        }
      });

      if (this.tablist) {
        const vertical = this.dataset.tabsPosition === 'left' && this.desktopQuery.matches;
        this.tablist.setAttribute('aria-orientation', vertical ? 'vertical' : 'horizontal');
      }

      // Tabs always need one active panel
      if (!accordion && this.active < 0) this.active = this.lastActive;

      this.render();
      if (!accordion) this.scrollTabIntoView(this.active, false);
    }

    render() {
      this.items.forEach((item, index) => {
        const on = index === this.active;
        item.classList.toggle('is-active', on);
        this.tabs[index]?.setAttribute('aria-selected', String(on));
        this.tabs[index]?.setAttribute('tabindex', on ? '0' : '-1');
        this.triggers[index]?.setAttribute('aria-expanded', String(on));
      });
    }

    /* ---------- Selection ---------- */
    select(index, { focus = false, user = false } = {}) {
      if (user) this.stopAutoplay();

      if (this.isAccordion) {
        this.active = this.active === index ? -1 : index;
        if (this.active > -1) this.lastActive = this.active;
        this.render();
        if (this.active > -1 && user) this.keepTriggerInView(index);
        return;
      }

      if (index === this.active) return;

      const previous = this.active;
      const fromHeight = this.stage?.offsetHeight;
      this.active = index;
      this.lastActive = index;
      this.render();
      this.animateHeight(fromHeight);
      this.animateSwap(previous, index);
      this.scrollTabIntoView(index);
      if (focus) this.tabs[index]?.focus({ preventScroll: true });
    }

    onTabKeydown(event, index) {
      const last = this.tabs.length - 1;
      const vertical = this.tablist?.getAttribute('aria-orientation') === 'vertical';
      const prevKey = vertical ? 'ArrowUp' : 'ArrowLeft';
      const nextKey = vertical ? 'ArrowDown' : 'ArrowRight';
      let next = null;

      if (event.key === nextKey) next = index === last ? 0 : index + 1;
      else if (event.key === prevKey) next = index === 0 ? last : index - 1;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = last;

      if (next === null) return;
      event.preventDefault();
      this.select(next, { focus: true, user: true });
    }

    /* ---------- Transitions (WAAPI) ---------- */
    // Smoothly resize the stage to the new card's height
    animateHeight(fromHeight) {
      this.heightAnimation?.cancel();
      if (!this.stage || !fromHeight || this.reducedMotion.matches) return;
      const toHeight = this.stage.offsetHeight;
      if (Math.abs(toHeight - fromHeight) < 2) return;
      this.heightAnimation = this.stage.animate(
        [{ height: `${fromHeight}px` }, { height: `${toHeight}px` }],
        { duration: 520, easing: EASE }
      );
    }

    animateSwap(from, to) {
      this.animations.forEach((animation) => animation.cancel());
      this.animations = [];
      this.panels.forEach((panel) => panel.classList.remove('is-leaving'));

      if (this.reducedMotion.matches || from < 0 || !this.panels[from].animate) return;

      const direction = to > from ? 1 : -1;
      const outgoing = this.panels[from];
      const incoming = this.panels[to];

      outgoing.classList.add('is-leaving');
      const out = outgoing.animate(
        [
          { opacity: 1, transform: 'translate3d(0, 0, 0)', filter: 'blur(0)' },
          { opacity: 0, transform: `translate3d(${-direction * 24}px, 0, 0) scale(0.985)`, filter: 'blur(6px)' },
        ],
        { duration: 360, easing: EASE, fill: 'forwards' }
      );
      out.finished
        .then(() => {
          outgoing.classList.remove('is-leaving');
          out.cancel();
        })
        .catch(() => {});

      const enter = incoming.animate(
        [
          { opacity: 0, transform: `translate3d(${direction * 32}px, 0, 0) scale(0.985)`, filter: 'blur(8px)' },
          { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)', filter: 'blur(0)' },
        ],
        { duration: 680, delay: 90, easing: EASE, fill: 'backwards' }
      );

      this.animations.push(out, enter);

      // Staggered reveal of the card's inner content
      incoming.querySelectorAll('[data-kb-ib-stagger], .kb-ib__visual').forEach((element, i) => {
        this.animations.push(
          element.animate(
            [
              { opacity: 0, transform: 'translate3d(0, 12px, 0)' },
              { opacity: 1, transform: 'translate3d(0, 0, 0)' },
            ],
            { duration: 620, delay: 200 + i * 60, easing: EASE, fill: 'backwards' }
          )
        );
      });
    }

    /* ---------- Scroll helpers ---------- */
    scrollTabIntoView(index, smooth = true) {
      const tab = this.tabs[index];
      const list = this.tablist;
      if (!tab || !list || list.scrollWidth <= list.clientWidth) return;
      const left = tab.offsetLeft - (list.clientWidth - tab.offsetWidth) / 2;
      list.scrollTo({ left, behavior: smooth && !this.reducedMotion.matches ? 'smooth' : 'auto' });
    }

    keepTriggerInView(index) {
      // Wait for the previous panel to collapse, then make sure the opened one is visible
      window.setTimeout(() => {
        const top = this.triggers[index].getBoundingClientRect().top;
        if (top < 0) {
          window.scrollBy({ top: top - 96, behavior: this.reducedMotion.matches ? 'auto' : 'smooth' });
        }
      }, 560);
    }

    /* ---------- Autoplay ---------- */
    setupAutoplay(signal) {
      const duration = parseInt(this.dataset.autoplay, 10);
      if (!duration || this.tabs.length < 2 || this.reducedMotion.matches) return;

      this.style.setProperty('--kb-ib-autoplay', `${duration}ms`);
      this.classList.add('is-autoplay');

      this.tabs.forEach((tab) => {
        tab.querySelector('[data-kb-ib-progress]')?.addEventListener(
          'animationend',
          () => {
            if (!this.classList.contains('is-autoplay') || this.isAccordion) return;
            this.select((this.active + 1) % this.tabs.length);
          },
          { signal }
        );
      });

      const pause = (reason) => {
        this.pauseReasons.add(reason);
        this.classList.add('is-paused');
      };
      const resume = (reason) => {
        this.pauseReasons.delete(reason);
        if (!this.pauseReasons.size) this.classList.remove('is-paused');
      };

      this.addEventListener('pointerenter', () => pause('hover'), { signal });
      this.addEventListener('pointerleave', () => resume('hover'), { signal });
      this.addEventListener('focusin', () => pause('focus'), { signal });
      this.addEventListener('focusout', (event) => {
        if (!this.contains(event.relatedTarget)) resume('focus');
      }, { signal });

      if ('IntersectionObserver' in window) {
        pause('offscreen');
        this.observer = new IntersectionObserver(
          ([entry]) => (entry.isIntersecting ? resume('offscreen') : pause('offscreen')),
          { threshold: 0.35 }
        );
        this.observer.observe(this);
      }
    }

    stopAutoplay() {
      this.classList.remove('is-autoplay', 'is-paused');
      this.observer?.disconnect();
    }

    /* ---------- Supplement Facts dialog ---------- */
    setupFactsDialog(signal) {
      const opener = this.querySelector('[data-kb-ib-facts-open]');
      const dialog = this.querySelector('[data-kb-ib-facts-dialog]');
      if (!opener || !dialog || typeof dialog.showModal !== 'function') return;

      opener.addEventListener('click', () => {
        dialog.showModal();
        document.documentElement.classList.add('kb-ib-lock');
      }, { signal });

      dialog.addEventListener('close', () => {
        document.documentElement.classList.remove('kb-ib-lock');
        opener.focus({ preventScroll: true });
      }, { signal });

      // Click on the backdrop closes the dialog
      dialog.addEventListener('click', (event) => {
        if (event.target === dialog) dialog.close();
      }, { signal });

      dialog.querySelectorAll('[data-kb-ib-facts-close]').forEach((button) => {
        button.addEventListener('click', () => dialog.close(), { signal });
      });
    }
  }

  customElements.define('kanbae-ingredients-breakdown', KanbaeIngredientsBreakdown);
})();
