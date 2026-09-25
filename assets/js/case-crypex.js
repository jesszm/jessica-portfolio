/* JM · Case 02 · Crypex — hover a screen to see it whole.
   Mouse only. The screen grows up to its --zoom, but never past the window,
   and slides back inside it (below the toolbar) when it would spill over. */
(() => {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const TOP = 72, PAD = 16; // toolbar height + breathing room
  const shots = document.querySelectorAll('.cx-strip img, .cx-feature__shots img');

  // measure the screen at rest, even if it is still shrinking back
  const restRect = (img) => {
    const t = img.style.transition, tf = img.style.transform;
    img.style.transition = 'none'; img.style.transform = '';
    const r = img.getBoundingClientRect();
    img.style.transform = tf; void img.offsetWidth; img.style.transition = t;
    return r;
  };

  const zoom = (img) => {
    const r = restRect(img);
    const want = parseFloat(getComputedStyle(img).getPropertyValue('--zoom')) || 1.7;
    const s = Math.max(1, Math.min(want, (innerHeight - TOP - PAD) / r.height, (innerWidth - 2 * PAD) / r.width));
    const w = r.width * s, h = r.height * s;
    const left = r.left + (r.width - w) / 2, top = r.top + (r.height - h) / 2;
    let dx = 0, dy = 0;
    if (left < PAD) dx = PAD - left; else if (left + w > innerWidth - PAD) dx = innerWidth - PAD - (left + w);
    if (top < TOP) dy = TOP - top; else if (top + h > innerHeight - PAD) dy = innerHeight - PAD - (top + h);
    img.style.transform = `translate(${dx}px, ${dy}px) scale(${s})`;
    img.classList.add('is-zoomed');
  };
  const reset = (img) => { img.style.transform = ''; img.classList.remove('is-zoomed'); };

  shots.forEach((img) => {
    img.addEventListener('mouseenter', () => zoom(img));
    img.addEventListener('mouseleave', () => reset(img));
  });
  // a scrolled page would leave the zoomed screen out of place
  window.addEventListener('scroll', () => document.querySelectorAll('.is-zoomed').forEach(reset), { passive: true });
})();
