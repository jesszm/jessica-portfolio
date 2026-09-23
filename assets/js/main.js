/* JM · Portfolio behaviours — v1.0.0
   Small, dependency-free. Everything degrades gracefully without JS. */
(() => {
  const html = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} }
  };

  /* ---------- Theme ---------- */
  const themeBtn = document.querySelector('[data-action="theme"]');
  const applyTheme = (t) => {
    if (t) html.setAttribute('data-theme', t); else html.removeAttribute('data-theme');
    if (themeBtn) {
      const dark = (t || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';
      themeBtn.setAttribute('aria-pressed', dark ? 'true' : 'false');
      themeBtn.querySelector('.label') && (themeBtn.querySelector('.label').textContent = dark ? 'Dark' : 'Light');
    }
  };
  applyTheme(store.get('jm-theme') || 'light');
  themeBtn?.addEventListener('click', () => {
    const current = html.getAttribute('data-theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = current === 'dark' ? 'light' : 'dark';
    store.set('jm-theme', next); applyTheme(next);
  });

  /* ---------- Grid & annotation toggles ---------- */
  const gridBtn = document.querySelector('[data-action="grid"]');
  const annoBtn = document.querySelector('[data-action="annotations"]');
  const setGrid = (on) => { html.setAttribute('data-grid', on ? 'on' : 'off'); gridBtn?.setAttribute('aria-pressed', on ? 'true' : 'false'); };
  const setAnno = (on) => { html.setAttribute('data-annotations', on ? 'on' : 'off'); annoBtn?.setAttribute('aria-pressed', on ? 'true' : 'false'); };
  setGrid(false); setAnno(true);
  gridBtn?.addEventListener('click', () => setGrid(html.getAttribute('data-grid') !== 'on'));
  annoBtn?.addEventListener('click', () => setAnno(html.getAttribute('data-annotations') !== 'on'));
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = (e.target && e.target.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag) || e.target?.isContentEditable) return;
    if (e.key === 'g' || e.key === 'G') setGrid(html.getAttribute('data-grid') !== 'on');
    if (e.key === 'a' || e.key === 'A') setAnno(html.getAttribute('data-annotations') !== 'on');
    if (e.key === 'd' || e.key === 'D') themeBtn?.click();
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
    const toggle = () => {
      const open = pin.getAttribute('data-open') === 'true';
      document.querySelectorAll('.pin[data-open="true"]').forEach(p => p.setAttribute('data-open', 'false'));
      pin.setAttribute('data-open', open ? 'false' : 'true');
    };
    pin.addEventListener('click', toggle);
    pin.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.querySelectorAll('.pin[data-open="true"]').forEach(p => p.setAttribute('data-open', 'false')); });

  /* ---------- Multiplayer cursor (desktop, pointer:fine, no reduced motion) ---------- */
  const cursor = document.querySelector('.cursor');
  const fine = window.matchMedia('(pointer: fine)').matches;
  if (cursor && fine && !reduced) {
    let tx = -100, ty = -100, cx = -100, cy = -100, raf = null, visible = false;
    const zone = document.querySelector('[data-cursor-zone]') || document.body;
    const step = () => {
      cx += (tx - cx) * 0.14; cy += (ty - cy) * 0.14;
      cursor.style.transform = `translate(${cx.toFixed(1)}px, ${cy.toFixed(1)}px)`;
      if (Math.abs(tx - cx) > 0.2 || Math.abs(ty - cy) > 0.2) raf = requestAnimationFrame(step); else raf = null;
    };
    zone.addEventListener('pointermove', (e) => {
      tx = e.clientX + 14; ty = e.clientY + 12;
      if (!visible) { visible = true; cursor.classList.add('is-on'); }
      if (!raf) raf = requestAnimationFrame(step);
    });
    zone.addEventListener('pointerleave', () => { visible = false; cursor.classList.remove('is-on'); });
  }

  /* ---------- Zoom readout (just for flavour) ---------- */
  const zoom = document.querySelector('[data-zoom]');
  if (zoom) {
    const update = () => { zoom.textContent = Math.round((window.devicePixelRatio || 1) * 100 / (window.devicePixelRatio || 1)) + '%'; };
    update();
  }

  /* ---------- Year ---------- */
  document.querySelectorAll('[data-year]').forEach(el => el.textContent = new Date().getFullYear());
})();
