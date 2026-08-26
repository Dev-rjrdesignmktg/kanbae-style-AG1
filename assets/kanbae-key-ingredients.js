document.querySelectorAll('[id^="KbKeyIngTabs-"]').forEach((tablist) => {
  const tabs = Array.from(tablist.querySelectorAll('[data-kb-key-ing-tab]'));
  const wrapper = tablist.closest('.kb-key-ing');
  if (!wrapper || tabs.length < 2) return;

  function activate(tab, { focusTab = false } = {}) {
    tabs.forEach((otherTab) => {
      const isActive = otherTab === tab;
      otherTab.classList.toggle('is-active', isActive);
      otherTab.setAttribute('aria-selected', isActive ? 'true' : 'false');
      otherTab.setAttribute('tabindex', isActive ? '0' : '-1');
    });

    const targetId = tab.dataset.target;
    wrapper.querySelectorAll('[data-kb-key-ing-panel]').forEach((panel) => {
      const isActive = panel.id === targetId;
      panel.classList.toggle('is-active', isActive);
      panel.toggleAttribute('hidden', !isActive);
    });

    if (focusTab) tab.focus();
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => activate(tab));
  });

  tablist.addEventListener('keydown', (event) => {
    const currentIndex = tabs.indexOf(document.activeElement);
    if (currentIndex === -1) return;

    let nextIndex = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % tabs.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = tabs.length - 1;
    }

    if (nextIndex === null) return;
    event.preventDefault();
    activate(tabs[nextIndex], { focusTab: true });
  });
});
