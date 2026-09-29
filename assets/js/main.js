/* JM · Portfolio behaviours · v2.5.0
   Small, dependency-free. Everything degrades gracefully without JS. */
/* runs once the pt-BR text is in place (immediately in English), so it reads translated alt text and labels */
(window.jmI18nReady || Promise.resolve()).then(() => {
  const html = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} }
  };

  /* ---------- Light only (v2.2) ---------- */
  html.setAttribute('data-theme', 'light');
  store.set('jm-theme', 'light');

  /* ---------- Designer view: the grid easter egg ----------
     Option/Alt + G (or the pill) shows the 12-column grid and turns the pointer
     into an inspector: hover or tab to anything to read its size and type, like
     in Figma. The shortcut needs a modifier so a stray "g" (or a voice command)
     never toggles it (WCAG 2.1.4). */
  const gridBtn = document.querySelector('[data-action="grid"]');
  const fine = window.matchMedia('(pointer: fine)').matches;
  const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const keyName = mac ? '⌥G' : 'Alt+G';
  document.querySelectorAll('.grid-egg kbd').forEach((k) => { k.textContent = keyName; });
  gridBtn?.setAttribute('aria-keyshortcuts', 'Alt+G');
  let box = null, tag = null, toast = null, current = null;
  const ensureUi = () => {
    if (box) return;
    box = Object.assign(document.createElement('div'), { className: 'inspect-box' });
    tag = Object.assign(document.createElement('div'), { className: 'inspect-tag' });
    toast = Object.assign(document.createElement('div'), { className: 'inspect-toast' });
    toast.setAttribute('role', 'status');
    [box, tag, toast].forEach((el) => { el.setAttribute('aria-hidden', el === toast ? 'false' : 'true'); document.body.appendChild(el); });
  };
  const SKIP = /^(HTML|BODY|MAIN|SECTION|HEADER|FOOTER|NAV|CANVAS)$/;
  const describe = (el) => {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    const name = el.classList[0] ? `.${el.classList[0]}` : el.tagName.toLowerCase();
    let line = `${name} · ${Math.round(r.width)} × ${Math.round(r.height)}`;
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (hasText) {
      const fam = cs.fontFamily.split(',')[0].replace(/["']/g, '');
      const lh = cs.lineHeight === 'normal' ? 'auto' : Math.round(parseFloat(cs.lineHeight));
      line += ` · ${fam} ${Math.round(parseFloat(cs.fontSize))}/${lh} · ${cs.fontWeight}`;
    }
    return line;
  };
  const place = () => {
    if (!current || !box) return;
    const r = current.getBoundingClientRect();
    Object.assign(box.style, { transform: `translate(${r.left}px, ${r.top}px)`, width: `${r.width}px`, height: `${r.height}px` });
    const above = r.top > 28;
    tag.style.transform = `translate(${Math.max(4, Math.min(r.left, innerWidth - tag.offsetWidth - 4))}px, ${above ? r.top - 24 : r.bottom + 4}px)`;
  };
  const onOver = (e) => {
    let el = e.target;
    while (el && (SKIP.test(el.tagName) || el.classList?.contains('container') || el.closest?.('.inspect-box, .inspect-tag'))) el = el.parentElement;
    if (!el || el === current) return;
    current = el; tag.textContent = describe(el); html.classList.add('is-inspecting'); place();
  };
  const onOut = (e) => { if (!e.relatedTarget) { current = null; html.classList.remove('is-inspecting'); } };
  let toastTimer = 0;
  const setGrid = (on) => {
    html.setAttribute('data-grid', on ? 'on' : 'off');
    gridBtn?.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (!fine) return;
    ensureUi();
    if (on) {
      document.addEventListener('pointerover', onOver);
      document.addEventListener('pointerout', onOut);
      document.addEventListener('focusin', onOver);
      window.addEventListener('scroll', place, { passive: true });
      const first = store.get('jm-found-grid') !== '1';
      const pt = window.JM_LANG === 'pt';
      toast.textContent = first
        ? (pt ? `✦ Modo designer ativado: passe o mouse sobre qualquer elemento para inspecioná-lo. Aperte ${keyName} para fechar.` : `✦ Designer view on: hover anything to inspect it. Press ${keyName} to close.`)
        : (pt ? `Modo designer ativado · ${keyName} para fechar` : `Designer view on · ${keyName} to close`);
      store.set('jm-found-grid', '1');
      toast.classList.add('is-on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('is-on'), first ? 4200 : 1800);
    } else {
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('pointerout', onOut);
      document.removeEventListener('focusin', onOver);
      window.removeEventListener('scroll', place);
      current = null; html.classList.remove('is-inspecting'); toast.classList.remove('is-on');
    }
  };
  setGrid(false);

  /* one-time nudge: when the reader reaches the work, a sticky note points at the pill */
  const hintTarget = document.getElementById('work');
  let hint = null, hintTimer = 0;
  const hideHint = () => { if (!hint) return; hint.classList.remove('is-on'); clearTimeout(hintTimer); const h = hint; hint = null; setTimeout(() => h.remove(), 400); };
  const showHint = () => {
    const r = gridBtn.getBoundingClientRect();
    if (!r.width || html.getAttribute('data-grid') === 'on') return;
    const pt = window.JM_LANG === 'pt';
    hint = document.createElement('div');
    hint.className = 'egg-hint';
    hint.setAttribute('aria-hidden', 'true');
    hint.innerHTML = (pt ? '<b>psiu</b>Tem um modo designer aqui: o grid, as medidas e as fontes por trás de cada elemento.' : '<b>psst</b>There’s a designer view: the grid, sizes and fonts behind every element.')
      + '<svg viewBox="0 0 34 34"><path d="M6 31C9 20 17 12 28 6"/><path d="M20 5.5 28 6 26.5 13.5"/></svg>';
    hint.style.top = `${r.bottom + 34}px`;
    hint.style.left = `${Math.max(12, r.right - 210)}px`;
    hint.addEventListener('click', () => { hideHint(); setGrid(true); });
    document.body.appendChild(hint);
    requestAnimationFrame(() => requestAnimationFrame(() => hint && hint.classList.add('is-on')));
    hintTimer = setTimeout(hideHint, 9000);
    try { sessionStorage.setItem('jm-hint', '1'); } catch {}
  };
  const seenHint = () => { try { return sessionStorage.getItem('jm-hint') === '1'; } catch { return true; } };
  if (gridBtn && hintTarget && fine && store.get('jm-found-grid') !== '1' && !seenHint() && 'IntersectionObserver' in window) {
    const ho = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      ho.disconnect();
      setTimeout(showHint, 600);
    }, { threshold: 0.25 });
    ho.observe(hintTarget);
  }
  html.setAttribute('data-annotations', 'on');
  gridBtn?.addEventListener('click', () => { hideHint(); setGrid(html.getAttribute('data-grid') !== 'on'); });
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey) return;
    const t = (e.target && e.target.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(t) || e.target?.isContentEditable) return;
    if (e.altKey && e.code === 'KeyG') { e.preventDefault(); hideHint(); setGrid(html.getAttribute('data-grid') !== 'on'); }
    if (e.key === 'Escape') hideHint();
    if (e.key === 'Escape' && html.getAttribute('data-grid') === 'on') setGrid(false);
  });

  /* ---------- Mobile nav ---------- */
  const navToggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.toolbar__nav');
  navToggle?.addEventListener('click', () => {
    const open = nav.getAttribute('data-open') === 'true';
    nav.setAttribute('data-open', open ? 'false' : 'true');
    navToggle.setAttribute('aria-expanded', open ? 'false' : 'true');
  });
  nav?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => { nav.setAttribute('data-open', 'false'); navToggle?.setAttribute('aria-expanded', 'false'); }));

  /* ---------- Active section in nav (scroll-position based) ---------- */
  const trackNav = (selector) => {
    const links = [...document.querySelectorAll(selector)].filter(a => (a.getAttribute('href') || '').startsWith('#'));
    const pairs = links.map(a => ({ a, el: document.querySelector(a.getAttribute('href')) })).filter(p => p.el && !p.el.classList.contains('chapter'));
    if (!pairs.length) return;
    let last = 0, timer = null;
    const update = () => {
      const line = window.scrollY + window.innerHeight * 0.35;
      let current = null;
      for (const p of pairs) { if (p.el.offsetTop <= line) current = p; }
      if (window.scrollY < 8 && current && current.el.offsetTop > 8) current = null;
      pairs.forEach(p => p.a.setAttribute('aria-current', p === current ? 'true' : 'false'));
    };
    const schedule = () => {
      const now = Date.now();
      if (now - last > 40) { last = now; update(); }
      else { clearTimeout(timer); timer = setTimeout(update, 60); }
    };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    update();
  };
  trackNav('.toolbar__nav a');
  trackNav('.doc__nav a');

  /* ---------- Reveal on scroll (IO + direct check, so it never depends on frame timing) ---------- */
  const reveals = [...document.querySelectorAll('.reveal')];
  const revealCheck = () => {
    const vh = window.innerHeight;
    reveals.forEach(el => {
      if (el.classList.contains('is-in')) return;
      const r = el.getBoundingClientRect();
      if (r.top < vh * 0.92 && r.bottom > 0) el.classList.add('is-in');
    });
  };
  if (reduced) {
    reveals.forEach(el => el.classList.add('is-in'));
  } else {
    if ('IntersectionObserver' in window) {
      const ro = new IntersectionObserver((entries) => {
        entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('is-in'); ro.unobserve(en.target); } });
      }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
      reveals.forEach(el => ro.observe(el));
    }
    let rt = 0;
    const onScroll = () => { const now = Date.now(); if (now - rt > 60) { rt = now; revealCheck(); } };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    window.addEventListener('load', revealCheck);
    revealCheck();
    setTimeout(revealCheck, 400);
  }

  /* ---------- Comment pins: click to toggle, Esc to close ---------- */
  document.querySelectorAll('.pin').forEach(pin => {
    pin.setAttribute('tabindex', '0');
    pin.setAttribute('role', 'button');
    pin.setAttribute('aria-expanded', 'false');
    const toggle = () => {
      const open = pin.getAttribute('data-open') === 'true';
      document.querySelectorAll('.pin[data-open="true"]').forEach(p => { p.setAttribute('data-open', 'false'); p.setAttribute('aria-expanded', 'false'); });
      pin.setAttribute('data-open', open ? 'false' : 'true');
      pin.setAttribute('aria-expanded', open ? 'false' : 'true');
    };
    pin.addEventListener('click', toggle);
    pin.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.querySelectorAll('.pin[data-open="true"]').forEach(p => { p.setAttribute('data-open', 'false'); p.setAttribute('aria-expanded', 'false'); }); });

  /* ---------- Ribbon: pauses on hover, on focus, and on a click / tap / Enter (WCAG 2.2.2) ---------- */
  document.querySelectorAll('.marquee[role="button"]').forEach((rib) => {
    const flip = () => { const on = !rib.classList.contains('is-paused'); rib.classList.toggle('is-paused', on); rib.setAttribute('aria-pressed', on ? 'true' : 'false'); };
    rib.addEventListener('click', flip);
    rib.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });
  });

  /* The cursor is the real pointer restyled in CSS (identity.css), no JS follower. */

  /* ---------- Zoom readout (just for flavour) ---------- */
  const zoom = document.querySelector('[data-zoom]');
  if (zoom) {
    const update = () => { zoom.textContent = Math.round((window.devicePixelRatio || 1) * 100 / (window.devicePixelRatio || 1)) + '%'; };
    update();
  }

  /* ---------- Year ---------- */
  document.querySelectorAll('[data-year]').forEach(el => el.textContent = new Date().getFullYear());
});
