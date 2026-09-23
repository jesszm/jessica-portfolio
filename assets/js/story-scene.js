/* JM · Cinematic story scene — v2.0.0
   A scroll-driven Three.js journey through Jessica's UI/UX process.
   setProgress(p) is deterministic (0..1) so scrolling back always rewinds.
   tick(time) only adds ambient life: dust, flicker, pulse. No text is ever
   rendered inside the 3D scene: every word on screen is real HTML. */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const range = (p, a, b) => clamp01((p - a) / (b - a));
const smooth = (t) => t * t * (3 - 2 * t);
const ease = (p, a, b) => smooth(range(p, a, b));
const lerp = (a, b, t) => a + (b - a) * t;
const backOut = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

function rng(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Palette — mirrors assets/css/tokens.css */
const C = {
  bone0: '#FFFFFF', bone50: '#FAFAF6', bone100: '#F2F2EB', bone200: '#E4E4DA',
  bone300: '#CFCFC2', bone400: '#A8A899', bone550: '#6B6B5E', bone600: '#5A5A4F',
  bone700: '#3E3E36', bone800: '#26261F', bone900: '#181812', bone950: '#121410',
  olive50: '#F4F5EE', olive100: '#E6E9D8', olive200: '#CDD3B3', olive300: '#ADB786',
  olive400: '#8C9A5E', olive500: '#6B7A3F', olive600: '#4B5320', olive700: '#3D4419',
  olive800: '#2F3514', olive900: '#22270F', olive950: '#141708',
  sand300: '#E8DFBF', sand400: '#D4C48F', sand500: '#B8A263',
  redline: '#CF3327', proto: '#2F80ED', success: '#3F8F4E',
};

/* Story timing (fractions of the pinned scroll) */
export const CUTS = { toWorld: 0.16, toStudio: 0.83 };
const CUT_HALF = 0.02;

/* The canvas world lives far from the studio; fog and visibility keep them apart. */
const W = new THREE.Vector3(0, 0, -40);

const CAMERA_PATHS = [
  {
    from: 0, to: CUTS.toWorld, offset: new THREE.Vector3(0, 0, 0),
    keys: [
      [0.0, [0.44, 0.94, 0.44], [0.0, 0.775, 0.04]],
      [0.05, [-0.04, 0.99, 0.54], [0.0, 0.775, 0.03]],
      [0.1, [-0.4, 1.03, 0.3], [0.02, 0.775, 0.04]],
      [0.135, [-0.07, 1.06, 0.2], [0.0, 0.765, 0.05]],
      [0.16, [0.0, 0.862, 0.118], [0.0, 0.762, 0.036]],
    ],
  },
  {
    from: CUTS.toWorld, to: CUTS.toStudio, offset: W,
    keys: [
      [0.16, [0.0, 0.62, 1.7], [0.0, 0.0, 0.25]],
      [0.195, [0.0, 1.38, 3.3], [0.0, 1.58, -3.0]],
      [0.235, [0.0, 1.62, 2.7], [0.0, 1.7, -3.0]],
      [0.3, [0.25, 1.72, 1.3], [0.1, 1.72, -3.0]],
      [0.345, [1.3, 1.9, 0.25], [4.4, 1.62, -5.0]],
      [0.385, [4.55, 1.76, -1.35], [5.6, 1.7, -5.0]],
      [0.45, [6.85, 1.8, -1.25], [7.25, 1.7, -5.0]],
      [0.49, [9.4, 1.9, -2.6], [12.4, 1.55, -8.0]],
      [0.525, [12.45, 1.6, -4.45], [12.6, 1.52, -8.0]],
      [0.6, [12.7, 1.58, -4.8], [12.8, 1.5, -8.0]],
      [0.665, [13.3, 1.6, -4.5], [13.25, 1.45, -8.0]],
      [0.73, [13.0, 1.56, -5.05], [13.1, 1.5, -8.0]],
      [0.79, [14.7, 1.82, -4.35], [14.1, 1.36, -8.0]],
      [0.83, [14.8, 1.86, -4.25], [14.1, 1.36, -8.0]],
    ],
  },
  {
    from: CUTS.toStudio, to: 1.0001, offset: new THREE.Vector3(0, 0, 0),
    keys: [
      [0.83, [0.0, 0.862, 0.118], [0.0, 0.762, 0.036]],
      [0.87, [0.1, 0.98, 0.44], [0.0, 0.775, 0.02]],
      [0.935, [-0.22, 1.16, 1.12], [-0.08, 0.8, 0.0]],
      [1.0, [-0.23, 1.16, 1.14], [-0.08, 0.8, 0.0]],
    ],
  },
];

export function createStory(canvas, options = {}) {
  const high = options.quality !== 'low';

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: high,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, high ? 1.75 : 1.25));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = high;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const studioBg = new THREE.Color('#0b0c0a');
  const worldBg = new THREE.Color(C.bone950);
  scene.background = studioBg.clone();
  scene.fog = new THREE.Fog(studioBg.clone(), 2.2, 7.5);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.25;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(36, 1, 0.02, 80);
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  /* ---------- helpers ---------- */
  const disposables = [];
  const track = (x) => { disposables.push(x); return x; };

  function std(color, rough = 0.6, metal = 0, extra = {}) {
    return track(new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra }));
  }
  function basic(color, extra = {}) {
    return track(new THREE.MeshBasicMaterial({ color, ...extra }));
  }
  function mesh(geo, mat, parent, x = 0, y = 0, z = 0, { cast = false, receive = false } = {}) {
    const m = new THREE.Mesh(track(geo), mat);
    m.position.set(x, y, z);
    m.castShadow = cast && high;
    m.receiveShadow = receive && high;
    if (parent) parent.add(m);
    return m;
  }
  function box(w, h, d, mat, parent, x, y, z, opts) {
    return mesh(new THREE.BoxGeometry(w, h, d), mat, parent, x, y, z, opts);
  }
  function plane(w, h, mat, parent, x, y, z) {
    return mesh(new THREE.PlaneGeometry(w, h), mat, parent, x, y, z);
  }
  function canvasTexture(w, h, draw, repeat) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = track(new THREE.CanvasTexture(c));
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    if (repeat) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeat[0], repeat[1]);
    }
    return t;
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ---------- procedural textures ---------- */
  const woodDesk = canvasTexture(512, 512, (g, w, h) => {
    const r = rng(7);
    g.fillStyle = '#4a3627';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 220; i++) {
      const y = r() * h;
      g.strokeStyle = `rgba(${r() > 0.5 ? '30,20,12' : '112,84,58'},${0.08 + r() * 0.12})`;
      g.lineWidth = 1 + r() * 3;
      g.beginPath();
      g.moveTo(0, y);
      g.bezierCurveTo(w * 0.3, y + (r() - 0.5) * 14, w * 0.7, y + (r() - 0.5) * 14, w, y + (r() - 0.5) * 8);
      g.stroke();
    }
  }, [1.5, 1]);

  const floorBoards = canvasTexture(512, 512, (g, w, h) => {
    const r = rng(11);
    for (let i = 0; i < 8; i++) {
      const tone = 26 + Math.floor(r() * 12);
      g.fillStyle = `rgb(${tone + 8},${tone + 2},${tone - 4})`;
      g.fillRect(0, i * (h / 8), w, h / 8);
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.fillRect(0, i * (h / 8), w, 2);
    }
  }, [6, 6]);

  const cork = canvasTexture(256, 256, (g, w, h) => {
    const r = rng(3);
    g.fillStyle = '#8f6f48';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = `rgba(${r() > 0.5 ? '60,42,24' : '176,142,98'},${0.25 + r() * 0.35})`;
      g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
    }
  }, [2, 1.2]);

  function drawSketch(seed) {
    return (g, w, h) => {
      const r = rng(seed);
      g.fillStyle = '#f1ece0';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(52,52,46,0.72)';
      g.lineCap = 'round';
      const jitterLine = (x1, y1, x2, y2) => {
        g.beginPath();
        g.moveTo(x1 + (r() - 0.5) * 2, y1 + (r() - 0.5) * 2);
        g.quadraticCurveTo((x1 + x2) / 2 + (r() - 0.5) * 4, (y1 + y2) / 2 + (r() - 0.5) * 4, x2, y2);
        g.stroke();
      };
      const sketchBox = (x, y, bw, bh) => {
        jitterLine(x, y, x + bw, y);
        jitterLine(x + bw, y, x + bw, y + bh);
        jitterLine(x + bw, y + bh, x, y + bh);
        jitterLine(x, y + bh, x, y);
      };
      g.lineWidth = 2.2;
      sketchBox(w * 0.1, h * 0.08, w * 0.8, h * 0.84);
      g.lineWidth = 1.6;
      sketchBox(w * 0.16, h * 0.14, w * 0.68, h * 0.08);
      sketchBox(w * 0.16, h * 0.27, w * 0.68, h * 0.26);
      jitterLine(w * 0.16, h * 0.27, w * 0.84, h * 0.53);
      jitterLine(w * 0.84, h * 0.27, w * 0.16, h * 0.53);
      for (let i = 0; i < 4; i++) jitterLine(w * 0.16, h * (0.6 + i * 0.05), w * (0.5 + r() * 0.3), h * (0.6 + i * 0.05));
      sketchBox(w * 0.16, h * 0.82, w * 0.3, h * 0.06);
      g.strokeStyle = 'rgba(75,83,32,0.85)';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(w * 0.72, h * 0.85, 12, 0, Math.PI * 1.7);
      g.stroke();
      jitterLine(w * 0.72, h * 0.85, w * 0.88, h * 0.72);
    };
  }

  function drawScreen(hifi) {
    return (g, w, h) => {
      g.fillStyle = '#171915';
      g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(242,242,235,0.09)';
      for (let x = 14; x < w; x += 26) for (let y = 14; y < h; y += 26) g.fillRect(x, y, 2, 2);
      g.fillStyle = '#20221d';
      g.fillRect(0, 0, w, 38);
      g.fillRect(0, 38, 52, h - 38);
      g.fillStyle = 'rgba(242,242,235,0.18)';
      for (let i = 0; i < 6; i++) g.fillRect(16, 60 + i * 34, 20, 20);
      const fx = 170, fy = 110, fw = 620, fh = 400;
      g.fillStyle = 'rgba(242,242,235,0.35)';
      g.fillRect(fx, fy - 20, 96, 7);
      g.fillStyle = hifi ? '#F4F5EE' : '#F2F2EB';
      g.fillRect(fx, fy, fw, fh);
      g.strokeStyle = C.proto;
      g.lineWidth = 2;
      g.strokeRect(fx - 1, fy - 1, fw + 2, fh + 2);
      g.fillStyle = C.proto;
      [[fx, fy], [fx + fw, fy], [fx, fy + fh], [fx + fw, fy + fh]].forEach(([x, y]) => g.fillRect(x - 4, y - 4, 8, 8));
      g.fillStyle = hifi ? '#FFFFFF' : '#E4E4DA';
      g.fillRect(fx, fy, fw, 34);
      g.fillStyle = hifi ? C.olive900 : '#E9E9E0';
      g.fillRect(fx, fy + 34, 110, fh - 34);
      g.fillStyle = hifi ? C.olive600 : '#CFCFC2';
      g.fillRect(fx + 12, fy + 10, 16, 16);
      for (let i = 0; i < 4; i++) {
        g.fillStyle = hifi ? (i === 0 ? C.olive400 : '#3E3E36') : '#CFCFC2';
        g.fillRect(fx + 16, fy + 58 + i * 22, 70, 8);
      }
      g.fillStyle = hifi ? '#121410' : '#CFCFC2';
      g.fillRect(fx + 140, fy + 58, 190, 16);
      g.fillStyle = hifi ? '#5A5A4F' : '#E4E4DA';
      g.fillRect(fx + 140, fy + 84, 130, 8);
      if (hifi) {
        g.fillStyle = C.olive600;
        g.fillRect(fx + 500, fy + 54, 96, 30);
        g.fillStyle = '#FFFFFF';
        g.fillRect(fx + 522, fy + 66, 52, 6);
      } else {
        g.strokeStyle = '#121410';
        g.lineWidth = 2;
        g.strokeRect(fx + 500, fy + 54, 96, 30);
      }
      for (let i = 0; i < 3; i++) {
        const cx = fx + 140 + i * 156;
        g.fillStyle = hifi ? '#FFFFFF' : '#EDEDE4';
        g.fillRect(cx, fy + 116, 140, 74);
        if (hifi) {
          g.strokeStyle = '#E4E4DA';
          g.lineWidth = 1;
          g.strokeRect(cx, fy + 116, 140, 74);
        }
        g.fillStyle = hifi ? '#A8A899' : '#CFCFC2';
        g.fillRect(cx + 12, fy + 130, 50, 6);
        g.fillStyle = hifi ? C.olive600 : '#CFCFC2';
        g.fillRect(cx + 12, fy + 148, 80, 18);
      }
      const chx = fx + 140, chy = fy + 214, chw = 460, chh = 168;
      g.fillStyle = hifi ? '#FFFFFF' : '#EDEDE4';
      g.fillRect(chx, chy, chw, chh);
      if (hifi) {
        g.beginPath();
        const pts = [0.9, 0.72, 0.78, 0.52, 0.6, 0.38, 0.46, 0.24, 0.3];
        g.moveTo(chx, chy + chh);
        pts.forEach((v, i) => g.lineTo(chx + (i / (pts.length - 1)) * chw, chy + v * chh));
        g.lineTo(chx + chw, chy + chh);
        g.closePath();
        g.fillStyle = 'rgba(140,154,94,0.35)';
        g.fill();
        g.beginPath();
        pts.forEach((v, i) => (i ? g.lineTo : g.moveTo).call(g, chx + (i / (pts.length - 1)) * chw, chy + v * chh));
        g.strokeStyle = C.olive600;
        g.lineWidth = 3;
        g.stroke();
      } else {
        g.strokeStyle = '#CFCFC2';
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(chx, chy);
        g.lineTo(chx + chw, chy + chh);
        g.moveTo(chx + chw, chy);
        g.lineTo(chx, chy + chh);
        g.stroke();
        g.fillStyle = C.redline;
        g.fillRect(fx + 110, fy + 64, 30, 2);
        g.fillRect(fx + 110, fy + 58, 2, 14);
        g.fillRect(fx + 138, fy + 58, 2, 14);
      }
    };
  }

  const screenLowfi = canvasTexture(900, 620, drawScreen(false));
  const screenHifi = canvasTexture(900, 620, drawScreen(true));

  const dotTexture = canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = C.bone950;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(242,242,235,0.28)';
    g.beginPath();
    g.arc(w / 2, h / 2, 2.2, 0, Math.PI * 2);
    g.fill();
  }, [180, 180]);

  const spriteTexture = canvasTexture(64, 64, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  });

  /* =====================================================================
     STUDIO — the designer's desk (hero + final)
     ===================================================================== */
  const studio = new THREE.Group();
  scene.add(studio);

  const M = {
    wall: std('#2a2923', 0.95),
    floor: std('#ffffff', 0.8, 0, { map: floorBoards }),
    desk: std('#ffffff', 0.55, 0, { map: woodDesk }),
    graphite: std('#2b2d2a', 0.42, 0.55),
    graphiteDark: std('#1a1b19', 0.5, 0.4),
    chrome: std('#d7dbd8', 0.2, 1),
    olive: std(C.olive600, 0.55),
    oliveMug: std(C.olive700, 0.3, 0.05),
    page: std(C.bone100, 0.85),
    cork: std('#ffffff', 0.95, 0, { map: cork }),
    terracotta: std('#9a5a3c', 0.85),
    leaf: std(C.olive500, 0.7),
    leafDark: std(C.olive700, 0.7),
    bookSand: std(C.sand500, 0.8),
    bookBone: std(C.bone300, 0.85),
    bookGraphite: std(C.bone700, 0.8),
  };

  mesh(new THREE.PlaneGeometry(8, 8), M.floor, studio, 0, 0, 0, { receive: true }).rotation.x = -Math.PI / 2;
  box(6, 3, 0.1, M.wall, studio, 0, 1.5, -1.15, { receive: true });
  box(0.1, 3, 5, M.wall, studio, -2.3, 1.5, 1.2, { receive: true });
  box(0.1, 3, 5, M.wall, studio, 2.5, 1.5, 1.2, { receive: true });

  /* desk */
  box(1.7, 0.045, 0.82, M.desk, studio, 0, 0.7275, 0, { cast: true, receive: true });
  [[-0.78, -0.34], [0.78, -0.34], [-0.78, 0.34], [0.78, 0.34]].forEach(([x, z]) => {
    box(0.04, 0.705, 0.04, M.graphiteDark, studio, x, 0.3525, z, { cast: true });
  });

  /* tablet + screen */
  const tablet = new THREE.Group();
  tablet.position.set(0, 0.75, 0.04);
  tablet.rotation.y = -0.12;
  studio.add(tablet);
  box(0.345, 0.011, 0.25, M.graphite, tablet, 0, 0.0055, 0, { cast: true, receive: true });
  const screenMat = basic('#000000', { map: screenLowfi, toneMapped: false });
  const screen = plane(0.318, 0.219, screenMat, tablet, 0, 0.0116, 0);
  screen.rotation.x = -Math.PI / 2;
  const screenGlow = new THREE.PointLight('#dfe8ff', 0, 1.2, 2);
  screenGlow.position.set(0, 0.12, 0.05);
  tablet.add(screenGlow);

  /* stylus */
  const stylus = new THREE.Group();
  studio.add(stylus);
  const stylusBody = mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.15, 16), M.graphite, stylus, 0, 0, 0, { cast: true });
  stylusBody.rotation.z = Math.PI / 2;
  const stylusTip = mesh(new THREE.ConeGeometry(0.0045, 0.014, 16), M.bookBone, stylus, 0.082, 0, 0);
  stylusTip.rotation.z = -Math.PI / 2;
  const STYLUS_REST = { pos: new THREE.Vector3(0.225, 0.7545, 0.13), rot: new THREE.Euler(0, 0.5, 0) };
  const STYLUS_HAND = { pos: new THREE.Vector3(0.05, 0.83, 0.1), rot: new THREE.Euler(0.2, 0.9, 0.95) };

  /* sketchbook: left half static, right half hinges on the spine and closes in the finale */
  const sketchTexA = canvasTexture(512, 700, drawSketch(21));
  const sketchTexB = canvasTexture(512, 700, drawSketch(34));
  const edgeMat = std(C.bone200, 0.9);
  const pageA = std('#ffffff', 0.9, 0, { map: sketchTexA });
  const pageB = std('#ffffff', 0.9, 0, { map: sketchTexB });
  const book = new THREE.Group();
  book.position.set(-0.46, 0.7505, 0.0);
  book.rotation.y = 0.18;
  studio.add(book);
  const leftHalf = new THREE.Mesh(track(new THREE.BoxGeometry(0.24, 0.008, 0.33)), [edgeMat, edgeMat, pageA, M.olive, edgeMat, edgeMat]);
  leftHalf.position.set(-0.121, 0.004, 0);
  leftHalf.castShadow = high;
  leftHalf.receiveShadow = high;
  book.add(leftHalf);
  const spine = new THREE.Group();
  spine.position.set(0, 0.008, 0);
  book.add(spine);
  const rightHalf = new THREE.Mesh(track(new THREE.BoxGeometry(0.24, 0.006, 0.33)), [edgeMat, edgeMat, pageB, M.olive, edgeMat, edgeMat]);
  rightHalf.position.set(0.121, -0.003, 0);
  rightHalf.castShadow = high;
  rightHalf.receiveShadow = high;
  spine.add(rightHalf);

  /* mug */
  const mug = new THREE.Group();
  mug.position.set(0.47, 0.75, -0.2);
  studio.add(mug);
  mesh(new THREE.CylinderGeometry(0.038, 0.034, 0.095, 32), M.oliveMug, mug, 0, 0.0475, 0, { cast: true });
  mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.002, 32), std('#2a1a10', 0.2), mug, 0, 0.087, 0);
  const handle = mesh(new THREE.TorusGeometry(0.022, 0.006, 10, 24), M.oliveMug, mug, 0.042, 0.05, 0, { cast: true });
  handle.rotation.y = Math.PI / 2;

  /* plant */
  const plant = new THREE.Group();
  plant.position.set(-0.68, 0.75, -0.28);
  studio.add(plant);
  mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.1, 24), M.terracotta, plant, 0, 0.05, 0, { cast: true });
  const pr = rng(5);
  for (let i = 0; i < 9; i++) {
    const leaf = mesh(new THREE.SphereGeometry(0.03, 12, 10), i % 2 ? M.leaf : M.leafDark, plant, 0, 0, 0, { cast: true });
    const a = (i / 9) * Math.PI * 2;
    leaf.scale.set(0.5, 1.9, 0.26);
    leaf.position.set(Math.cos(a) * 0.035, 0.15 + pr() * 0.06, Math.sin(a) * 0.035);
    leaf.rotation.set(Math.sin(a) * 0.6, a, Math.cos(a) * 0.6);
  }

  /* desk lamp */
  const lampBase = new THREE.Vector3(0.62, 0.75, -0.3);
  const lampHead = new THREE.Vector3(0.36, 1.2, -0.12);
  mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.02, 32), M.graphiteDark, studio, lampBase.x, 0.76, lampBase.z, { cast: true });
  const elbow = new THREE.Vector3(0.66, 1.1, -0.34);
  function rod(a, b, r, mat) {
    const len = a.distanceTo(b);
    const m = mesh(new THREE.CylinderGeometry(r, r, len, 12), mat, studio, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, { cast: true });
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    return m;
  }
  rod(new THREE.Vector3(lampBase.x, 0.77, lampBase.z), elbow, 0.008, M.graphiteDark);
  rod(elbow, lampHead, 0.008, M.graphiteDark);
  const beamTarget = new THREE.Vector3(0.02, 0.75, 0.05);
  const headDir = beamTarget.clone().sub(lampHead).normalize();
  const shade = mesh(new THREE.CylinderGeometry(0.035, 0.085, 0.11, 32, 1, true), std(C.bone800, 0.5, 0.3, { side: THREE.DoubleSide }), studio, lampHead.x, lampHead.y, lampHead.z, { cast: true });
  shade.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), headDir);
  const bulbMat = basic('#fff1d6', { toneMapped: false });
  const bulb = mesh(new THREE.SphereGeometry(0.022, 16, 12), bulbMat, studio, lampHead.x + headDir.x * 0.03, lampHead.y + headDir.y * 0.03, lampHead.z + headDir.z * 0.03);

  const lampLight = new THREE.SpotLight('#ffd6a0', 3.2, 4, 0.62, 0.65, 2);
  lampLight.position.copy(lampHead);
  lampLight.target.position.copy(beamTarget);
  lampLight.castShadow = high;
  lampLight.shadow.mapSize.set(1024, 1024);
  lampLight.shadow.bias = -0.0008;
  lampLight.shadow.camera.near = 0.1;
  lampLight.shadow.camera.far = 3;
  studio.add(lampLight, lampLight.target);

  /* volumetric beam (soft additive cone) */
  const beamLen = lampHead.distanceTo(beamTarget);
  const beamMat = track(new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color('#ffcf8f') }, uIntensity: { value: 0.22 } },
    vertexShader: `
      varying vec3 vN; varying vec3 vV; varying vec2 vUv;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        vUv = uv;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uIntensity;
      varying vec3 vN; varying vec3 vV; varying vec2 vUv;
      void main() {
        float facing = pow(abs(dot(vN, vV)), 1.6);
        float along = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.82, vUv.y);
        float a = facing * along * uIntensity;
        gl_FragColor = vec4(uColor * a, a);
      }`,
  }));
  const beam = mesh(new THREE.CylinderGeometry(0.34, 0.07, beamLen, 40, 1, true), beamMat, studio,
    (lampHead.x + beamTarget.x) / 2, (lampHead.y + beamTarget.y) / 2, (lampHead.z + beamTarget.z) / 2);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), headDir);

  /* dust drifting through the beam */
  const dustCount = high ? 220 : 80;
  const dustSeed = [];
  const dr = rng(99);
  for (let i = 0; i < dustCount; i++) dustSeed.push({ t: dr(), a: dr() * Math.PI * 2, r: Math.sqrt(dr()), s: 0.3 + dr() * 0.7, ph: dr() * 10 });
  const dustGeo = track(new THREE.BufferGeometry());
  const dustPos = new Float32Array(dustCount * 3);
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustMat = track(new THREE.PointsMaterial({
    color: '#ffe2b8', size: 0.0055, map: spriteTexture, transparent: true, opacity: 0.75,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
  }));
  const dust = new THREE.Points(dustGeo, dustMat);
  studio.add(dust);
  const beamPerp1 = new THREE.Vector3().crossVectors(headDir, new THREE.Vector3(0, 0, 1)).normalize();
  const beamPerp2 = new THREE.Vector3().crossVectors(headDir, beamPerp1).normalize();

  /* corkboard + pinned sketches on the back wall */
  box(1.3, 0.72, 0.02, M.cork, studio, -0.35, 1.55, -1.09, { receive: true });
  const pinColors = [C.olive600, C.sand500, C.olive400, C.sand500];
  [[-0.72, 1.62, 0.05, 31], [-0.36, 1.5, -0.04, 44], [0.0, 1.66, 0.03, 52], [0.2, 1.45, -0.06, 63]].forEach(([x, y, rot, seed], i) => {
    const tex = canvasTexture(256, 340, drawSketch(seed));
    const paper = plane(0.24, 0.32, std('#ffffff', 0.9, 0, { map: tex }), studio, x, y, -1.075);
    paper.rotation.z = rot;
    mesh(new THREE.SphereGeometry(0.012, 12, 10), std(pinColors[i], 0.4), studio, x, y + 0.13, -1.068);
  });

  /* bookshelf */
  box(0.9, 0.025, 0.2, M.graphiteDark, studio, 1.3, 1.35, -1.0, { cast: true });
  const books = [[0.04, 0.26, M.olive], [0.035, 0.22, M.bookSand], [0.05, 0.28, M.bookGraphite], [0.03, 0.24, M.bookBone], [0.045, 0.2, M.olive], [0.04, 0.27, M.bookGraphite]];
  let bx = 0.95;
  books.forEach(([w, h, mat]) => {
    box(w, h, 0.16, mat, studio, bx + w / 2, 1.3625 + h / 2, -1.0, { cast: true });
    bx += w + 0.006;
  });

  /* window on the right wall: blue hour */
  const windowMat = basic('#223246', { toneMapped: false });
  plane(1.1, 1.0, windowMat, studio, 2.44, 1.6, -0.2).rotation.y = -Math.PI / 2;
  box(0.04, 1.04, 0.04, M.graphiteDark, studio, 2.43, 1.6, -0.2);
  box(0.04, 0.04, 1.14, M.graphiteDark, studio, 2.43, 1.6, -0.2);
  const windowFill = new THREE.DirectionalLight('#7f9bc4', 0.35);
  windowFill.position.set(3, 2, 0);
  windowFill.target.position.set(0, 0.7, 0);
  studio.add(windowFill, windowFill.target);

  const studioHemi = new THREE.HemisphereLight('#fff1dc', '#0c0b09', 0.18);
  studio.add(studioHemi);

  /* =====================================================================
     WORLD — the infinite design canvas
     ===================================================================== */
  const world = new THREE.Group();
  world.position.copy(W);
  world.visible = false;
  scene.add(world);

  const floorWorld = plane(160, 160, basic('#ffffff', { map: dotTexture }), world, 0, 0, -10);
  floorWorld.rotation.x = -Math.PI / 2;

  const worldHemi = new THREE.HemisphereLight('#e6ead8', '#0d0e0b', 0.9);
  world.add(worldHemi);
  const key = new THREE.DirectionalLight('#fff4e2', 2.2);
  key.position.set(6, 9, 6);
  key.target.position.set(6, 1.4, -5);
  world.add(key, key.target);
  const rim = new THREE.PointLight(C.olive300, 6, 14, 2);
  rim.position.set(10, 3.2, -9.5);
  world.add(rim);

  const frameMat = (color) => std(color, 0.6, 0, { emissive: new THREE.Color(color), emissiveIntensity: 0.32 });

  /* ---------- Discover + Research: sticky notes → affinity clusters ---------- */
  const noteColors = [C.sand300, C.olive100, C.bone0, C.olive200, C.sand300, C.bone0];
  const noteMats = noteColors.map((c) => frameMat(c));
  const inkMat = basic(C.bone700, { transparent: true, opacity: 0.75 });
  const notes = [];
  const nr = rng(2024);
  const clusters = [-1.6, 0, 1.6];
  for (let i = 0; i < 18; i++) {
    const g = new THREE.Group();
    world.add(g);
    box(0.26, 0.26, 0.006, noteMats[i % noteMats.length], g, 0, 0, 0);
    const lines = 2 + (i % 2);
    for (let l = 0; l < lines; l++) plane(0.16 - l * 0.03 + nr() * 0.02, 0.012, inkMat, g, -0.03 + (nr() - 0.5) * 0.02, 0.06 - l * 0.045, 0.0035);
    const col = i % 6;
    const row = Math.floor(i / 6);
    const scatter = new THREE.Vector3(-2.3 + col * 0.92 + (nr() - 0.5) * 0.25, 1.05 + row * 0.62 + (nr() - 0.5) * 0.2, -3 + (nr() - 0.5) * 0.12);
    const k = i % 3;
    const slot = Math.floor(i / 3);
    const cluster = new THREE.Vector3(clusters[k] + (slot % 2 ? 0.15 : -0.15), 2.02 - Math.floor(slot / 2) * 0.3, -3 + 0.002 * slot);
    const start = new THREE.Vector3((nr() - 0.5) * 11, 0.2 + nr() * 3.6, -9 - nr() * 5);
    notes.push({
      g, scatter, cluster, start,
      rotStart: new THREE.Euler((nr() - 0.5) * 2.4, (nr() - 0.5) * 2.4, (nr() - 0.5) * 2),
      rotScatter: (nr() - 0.5) * 0.3,
      rotCluster: (nr() - 0.5) * 0.06,
      delayIn: i * 0.0022,
      delayCluster: (i % 6) * 0.004 + k * 0.002,
    });
  }
  const clusterHeads = [C.olive600, C.sand500, C.olive400].map((c, k) => {
    const h = box(0.62, 0.08, 0.008, frameMat(c), world, clusters[k], 2.36, -3.0);
    h.scale.x = 0.001;
    return h;
  });

  /* ---------- Define: user flow that lights up node by node ---------- */
  const nodeDefs = [
    [3.4, 1.65], [4.85, 2.1], [6.25, 2.32], [6.25, 1.18], [7.65, 1.86], [8.95, 1.65],
  ];
  const edges = [[0, 1, 0.372], [1, 2, 0.388], [1, 3, 0.392], [2, 4, 0.405], [3, 4, 0.41], [4, 5, 0.425]];
  const nodes = nodeDefs.map(([x, y], i) => {
    const g = new THREE.Group();
    g.position.set(x, y, -5);
    world.add(g);
    const mat = frameMat(C.bone50);
    box(0.62, 0.4, 0.03, mat, g, 0, 0, 0);
    plane(0.62, 0.07, basic(i === 0 || i === 5 ? C.olive600 : C.bone300), g, 0, 0.165, 0.016);
    plane(0.4, 0.028, basic(C.bone300), g, -0.07, 0.04, 0.016);
    plane(0.28, 0.028, basic(C.bone200), g, -0.13, -0.03, 0.016);
    plane(0.22, 0.06, basic(C.bone200), g, -0.14, -0.12, 0.016);
    const glowMat = basic(C.olive300, { transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    plane(0.74, 0.52, glowMat, g, 0, 0, -0.02);
    return { g, mat, glowMat };
  });
  const edgeObjs = edges.map(([a, b, start]) => {
    const pa = nodes[a].g.position.clone().add(new THREE.Vector3(0.31, 0, 0.02));
    const pb = nodes[b].g.position.clone().add(new THREE.Vector3(-0.31, 0, 0.02));
    const dx = (pb.x - pa.x) * 0.5;
    const curve = new THREE.CubicBezierCurve3(pa, pa.clone().add(new THREE.Vector3(dx, 0, 0.05)), pb.clone().add(new THREE.Vector3(-dx, 0, 0.05)), pb);
    const tubular = 64;
    const radial = 6;
    const geo = new THREE.TubeGeometry(curve, tubular, 0.011, radial, false);
    const m = mesh(geo, basic(C.proto, { toneMapped: false }), world);
    geo.setDrawRange(0, 0);
    const arrow = mesh(new THREE.ConeGeometry(0.03, 0.06, 12), basic(C.proto, { toneMapped: false }), world, pb.x - 0.03, pb.y, pb.z);
    arrow.rotation.z = -Math.PI / 2;
    arrow.scale.setScalar(0.001);
    return { geo, m, arrow, a, b, start, end: start + 0.02, perRing: radial * 6, tubular };
  });

  /* ---------- Design: wireframe → redlines + grid → aligned → high fidelity ---------- */
  const desk = new THREE.Group();
  desk.position.set(12.4, 1.55, -8);
  world.add(desk);
  const deskFrameMat = frameMat(C.bone50);
  box(2.8, 1.75, 0.03, deskFrameMat, desk, 0, 0, 0);
  plane(0.3, 0.035, basic(C.bone400), desk, -1.25, 0.94, 0);

  const phone = new THREE.Group();
  phone.position.set(14.4, 1.4, -8);
  world.add(phone);
  box(0.66, 1.32, 0.04, frameMat(C.bone800), phone, 0, 0, -0.005);
  box(0.62, 1.28, 0.03, frameMat(C.bone50), phone, 0, 0, 0);
  plane(0.2, 0.03, basic(C.bone400), phone, -0.2, 0.72, 0);

  const Z = 0.0165;
  const uiEls = [];
  function ui(parent, w, h, x, y, low, hi, { mis = [0, 0], z = Z, delay = 0 } = {}) {
    const mat = basic(low);
    const m = plane(w, h, mat, parent, x + mis[0], y + mis[1], z);
    const el = { m, mat, low: new THREE.Color(low), hi: new THREE.Color(hi), home: new THREE.Vector2(x, y), mis: new THREE.Vector2(mis[0], mis[1]), delay };
    uiEls.push(el);
    return el;
  }
  const topY = 0.875;
  ui(desk, 2.8, 0.14, 0, topY - 0.07, C.bone200, C.bone0, { delay: 0 });
  ui(desk, 0.08, 0.08, -1.28, topY - 0.07, C.bone300, C.olive600, { z: Z + 0.001, delay: 0 });
  ui(desk, 0.5, 1.61, -1.15, -0.07, C.bone100, C.olive900, { delay: 0.004 });
  [0.58, 0.49, 0.4, 0.31].forEach((y, i) => ui(desk, 0.3, 0.035, -1.16, y, C.bone300, i === 0 ? C.olive400 : C.bone700, { z: Z + 0.001, delay: 0.005 }));
  ui(desk, 0.8, 0.07, -0.4, 0.6, C.bone300, C.bone950, { mis: [0.035, -0.02], delay: 0.004 });
  ui(desk, 0.55, 0.035, -0.525, 0.5, C.bone200, C.bone600, { mis: [0.035, -0.02], delay: 0.005 });
  const cta = ui(desk, 0.42, 0.13, 1.0, 0.58, C.bone0, C.olive600, { mis: [-0.04, 0.03], delay: 0.004 });
  const ctaLabel = ui(desk, 0.2, 0.024, 1.0, 0.58, C.bone300, C.bone0, { mis: [-0.04, 0.03], z: Z + 0.001, delay: 0.004 });
  const outlineMat = basic(C.bone950, { transparent: true, opacity: 1 });
  const ctaOutline = new THREE.Group();
  desk.add(ctaOutline);
  [[0.42, 0.006, 0, 0.065], [0.42, 0.006, 0, -0.065], [0.006, 0.13, 0.21, 0], [0.006, 0.13, -0.21, 0]].forEach(([w, h, x, y]) => plane(w, h, outlineMat, ctaOutline, x, y, Z + 0.0015));
  const cardXs = [-0.52, 0.2, 0.92];
  const cardMis = [[0.02, -0.03], [-0.03, 0.02], [0.025, 0.015]];
  cardXs.forEach((x, i) => {
    ui(desk, 0.66, 0.36, x, 0.19, C.bone100, C.bone0, { mis: cardMis[i], delay: 0.008 });
    ui(desk, 0.2, 0.025, x - 0.18, 0.28, C.bone300, C.bone400, { mis: cardMis[i], z: Z + 0.001, delay: 0.008 });
    ui(desk, 0.34, 0.07, x - 0.1, 0.15, C.bone300, C.olive600, { mis: cardMis[i], z: Z + 0.001, delay: 0.009 });
  });
  ui(desk, 2.1, 0.72, 0.2, -0.43, C.bone100, C.bone0, { mis: [-0.02, 0.03], delay: 0.012 });
  const xMat = basic(C.bone300, { transparent: true, opacity: 1 });
  const chartX = new THREE.Group();
  chartX.position.set(0.2, -0.43, Z + 0.001);
  desk.add(chartX);
  const diag = Math.atan2(0.72, 2.1);
  const xl1 = plane(Math.hypot(2.1, 0.72), 0.006, xMat, chartX, 0, 0, 0);
  xl1.rotation.z = diag;
  const xl2 = plane(Math.hypot(2.1, 0.72), 0.006, xMat, chartX, 0, 0, 0);
  xl2.rotation.z = -diag;
  const chartPts = [0.9, 0.72, 0.78, 0.52, 0.6, 0.38, 0.46, 0.24, 0.3];
  const shape = new THREE.Shape();
  shape.moveTo(-1.02, -0.34);
  chartPts.forEach((v, i) => shape.lineTo(-1.02 + (i / (chartPts.length - 1)) * 2.04, 0.34 - v * 0.62));
  shape.lineTo(1.02, -0.34);
  shape.lineTo(-1.02, -0.34);
  const areaMat = basic(C.olive400, { transparent: true, opacity: 0 });
  mesh(new THREE.ShapeGeometry(shape), areaMat, chartX, 0, 0, 0.0005);
  const linePts = chartPts.map((v, i) => new THREE.Vector3(-1.02 + (i / (chartPts.length - 1)) * 2.04, 0.34 - v * 0.62, 0.001));
  const chartLineGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(linePts), 80, 0.006, 5, false);
  const chartLineMat = basic(C.olive600, { transparent: true, opacity: 0 });
  mesh(chartLineGeo, chartLineMat, chartX, 0, 0, 0);

  /* phone UI */
  ui(phone, 0.5, 0.03, 0, 0.58, C.bone200, C.bone400, { delay: 0.006 });
  ui(phone, 0.5, 0.36, 0, 0.3, C.bone100, C.olive500, { mis: [0.02, -0.02], delay: 0.008 });
  ui(phone, 0.4, 0.05, -0.05, 0.03, C.bone300, C.bone950, { mis: [-0.02, 0.01], delay: 0.01 });
  ui(phone, 0.46, 0.025, -0.02, -0.06, C.bone200, C.bone600, { delay: 0.011 });
  ui(phone, 0.32, 0.025, -0.09, -0.12, C.bone200, C.bone600, { delay: 0.011 });
  ui(phone, 0.5, 0.2, 0, -0.32, C.bone100, C.olive100, { mis: [0.015, 0.02], delay: 0.012 });
  ui(phone, 0.5, 0.09, 0, -0.53, C.bone0, C.olive600, { mis: [-0.02, -0.015], delay: 0.013 });

  /* redlines + 12-column grid */
  const redMat = basic(C.redline, { transparent: true, opacity: 0, toneMapped: false });
  const redlines = [];
  function redline(ax, ay, bx, by) {
    const g = new THREE.Group();
    desk.add(g);
    const horizontal = Math.abs(by - ay) < 1e-6;
    const len = horizontal ? Math.abs(bx - ax) : Math.abs(by - ay);
    const cx = (ax + bx) / 2;
    const cy = (ay + by) / 2;
    g.position.set(cx, cy, Z + 0.004);
    plane(horizontal ? len : 0.005, horizontal ? 0.005 : len, redMat, g, 0, 0, 0);
    const t = 0.04;
    if (horizontal) {
      plane(0.005, t, redMat, g, -len / 2, 0, 0);
      plane(0.005, t, redMat, g, len / 2, 0, 0);
      plane(0.07, 0.034, redMat, g, 0, 0.035, 0);
    } else {
      plane(t, 0.005, redMat, g, 0, -len / 2, 0);
      plane(t, 0.005, redMat, g, 0, len / 2, 0);
      plane(0.07, 0.034, redMat, g, 0.06, 0, 0);
    }
    redlines.push({ g, horizontal });
  }
  redline(-0.9, 0.66, -0.8, 0.66);
  redline(-0.7, 0.735, -0.7, 0.635);
  redline(-0.19, 0.19, -0.13, 0.19);
  redline(0.95, 0.01, 0.95, -0.07);
  const gridMat = basic(C.redline, { transparent: true, opacity: 0, depthWrite: false });
  const gridGroup = new THREE.Group();
  desk.add(gridGroup);
  const colW = (2.18 - 11 * 0.03) / 12;
  for (let i = 0; i < 12; i++) plane(colW, 1.53, gridMat, gridGroup, -0.84 + colW / 2 + i * (colW + 0.03), -0.035, Z + 0.003);

  const handleMat = basic(C.proto, { transparent: true, opacity: 0, toneMapped: false });
  [[-1.4, 0.875], [1.4, 0.875], [-1.4, -0.875], [1.4, -0.875]].forEach(([x, y]) => plane(0.04, 0.04, handleMat, desk, x, y, 0.02));
  const outlineSel = [[2.8, 0.006, 0, 0.878], [2.8, 0.006, 0, -0.878], [0.006, 1.756, 1.403, 0], [0.006, 1.756, -1.403, 0]];
  outlineSel.forEach(([w, h, x, y]) => plane(w, h, handleMat, desk, x, y, 0.019));

  /* ---------- Validate: comment pins, hotspot, prototype noodle ---------- */
  function makePin(color) {
    const g = new THREE.Group();
    const mat = std(color, 0.35, 0.05, { emissive: new THREE.Color(color), emissiveIntensity: 0.35 });
    mesh(new THREE.SphereGeometry(0.05, 20, 16), mat, g, 0, 0, 0);
    const tip = mesh(new THREE.ConeGeometry(0.032, 0.06, 16), mat, g, -0.03, -0.04, 0);
    tip.rotation.z = Math.PI * 0.75;
    g.scale.setScalar(0.001);
    return { g, mat, color: new THREE.Color(color) };
  }
  const pins = [
    { ...makePin(C.olive500), pos: [1.18, 0.7], at: 0.672 },
    { ...makePin(C.sand500), pos: [0.46, 0.32], at: 0.68 },
    { ...makePin(C.olive500), pos: [-0.35, -0.22], at: 0.688 },
  ];
  pins.forEach((pn) => {
    pn.g.position.set(pn.pos[0], pn.pos[1], 0.07);
    desk.add(pn.g);
  });
  const successColor = new THREE.Color(C.success);

  const hotMat = basic(C.proto, { transparent: true, opacity: 0, toneMapped: false });
  const hotFill = basic(C.proto, { transparent: true, opacity: 0, depthWrite: false });
  const hotspot = new THREE.Group();
  hotspot.position.set(1.0, 0.58, Z + 0.006);
  desk.add(hotspot);
  plane(0.47, 0.18, hotFill, hotspot, 0, 0, 0);
  [[0.47, 0.006, 0, 0.09], [0.47, 0.006, 0, -0.09], [0.006, 0.18, 0.235, 0], [0.006, 0.18, -0.235, 0]].forEach(([w, h, x, y]) => plane(w, h, hotMat, hotspot, x, y, 0.001));
  mesh(new THREE.CircleGeometry(0.018, 20), hotMat, hotspot, 0.235, 0, 0.002);

  const noodleCurve = new THREE.CubicBezierCurve3(
    new THREE.Vector3(13.645, 2.13, -7.95),
    new THREE.Vector3(13.95, 2.34, -7.9),
    new THREE.Vector3(13.9, 1.72, -7.9),
    new THREE.Vector3(14.07, 1.72, -7.95),
  );
  const noodleGeo = new THREE.TubeGeometry(noodleCurve, 72, 0.008, 6, false);
  mesh(noodleGeo, basic(C.proto, { toneMapped: false }), world);
  noodleGeo.setDrawRange(0, 0);
  const noodleArrow = mesh(new THREE.ConeGeometry(0.025, 0.05, 12), basic(C.proto, { toneMapped: false }), world, 14.05, 1.72, -7.95);
  noodleArrow.rotation.z = -Math.PI / 2;
  noodleArrow.scale.setScalar(0.001);

  /* ---------- Deliver: token fan deck, spec chips, ready-for-dev pill ---------- */
  const tokenColors = [C.olive50, C.olive100, C.olive200, C.olive300, C.olive400, C.olive500, C.olive600, C.olive700, C.olive800, C.olive900, C.olive950, C.sand500, C.proto, C.redline];
  const fan = new THREE.Group();
  fan.position.set(15.25, 0.78, -7.85);
  world.add(fan);
  const chips = tokenColors.map((c, i) => {
    const pivot = new THREE.Group();
    pivot.position.z = i * 0.004;
    fan.add(pivot);
    box(0.11, 0.5, 0.006, frameMat(c), pivot, 0, 0.25, 0);
    return pivot;
  });

  const specMat = basic(C.proto, { transparent: true, opacity: 0, toneMapped: false });
  const specChips = [[desk, -0.1, 0.71], [desk, 0.62, 0.42], [phone, 0, 0.7]].map(([parent, x, y]) => {
    const g = new THREE.Group();
    g.position.set(x, y, Z + 0.01);
    parent.add(g);
    [[0.26, 0.004, 0, 0.028], [0.26, 0.004, 0, -0.028], [0.004, 0.056, 0.13, 0], [0.004, 0.056, -0.13, 0]].forEach(([w, h, px, py]) => plane(w, h, specMat, g, px, py, 0));
    plane(0.16, 0.012, specMat, g, -0.03, 0, 0);
    return g;
  });
  const pill = new THREE.Group();
  pill.position.set(-0.86, 0.94, 0);
  desk.add(pill);
  const pillMat = basic(C.olive800, { transparent: true, opacity: 0 });
  const pillDot = basic(C.success, { transparent: true, opacity: 0, toneMapped: false });
  plane(0.28, 0.06, pillMat, pill, 0, 0, 0.001);
  mesh(new THREE.CircleGeometry(0.014, 16), pillDot, pill, -0.1, 0, 0.002);

  /* floating bokeh in the canvas world */
  const bokehCount = high ? 260 : 90;
  const bokehGeo = track(new THREE.BufferGeometry());
  const bokehBase = new Float32Array(bokehCount * 3);
  const bokehPos = new Float32Array(bokehCount * 3);
  const br = rng(77);
  for (let i = 0; i < bokehCount; i++) {
    bokehBase[i * 3] = -4 + br() * 22;
    bokehBase[i * 3 + 1] = 0.3 + br() * 3.6;
    bokehBase[i * 3 + 2] = 2 - br() * 13;
  }
  bokehGeo.setAttribute('position', new THREE.BufferAttribute(bokehPos, 3));
  const bokeh = new THREE.Points(bokehGeo, track(new THREE.PointsMaterial({
    color: C.olive200, size: 0.03, map: spriteTexture, transparent: true, opacity: 0.35,
    depthWrite: false, blending: THREE.AdditiveBlending,
  })));
  world.add(bokeh);

  /* =====================================================================
     State
     ===================================================================== */
  const paths = CAMERA_PATHS.map((path) => ({
    ...path,
    pos: new THREE.CatmullRomCurve3(path.keys.map((k) => new THREE.Vector3(...k[1])), false, 'centripetal'),
    tgt: new THREE.CatmullRomCurve3(path.keys.map((k) => new THREE.Vector3(...k[2])), false, 'centripetal'),
  }));
  const vPos = new THREE.Vector3();
  const vTgt = new THREE.Vector3();

  function sampleCamera(p) {
    const path = paths.find((pa) => p >= pa.from && p < pa.to) || paths[paths.length - 1];
    const k = path.keys;
    let i = 0;
    while (i < k.length - 2 && p >= k[i + 1][0]) i++;
    const t = smooth(range(p, k[i][0], k[i + 1][0]));
    const u = (i + t) / (k.length - 1);
    path.pos.getPoint(u, vPos).add(path.offset);
    path.tgt.getPoint(u, vTgt).add(path.offset);
    camera.position.copy(vPos);
    camera.lookAt(vTgt);
  }

  let progress = 0;
  let inWorld = false;
  let screenOn = 0;
  let lampPower = 1;

  function setProgress(p) {
    progress = clamp01(p);
    const pr = progress;
    inWorld = pr >= CUTS.toWorld && pr < CUTS.toStudio;
    studio.visible = !inWorld;
    world.visible = inWorld;
    const bg = inWorld ? worldBg : studioBg;
    scene.background.copy(bg);
    scene.fog.color.copy(bg);
    scene.fog.near = inWorld ? 7 : 2.2;
    scene.fog.far = inWorld ? 26 : 7.5;
    scene.environmentIntensity = inWorld ? 0.35 : lerp(0.22, 0.4, ease(pr, 0.85, 0.94));

    sampleCamera(pr);

    /* studio: screen wakes in the hero, shows the final UI in the finale */
    const finale = pr >= CUTS.toStudio;
    if (finale) {
      screenMat.map = screenHifi;
      screenOn = 1;
    } else {
      screenMat.map = screenLowfi;
      screenOn = ease(pr, 0.065, 0.1);
    }
    screenMat.color.setScalar(screenOn);
    screenGlow.intensity = screenOn * 0.35;
    studioHemi.intensity = finale ? lerp(0.25, 0.55, ease(pr, 0.86, 0.95)) : 0.18;
    lampPower = finale ? 1 : 1;

    /* stylus: in hand during the finale, set down beside the tablet */
    const setDown = finale ? ease(pr, 0.865, 0.905) : 1;
    stylus.position.lerpVectors(STYLUS_HAND.pos, STYLUS_REST.pos, setDown);
    stylus.rotation.set(
      lerp(STYLUS_HAND.rot.x, STYLUS_REST.rot.x, setDown),
      lerp(STYLUS_HAND.rot.y, STYLUS_REST.rot.y, setDown),
      lerp(STYLUS_HAND.rot.z, STYLUS_REST.rot.z, setDown),
    );

    /* sketchbook closes at the end — the same object from the opening shot */
    const close = finale ? ease(pr, 0.9, 0.95) : 0;
    spine.rotation.z = close * Math.PI * 0.995;

    /* world: discover → research */
    notes.forEach((n) => {
      const fly = ease(pr, 0.17 + n.delayIn, 0.205 + n.delayIn);
      const group = ease(pr, 0.262 + n.delayCluster, 0.3 + n.delayCluster);
      const flyT = backOut(fly) * 0.15 + fly * 0.85;
      n.g.position.lerpVectors(n.start, n.scatter, clamp01(flyT));
      n.g.position.lerp(n.cluster, group);
      n.g.rotation.set(
        lerp(n.rotStart.x, 0, fly),
        lerp(n.rotStart.y, 0, fly),
        lerp(lerp(n.rotStart.z, n.rotScatter, fly), n.rotCluster, group),
      );
    });
    clusterHeads.forEach((h, k) => {
      h.scale.x = Math.max(0.001, ease(pr, 0.3 + k * 0.006, 0.318 + k * 0.006));
    });

    /* define: edges draw like current, nodes light up when reached */
    nodes.forEach((n, i) => {
      let lit = i === 0 ? ease(pr, 0.37, 0.378) : 0;
      edgeObjs.forEach((e) => { if (e.b === i) lit = Math.max(lit, ease(pr, e.end - 0.004, e.end + 0.006)); });
      n.mat.emissiveIntensity = 0.32 + lit * 0.4;
      n.glowMat.opacity = lit * 0.35;
    });
    edgeObjs.forEach((e) => {
      const d = range(pr, e.start, e.end);
      e.geo.setDrawRange(0, Math.floor(d * e.tubular) * e.perRing);
      e.arrow.scale.setScalar(Math.max(0.001, ease(pr, e.end - 0.002, e.end + 0.004)));
    });

    /* design: redlines & grid, snap to grid, then high fidelity */
    const measure = ease(pr, 0.525, 0.55) * (1 - ease(pr, 0.598, 0.618));
    redMat.opacity = measure;
    redlines.forEach((r) => {
      const s = Math.max(0.001, ease(pr, 0.525, 0.548));
      if (r.horizontal) r.g.scale.x = s; else r.g.scale.y = s;
    });
    gridMat.opacity = 0.055 * ease(pr, 0.53, 0.552) * (1 - ease(pr, 0.598, 0.618));
    const align = ease(pr, 0.552, 0.582);
    const selected = ease(pr, 0.5, 0.52) * (1 - ease(pr, 0.655, 0.675)) + ease(pr, 0.76, 0.785);
    handleMat.opacity = Math.min(1, selected);
    uiEls.forEach((el) => {
      const fill = ease(pr, 0.585 + el.delay, 0.608 + el.delay);
      el.mat.color.copy(el.low).lerp(el.hi, fill);
      el.m.position.x = el.home.x + el.mis.x * (1 - align);
      el.m.position.y = el.home.y + el.mis.y * (1 - align);
    });
    const hifi = ease(pr, 0.59, 0.612);
    outlineMat.opacity = 1 - hifi;
    ctaOutline.position.set(-0.04 * (1 - align), 0.03 * (1 - align), 0);
    xMat.opacity = 1 - ease(pr, 0.596, 0.61);
    areaMat.opacity = 0.42 * ease(pr, 0.6, 0.618);
    chartLineMat.opacity = ease(pr, 0.602, 0.62);

    /* validate: pins pop, hotspot pulses, prototype connection draws, pins resolve */
    pins.forEach((pn) => {
      const pop = range(pr, pn.at, pn.at + 0.014);
      const resolve = ease(pr, 0.726, 0.748);
      const s = pop <= 0 ? 0.001 : backOut(pop) * lerp(1, 0.62, resolve);
      pn.g.scale.setScalar(Math.max(0.001, s));
      pn.mat.color.copy(pn.color).lerp(successColor, resolve);
      pn.mat.emissive.copy(pn.mat.color);
    });
    const hot = ease(pr, 0.692, 0.702) * (1 - ease(pr, 0.745, 0.76));
    hotMat.opacity = hot;
    hotFill.opacity = hot * 0.14;
    const noodle = range(pr, 0.698, 0.722);
    noodleGeo.setDrawRange(0, Math.floor(noodle * 72) * 36);
    noodleArrow.scale.setScalar(Math.max(0.001, ease(pr, 0.72, 0.726)) * (noodle > 0 ? 1 : 0.001));

    /* deliver: the token deck fans out, spec chips and ready-for-dev appear */
    const fanOut = ease(pr, 0.752, 0.79);
    chips.forEach((c, i) => {
      c.rotation.z = lerp(0, (i / (chips.length - 1) - 0.5) * 1.35, fanOut) - 0.25 * fanOut;
    });
    specMat.opacity = ease(pr, 0.765, 0.785);
    pillMat.opacity = ease(pr, 0.772, 0.79);
    pillDot.opacity = pillMat.opacity;
  }

  /* ambient life, time-based — never changes story state */
  function ambient(time) {
    if (!inWorld) {
      const flicker = 0.97 + Math.sin(time * 13.1) * 0.012 + Math.sin(time * 31.7) * 0.01;
      lampLight.intensity = 3.2 * lampPower * flicker;
      beamMat.uniforms.uIntensity.value = 0.22 * flicker;
      bulbMat.color.setScalar(flicker);
      for (let i = 0; i < dustCount; i++) {
        const d = dustSeed[i];
        const t = (d.t + time * 0.012 * d.s) % 1;
        const along = 0.1 + t * 0.85;
        const radius = lerp(0.05, 0.3, along) * d.r;
        const a = d.a + Math.sin(time * 0.3 + d.ph) * 0.4;
        const ix = i * 3;
        dustPos[ix] = lampHead.x + headDir.x * beamLen * along + (beamPerp1.x * Math.cos(a) + beamPerp2.x * Math.sin(a)) * radius;
        dustPos[ix + 1] = lampHead.y + headDir.y * beamLen * along + (beamPerp1.y * Math.cos(a) + beamPerp2.y * Math.sin(a)) * radius;
        dustPos[ix + 2] = lampHead.z + headDir.z * beamLen * along + (beamPerp1.z * Math.cos(a) + beamPerp2.z * Math.sin(a)) * radius;
      }
      dustGeo.attributes.position.needsUpdate = true;
    } else {
      for (let i = 0; i < bokehCount; i++) {
        const ix = i * 3;
        bokehPos[ix] = bokehBase[ix] + Math.sin(time * 0.15 + i) * 0.12;
        bokehPos[ix + 1] = bokehBase[ix + 1] + Math.sin(time * 0.2 + i * 1.7) * 0.08;
        bokehPos[ix + 2] = bokehBase[ix + 2];
      }
      bokehGeo.attributes.position.needsUpdate = true;
      const pulse = 1 + Math.sin(time * 4.2) * 0.035;
      hotspot.scale.set(pulse, pulse, 1);
    }
  }

  /* Compose around the HTML copy: the subject shifts right in landscape (copy
     sits left) and up in portrait (copy sits at the bottom). */
  function applyProjection(w, h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = camera.aspect < 0.8 ? 58 : camera.aspect < 1.2 ? 46 : 36;
    if (camera.aspect < 0.9) camera.setViewOffset(w, h, 0, h * 0.15, w, h);
    else camera.setViewOffset(w, h, -w * 0.13, 0, w, h);
    camera.updateProjectionMatrix();
  }

  function resize() {
    applyProjection(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight);
  }

  function render(time = performance.now() / 1000) {
    ambient(time);
    renderer.render(scene, camera);
  }

  function snapshot(p, width, height) {
    applyProjection(width, height);
    setProgress(p);
    render(1.5);
    return canvas.toDataURL('image/jpeg', 0.84);
  }

  function dispose() {
    disposables.forEach((d) => d.dispose && d.dispose());
    renderer.dispose();
  }

  /* smooth, symmetric dip-to-canvas at each cut */
  function cutOpacity(p) {
    const d = Math.min(Math.abs(p - CUTS.toWorld), Math.abs(p - CUTS.toStudio));
    return 1 - smooth(clamp01(d / CUT_HALF));
  }

  resize();
  setProgress(0);

  return { setProgress, render, resize, snapshot, dispose, cutOpacity, get progress() { return progress; } };
}
