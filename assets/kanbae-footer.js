(function () {
  var accordions = document.querySelectorAll('.kb-ftr__accordion');
  if (!accordions.length) return;

  var mq = window.matchMedia('(min-width: 750px)');

  function sync(e) {
    accordions.forEach(function (details) {
      details.open = e.matches;
    });
  }

  sync(mq);
  mq.addEventListener('change', sync);
})();
