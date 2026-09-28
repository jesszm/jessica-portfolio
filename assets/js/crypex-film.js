/* JM · Case 02 · Crypex — the scroll film, v1.0.0
   A short film in real-time 3D, built only from the real exported screens.
   The brand's diagonal plane of light (the one that continues the X) sweeps
   through graphite; the wordmark lights up; a phone rises with the home
   screen; six draft screens fan out and fold into one converter; the pay flow
   runs amount → recipient → review; the light turns and the payment lands.

   setProgress(p) is deterministic (0..1): scrolling back always rewinds.
   GSAP ScrollTrigger pins the frame and scrubs p; Lenis smooths the scroll
   and stays in sync through gsap.ticker. Reduced motion, no WebGL or missing
   libraries keep the static cover. */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const range = (p, a, b) => clamp01((p - a) / (b - a));
const smooth = (t) => t * t * (3 - 2 * t);
const ease = (p, a, b) => smooth(range(p, a, b));
const lerp = (a, b, t) => a + (b - a) * t;

const html = document.documentElement;
const params = new URLSearchParams(location.search);
const reduced = params.get('motion') === 'reduced' || matchMedia('(prefers-reduced-motion: reduce)').matches;
const small = matchMedia('(max-width: 820px), (pointer: coarse)').matches;

const film = document.querySelector('.cx-film');
const stage = film?.querySelector('.cx-film__stage');
const canvas = film?.querySelector('.cx-film__canvas');
const bar = film?.querySelector('.cx-film__progress span');
const chapters = film ? [...film.querySelectorAll('.cx-film__chapter')] : [];
const IMG = '../assets/img/crypex/';

/* ---------------------------------------------------------------- scene */

function createFilm(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !small, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, small ? 1.25 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(28, 16 / 9, 0.1, 50);
  camera.position.set(0, 0, 4.2);

  /* background: graphite with the brand's diagonal plane of light, turning to the light side at the end */
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      depthWrite: false, depthTest: false,
      uniforms: { uEdge: { value: 1.4 }, uLight: { value: 0 }, uAspect: { value: 16 / 9 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }',
      fragmentShader: `
        varying vec2 vUv; uniform float uEdge; uniform float uLight; uniform float uAspect;
        void main(){
          vec2 p = vec2((vUv.x - 0.5) * uAspect, vUv.y - 0.5);
          // the X stroke leans ~58 degrees: its normal points down-right
          vec2 n = normalize(vec2(0.914, -0.406));
          float d = dot(p, n) - uEdge;
          float lit = smoothstep(0.0, 0.004, d);
          vec3 darkBase = vec3(0.106), darkLit = vec3(0.165);
          vec3 lightBase = vec3(0.925), lightLit = vec3(0.968);
          vec3 base = mix(darkBase, lightBase, uLight), hi = mix(darkLit, lightLit, uLight);
          vec3 c = mix(base, hi, lit * (0.85 - 0.35 * clamp(d * 0.8, 0.0, 1.0)));
          float v = smoothstep(1.25, 0.2, length(p * vec2(0.9, 1.3)));
          c *= mix(0.82, 1.0, v);
          gl_FragColor = vec4(c, 1.0);
        }`,
    })
  );
  bg.frustumCulled = false;
  bg.renderOrder = -10;
  scene.add(bg);

  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const key = new THREE.DirectionalLight(0xfff3e0, 1.6);
  key.position.set(2.5, 2.5, 3);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xc9d6ff, 0.9);
  rim.position.set(-3, 1, -2);
  scene.add(rim);

  /* textures: only the real exports */
  const loader = new THREE.TextureLoader();
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const tex = (name) => {
    const t = loader.load(IMG + name);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, maxAniso);
    return t;
  };
  const T = {
    logo: tex('logo-light.webp'),
    home: tex('home.webp'),
    amount: tex('pay-amount.webp'),
    recipient: tex('pay-recipient.webp'),
    review: tex('pay-review.webp'),
    success: tex('pay-success.webp'),
    drafts: [1, 2, 3, 4, 5, 6].map((n) => tex(`draft-${n}.webp`)),
  };

  /* the wordmark */
  const LOGO_W = 1.35;
  const logo = new THREE.Mesh(
    new THREE.PlaneGeometry(LOGO_W, LOGO_W * 135 / 406),
    new THREE.MeshBasicMaterial({ map: T.logo, transparent: true, opacity: 0, depthWrite: false, toneMapped: false })
  );
  scene.add(logo);

  /* a phone: rounded graphite body, the export as its screen (corners are already transparent) */
  const SW = 0.44, SH = SW * 1704 / 786;
  const bodyGeo = new RoundedBoxGeometry(SW + 0.03, SH + 0.03, 0.05, 6, 0.07);
  const screenGeo = new THREE.PlaneGeometry(SW, SH);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1e, metalness: 0.55, roughness: 0.32 });
  function phone(map) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    const screen = new THREE.Mesh(screenGeo, new THREE.MeshBasicMaterial({ map, transparent: true, toneMapped: false }));
    screen.position.z = 0.0262;
    g.add(body, screen);
    g.userData.screen = screen;
    return g;
  }
  const hero = phone(T.home);
  // a second screen in front of the first crossfades between steps of the flow
  const next = new THREE.Mesh(screenGeo, new THREE.MeshBasicMaterial({ map: T.amount, transparent: true, opacity: 0, toneMapped: false }));
  next.position.z = 0.0264;
  hero.add(next);
  scene.add(hero);

  const drafts = T.drafts.map((t) => { const d = phone(t); d.visible = false; scene.add(d); return d; });

  /* the flow, in order: [progress where the screen is fully in, texture] */
  const FLOW = [[0, T.home], [0.44, T.amount], [0.6, T.recipient], [0.71, T.review], [0.85, T.success]];
  const FADE = 0.035;
  function screens(p) {
    let i = 0;
    while (i + 1 < FLOW.length && p >= FLOW[i + 1][0] - FADE) i++;
    const [at, map] = FLOW[i];
    const prev = FLOW[Math.max(0, i - 1)][1];
    const t = i === 0 ? 1 : ease(p, at - FADE, at);
    hero.userData.screen.material.map = t < 1 ? prev : map;
    next.material.map = map;
    next.material.opacity = t < 1 ? t : 0;
  }

  const side = small ? 0 : 0.62;  // phone sits right of the text on wide screens
  const baseY = small ? 0.28 : 0;
  let floatT = 0;
  let P = 0;
  // set in resize(): the wordmark fits narrow frames, and the light's edge meets its X
  let logoFit = 1, edgeAtX = 0.23;

  function setProgress(p) {
    P = p;
    // light plane sweeps in, then turns the whole frame light at the end
    bg.material.uniforms.uEdge.value = lerp(1.4, edgeAtX, ease(p, 0, 0.1)) + lerp(0, -2.2, ease(p, 0.86, 0.97));
    bg.material.uniforms.uLight.value = ease(p, 0.88, 0.98);

    // wordmark lights up, then lifts away
    logo.material.opacity = ease(p, 0.02, 0.08) * (1 - ease(p, 0.12, 0.18));
    logo.position.set(0, lerp(0, 0.55, ease(p, 0.12, 0.2)), 0.2);
    logo.scale.setScalar(logoFit * lerp(0.94, 1, ease(p, 0, 0.1)));

    // the hero phone: rises, steps aside, folds into the drafts, returns as the converter
    const rise = ease(p, 0.1, 0.2);
    const toCentre = ease(p, 0.27, 0.31);
    const hide = ease(p, 0.29, 0.32) * (1 - ease(p, 0.4, 0.45));
    const back = ease(p, 0.45, 0.5);
    const finale = ease(p, 0.88, 0.98);
    let x = lerp(0, side, rise);
    x = lerp(x, 0, toCentre);
    x = lerp(x, side, back);
    x = lerp(x, 0, finale);
    const push = ease(p, 0.72, 0.8) * (1 - ease(p, 0.84, 0.9));
    hero.position.set(x, lerp(-1.9, baseY, rise) + Math.sin(floatT * 0.9) * 0.012, push * (small ? 0.35 : 0.9));
    hero.rotation.set(lerp(0.25, 0.02, rise), lerp(-0.7, -0.2, rise) + back * 0.12 - finale * 0.12 + push * 0.1, lerp(0.08, 0, rise));
    const s = (small ? 1.1 : 1) * (1 - hide * 0.999);
    hero.scale.setScalar(Math.max(0.001, s));
    screens(p);

    // six drafts fan out, then fold into one
    const open = ease(p, 0.29, 0.35);
    const fold = ease(p, 0.39, 0.45);
    const show = open * (1 - fold);
    drafts.forEach((d, i) => {
      d.visible = show > 0.002;
      if (!d.visible) return;
      const spreadOut = open * (1 - fold);
      if (small) {
        // portrait: two rows of three
        const col = (i % 3) - 1, row = i < 3 ? 1 : -1;
        d.position.set(col * 0.37 * spreadOut, baseY - 0.2 + row * 0.3 * spreadOut, -Math.abs(col) * 0.08 * open);
        d.rotation.set(0.04, -col * 0.12 * open, 0);
        d.scale.setScalar(Math.max(0.001, 0.5 * show));
      } else {
        const k = i - 2.5;
        d.position.set(k * 0.6 * spreadOut, baseY + 0.04 + Math.abs(k) * -0.035 * open, -Math.abs(k) * 0.12 * open);
        d.rotation.set(0.04, -k * 0.09 * open, 0);
        d.scale.setScalar(Math.max(0.001, 0.74 * show));
      }
    });

    camera.position.z = 4.2 - push * 0.25;
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the phone the same size on narrow frames
    camera.fov = camera.aspect < 1 ? 38 : 28;
    camera.updateProjectionMatrix();
    bg.material.uniforms.uAspect.value = camera.aspect;
    const viewH = 2 * 4.2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    logoFit = Math.min(1, (viewH * camera.aspect * 0.78) / LOGO_W);
    // the X sits at ~0.4 of the wordmark's width right of centre
    edgeAtX = ((0.4 * LOGO_W * logoFit) / viewH) * 0.914;
  }

  function render(time) {
    floatT = time;
    setProgress(P);
    renderer.render(scene, camera);
  }

  resize();
  setProgress(0);
  return { setProgress, render, resize };
}

/* ---------------------------------------------------------------- orchestration */

let filmScene = null;
if (film && canvas && !reduced) {
  try { filmScene = createFilm(canvas); } catch (err) { console.warn('[film] WebGL unavailable, keeping the static cover.', err); }
}
const libs = Boolean(window.gsap && window.ScrollTrigger && window.Lenis);

if (film && filmScene && libs) cinematic();
else if (film) html.classList.add('film-static');

function cinematic() {
  html.classList.add('film-on');
  const { gsap, ScrollTrigger, Lenis } = window;
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  const lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 0.95, anchors: false });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);

  const state = { p: 0 };
  const distance = () => innerHeight * (small ? 3.4 : 4.5);
  const draw = () => {
    filmScene.setProgress(state.p);
    if (bar) bar.style.transform = `scaleX(${state.p.toFixed(4)})`;
  };

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: film, start: 'top top', end: () => `+=${distance()}`,
      pin: stage, scrub: true, anticipatePin: 1, invalidateOnRefresh: true,
      onRefresh: () => { filmScene.resize(); draw(); },
    },
  });
  tl.to(state, { p: 1, duration: 1, onUpdate: draw }, 0);
  chapters.forEach((el) => {
    const a = Number(el.dataset.in), b = el.dataset.out ? Number(el.dataset.out) : null;
    tl.fromTo(el, { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: 0.02, ease: 'power2.out' }, a);
    if (b !== null) tl.to(el, { autoAlpha: 0, y: -24, duration: 0.018, ease: 'power2.in' }, b);
  });

  // render only while the frame is on screen
  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(stage);
  gsap.ticker.add((time) => { if (visible && !document.hidden) filmScene.render(time); });
  addEventListener('resize', () => { filmScene.resize(); draw(); });

  // in-page links scroll through Lenis, clear of the toolbar and the index
  const offset = () => {
    const bar = document.querySelector('.toolbar'), toc = document.querySelector('.cx-toc');
    return (bar ? bar.offsetHeight : 0) + (toc ? toc.offsetHeight : 0) + 24;
  };
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented) return;
    const el = document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)));
    if (!el) return;
    e.preventDefault();
    const target = el.closest('section') && el.id.startsWith('cx-') && el.tagName === 'H2' ? el.closest('section') : el;
    lenis.scrollTo(target, { offset: -offset(), duration: 1.4 });
    history.replaceState(null, '', `#${el.id}`);
  });

  draw();

  window.__film = { scene: filmScene, tl, lenis, state };

  /* measure the pin only once layout and fonts settle: a restored scroll
     position or a late font swap would otherwise shift start and end */
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  const hashId = decodeURIComponent(location.hash.slice(1));
  const loaded = new Promise((r) => (document.readyState === 'complete' ? r() : addEventListener('load', r, { once: true })));
  Promise.all([loaded, document.fonts ? document.fonts.ready : null]).then(() => {
    ScrollTrigger.refresh();
    lenis.resize();
    const el = hashId && document.getElementById(hashId);
    if (el) setTimeout(() => lenis.scrollTo(el.tagName === 'H2' && el.closest('section') ? el.closest('section') : el, { offset: -offset(), immediate: true }), 60);
  });
}
