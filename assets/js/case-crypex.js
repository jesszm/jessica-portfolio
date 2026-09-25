/* JM · Case 02 · Crypex — click a screen to see it up close.
   Medium-style zoom: the screen flies from its place to the centre of the
   window over a paper backdrop, and back. Click, Esc or scroll to close.
   Works with mouse, touch and keyboard (Enter / Space). */
(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const shots = document.querySelectorAll('.cx-strip img, .cx-feature__shots img');
  const MARGIN = 32, TOP = 64; // keep clear of the edges and the toolbar
  let open = null;

  const close = () => {
    if (!open) return;
    const { img, clone, veil } = open;
    open = null;
    veil.classList.remove('is-open');
    clone.style.transform = '';
    let finished = false;
    const done = () => {
      if (finished) return; finished = true;
      clone.remove(); veil.remove(); img.style.visibility = ''; img.focus({ preventScroll: true });
    };
    if (reduced) done();
    else { clone.addEventListener('transitionend', done, { once: true }); setTimeout(done, 450); }
    removeEventListener('scroll', onScroll);
  };

  let startY = 0;
  const onScroll = () => { if (Math.abs(scrollY - startY) > 40) close(); };

  const zoom = (img) => {
    if (open) return close();
    const r = img.getBoundingClientRect();
    const veil = document.createElement('div');
    veil.className = 'cx-zoom';
    veil.addEventListener('click', close);
    const clone = img.cloneNode();
    clone.removeAttribute('tabindex'); clone.removeAttribute('role'); clone.removeAttribute('aria-label');
    clone.className = 'cx-zoom__img';
    Object.assign(clone.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    clone.addEventListener('click', close);
    document.body.append(veil, clone);
    img.style.visibility = 'hidden';

    // fit the window, never past the export's own size (2x files shown at 1x)
    const maxW = innerWidth - MARGIN * 2, maxH = innerHeight - TOP - MARGIN;
    const s = Math.min(maxW / r.width, maxH / r.height, (img.naturalWidth / 2) / r.width);
    const tx = innerWidth / 2 - (r.left + r.width / 2);
    const ty = TOP + maxH / 2 - (r.top + r.height / 2);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      veil.classList.add('is-open');
      clone.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
    }));
    open = { img, clone, veil };
    startY = scrollY;
    addEventListener('scroll', onScroll, { passive: true });
  };

  shots.forEach((img) => {
    img.tabIndex = 0;
    img.setAttribute('role', 'button');
    img.setAttribute('aria-label', `${window.JM_LANG === 'pt' ? 'Ver maior' : 'View larger'}: ${img.alt}`);
    img.addEventListener('click', () => zoom(img));
    img.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); zoom(img); } });
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  addEventListener('resize', close);
})();
