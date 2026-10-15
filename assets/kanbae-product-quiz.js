if (!customElements.get('kanbae-quiz')) {
  class KanbaeQuiz extends HTMLElement {
    connectedCallback() {
      this.questions = Array.from(this.querySelectorAll('[data-step="question"]'));
      this.loader = this.querySelector('[data-step="loader"]');
      this.resultStep = this.querySelector('[data-step="result"]');
      // Ascending by threshold so the last one that fits is the best match.
      this.results = Array.from(this.querySelectorAll('[data-result]')).sort(
        (a, b) => Number(a.dataset.minScore) - Number(b.dataset.minScore)
      );
      this.backButton = this.querySelector('[data-quiz-back]');
      this.progressLabel = this.querySelector('[data-quiz-progress-label]');
      this.progressFill = this.querySelector('[data-quiz-progress-fill]');
      this.loaderText = this.querySelector('[data-quiz-loader-text]');

      this.loaderDuration = Number(this.dataset.loaderDuration) || 2000;
      this.stepLabel = this.dataset.stepLabel || '[current] / [total]';
      try {
        this.messages = JSON.parse(this.dataset.messages || '[]')
          .map((m) => m.trim())
          .filter(Boolean);
      } catch (e) {
        this.messages = [];
      }

      this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.answers = new Array(this.questions.length).fill(null);
      this.index = 0;
      this.current = this.questions[0];
      this.timers = [];
      this.transitionToken = 0;

      this.onClick = this.onClick.bind(this);
      this.onBlockSelect = this.onBlockSelect.bind(this);
      this.addEventListener('click', this.onClick);
      if (window.Shopify && Shopify.designMode) {
        document.addEventListener('shopify:block:select', this.onBlockSelect);
      }

      this.updateChrome();
    }

    disconnectedCallback() {
      this.removeEventListener('click', this.onClick);
      document.removeEventListener('shopify:block:select', this.onBlockSelect);
      this.clearTimers();
    }

    /* ---------- Events ---------- */

    onClick(event) {
      const option = event.target.closest('.kb-quiz__option');
      if (option) return this.selectOption(option);
      if (event.target.closest('[data-quiz-back]')) return this.goBack();
      if (event.target.closest('[data-quiz-restart]')) return this.restart();
      const apply = event.target.closest('[data-quiz-apply]');
      if (apply) return this.applyRecommendation(apply);
    }

    // Theme editor: jump to whichever question/result block the merchant selects.
    onBlockSelect(event) {
      if (event.detail.sectionId !== this.dataset.sectionId) return;
      const target = this.querySelector(`[data-block-id="${event.detail.blockId}"]`);
      if (!target) return;
      this.clearTimers();
      if (target.dataset.step === 'question') {
        this.index = Number(target.dataset.index);
        this.showStep(target, 1, { animate: false });
      } else if (target.hasAttribute('data-result')) {
        this.revealResult(target);
        this.showStep(this.resultStep, 1, { animate: false });
      }
    }

    /* ---------- Flow ---------- */

    selectOption(option) {
      if (this.locked) return;
      const step = option.closest('[data-step="question"]');
      step.querySelectorAll('.kb-quiz__option').forEach((el) => {
        el.setAttribute('aria-pressed', String(el === option));
      });
      this.answers[Number(step.dataset.index)] = {
        question: step.querySelector('.kb-quiz__question').textContent.trim(),
        answer: option.dataset.value,
        weight: Number(option.dataset.weight) || 0,
      };

      // Short pause so the shopper sees their pick confirmed before auto-advancing.
      this.locked = true;
      this.later(() => {
        this.locked = false;
        if (this.index < this.questions.length - 1) {
          this.index += 1;
          this.showStep(this.questions[this.index], 1);
        } else {
          this.analyze();
        }
      }, this.reducedMotion ? 120 : 360);
    }

    goBack() {
      if (this.locked || this.current.dataset.step !== 'question' || this.index === 0) return;
      this.index -= 1;
      this.showStep(this.questions[this.index], -1);
    }

    restart() {
      this.clearTimers();
      this.locked = false;
      this.answers.fill(null);
      this.index = 0;
      this.querySelectorAll('.kb-quiz__option').forEach((el) => el.setAttribute('aria-pressed', 'false'));
      this.querySelectorAll('[data-quiz-apply]').forEach((btn) => this.resetApplyButton(btn));
      this.showStep(this.questions[0], -1);
    }

    analyze() {
      this.showStep(this.loader, 1);

      // Rotate the loader copy evenly across the loader duration.
      if (this.messages.length > 1) {
        const slot = this.loaderDuration / this.messages.length;
        this.messages.slice(1).forEach((message, i) => {
          this.later(() => this.swapLoaderText(message), slot * (i + 1));
        });
      }

      const score = this.score();
      const match = this.pickResult(score);
      this.later(() => {
        this.revealResult(match);
        this.showStep(this.resultStep, 1);
        this.dispatchEvent(
          new CustomEvent('kanbae:quiz:complete', {
            bubbles: true,
            detail: { score, answers: this.answers, variantId: match.dataset.variantId || null },
          })
        );
      }, this.loaderDuration);
    }

    // Picked weights as a % of the max weight available across all questions.
    score() {
      let total = 0;
      let max = 0;
      this.questions.forEach((question, i) => {
        const weights = Array.from(question.querySelectorAll('.kb-quiz__option')).map(
          (el) => Number(el.dataset.weight) || 0
        );
        max += Math.max(0, ...weights);
        total += this.answers[i] ? this.answers[i].weight : 0;
      });
      return max ? Math.round((total / max) * 100) : 0;
    }

    pickResult(score) {
      let match = this.results[0];
      this.results.forEach((result) => {
        if (score >= Number(result.dataset.minScore)) match = result;
      });
      return match;
    }

    revealResult(match) {
      this.results.forEach((result) => {
        result.hidden = result !== match;
      });
    }

    swapLoaderText(message) {
      if (!this.loaderText) return;
      this.loaderText.classList.add('is-swapping');
      this.later(() => {
        this.loaderText.textContent = message;
        this.loaderText.classList.remove('is-swapping');
      }, 250);
    }

    /* ---------- Transitions ---------- */

    showStep(next, direction = 1, { animate = true } = {}) {
      const prev = this.current;
      const token = ++this.transitionToken;
      const useMotion = animate && !this.reducedMotion;
      this.current = next;

      const enter = () => {
        if (token !== this.transitionToken) return;
        this.querySelectorAll('[data-step]').forEach((step) => {
          if (step !== next) step.hidden = true;
          step.classList.remove('is-leaving', 'is-entering');
        });
        if (next === this.loader) this.resetLoader();
        next.style.setProperty('--kb-quiz-dir', direction);
        next.hidden = false;
        if (useMotion) {
          next.classList.add('is-entering');
          next.addEventListener('animationend', () => next.classList.remove('is-entering'), { once: true });
        }
        this.updateChrome();
        if (animate) this.focusStep(next);
      };

      if (prev && prev !== next && useMotion) {
        prev.style.setProperty('--kb-quiz-dir', direction);
        prev.classList.add('is-leaving');
        this.later(enter, 220);
      } else {
        enter();
      }
    }

    resetLoader() {
      if (this.loaderText && this.messages.length) this.loaderText.textContent = this.messages[0];
      // Restart the CSS fill animation from zero.
      const fill = this.loader.querySelector('.kb-quiz__loader-fill');
      if (fill) {
        fill.style.animation = 'none';
        void fill.offsetWidth;
        fill.style.animation = '';
      }
    }

    focusStep(step) {
      const heading = step.querySelector('.kb-quiz__question, .kb-quiz__loader-text, [data-result]:not([hidden]) .kb-quiz__result-title');
      if (heading) heading.focus({ preventScroll: true });

      // On mobile the card can scroll out of view between steps; bring its top back.
      const top = this.getBoundingClientRect().top;
      if (top < 0) {
        this.scrollIntoView({ behavior: this.reducedMotion ? 'auto' : 'smooth', block: 'start' });
      }
    }

    updateChrome() {
      const total = this.questions.length;
      const isQuestion = this.current && this.current.dataset.step === 'question';
      const current = isQuestion ? this.index + 1 : total;
      const progress = isQuestion ? (this.index / total) * 100 : 100;

      this.progressFill.style.width = `${progress}%`;
      this.progressLabel.textContent = this.stepLabel
        .replace('[current]', current)
        .replace('[total]', total);
      this.backButton.hidden = !isQuestion || this.index === 0;
    }

    /* ---------- Apply recommendation to the PDP ---------- */

    async applyRecommendation(button) {
      if (button.getAttribute('aria-busy') === 'true') return;
      const panel = button.closest('[data-result]');
      const variantId = panel.dataset.variantId;
      let values = [];
      try {
        values = JSON.parse(panel.dataset.variantOptions || '[]');
      } catch (e) {}

      button.setAttribute('aria-busy', 'true');
      const picker = this.findPicker();

      if (picker && values.length) {
        await this.selectVariant(values);
      } else if (!picker && variantId && Number(button.dataset.variantCount) > 1) {
        // No native picker on the page: load the PDP with the variant preselected.
        window.location.href = `${button.dataset.productUrl}?variant=${variantId}`;
        return;
      }

      button.removeAttribute('aria-busy');
      const label = button.querySelector('[data-quiz-cta-label]');
      if (label && button.dataset.appliedLabel) {
        label.dataset.originalLabel = label.dataset.originalLabel || label.textContent;
        label.textContent = button.dataset.appliedLabel;
      }

      const buyBox = document.querySelector('product-info') || document.querySelector('product-form');
      if (buyBox) buyBox.scrollIntoView({ behavior: this.reducedMotion ? 'auto' : 'smooth', block: 'start' });
    }

    resetApplyButton(button) {
      button.removeAttribute('aria-busy');
      const label = button.querySelector('[data-quiz-cta-label]');
      if (label && label.dataset.originalLabel) label.textContent = label.dataset.originalLabel;
    }

    findPicker() {
      return document.querySelector('product-info variant-selects') || document.querySelector('variant-selects');
    }

    // Changes one option at a time and waits for Dawn to re-render the picker
    // (it swaps the DOM after each change) before touching the next option.
    async selectVariant(values) {
      for (let i = 0; i < values.length; i++) {
        const picker = this.findPicker();
        if (!picker) return;
        const group = picker.querySelectorAll('fieldset, .product-form__input--dropdown')[i];
        if (!group) continue;

        let changed = false;
        const select = group.querySelector('select');
        if (select) {
          const option = Array.from(select.options).find(
            (o) => o.value === values[i] || o.textContent.trim() === values[i]
          );
          if (option && !option.selected) {
            select.value = option.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            changed = true;
          }
        } else {
          const input = Array.from(group.querySelectorAll('input[type="radio"]')).find(
            (el) => el.value === values[i]
          );
          if (input && !input.checked) {
            input.checked = true;
            input.dispatchEvent(new Event('change', { bubbles: true }));
            changed = true;
          }
        }
        if (changed) await this.waitForVariantChange();
      }
    }

    waitForVariantChange() {
      return new Promise((resolve) => {
        let unsubscribe;
        const done = () => {
          clearTimeout(timeout);
          if (unsubscribe) unsubscribe();
          resolve();
        };
        const timeout = setTimeout(done, 1500);
        if (typeof subscribe === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
          unsubscribe = subscribe(PUB_SUB_EVENTS.variantChange, done);
        }
      });
    }

    /* ---------- Timers ---------- */

    later(fn, ms) {
      const id = setTimeout(fn, ms);
      this.timers.push(id);
      return id;
    }

    clearTimers() {
      this.timers.forEach(clearTimeout);
      this.timers = [];
    }
  }

  customElements.define('kanbae-quiz', KanbaeQuiz);
}
