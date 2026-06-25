/* atak-loader.js — injects the ATAK loading screen and the dagger brand mark.
 * Runs on every window open (real overlay + preview). The Katarina centerpiece
 * is easy to swap for a dancing-Katarina GIF: set KATA_SRC to the gif URL/path.
 */
(function () {
  // Katarina art. Swap to a dancing-Katarina .gif here when you have one.
  var KATA_SRC = 'https://ddragon.leagueoflegends.com/cdn/img/champion/loading/Katarina_0.jpg';

  // Katarina-style dagger, used in the loader and the brand mark.
  var DAGGER =
    '<svg class="akl-dagger-svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<path d="M12 1.2l1.85 12.4-1.85 2.5-1.85-2.5L12 1.2z"/>' +
    '<path d="M7.3 14.0h9.4v1.6H7.3z"/>' +
    '<path d="M11.05 15.8h1.9v4.9l-.95 1.1-.95-1.1z"/>' +
    '</svg>';

  function dagger(cls) {
    return DAGGER.replace('class="akl-dagger-svg"', 'class="' + cls + '"');
  }

  function build() {
    if (document.getElementById('atak-loader')) return;

    var el = document.createElement('div');
    el.id = 'atak-loader';
    el.innerHTML =
      '<div class="akl-stage">' +
        '<div class="akl-halo"></div>' +
        '<img class="akl-kata" src="' + KATA_SRC + '" alt="" ' +
          'onerror="this.style.display=\'none\'" />' +
        '<div class="akl-ring">' +
          '<div class="akl-d d1">' + DAGGER + '</div>' +
          '<div class="akl-d d2">' + DAGGER + '</div>' +
          '<div class="akl-d d3">' + DAGGER + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="akl-word">' + dagger('akl-mark') + 'atak</div>' +
      '<div class="akl-sub">AI Companion</div>' +
      '<div class="akl-bar"><i></i></div>';
    document.body.appendChild(el);

    // Brand mark — replace the generic gem with the Katarina dagger.
    var gem = document.getElementById('brand-gem');
    if (gem) {
      gem.innerHTML = dagger('brand-dagger');
      gem.style.color = '#e23b4e';
      gem.style.clipPath = 'none';
      gem.style.background = 'linear-gradient(135deg, rgba(226,59,78,.16), rgba(226,59,78,.04))';
      var svg = gem.querySelector('svg');
      if (svg) { svg.style.width = '62%'; svg.style.height = '62%'; }
    }
  }

  function hide() {
    var el = document.getElementById('atak-loader');
    if (!el) return;
    el.classList.add('akl-hide');
    setTimeout(function () { if (el && el.parentNode) el.parentNode.removeChild(el); }, 650);
  }
  // Exposed so the overlay can dismiss it as soon as real data arrives.
  window.atakHideLoader = hide;

  function init() {
    build();
    // Minimum on-screen time so the animation is appreciated, then fade out.
    setTimeout(hide, 1900);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
