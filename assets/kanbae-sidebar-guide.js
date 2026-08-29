document.querySelectorAll('[id^="KbSidebarGuide-"]').forEach((root) => {
  const nav = root.querySelector('[data-kb-sg-nav]');
  const links = Array.from(root.querySelectorAll('[data-kb-sg-link]'));
  const panels = Array.from(root.querySelectorAll('[data-kb-sg-panel]'));
  const indicator = root.querySelector('[data-kb-sg-indicator]');
  if (!nav || links.length < 2 || panels.length < 2) return;

  const isDesktop = () => window.matchMedia('(min-width: 990px)').matches;
  let activeLink = links[0];

  function moveIndicator(link) {
    if (!indicator) return;
    if (isDesktop()) {
      indicator.style.width = '';
      indicator.style.transform = `translateY(${link.offsetTop}px)`;
      indicator.style.height = `${link.offsetHeight}px`;
    } else {
      indicator.style.height = '';
      indicator.style.transform = `translateX(${link.offsetLeft}px)`;
      indicator.style.width = `${link.offsetWidth}px`;
    }
  }

  function scrollNavToLink(link) {
    // Scroll only the nav's own horizontal track (nav.scrollLeft), never
    // scrollIntoView: on mobile the nav sits in normal flow (not sticky),
    // so once the page scrolls past it, scrollIntoView's vertical "nearest"
    // check would yank the whole page back up to reveal the nav again.
    const linkLeft = link.offsetLeft;
    const linkRight = linkLeft + link.offsetWidth;
    const viewLeft = nav.scrollLeft;
    const viewRight = viewLeft + nav.clientWidth;
    const edgePadding = 16;

    if (linkLeft < viewLeft) {
      nav.scrollTo({ left: Math.max(linkLeft - edgePadding, 0), behavior: 'smooth' });
    } else if (linkRight > viewRight) {
      nav.scrollTo({ left: linkRight - nav.clientWidth + edgePadding, behavior: 'smooth' });
    }
  }

  function setActive(link, { scrollNavIntoView = false } = {}) {
    if (!link || link === activeLink) return;
    activeLink = link;

    links.forEach((otherLink) => {
      const isActive = otherLink === link;
      otherLink.classList.toggle('is-active', isActive);
      if (isActive) {
        otherLink.setAttribute('aria-current', 'true');
      } else {
        otherLink.removeAttribute('aria-current');
      }
    });

    moveIndicator(link);

    if (scrollNavIntoView && !isDesktop()) {
      scrollNavToLink(link);
    }
  }

  links.forEach((link) => {
    link.addEventListener('click', (event) => {
      const targetId = link.getAttribute('href').slice(1);
      const target = document.getElementById(targetId);
      if (!target) return;

      event.preventDefault();
      setActive(link);
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  const panelToLink = new Map();
  panels.forEach((panel) => {
    const link = links.find((candidate) => candidate.getAttribute('href') === `#${panel.id}`);
    if (link) panelToLink.set(panel, link);
  });

  let observer;
  // Persisted per-panel state: each IntersectionObserver callback only
  // reports entries whose state changed, not every panel's current state.
  // Tracking it ourselves lets us always pick the topmost panel that is
  // actually intersecting right now, instead of only the ones that just
  // changed in this batch (which could skip a still-visible panel).
  let intersecting;

  function pickActivePanel() {
    return panels.find((panel) => intersecting.get(panel)) || null;
  }

  function createObserver() {
    if (observer) observer.disconnect();
    intersecting = new Map(panels.map((panel) => [panel, false]));

    const headerHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 0;
    const topMargin = headerHeight + 32;

    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          intersecting.set(entry.target, entry.isIntersecting);
        });

        const activePanel = pickActivePanel();
        if (!activePanel) return;

        const link = panelToLink.get(activePanel);
        if (link) setActive(link, { scrollNavIntoView: true });
      },
      {
        root: null,
        rootMargin: `-${topMargin}px 0px -60% 0px`,
        threshold: 0,
      }
    );

    panels.forEach((panel) => observer.observe(panel));
  }

  createObserver();
  moveIndicator(activeLink);
  requestAnimationFrame(() => nav.classList.add('is-ready'));

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      moveIndicator(activeLink);
      createObserver();
    }, 150);
  });
});
