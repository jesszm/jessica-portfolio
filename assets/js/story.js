/* JM · Story orchestration — v3.2.0
   GSAP ScrollTrigger pins the canvas and scrubs the story; Lenis smooths the
   scroll and stays in sync through gsap.ticker. Falls back to static stills for
   prefers-reduced-motion, ?motion=reduced, missing WebGL or missing libraries. */

import { createStory } from './story-scene.js?v=8';

const html = document.documentElement;
const params = new URLSearchParams(window.location.search);
const reduced = params.get('motion') === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const small = window.matchMedia('(max-width: 820px), (pointer: coarse)').matches;

const story = document.querySelector('.story');
const stage = story?.querySelector('.story__stage');
const canvas = story?.querySelector('.story__canvas');
const cut = story?.querySelector('.story__cut');
const bar = story?.querySelector('.story__progress span');
const chapters = story ? [...story.querySelectorAll('.chapter')] : [];
const railLinks = story ? [...story.querySelectorAll('.story__rail a')] : [];
const processLink = document.querySelector('.toolbar__nav a[data-process]');

function navOffset() {
  const toolbar = document.querySelector('.toolbar');
  return toolbar ? toolbar.offsetHeight + 8 : 0;
}


let scene = null;
if (story && canvas) {
  try {
    scene = createStory(canvas, { quality: small ? 'low' : 'high' });
  } catch (err) {
    console.warn('[story] WebGL unavailable, using the static fallback.', err);
  }
}

const libsReady = Boolean(window.gsap && window.ScrollTrigger && window.Lenis);

if (story && scene && libsReady && !reduced) {
  cinematic();
} else if (story) {
  staticMode();
}

/* ---------------------------------------------------------------------- */

function cinematic() {
  html.classList.add('is-cinematic');
  html.classList.remove('is-static');

  const { gsap, ScrollTrigger, Lenis } = window;
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  const lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.95, anchors: false });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  const state = { p: 0 };
  const distance = () => window.innerHeight * (small ? 7 : 10);

  const draw = () => {
    scene.setProgress(state.p);
    if (cut) cut.style.opacity = scene.cutOpacity(state.p).toFixed(3);
    if (bar) bar.style.transform = `scaleX(${state.p.toFixed(4)})`;
    if (bar) bar.parentElement.classList.toggle('is-done', state.p > 0.985);
  };

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: story,
      start: 'top top',
      end: () => `+=${distance()}`,
      pin: stage,
      scrub: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: syncUi,
      onRefresh: syncUi,
    },
  });

  tl.to(state, { p: 1, duration: 1, onUpdate: draw }, 0);

  chapters.forEach((el) => {
    const a = Number(el.dataset.in);
    const b = el.dataset.out ? Number(el.dataset.out) : null;
    if (a > 0) {
      tl.fromTo(el, { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.014, ease: 'power2.out' }, a);
    }
    if (b !== null) {
      tl.to(el, { autoAlpha: 0, y: -32, duration: 0.012, ease: 'power2.in' }, b);
    }
  });

  function syncUi() {
    const p = state.p;
    if (bar && tl.scrollTrigger) bar.parentElement.classList.toggle('is-done', tl.scrollTrigger.progress > 0.985);
    let current = 0;
    chapters.forEach((el, i) => { if (p >= Number(el.dataset.in) - 0.005) current = i; });
    railLinks.forEach((a, i) => a.setAttribute('aria-current', i === current ? 'step' : 'false'));
    if (processLink) {
      const inProcess = tl.scrollTrigger.isActive && p > 0.165 && p < 0.83;
      processLink.setAttribute('aria-current', inProcess ? 'true' : 'false');
    }
  }

  /* render loop: ambient life only while the stage is on screen */
  let visible = true;
  const io = new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; }, { threshold: 0 });
  io.observe(stage);
  gsap.ticker.add((time) => {
    if (visible && !document.hidden) scene.render(time);
  });

  const onResize = () => { scene.resize(); draw(); };
  window.addEventListener('resize', onResize);

  /* anchors: chapters map to story progress, everything else scrolls through Lenis */
  function scrollToTarget(el, immediate = false) {
    const st = tl.scrollTrigger;
    if (el.classList.contains('chapter')) {
      const y = st.start + (st.end - st.start) * Number(el.dataset.at);
      lenis.scrollTo(y, { duration: 1.8, immediate });
    } else if (el === story) {
      lenis.scrollTo(0, { duration: 1.6, immediate });
    } else {
      lenis.scrollTo(el, { offset: -navOffset(), duration: 1.6, immediate });
    }
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented) return;
    const id = decodeURIComponent(a.getAttribute('href').slice(1));
    const el = id && document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    scrollToTarget(el);
    if (window.history.replaceState) window.history.replaceState(null, '', `#${id}`);
  });

  draw();
  syncUi();
  /* setTimeout, not rAF: rAF is paused in background tabs, which would leave
     the canvas hidden and deep links unapplied until the tab is focused */
  setTimeout(() => html.classList.add('is-ready'), 0);

  /* deep links (#research, #work…) only after layout and fonts settle,
     otherwise the pin distance is measured too early */
  if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
  const initialId = decodeURIComponent(window.location.hash.slice(1));
  if (initialId) window.history.replaceState(null, '', window.location.pathname + window.location.search);
  const loaded = new Promise((resolve) => {
    if (document.readyState === 'complete') resolve();
    else window.addEventListener('load', resolve, { once: true });
  });
  Promise.all([loaded, document.fonts ? document.fonts.ready : Promise.resolve()]).then(() => {
    ScrollTrigger.refresh();
    lenis.resize();
    const el = initialId && document.getElementById(initialId);
    if (!el) return;
    setTimeout(() => {
      scrollToTarget(el, true);
      window.history.replaceState(null, '', `#${initialId}`);
      /* a second pass absorbs any late layout shift (images, pin spacing) */
      setTimeout(() => { lenis.resize(); scrollToTarget(el, true); }, 180);
    }, 30);
  });

  window.__story = { scene, tl, lenis, state, scrollToTarget };
}

function staticMode() {
  html.classList.remove('is-cinematic');
  html.classList.add('is-static');
  if (!scene) return;
  scene.ready.then(() => shots());
}

function shots() {
  const portrait = window.innerWidth < 820;
  const w = portrait ? 720 : 1280;
  const h = portrait ? 960 : 760;
  chapters.forEach((el) => {
    const at = Number(el.dataset.shot ?? el.dataset.at);
    const url = scene.snapshot(at, w, h);
    el.style.setProperty('--shot', `url("${url}")`);
  });
  scene.dispose();
  html.classList.add('is-ready');
}
