/* JM · Cinematic story scene — v3.1.0 "Canvas"
   Light-first. A MacBook Pro on a sunny desk opens the story; the camera dives
   into its screen and lands on a FigJam-style board where the UI/UX process
   plays out. It returns to the desk, the lid closes and the stickers show,
   Jess in the middle. setProgress(p) is deterministic (0..1): scrolling back
   always rewinds. tick(time) only adds ambient life. */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

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

/* Palette — mirrors assets/css/tokens.css v2 */
const C = {
  paper0: '#FFFFFF', paper50: '#F7F3EA', paper100: '#EFEADD', paper200: '#E3DCCB', paper300: '#D3CAB5',
  ink400: '#8E8C80', ink500: '#66655B', ink600: '#4E4D44', ink800: '#2A2922', ink900: '#16150F',
  leaf: '#6E9A55', leafDark: '#3F6B3A', stem: '#557A3C',
  yellow: '#FFD95A', lilac: '#C9B8FF', mint: '#B5EBDD', pink: '#FFC4DE', coral: '#FF8A66', sky: '#A9D4FF',
  violet: '#6445D6', teal: '#0B6F6B', success: '#2E7A3C',
};
const FONT_DISPLAY = '"Brygada 1918", Georgia, serif';
const FONT_SANS = '"Hanken Grotesk", system-ui, sans-serif';
const FONT_HAND = '"Mynerve", "Bradley Hand", cursive';
const FONT_MONO = '"Fragment Mono", ui-monospace, monospace';

export const CUTS = { toWorld: 0.16, toStudio: 0.83 };
const CUT_HALF = 0.02;
const W = new THREE.Vector3(0, 0, -40);

export function createStory(canvas, options = {}) {
  const high = options.quality !== 'low';
  let dark = Boolean(options.dark);
  const characterUrl = options.characterUrl || 'assets/img/jess-character.png';

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: high, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, high ? 1.75 : 1.25));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = high;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color();
  scene.fog = new THREE.Fog(0xffffff, 2.5, 8);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(36, 1, 0.02, 80);
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  /* ---------- helpers ---------- */
  const disposables = [];
  const track = (x) => { disposables.push(x); return x; };
  const std = (color, rough = 0.6, metal = 0, extra = {}) => track(new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra }));
  const basic = (color, extra = {}) => track(new THREE.MeshBasicMaterial({ color, ...extra }));
  function mesh(geo, mat, parent, x = 0, y = 0, z = 0, { cast = false, receive = false } = {}) {
    const m = new THREE.Mesh(track(geo), mat);
    m.position.set(x, y, z);
    m.castShadow = cast && high;
    m.receiveShadow = receive && high;
    if (parent) parent.add(m);
    return m;
  }
  const box = (w, h, d, mat, parent, x, y, z, o) => mesh(new THREE.BoxGeometry(w, h, d), mat, parent, x, y, z, o);
  const plane = (w, h, mat, parent, x, y, z) => mesh(new THREE.PlaneGeometry(w, h), mat, parent, x, y, z);
  function canvasTexture(w, h, draw, repeat) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = track(new THREE.CanvasTexture(c));
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    t.userData.canvas = c;
    t.userData.draw = draw;
    return t;
  }
  function redraw(t) {
    const c = t.userData.canvas;
    const g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    t.userData.draw(g, c.width, c.height);
    t.needsUpdate = true;
  }
  function rr(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  function sparklePath(g, cx, cy, r) {
    g.beginPath();
    g.moveTo(cx, cy - r);
    g.bezierCurveTo(cx + r * 0.12, cy - r * 0.3, cx + r * 0.3, cy - r * 0.12, cx + r, cy);
    g.bezierCurveTo(cx + r * 0.3, cy + r * 0.12, cx + r * 0.12, cy + r * 0.3, cx, cy + r);
    g.bezierCurveTo(cx - r * 0.12, cy + r * 0.3, cx - r * 0.3, cy + r * 0.12, cx - r, cy);
    g.bezierCurveTo(cx - r * 0.3, cy - r * 0.12, cx - r * 0.12, cy - r * 0.3, cx, cy - r);
    g.closePath();
  }

  /* ---------- procedural textures ---------- */
  const oak = canvasTexture(512, 512, (g, w, h) => {
    const r = rng(7);
    g.fillStyle = '#C9A77E';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 200; i++) {
      const y = r() * h;
      g.strokeStyle = `rgba(${r() > 0.5 ? '146,108,68' : '226,200,160'},${0.1 + r() * 0.16})`;
      g.lineWidth = 1 + r() * 3;
      g.beginPath();
      g.moveTo(0, y);
      g.bezierCurveTo(w * 0.3, y + (r() - 0.5) * 14, w * 0.7, y + (r() - 0.5) * 14, w, y + (r() - 0.5) * 8);
      g.stroke();
    }
  }, [1.5, 1]);
  const floorTex = canvasTexture(512, 512, (g, w, h) => {
    const r = rng(11);
    for (let i = 0; i < 8; i++) {
      const tone = 170 + Math.floor(r() * 22);
      g.fillStyle = `rgb(${tone},${tone - 22},${tone - 52})`;
      g.fillRect(0, i * (h / 8), w, h / 8);
      g.fillStyle = 'rgba(80,56,30,0.35)';
      g.fillRect(0, i * (h / 8), w, 2);
    }
  }, [6, 6]);
  const cork = canvasTexture(256, 256, (g, w, h) => {
    const r = rng(3);
    g.fillStyle = '#B08A5C';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = `rgba(${r() > 0.5 ? '96,70,40' : '214,180,130'},${0.25 + r() * 0.35})`;
      g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
    }
  }, [2, 1.2]);
  function drawSketch(seed) {
    return (g, w, h) => {
      const r = rng(seed);
      g.fillStyle = '#FBF8F1';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(40,40,36,0.75)';
      g.lineCap = 'round';
      const line = (x1, y1, x2, y2) => {
        g.beginPath();
        g.moveTo(x1 + (r() - 0.5) * 2, y1 + (r() - 0.5) * 2);
        g.quadraticCurveTo((x1 + x2) / 2 + (r() - 0.5) * 4, (y1 + y2) / 2 + (r() - 0.5) * 4, x2, y2);
        g.stroke();
      };
      const sb = (x, y, bw, bh) => { line(x, y, x + bw, y); line(x + bw, y, x + bw, y + bh); line(x + bw, y + bh, x, y + bh); line(x, y + bh, x, y); };
      g.lineWidth = 2.2; sb(w * 0.1, h * 0.08, w * 0.8, h * 0.84);
      g.lineWidth = 1.6; sb(w * 0.16, h * 0.14, w * 0.68, h * 0.08); sb(w * 0.16, h * 0.27, w * 0.68, h * 0.26);
      line(w * 0.16, h * 0.27, w * 0.84, h * 0.53); line(w * 0.84, h * 0.27, w * 0.16, h * 0.53);
      for (let i = 0; i < 4; i++) line(w * 0.16, h * (0.6 + i * 0.05), w * (0.5 + r() * 0.3), h * (0.6 + i * 0.05));
      g.fillStyle = C.lilac; g.globalAlpha = 0.75; g.fillRect(w * 0.16, h * 0.82, w * 0.3, h * 0.06); g.globalAlpha = 1;
      g.strokeStyle = C.violet; g.lineWidth = 2; g.beginPath(); g.arc(w * 0.72, h * 0.85, 12, 0, Math.PI * 1.7); g.stroke();
    };
  }

  /* screen: a Figma-like light canvas with the artboard, low-fi then hi-fi */
  function drawScreen(hifi) {
    return (g, w, h) => {
      g.fillStyle = '#F4F0E6';
      g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(22,21,15,0.14)';
      for (let x = 14; x < w; x += 26) for (let y = 14; y < h; y += 26) g.fillRect(x, y, 2.4, 2.4);
      g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, w, 40);
      g.fillStyle = C.ink900; g.fillRect(0, 40, w, 2);
      g.fillStyle = C.lilac; rr(g, 14, 10, 20, 20, 5); g.fill();
      g.fillStyle = 'rgba(22,21,15,0.25)'; for (let i = 0; i < 5; i++) g.fillRect(52 + i * 34, 16, 22, 8);
      const fx = 170, fy = 104, fw = 640, fh = 420;
      g.fillStyle = C.ink500; g.font = `400 13px ${FONT_MONO}`; g.fillText('Frame 04 · Design / Dashboard', fx, fy - 12);
      g.fillStyle = '#FFFFFF'; g.fillRect(fx, fy, fw, fh);
      g.strokeStyle = C.violet; g.lineWidth = 2; g.strokeRect(fx - 1, fy - 1, fw + 2, fh + 2);
      g.fillStyle = C.violet; [[fx, fy], [fx + fw, fy], [fx, fy + fh], [fx + fw, fy + fh]].forEach(([x, y]) => g.fillRect(x - 4, y - 4, 8, 8));
      g.fillStyle = hifi ? '#FFFFFF' : '#EFEADD'; g.fillRect(fx, fy, fw, 36);
      g.fillStyle = hifi ? C.ink900 : '#E6E0D2'; g.fillRect(fx, fy + 36, 116, fh - 36);
      g.fillStyle = hifi ? C.lilac : '#D3CAB5'; rr(g, fx + 12, fy + 9, 18, 18, 4); g.fill();
      for (let i = 0; i < 4; i++) { g.fillStyle = hifi ? (i === 0 ? C.lilac : 'rgba(255,255,255,0.35)') : '#D3CAB5'; rr(g, fx + 14, fy + 58 + i * 24, 80, 10, 4); g.fill(); }
      g.fillStyle = hifi ? C.ink900 : '#D3CAB5'; g.fillRect(fx + 146, fy + 60, 200, 18);
      g.fillStyle = hifi ? C.ink500 : '#E3DCCB'; g.fillRect(fx + 146, fy + 88, 140, 9);
      if (hifi) {
        g.fillStyle = C.lilac; rr(g, fx + 523, fy + 57, 100, 32, 8); g.fill();
        g.fillStyle = C.ink900; rr(g, fx + 520, fy + 54, 100, 32, 8); g.fill();
        g.strokeStyle = C.ink900; g.lineWidth = 2; rr(g, fx + 520, fy + 54, 100, 32, 8); g.stroke();
        g.fillStyle = '#FFFFFF'; g.fillRect(fx + 544, fy + 67, 52, 6);
      } else {
        g.strokeStyle = C.ink900; g.lineWidth = 2; rr(g, fx + 520, fy + 54, 100, 32, 8); g.stroke();
      }
      const cardColors = [C.mint, C.lilac, C.yellow];
      for (let i = 0; i < 3; i++) {
        const cx = fx + 146 + i * 160;
        g.fillStyle = hifi ? '#FFFFFF' : '#F4F0E6'; rr(g, cx, fy + 118, 144, 78, 10); g.fill();
        if (hifi) { g.strokeStyle = C.ink900; g.lineWidth = 2; rr(g, cx, fy + 118, 144, 78, 10); g.stroke(); }
        g.fillStyle = hifi ? cardColors[i] : '#D3CAB5'; rr(g, cx + 12, fy + 132, 34, 34, 8); g.fill();
        g.fillStyle = hifi ? C.ink900 : '#D3CAB5'; g.fillRect(cx + 56, fy + 138, 70, 14);
        g.fillStyle = hifi ? C.ink400 : '#E3DCCB'; g.fillRect(cx + 56, fy + 160, 50, 7);
      }
      const chx = fx + 146, chy = fy + 216, chw = 474, chh = 180;
      g.fillStyle = hifi ? '#FFFFFF' : '#F4F0E6'; rr(g, chx, chy, chw, chh, 10); g.fill();
      if (hifi) {
        g.strokeStyle = C.ink900; g.lineWidth = 2; rr(g, chx, chy, chw, chh, 10); g.stroke();
        const pts = [0.9, 0.72, 0.78, 0.52, 0.6, 0.38, 0.46, 0.24, 0.3];
        g.beginPath(); g.moveTo(chx, chy + chh);
        pts.forEach((v, i) => g.lineTo(chx + (i / (pts.length - 1)) * chw, chy + v * chh));
        g.lineTo(chx + chw, chy + chh); g.closePath(); g.fillStyle = 'rgba(201,184,255,0.55)'; g.fill();
        g.beginPath(); pts.forEach((v, i) => (i ? g.lineTo : g.moveTo).call(g, chx + (i / (pts.length - 1)) * chw, chy + v * chh));
        g.strokeStyle = C.violet; g.lineWidth = 3.5; g.stroke();
      } else {
        g.strokeStyle = '#D3CAB5'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(chx, chy); g.lineTo(chx + chw, chy + chh); g.moveTo(chx + chw, chy); g.lineTo(chx, chy + chh); g.stroke();
        g.fillStyle = C.coral; g.fillRect(fx + 116, fy + 68, 30, 2); g.fillRect(fx + 116, fy + 62, 2, 14); g.fillRect(fx + 144, fy + 62, 2, 14);
      }
      g.fillStyle = C.yellow; g.save(); g.translate(fx + fw + 20, fy + 40); g.rotate(0.05); g.fillRect(0, 0, 110, 96); g.restore();
      g.fillStyle = C.ink900; g.font = `400 22px ${FONT_HAND}`; g.save(); g.translate(fx + fw + 30, fy + 74); g.rotate(0.05);
      g.fillText(hifi ? 'ship it!' : 'test w/ 5', 0, 0); g.fillText(hifi ? '✓ ready' : 'users', 0, 26); g.restore();
    };
  }
  const screenLowfi = canvasTexture(1000, 640, drawScreen(false));
  const screenHifi = canvasTexture(1000, 640, drawScreen(true));

  function dotTex(bg, dot) {
    return canvasTexture(128, 128, (g, w, h) => {
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      g.fillStyle = dot; g.beginPath(); g.arc(w / 2, h / 2, 7, 0, Math.PI * 2); g.fill();
    }, [360, 180]);
  }
  const dotsLight = dotTex('#F4F0E6', 'rgba(22,21,15,0.2)');
  const dotsDark = dotTex('#151611', 'rgba(242,239,230,0.16)');

  const spriteTexture = canvasTexture(64, 64, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.35, 'rgba(255,255,255,0.55)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  });

  /* =====================================================================
     STUDIO — a sunny desk (hero + finale)
     ===================================================================== */
  const studio = new THREE.Group();
  scene.add(studio);

  const M = {
    wall: std('#EFE8DA', 0.95),
    floor: std('#ffffff', 0.8, 0, { map: floorTex }),
    desk: std('#ffffff', 0.5, 0, { map: oak }),
    deskLeg: std('#F2EEE6', 0.5, 0.1),
    alu: std('#C9CCD0', 0.32, 0.9),
    aluDark: std('#A7ABB0', 0.4, 0.85),
    black: std('#0E0E10', 0.35, 0.2),
    trackpad: std('#BFC2C6', 0.22, 0.85),
    mugMat: std(C.lilac, 0.35, 0.05),
    terracotta: std('#B5673F', 0.85),
    leaf: std(C.leaf, 0.7),
    leafDark: std(C.leafDark, 0.7),
    cork: std('#ffffff', 0.95, 0, { map: cork }),
    edge: std(C.paper200, 0.9),
    cover: std(C.lilac, 0.6),
  };

  mesh(new THREE.PlaneGeometry(8, 8), M.floor, studio, 0, 0, 0, { receive: true }).rotation.x = -Math.PI / 2;
  box(6, 3, 0.1, M.wall, studio, 0, 1.5, -1.15, { receive: true });
  box(0.1, 3, 5, M.wall, studio, -2.3, 1.5, 1.2, { receive: true });
  box(0.1, 3, 5, M.wall, studio, 2.5, 1.5, 1.2, { receive: true });

  box(1.7, 0.045, 0.82, M.desk, studio, 0, 0.7275, 0, { cast: true, receive: true });
  [[-0.78, -0.34], [0.78, -0.34], [-0.78, 0.34], [0.78, 0.34]].forEach(([x, z]) => box(0.04, 0.705, 0.04, M.deskLeg, studio, x, 0.3525, z, { cast: true }));

  /* ---------- MacBook Pro 14" ---------- */
  const MAC = { w: 0.3128, d: 0.2212, base: 0.0106, lid: 0.0052 };
  const mac = new THREE.Group();
  mac.position.set(0.02, 0.754, 0.06);
  mac.rotation.y = -0.1;
  studio.add(mac);
  mesh(new RoundedBoxGeometry(MAC.w, MAC.base, MAC.d, 3, 0.005), M.alu, mac, 0, MAC.base / 2, 0, { cast: true, receive: true });
  const keyTex = canvasTexture(512, 200, (g, w, h) => {
    g.fillStyle = '#1B1B1D'; g.fillRect(0, 0, w, h);
    const rows = [14, 14, 14, 13, 12, 9];
    rows.forEach((n, ri) => {
      const kh = h / rows.length - 5;
      const kw = (w - 8) / 14 - 4;
      let x = 6;
      for (let i = 0; i < n; i++) {
        const ww = ri === 5 && i === 4 ? kw * 5.4 : ri === 3 && i === 0 ? kw * 1.6 : kw;
        g.fillStyle = '#0B0B0C'; rr(g, x, 4 + ri * (kh + 5), ww, kh, 4); g.fill();
        x += ww + 4;
      }
    });
  });
  const keys = plane(0.272, 0.108, std('#ffffff', 0.7, 0.1, { map: keyTex }), mac, 0, MAC.base + 0.0004, -0.037);
  keys.rotation.x = -Math.PI / 2;
  const pad = mesh(new RoundedBoxGeometry(0.13, 0.0008, 0.082, 2, 0.0004), M.trackpad, mac, 0, MAC.base + 0.0002, 0.062);
  pad.receiveShadow = high;

  const hinge = new THREE.Group();
  hinge.position.set(0, MAC.base, -MAC.d / 2 + 0.002);
  mac.add(hinge);
  const lid = new THREE.Group();
  hinge.add(lid);
  mesh(new RoundedBoxGeometry(MAC.w, MAC.d, MAC.lid, 3, 0.0024), M.alu, lid, 0, MAC.d / 2, -MAC.lid / 2, { cast: true, receive: true });
  plane(MAC.w - 0.006, MAC.d - 0.006, M.black, lid, 0, MAC.d / 2, 0.0003);
  const screenMat = basic('#000000', { map: screenLowfi, toneMapped: false });
  const screen = plane(0.296, 0.19, screenMat, lid, 0, MAC.d / 2 + 0.006, 0.0006);
  plane(0.03, 0.006, M.black, lid, 0, MAC.d - 0.012, 0.0008);
  const screenGlow = new THREE.PointLight('#e8efff', 0, 1.0, 2);
  screenGlow.position.set(0, MAC.d / 2, 0.12);
  lid.add(screenGlow);
  const LID_OPEN = -0.29;
  const LID_CLOSED = Math.PI / 2;

  /* stickers live on the back of the lid, oriented to read upright when closed */
  const stickerLayer = new THREE.Group();
  lid.add(stickerLayer);

  /* ---------- sketchbook, mug, plant, lamp ---------- */
  const sketchA = canvasTexture(512, 700, drawSketch(21));
  const sketchB = canvasTexture(512, 700, drawSketch(34));
  const book = new THREE.Group();
  book.position.set(-0.5, 0.7505, 0.02);
  book.rotation.y = 0.2;
  studio.add(book);
  const pageA = std('#ffffff', 0.9, 0, { map: sketchA });
  const pageB = std('#ffffff', 0.9, 0, { map: sketchB });
  const leftHalf = new THREE.Mesh(track(new THREE.BoxGeometry(0.24, 0.008, 0.33)), [M.edge, M.edge, pageA, M.cover, M.edge, M.edge]);
  leftHalf.position.set(-0.121, 0.004, 0); leftHalf.castShadow = high; leftHalf.receiveShadow = high; book.add(leftHalf);
  const rightHalf = new THREE.Mesh(track(new THREE.BoxGeometry(0.24, 0.006, 0.33)), [M.edge, M.edge, pageB, M.cover, M.edge, M.edge]);
  rightHalf.position.set(0.121, 0.005, 0); rightHalf.castShadow = high; rightHalf.receiveShadow = high; book.add(rightHalf);

  const mug = new THREE.Group();
  mug.position.set(0.47, 0.75, -0.18);
  studio.add(mug);
  mesh(new THREE.CylinderGeometry(0.038, 0.034, 0.095, 32), M.mugMat, mug, 0, 0.0475, 0, { cast: true });
  mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.002, 32), std('#3a2414', 0.2), mug, 0, 0.087, 0);
  mesh(new THREE.TorusGeometry(0.022, 0.006, 10, 24), M.mugMat, mug, 0.042, 0.05, 0, { cast: true }).rotation.y = Math.PI / 2;

  const plant = new THREE.Group();
  plant.position.set(-0.7, 0.75, -0.28);
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

  const lampBase = new THREE.Vector3(0.66, 0.75, -0.3);
  const lampHead = new THREE.Vector3(0.42, 1.18, -0.16);
  const lampMat = std(C.yellow, 0.45, 0.1);
  mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.02, 32), lampMat, studio, lampBase.x, 0.76, lampBase.z, { cast: true });
  function rod(a, b, r, mat) {
    const m = mesh(new THREE.CylinderGeometry(r, r, a.distanceTo(b), 12), mat, studio, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, { cast: true });
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  }
  const elbow = new THREE.Vector3(0.7, 1.08, -0.34);
  rod(new THREE.Vector3(lampBase.x, 0.77, lampBase.z), elbow, 0.008, M.black);
  rod(elbow, lampHead, 0.008, M.black);
  const lampTarget = new THREE.Vector3(0.05, 0.75, 0.05);
  const headDir = lampTarget.clone().sub(lampHead).normalize();
  const shade = mesh(new THREE.CylinderGeometry(0.035, 0.085, 0.11, 32, 1, true), std(C.yellow, 0.45, 0.1, { side: THREE.DoubleSide }), studio, lampHead.x, lampHead.y, lampHead.z, { cast: true });
  shade.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), headDir);
  const bulbMat = basic('#fff1d6', { toneMapped: false });
  mesh(new THREE.SphereGeometry(0.022, 16, 12), bulbMat, studio, lampHead.x + headDir.x * 0.03, lampHead.y + headDir.y * 0.03, lampHead.z + headDir.z * 0.03);
  const lampLight = new THREE.SpotLight('#ffd6a0', 0, 4, 0.62, 0.65, 2);
  lampLight.position.copy(lampHead);
  lampLight.target.position.copy(lampTarget);
  studio.add(lampLight, lampLight.target);

  /* =====================================================================
     Jessica's desk — organised, a few personal things, lots of clear space.
     References: designer desk tours (felt mat, pegboard, pen cup, a framed
     print, flowers, a colour swatch fan). Palette follows the site.
     ===================================================================== */
  const put = (obj, x, y, z, ry = 0) => { obj.position.set(x, y, z); obj.rotation.y = ry; studio.add(obj); return obj; };
  const DESK_Y = 0.75;

  /* felt desk mat under the laptop */
  mesh(new RoundedBoxGeometry(0.66, 0.004, 0.4, 2, 0.002), std('#D8D1C2', 0.98), studio, 0.03, DESK_Y + 0.002, 0.07, { receive: true });

  /* pen cup with pencils and markers */
  const cup = put(new THREE.Group(), -0.3, DESK_Y, -0.27);
  mesh(new THREE.CylinderGeometry(0.034, 0.03, 0.095, 28, 1, true), std('#F4F1EA', 0.5, 0, { side: THREE.DoubleSide }), cup, 0, 0.0475, 0, { cast: true });
  mesh(new THREE.CylinderGeometry(0.0342, 0.0342, 0.02, 28, 1, true), std(C.lilac, 0.5, 0, { side: THREE.DoubleSide }), cup, 0, 0.07, 0);
  mesh(new THREE.CircleGeometry(0.03, 20), std('#E6E1D6', 0.6), cup, 0, 0.004, 0).rotation.x = -Math.PI / 2;
  const penR = rng(12);
  [C.yellow, C.violet, C.coral, C.ink900, C.mint, C.sky].forEach((color, k) => {
    const a = (k / 6) * Math.PI * 2;
    const pen = new THREE.Group();
    pen.position.set(Math.cos(a) * 0.012, 0.075, Math.sin(a) * 0.012);
    pen.rotation.set(Math.sin(a) * 0.22, 0, -Math.cos(a) * 0.22);
    cup.add(pen);
    const len = 0.12 + penR() * 0.04;
    mesh(new THREE.CylinderGeometry(0.0038, 0.0038, len, 6), std(color, 0.55), pen, 0, 0, 0, { cast: true });
    mesh(new THREE.ConeGeometry(0.0038, 0.012, 6), std(k % 2 ? '#E9D8BE' : C.ink900, 0.6), pen, 0, len / 2 + 0.006, 0);
  });

  /* sunflowers in a white vase */
  const vase = put(new THREE.Group(), -0.5, DESK_Y, -0.3);
  mesh(new THREE.CylinderGeometry(0.03, 0.042, 0.13, 28), std('#F2EEE6', 0.35, 0.05), vase, 0, 0.065, 0, { cast: true });
  const petalTex = canvasTexture(256, 256, (g, w, h) => {
    g.translate(w / 2, h / 2);
    for (let k = 0; k < 18; k++) {
      g.rotate((Math.PI * 2) / 18);
      g.fillStyle = k % 2 ? '#FFC93C' : '#FFD95A';
      g.beginPath(); g.ellipse(0, -74, 17, 50, 0, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = '#5A3A1E'; g.beginPath(); g.arc(0, 0, 44, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let k = 0; k < 60; k++) { const a = k * 2.4; const r = Math.sqrt(k) * 5.4; g.beginPath(); g.arc(Math.cos(a) * r, Math.sin(a) * r, 2.4, 0, Math.PI * 2); g.fill(); }
  });
  const petalMat = std('#ffffff', 0.8, 0, { map: petalTex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide });
  const stemMat = std(C.stem, 0.7);
  [[0.0, 0.3, 0.1, -0.15], [-0.04, 0.25, -0.25, 0.1], [0.045, 0.22, 0.3, 0.25]].forEach(([dx, hgt, tiltX, tiltZ]) => {
    const f = new THREE.Group();
    f.position.set(dx * 0.3, 0.1, 0);
    f.rotation.set(tiltX * 0.5, 0, tiltZ);
    vase.add(f);
    mesh(new THREE.CylinderGeometry(0.0028, 0.0032, hgt, 6), stemMat, f, 0, hgt / 2, 0, { cast: true });
    const head = plane(0.12, 0.12, petalMat, f, 0, hgt + 0.01, 0.01);
    head.rotation.set(-0.25, 0.55, 0);
    head.castShadow = high;
    const leafM = mesh(new THREE.SphereGeometry(0.02, 10, 8), M.leaf, f, 0.014, hgt * 0.45, 0);
    leafM.scale.set(1.3, 0.35, 0.6);
  });

  /* stack of books with the sunflower sunglasses on top */
  const stack = put(new THREE.Group(), 0.57, DESK_Y, 0.2, -0.25);
  [[0.21, 0.028, 0.15, C.lilac, 0], [0.19, 0.024, 0.14, '#EDE6D6', 0.08], [0.2, 0.03, 0.145, C.ink800, -0.05]].reduce((y, [bw, bh, bd, color, rot]) => {
    const b = mesh(new THREE.BoxGeometry(bw, bh, bd), std(color, 0.75), stack, 0, y + bh / 2, 0, { cast: true, receive: true });
    b.rotation.y = rot;
    mesh(new THREE.BoxGeometry(bw - 0.008, bh - 0.006, bd + 0.001), std('#F7F3EA', 0.9), stack, 0.004, y + bh / 2, 0).rotation.y = rot;
    return y + bh;
  }, 0);
  function drawGlasses(g, w, h) {
    const flower = (cx, cy, r) => {
      g.fillStyle = C.yellow; g.strokeStyle = C.ink900; g.lineWidth = 2.5;
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; g.beginPath(); g.ellipse(cx + Math.cos(a) * r * 0.62, cy + Math.sin(a) * r * 0.62, r * 0.38, r * 0.28, a, 0, Math.PI * 2); g.fill(); g.stroke(); }
      g.fillStyle = '#2E7D5B'; g.beginPath(); g.arc(cx, cy, r * 0.52, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(cx - r * 0.18, cy - r * 0.18, r * 0.16, 0, Math.PI * 2); g.fill();
    };
    flower(w * 0.27, h * 0.5, h * 0.44); flower(w * 0.73, h * 0.5, h * 0.44);
    g.strokeStyle = C.ink900; g.lineWidth = 4; g.beginPath(); g.moveTo(w * 0.43, h * 0.46); g.quadraticCurveTo(w / 2, h * 0.36, w * 0.57, h * 0.46); g.stroke();
  }
  const glassesTex = canvasTexture(512, 220, drawGlasses);
  const glasses = plane(0.15, 0.064, std('#ffffff', 0.5, 0, { map: glassesTex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide }), stack, 0.01, 0.086, 0.005);
  glasses.rotation.set(-Math.PI / 2, 0, 0.35);
  glasses.castShadow = high;

  /* colour swatch fan, like a Pantone book */
  const swatch = put(new THREE.Group(), -0.21, DESK_Y + 0.0046, 0.29, 0.5);
  [C.lilac, C.yellow, C.mint, C.pink, C.coral, C.sky].forEach((color, k) => {
    const t = canvasTexture(64, 220, (g, w, h) => {
      g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, w, h);
      g.fillStyle = color; g.fillRect(4, 4, w - 8, h * 0.62);
      g.fillStyle = C.ink400; g.fillRect(6, h * 0.72, w * 0.6, 5); g.fillRect(6, h * 0.8, w * 0.4, 4);
    });
    const leaf = new THREE.Group();
    leaf.rotation.y = -0.2 + k * 0.16;
    swatch.add(leaf);
    const m = plane(0.045, 0.15, std('#ffffff', 0.7, 0, { map: t }), leaf, 0, 0.0006 * k, -0.07);
    m.rotation.x = -Math.PI / 2;
    m.receiveShadow = high;
  });
  mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.008, 12), M.alu, swatch, 0, 0.004, 0);

  /* sticky-note pads and a pencil */
  const pads = put(new THREE.Group(), 0.33, DESK_Y, 0.08, 0.35);
  mesh(new THREE.BoxGeometry(0.076, 0.014, 0.076), std(C.yellow, 0.85), pads, 0, 0.007, 0, { cast: true, receive: true });
  mesh(new THREE.BoxGeometry(0.076, 0.01, 0.076), std(C.lilac, 0.85), pads, 0.05, 0.005, 0.07, { cast: true, receive: true }).rotation.y = 0.5;
  const pencil = mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.16, 6), std(C.yellow, 0.55), pads, -0.02, 0.004, 0.1, { cast: true });
  pencil.rotation.set(0, 0.3, Math.PI / 2);

  /* phone, face down */
  const phoneBody = put(new THREE.Group(), 0.33, DESK_Y + 0.002, -0.1, 0.45);
  mesh(new RoundedBoxGeometry(0.072, 0.008, 0.148, 3, 0.003), std('#2A2922', 0.35, 0.3), phoneBody, 0, 0.004, 0, { cast: true });
  mesh(new RoundedBoxGeometry(0.03, 0.003, 0.03, 2, 0.001), std('#3A3931', 0.3, 0.4), phoneBody, -0.016, 0.009, -0.05);

  /* wall: lilac pegboard with a shelf, headphones, sketches and a framed print */
  const pegTex = canvasTexture(512, 320, (g, w, h) => {
    g.fillStyle = '#DCD1FF'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(40,30,80,0.35)';
    for (let x = 16; x < w; x += 24) for (let y = 16; y < h; y += 24) { g.beginPath(); g.arc(x, y, 3.2, 0, Math.PI * 2); g.fill(); }
  });
  box(1.12, 0.68, 0.018, std('#ffffff', 0.9, 0, { map: pegTex }), studio, -0.36, 1.56, -1.09, { receive: true });
  const shelf = box(0.34, 0.014, 0.09, std('#ffffff', 0.55, 0, { map: oak }), studio, -0.66, 1.4, -1.035, { cast: true, receive: true });
  shelf.userData.shelf = true;
  mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.05, 20), M.terracotta, studio, -0.75, 1.432, -1.04, { cast: true });
  for (let k = 0; k < 5; k++) {
    const leaf = mesh(new THREE.SphereGeometry(0.016, 10, 8), k % 2 ? M.leaf : M.leafDark, studio, -0.75 + Math.cos(k * 1.3) * 0.012, 1.475 + (k % 3) * 0.008, -1.04 + Math.sin(k * 1.3) * 0.012, { cast: true });
    leaf.scale.set(0.6, 1.6, 0.35);
    leaf.rotation.z = Math.cos(k * 1.3) * 0.5;
  }
  [[0.03, 0.1, C.coral], [0.024, 0.085, C.ink800], [0.03, 0.095, C.sky]].reduce((x, [bw, bh, color]) => {
    box(bw, bh, 0.07, std(color, 0.8), studio, x + bw / 2, 1.407 + bh / 2, -1.04, { cast: true });
    return x + bw + 0.004;
  }, -0.66);
  /* headphones on a peg */
  const phones = put(new THREE.Group(), -0.12, 1.66, -1.06);
  mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.04, 8), M.alu, phones, 0, 0.02, 0.01).rotation.x = Math.PI / 2;
  const band = mesh(new THREE.TorusGeometry(0.075, 0.008, 8, 28, Math.PI), std('#EDE6D6', 0.6), phones, 0, -0.05, 0.03, { cast: true });
  band.rotation.z = 0;
  [-1, 1].forEach((sd) => {
    const cupM = mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.024, 24), std('#EDE6D6', 0.6), phones, sd * 0.075, -0.07, 0.03, { cast: true });
    cupM.rotation.z = Math.PI / 2;
    mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.006, 24), std(C.ink800, 0.9), phones, sd * 0.062, -0.07, 0.03).rotation.z = Math.PI / 2;
  });
  /* sketches taped to the board (washi tape, not pins) */
  [[-0.72, 1.72, 0.05, 31, C.mint], [-0.52, 1.73, -0.04, 44, C.yellow], [0.08, 1.52, 0.04, 52, C.pink]].forEach(([x, y, rot, seed, tape]) => {
    const paper = plane(0.15, 0.2, std('#ffffff', 0.9, 0, { map: canvasTexture(256, 340, drawSketch(seed)) }), studio, x, y, -1.079);
    paper.rotation.z = rot;
    const t = plane(0.06, 0.018, std(tape, 0.8, 0, { transparent: true, opacity: 0.85 }), studio, x + Math.sin(-rot) * 0.1, y + 0.1, -1.078);
    t.rotation.z = rot + 0.2;
  });
  /* framed print: the quote from the About section */
  const printTex = canvasTexture(360, 460, (g, w, h) => {
    g.fillStyle = '#FBF8F1'; g.fillRect(0, 0, w, h);
    g.fillStyle = C.lilac; g.beginPath(); g.arc(w * 0.66, h * 0.33, 92, 0, Math.PI * 2); g.fill();
    g.fillStyle = C.yellow; sparklePath(g, w * 0.3, h * 0.2, 34); g.fill();
    g.strokeStyle = C.ink900; g.lineWidth = 1.5; sparklePath(g, w * 0.3, h * 0.2, 34); g.stroke();
    g.fillStyle = C.ink900; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.font = `400 34px ${FONT_DISPLAY}`; g.fillText('Good design', 34, h * 0.66);
    g.fillText('stands on', 34, h * 0.66 + 40);
    g.font = `italic 400 34px ${FONT_DISPLAY}`; g.fillText('your side.', 34, h * 0.66 + 80);
    g.font = `400 12px ${FONT_MONO}`; g.fillStyle = C.ink500; g.fillText('JM · 2026', 34, h - 26);
  });
  box(0.36, 0.46, 0.02, std(C.ink900, 0.5), studio, 0.5, 1.6, -1.09, { cast: true });
  plane(0.3, 0.4, std('#ffffff', 0.85, 0, { map: printTex }), studio, 0.5, 1.6, -1.0795);

  /* bookshelf on the right */
  box(0.9, 0.025, 0.2, M.deskLeg, studio, 1.3, 1.35, -1.0, { cast: true });
  const books = [[0.04, 0.26, C.violet], [0.035, 0.22, C.lilac], [0.05, 0.28, C.ink800], [0.03, 0.24, C.yellow], [0.045, 0.2, C.mint], [0.04, 0.27, C.coral]];
  let bx = 0.95;
  books.forEach(([w, h, c]) => { box(w, h, 0.16, std(c, 0.8), studio, bx + w / 2, 1.3625 + h / 2, -1.0, { cast: true }); bx += w + 0.006; });

  /* window on the right wall + the sun */
  const windowMat = basic('#DCEEFB', { toneMapped: false });
  plane(1.1, 1.0, windowMat, studio, 2.44, 1.6, -0.2).rotation.y = -Math.PI / 2;
  box(0.04, 1.04, 0.04, M.deskLeg, studio, 2.43, 1.6, -0.2);
  box(0.04, 0.04, 1.14, M.deskLeg, studio, 2.43, 1.6, -0.2);
  const sun = new THREE.DirectionalLight('#FFF1D8', 2.6);
  sun.position.set(2.4, 2.2, 0.6);
  sun.target.position.set(0, 0.75, 0);
  sun.castShadow = high;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -1.2; sun.shadow.camera.right = 1.2; sun.shadow.camera.top = 1.2; sun.shadow.camera.bottom = -1.2;
  sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 6;
  sun.shadow.bias = -0.0006;
  sun.shadow.radius = 4;
  studio.add(sun, sun.target);
  const studioHemi = new THREE.HemisphereLight('#FFF6E8', '#B8A68C', 1.2);
  studio.add(studioHemi);

  /* sunbeam through the window, with dust */
  const beamFrom = new THREE.Vector3(2.4, 1.75, 0.2);
  const beamTo = new THREE.Vector3(0.1, 0.76, 0.05);
  const beamDir = beamTo.clone().sub(beamFrom).normalize();
  const beamLen = beamFrom.distanceTo(beamTo);
  const beamMat = track(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color('#FFE3B0') }, uIntensity: { value: 0.12 } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec2 vUv; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); vUv = uv; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uColor; uniform float uIntensity; varying vec3 vN; varying vec3 vV; varying vec2 vUv; void main(){ float f = pow(abs(dot(vN,vV)),1.4); float a = f * smoothstep(0.0,0.2,vUv.y) * smoothstep(1.0,0.75,vUv.y) * uIntensity; gl_FragColor = vec4(uColor*a, a); }',
  }));
  const beam = mesh(new THREE.CylinderGeometry(0.5, 0.26, beamLen, 40, 1, true), beamMat, studio, (beamFrom.x + beamTo.x) / 2, (beamFrom.y + beamTo.y) / 2, (beamFrom.z + beamTo.z) / 2);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), beamDir);
  const dustCount = high ? 200 : 70;
  const dustSeed = [];
  const dr = rng(99);
  for (let i = 0; i < dustCount; i++) dustSeed.push({ t: dr(), a: dr() * Math.PI * 2, r: Math.sqrt(dr()), s: 0.3 + dr() * 0.7, ph: dr() * 10 });
  const dustGeo = track(new THREE.BufferGeometry());
  const dustPos = new Float32Array(dustCount * 3);
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustMat = track(new THREE.PointsMaterial({ color: '#FFF3D6', size: 0.006, map: spriteTexture, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
  studio.add(new THREE.Points(dustGeo, dustMat));
  const perp1 = new THREE.Vector3().crossVectors(beamDir, new THREE.Vector3(0, 0, 1)).normalize();
  const perp2 = new THREE.Vector3().crossVectors(beamDir, perp1).normalize();

  /* =====================================================================
     WORLD — a FigJam-style board
     ===================================================================== */
  const world = new THREE.Group();
  world.position.copy(W);
  world.visible = false;
  scene.add(world);

  /* the board itself: an endless dotted wall far behind everything */
  const floorMat = basic('#ffffff', { map: dotsLight, fog: false });
  plane(200, 100, floorMat, world, 6, 0, -16);
  const worldHemi = new THREE.HemisphereLight('#FFFFFF', '#E9E2D2', 1.6);
  world.add(worldHemi);
  const key = new THREE.DirectionalLight('#FFFFFF', 1.4);
  key.position.set(6, 9, 6);
  key.target.position.set(6, 1.4, -5);
  world.add(key, key.target);

  /* generic flat card: a plane with a canvas texture, plus a soft drop shadow */
  const shadowTex = canvasTexture(128, 128, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(22,21,15,0.35)'); grd.addColorStop(1, 'rgba(22,21,15,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  });
  function card(parent, w, h, tex, { shadow = true, z = 0 } = {}) {
    const g = new THREE.Group();
    parent.add(g);
    if (shadow) {
      const s = plane(w * 1.28, h * 1.34, basic('#ffffff', { map: shadowTex, transparent: true, depthWrite: false }), g, w * 0.04, -h * 0.08, z - 0.004);
      s.renderOrder = -1;
    }
    plane(w, h, basic('#ffffff', { map: tex, transparent: true }), g, 0, 0, z);
    return g;
  }

  /* ---------- Discover + Research: stickies → sections ---------- */
  const STICKY_COLORS = [C.yellow, C.lilac, C.mint, C.pink, C.coral, C.sky];
  const NOTES = ['why so\nmany steps?', 'hidden\nfees?', 'trust the\npayment?', 'love the\nclean UI', 'where is\nhelp?', 'receipts\nplease', 'too slow\nat checkout', 'icons are\nconfusing', 'one-tap\npay!', 'dark mode\npls', 'track my\norder', 'saved\ncards', 'compare\nprices', 'first time\nlost', 'notify\nme', 'security\n= trust', 'quick\nsetup', 'makes me\nsmile'];
  const noteTextures = NOTES.map((txt, i) => canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = STICKY_COLORS[i % STICKY_COLORS.length]; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.05)'; g.fillRect(0, h - 18, w, 18);
    g.fillStyle = C.ink900; g.font = `400 46px ${FONT_HAND}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    txt.split('\n').forEach((line, li, arr) => g.fillText(line, w / 2, h / 2 + (li - (arr.length - 1) / 2) * 50));
  }));
  const notes = [];
  const nr = rng(2024);
  const clusters = [-0.96, 0, 0.96];
  for (let i = 0; i < 18; i++) {
    const g = card(world, 0.26, 0.26, noteTextures[i]);
    const col = i % 6;
    const row = Math.floor(i / 6);
    const k = i % 3;
    const slot = Math.floor(i / 3);
    notes.push({
      g,
      scatter: new THREE.Vector3(-2.3 + col * 0.92 + (nr() - 0.5) * 0.25, 1.05 + row * 0.62 + (nr() - 0.5) * 0.2, -3 + (nr() - 0.5) * 0.1),
      cluster: new THREE.Vector3(clusters[k] + (slot % 2 ? 0.15 : -0.15), 2.02 - Math.floor(slot / 2) * 0.3, -3 + 0.003 * slot),
      start: new THREE.Vector3((nr() - 0.5) * 11, 0.2 + nr() * 3.6, -9 - nr() * 5),
      rotStart: new THREE.Euler((nr() - 0.5) * 2.4, (nr() - 0.5) * 2.4, (nr() - 0.5) * 2),
      rotScatter: (nr() - 0.5) * 0.3,
      rotCluster: (nr() - 0.5) * 0.08,
      delayIn: i * 0.0022,
      delayCluster: (i % 6) * 0.004 + k * 0.002,
    });
  }
  const SECTION_TITLES = [['Pain points', C.coral], ['Needs', C.lilac], ['Delights', C.mint]];
  const sections = SECTION_TITLES.map(([title, color], k) => {
    const tex = canvasTexture(512, 700, (g, w, h) => {
      g.fillStyle = color; g.globalAlpha = 0.28; rr(g, 6, 70, w - 12, h - 76, 26); g.fill(); g.globalAlpha = 1;
      g.strokeStyle = C.ink900; g.lineWidth = 2.5; rr(g, 6, 70, w - 12, h - 76, 26); g.stroke();
      g.font = `600 40px ${FONT_SANS}`;
      const tw = g.measureText(title).width + 40;
      g.fillStyle = color; rr(g, 6, 6, tw, 56, 14); g.fill();
      g.strokeStyle = C.ink900; g.lineWidth = 2.5; rr(g, 6, 6, tw, 56, 14); g.stroke();
      g.fillStyle = C.ink900; g.textBaseline = 'middle'; g.fillText(title, 26, 36);
    });
    const m = plane(0.8, 1.1, basic('#ffffff', { map: tex, transparent: true, depthWrite: false }), world, clusters[k], 1.8, -3.02);
    m.material.opacity = 0;
    m.renderOrder = -2;
    return m;
  });

  /* ---------- Define: FigJam flowchart ---------- */
  const SHAPES = [
    { label: 'Open app', kind: 'pill', color: C.mint, x: 3.4, y: 1.65 },
    { label: 'Log in', kind: 'rect', color: C.lilac, x: 4.85, y: 2.1 },
    { label: 'New user?', kind: 'diamond', color: C.yellow, x: 6.25, y: 2.32 },
    { label: 'Saved card', kind: 'rect', color: C.sky, x: 6.25, y: 1.18 },
    { label: 'Pay', kind: 'rect', color: C.pink, x: 7.65, y: 1.86 },
    { label: 'Receipt ✓', kind: 'pill', color: C.mint, x: 8.95, y: 1.65 },
  ];
  const shapeTex = SHAPES.map((s) => canvasTexture(512, 320, (g, w, h) => {
    g.fillStyle = s.color; g.strokeStyle = C.ink900; g.lineWidth = 4.5;
    if (s.kind === 'diamond') {
      g.beginPath(); g.moveTo(w / 2, 12); g.lineTo(w - 12, h / 2); g.lineTo(w / 2, h - 12); g.lineTo(12, h / 2); g.closePath();
    } else rr(g, 10, 10, w - 20, h - 20, s.kind === 'pill' ? (h - 20) / 2 : 36);
    g.fill(); g.stroke();
    g.fillStyle = C.ink900; g.font = `600 ${s.kind === 'diamond' ? 50 : 60}px ${FONT_SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(s.label, w / 2, h / 2 + 2);
  }));
  const nodes = SHAPES.map((s, i) => {
    const g = card(world, 0.62, 0.39, shapeTex[i]);
    g.position.set(s.x, s.y, -5);
    g.scale.setScalar(0.001);
    return g;
  });
  const edges = [[0, 1, 0.372], [1, 2, 0.388], [1, 3, 0.392], [2, 4, 0.405], [3, 4, 0.41], [4, 5, 0.425]];
  const inkLine = basic(C.ink900);
  const edgeObjs = edges.map(([a, b, start]) => {
    const pa = nodes[a].position.clone().add(new THREE.Vector3(0.31, 0, 0.01));
    const pb = nodes[b].position.clone().add(new THREE.Vector3(-0.33, 0, 0.01));
    const mx = (pa.x + pb.x) / 2;
    const r = Math.min(0.08, Math.abs(pb.y - pa.y) / 2, Math.abs(mx - pa.x));
    const path = new THREE.CurvePath();
    const sy = Math.sign(pb.y - pa.y) || 1;
    if (Math.abs(pb.y - pa.y) < 0.01) path.add(new THREE.LineCurve3(pa, pb));
    else {
      const c1 = new THREE.Vector3(mx, pa.y, pa.z);
      const c2 = new THREE.Vector3(mx, pb.y, pb.z);
      path.add(new THREE.LineCurve3(pa, new THREE.Vector3(mx - r, pa.y, pa.z)));
      path.add(new THREE.QuadraticBezierCurve3(new THREE.Vector3(mx - r, pa.y, pa.z), c1, new THREE.Vector3(mx, pa.y + sy * r, pa.z)));
      path.add(new THREE.LineCurve3(new THREE.Vector3(mx, pa.y + sy * r, pa.z), new THREE.Vector3(mx, pb.y - sy * r, pb.z)));
      path.add(new THREE.QuadraticBezierCurve3(new THREE.Vector3(mx, pb.y - sy * r, pb.z), c2, new THREE.Vector3(mx + r, pb.y, pb.z)));
      path.add(new THREE.LineCurve3(new THREE.Vector3(mx + r, pb.y, pb.z), pb));
    }
    const tubular = 96;
    const geo = new THREE.TubeGeometry(path, tubular, 0.0055, 6, false);
    mesh(geo, inkLine, world);
    geo.setDrawRange(0, 0);
    const arrow = mesh(new THREE.ConeGeometry(0.028, 0.055, 3), inkLine, world, pb.x - 0.012, pb.y, pb.z);
    arrow.rotation.z = -Math.PI / 2;
    arrow.scale.setScalar(0.001);
    return { geo, arrow, b, start, end: start + 0.02, perRing: 36, tubular };
  });

  /* ---------- Design: the artboard ---------- */
  const frameMat = (color) => basic(color);
  const desk = new THREE.Group();
  desk.position.set(12.4, 1.55, -8);
  world.add(desk);
  box(2.84, 1.79, 0.02, basic(C.ink900), desk, 0, 0, -0.012);
  box(2.8, 1.75, 0.03, frameMat(C.paper0), desk, 0, 0, 0);
  const labelTex = (txt) => canvasTexture(512, 64, (g, w, h) => { g.fillStyle = C.ink500; g.font = `400 30px ${FONT_MONO}`; g.textBaseline = 'middle'; g.fillText(txt, 4, h / 2); });
  plane(1.1, 0.14, basic('#ffffff', { map: labelTex('Frame 04 · Dashboard'), transparent: true }), desk, -0.85, 0.96, 0);

  const phone = new THREE.Group();
  phone.position.set(14.4, 1.4, -8);
  world.add(phone);
  mesh(new RoundedBoxGeometry(0.68, 1.34, 0.04, 3, 0.06), basic(C.ink900), phone, 0, 0, -0.006);
  mesh(new RoundedBoxGeometry(0.62, 1.28, 0.03, 3, 0.05), frameMat(C.paper0), phone, 0, 0, 0);
  plane(0.9, 0.12, basic('#ffffff', { map: labelTex('Mobile · 390'), transparent: true }), phone, -0.1, 0.74, 0);

  const Z = 0.0165;
  const uiEls = [];
  function ui(parent, w, h, x, y, low, hi, { mis = [0, 0], z = Z, delay = 0 } = {}) {
    const mat = basic(low);
    const m = plane(w, h, mat, parent, x + mis[0], y + mis[1], z);
    uiEls.push({ m, mat, low: new THREE.Color(low), hi: new THREE.Color(hi), home: new THREE.Vector2(x, y), mis: new THREE.Vector2(mis[0], mis[1]), delay });
  }
  const topY = 0.875;
  ui(desk, 2.8, 0.14, 0, topY - 0.07, C.paper100, C.paper0);
  ui(desk, 0.08, 0.08, -1.28, topY - 0.07, C.paper300, C.lilac, { z: Z + 0.001 });
  ui(desk, 0.5, 1.61, -1.15, -0.07, C.paper100, C.ink900, { delay: 0.004 });
  [0.58, 0.49, 0.4, 0.31].forEach((y, i) => ui(desk, 0.3, 0.035, -1.16, y, C.paper300, i === 0 ? C.lilac : C.ink500, { z: Z + 0.001, delay: 0.005 }));
  ui(desk, 0.8, 0.07, -0.4, 0.6, C.paper300, C.ink900, { mis: [0.035, -0.02], delay: 0.004 });
  ui(desk, 0.55, 0.035, -0.525, 0.5, C.paper200, C.ink500, { mis: [0.035, -0.02], delay: 0.005 });
  ui(desk, 0.42, 0.13, 1.0, 0.58, C.paper0, C.ink900, { mis: [-0.04, 0.03], delay: 0.004 });
  ui(desk, 0.2, 0.024, 1.0, 0.58, C.paper300, C.paper0, { mis: [-0.04, 0.03], z: Z + 0.001, delay: 0.004 });
  const outlineMat = basic(C.ink900, { transparent: true, opacity: 1 });
  const ctaOutline = new THREE.Group();
  desk.add(ctaOutline);
  [[0.42, 0.008, 0, 0.065], [0.42, 0.008, 0, -0.065], [0.008, 0.13, 0.21, 0], [0.008, 0.13, -0.21, 0]].forEach(([w, h, x, y]) => plane(w, h, outlineMat, ctaOutline, x + 1.0, y + 0.58, Z + 0.0015));
  const ctaShadow = plane(0.42, 0.13, basic(C.ink900, { transparent: true, opacity: 0 }), desk, 1.018, 0.562, Z - 0.0005);
  const cardXs = [-0.52, 0.2, 0.92];
  const cardMis = [[0.02, -0.03], [-0.03, 0.02], [0.025, 0.015]];
  const cardAccents = [C.mint, C.lilac, C.yellow];
  cardXs.forEach((x, i) => {
    ui(desk, 0.66, 0.36, x, 0.19, C.paper100, C.paper0, { mis: cardMis[i], delay: 0.008 });
    ui(desk, 0.12, 0.12, x - 0.22, 0.2, C.paper300, cardAccents[i], { mis: cardMis[i], z: Z + 0.001, delay: 0.009 });
    ui(desk, 0.26, 0.06, x + 0.06, 0.22, C.paper300, C.ink900, { mis: cardMis[i], z: Z + 0.001, delay: 0.009 });
    ui(desk, 0.18, 0.025, x + 0.02, 0.13, C.paper200, C.ink400, { mis: cardMis[i], z: Z + 0.001, delay: 0.01 });
  });
  const cardBorderMat = basic(C.ink900, { transparent: true, opacity: 0 });
  cardXs.forEach((x) => {
    [[0.66, 0.008, 0, 0.18], [0.66, 0.008, 0, -0.18], [0.008, 0.36, 0.33, 0], [0.008, 0.36, -0.33, 0]].forEach(([w, h, dx, dy]) => plane(w, h, cardBorderMat, desk, x + dx, 0.19 + dy, Z + 0.002));
  });
  ui(desk, 2.1, 0.72, 0.2, -0.43, C.paper100, C.paper0, { mis: [-0.02, 0.03], delay: 0.012 });
  const xMat = basic(C.paper300, { transparent: true, opacity: 1 });
  const chartX = new THREE.Group();
  chartX.position.set(0.2, -0.43, Z + 0.001);
  desk.add(chartX);
  const diag = Math.atan2(0.72, 2.1);
  plane(Math.hypot(2.1, 0.72), 0.006, xMat, chartX, 0, 0, 0).rotation.z = diag;
  plane(Math.hypot(2.1, 0.72), 0.006, xMat, chartX, 0, 0, 0).rotation.z = -diag;
  const chartPts = [0.9, 0.72, 0.78, 0.52, 0.6, 0.38, 0.46, 0.24, 0.3];
  const shape = new THREE.Shape();
  shape.moveTo(-1.02, -0.34);
  chartPts.forEach((v, i) => shape.lineTo(-1.02 + (i / (chartPts.length - 1)) * 2.04, 0.34 - v * 0.62));
  shape.lineTo(1.02, -0.34);
  const areaMat = basic(C.lilac, { transparent: true, opacity: 0 });
  mesh(new THREE.ShapeGeometry(shape), areaMat, chartX, 0, 0, 0.0005);
  const chartLineMat = basic(C.violet, { transparent: true, opacity: 0 });
  mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(chartPts.map((v, i) => new THREE.Vector3(-1.02 + (i / (chartPts.length - 1)) * 2.04, 0.34 - v * 0.62, 0.001))), 80, 0.008, 5, false), chartLineMat, chartX);

  ui(phone, 0.5, 0.03, 0, 0.58, C.paper200, C.ink400, { delay: 0.006 });
  ui(phone, 0.5, 0.36, 0, 0.3, C.paper100, C.lilac, { mis: [0.02, -0.02], delay: 0.008 });
  ui(phone, 0.4, 0.05, -0.05, 0.03, C.paper300, C.ink900, { mis: [-0.02, 0.01], delay: 0.01 });
  ui(phone, 0.46, 0.025, -0.02, -0.06, C.paper200, C.ink500, { delay: 0.011 });
  ui(phone, 0.32, 0.025, -0.09, -0.12, C.paper200, C.ink500, { delay: 0.011 });
  ui(phone, 0.5, 0.2, 0, -0.32, C.paper100, C.mint, { mis: [0.015, 0.02], delay: 0.012 });
  ui(phone, 0.5, 0.09, 0, -0.53, C.paper0, C.ink900, { mis: [-0.02, -0.015], delay: 0.013 });

  const redMat = basic(C.coral, { transparent: true, opacity: 0, toneMapped: false });
  const redlines = [];
  function redline(ax, ay, bx, by) {
    const g = new THREE.Group();
    desk.add(g);
    const horizontal = Math.abs(by - ay) < 1e-6;
    const len = horizontal ? Math.abs(bx - ax) : Math.abs(by - ay);
    g.position.set((ax + bx) / 2, (ay + by) / 2, Z + 0.004);
    plane(horizontal ? len : 0.006, horizontal ? 0.006 : len, redMat, g, 0, 0, 0);
    if (horizontal) { plane(0.006, 0.04, redMat, g, -len / 2, 0, 0); plane(0.006, 0.04, redMat, g, len / 2, 0, 0); plane(0.08, 0.036, redMat, g, 0, 0.036, 0); }
    else { plane(0.04, 0.006, redMat, g, 0, -len / 2, 0); plane(0.04, 0.006, redMat, g, 0, len / 2, 0); plane(0.08, 0.036, redMat, g, 0.064, 0, 0); }
    redlines.push({ g, horizontal });
  }
  redline(-0.9, 0.66, -0.8, 0.66);
  redline(-0.7, 0.735, -0.7, 0.635);
  redline(-0.19, 0.19, -0.13, 0.19);
  redline(0.95, 0.01, 0.95, -0.07);
  const gridMat = basic(C.violet, { transparent: true, opacity: 0, depthWrite: false });
  const colW = (2.18 - 11 * 0.03) / 12;
  for (let i = 0; i < 12; i++) plane(colW, 1.53, gridMat, desk, -0.84 + colW / 2 + i * (colW + 0.03), -0.035, Z + 0.003);
  const handleMat = basic(C.violet, { transparent: true, opacity: 0, toneMapped: false });
  [[-1.4, 0.875], [1.4, 0.875], [-1.4, -0.875], [1.4, -0.875]].forEach(([x, y]) => plane(0.045, 0.045, handleMat, desk, x, y, 0.02));
  [[2.8, 0.007, 0, 0.878], [2.8, 0.007, 0, -0.878], [0.007, 1.756, 1.403, 0], [0.007, 1.756, -1.403, 0]].forEach(([w, h, x, y]) => plane(w, h, handleMat, desk, x, y, 0.019));

  /* ---------- Validate: pins, FigJam stamps, prototype noodle ---------- */
  function makePin(color, fg, num) {
    const tex = canvasTexture(128, 128, (g, w, h) => {
      g.fillStyle = C.ink900; g.beginPath(); g.moveTo(10, 118); g.lineTo(10, 64); g.arc(64, 64, 54, Math.PI, Math.PI * 0.5, false); g.closePath();
      g.save(); g.translate(3, 3); g.fill(); g.restore();
      g.fillStyle = color; g.beginPath(); g.moveTo(10, 118); g.lineTo(10, 64); g.arc(64, 64, 54, Math.PI, Math.PI * 0.5, false); g.closePath(); g.fill();
      g.strokeStyle = C.ink900; g.lineWidth = 3; g.stroke();
      g.fillStyle = fg; g.font = `600 52px ${FONT_SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(num, 64, 66);
    });
    const g = new THREE.Group();
    plane(0.13, 0.13, basic('#ffffff', { map: tex, transparent: true }), g, 0.065, 0.065, 0);
    g.scale.setScalar(0.001);
    return g;
  }
  const pins = [
    { g: makePin(C.violet, '#FFFFFF', '1'), pos: [1.18, 0.7], at: 0.672 },
    { g: makePin(C.yellow, C.ink900, '2'), pos: [0.46, 0.32], at: 0.68 },
    { g: makePin(C.violet, '#FFFFFF', '3'), pos: [-0.35, -0.22], at: 0.688 },
  ];
  pins.forEach((pn) => { pn.g.position.set(pn.pos[0], pn.pos[1], 0.07); desk.add(pn.g); });
  const STAMPS = [['👍', C.yellow, [1.36, 0.36]], ['❤️', C.pink, [0.72, -0.12]], ['⭐', C.mint, [-0.62, 0.02]], ['+1', C.lilac, [0.1, 0.72]]];
  const stamps = STAMPS.map(([sym, color, pos], i) => {
    const tex = canvasTexture(160, 160, (g, w, h) => {
      g.fillStyle = C.ink900; g.beginPath(); g.arc(w / 2 + 3, h / 2 + 3, 68, 0, Math.PI * 2); g.fill();
      g.fillStyle = color; g.beginPath(); g.arc(w / 2, h / 2, 68, 0, Math.PI * 2); g.fill();
      g.strokeStyle = C.ink900; g.lineWidth = 3; g.stroke();
      g.fillStyle = C.ink900; g.font = sym === '+1' ? `600 64px ${FONT_SANS}` : '72px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(sym, w / 2, h / 2 + 4);
    });
    const m = plane(0.16, 0.16, basic('#ffffff', { map: tex, transparent: true }), desk, pos[0], pos[1], 0.06 + i * 0.002);
    m.scale.setScalar(0.001);
    return { m, at: 0.705 + i * 0.006 };
  });
  const hotMat = basic(C.violet, { transparent: true, opacity: 0, toneMapped: false });
  const hotFill = basic(C.violet, { transparent: true, opacity: 0, depthWrite: false });
  const hotspot = new THREE.Group();
  hotspot.position.set(1.0, 0.58, Z + 0.006);
  desk.add(hotspot);
  plane(0.47, 0.18, hotFill, hotspot, 0, 0, 0);
  [[0.47, 0.007, 0, 0.09], [0.47, 0.007, 0, -0.09], [0.007, 0.18, 0.235, 0], [0.007, 0.18, -0.235, 0]].forEach(([w, h, x, y]) => plane(w, h, hotMat, hotspot, x, y, 0.001));
  mesh(new THREE.CircleGeometry(0.02, 20), hotMat, hotspot, 0.235, 0, 0.002);
  const noodleCurve = new THREE.CubicBezierCurve3(new THREE.Vector3(13.645, 2.13, -7.95), new THREE.Vector3(13.95, 2.34, -7.9), new THREE.Vector3(13.9, 1.72, -7.9), new THREE.Vector3(14.07, 1.72, -7.95));
  const noodleGeo = new THREE.TubeGeometry(noodleCurve, 72, 0.006, 6, false);
  mesh(noodleGeo, basic(C.violet, { toneMapped: false }), world);
  noodleGeo.setDrawRange(0, 0);
  const noodleArrow = mesh(new THREE.ConeGeometry(0.026, 0.05, 12), basic(C.violet, { toneMapped: false }), world, 14.05, 1.72, -7.95);
  noodleArrow.rotation.z = -Math.PI / 2;
  noodleArrow.scale.setScalar(0.001);

  /* ---------- Deliver: tokens fan deck + spec chips ---------- */
  const tokenColors = [C.paper0, C.paper100, C.paper300, C.ink400, C.ink600, C.ink900, C.violet, C.yellow, C.lilac, C.mint, C.pink, C.coral, C.sky, C.teal];
  const fan = new THREE.Group();
  fan.position.set(15.25, 0.78, -7.85);
  world.add(fan);
  const chips = tokenColors.map((c, i) => {
    const pivot = new THREE.Group();
    pivot.position.z = i * 0.005;
    fan.add(pivot);
    const tex = canvasTexture(96, 420, (g, w, h) => {
      g.fillStyle = '#FFFFFF'; rr(g, 3, 3, w - 6, h - 6, 14); g.fill();
      g.fillStyle = c; rr(g, 12, 12, w - 24, h * 0.62, 8); g.fill();
      g.strokeStyle = C.ink900; g.lineWidth = 2.5; rr(g, 3, 3, w - 6, h - 6, 14); g.stroke();
      g.fillStyle = C.ink500; g.fillRect(14, h * 0.72, w - 34, 10); g.fillRect(14, h * 0.8, w - 50, 8);
    });
    plane(0.11, 0.48, basic('#ffffff', { map: tex, transparent: true }), pivot, 0, 0.24, 0);
    return pivot;
  });
  const specMat = basic(C.violet, { transparent: true, opacity: 0, toneMapped: false });
  [[desk, -0.1, 0.71], [desk, 0.62, 0.42], [phone, 0, 0.7]].forEach(([parent, x, y]) => {
    const g = new THREE.Group();
    g.position.set(x, y, Z + 0.01);
    parent.add(g);
    [[0.26, 0.005, 0, 0.028], [0.26, 0.005, 0, -0.028], [0.005, 0.056, 0.13, 0], [0.005, 0.056, -0.13, 0]].forEach(([w, h, px, py]) => plane(w, h, specMat, g, px, py, 0));
    plane(0.16, 0.012, specMat, g, -0.03, 0, 0);
  });
  const pillTex = canvasTexture(320, 80, (g, w, h) => {
    g.fillStyle = C.mint; rr(g, 3, 3, w - 6, h - 6, h / 2 - 3); g.fill();
    g.strokeStyle = C.ink900; g.lineWidth = 2; g.stroke();
    g.fillStyle = C.success; g.beginPath(); g.arc(34, h / 2, 9, 0, Math.PI * 2); g.fill();
    g.fillStyle = C.ink900; g.font = `400 28px ${FONT_MONO}`; g.textBaseline = 'middle'; g.fillText('READY FOR DEV', 54, h / 2 + 1);
  });
  const pill = plane(0.5, 0.125, basic('#ffffff', { map: pillTex, transparent: true, opacity: 0 }), desk, -0.1, 0.99, 0.01);

  /* ---------- multiplayer cursors ---------- */
  function cursorTex(name, color, fg) {
    return canvasTexture(256, 96, (g, w, h) => {
      g.fillStyle = color; g.strokeStyle = C.ink900; g.lineWidth = 1.8;
      g.beginPath(); g.moveTo(8, 6); g.lineTo(44, 24); g.lineTo(28, 30); g.lineTo(22, 46); g.closePath(); g.fill(); g.stroke();
      g.font = `600 26px ${FONT_SANS}`;
      const tw = g.measureText(name).width + 24;
      g.fillStyle = color; rr(g, 34, 40, tw, 40, 10); g.fill(); g.stroke();
      g.fillStyle = fg; g.textBaseline = 'middle'; g.fillText(name, 46, 61);
    });
  }
  const cursors = [['Jess', C.violet, '#FFFFFF'], ['Client', C.yellow, C.ink900], ['Dev', C.mint, C.ink900]].map(([name, color, fg], i) => {
    const s = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: cursorTex(name, color, fg), transparent: true, depthTest: false })));
    s.center.set(0.03, 0.95);
    s.scale.set(0.34, 0.1275, 1);
    s.renderOrder = 10;
    world.add(s);
    return { s, ph: i * 2.1 };
  });
  const STATIONS = [
    [0.16, new THREE.Vector3(0, 1.7, -2.9)],
    [0.345, new THREE.Vector3(6.2, 1.8, -4.9)],
    [0.49, new THREE.Vector3(12.8, 1.6, -7.9)],
    [0.83, new THREE.Vector3(13.6, 1.6, -7.9)],
  ];
  const stationVec = new THREE.Vector3();

  /* =====================================================================
     Stickers — drawn once fonts and the Jess illustration are ready
     ===================================================================== */
  function dieCut(g, w, h, drawShape, { outline = 14, shadow = true } = {}) {
    const sil = document.createElement('canvas');
    sil.width = w; sil.height = h;
    const sg = sil.getContext('2d');
    drawShape(sg, w, h);
    const mask = document.createElement('canvas');
    mask.width = w; mask.height = h;
    const mg = mask.getContext('2d');
    mg.drawImage(sil, 0, 0);
    mg.globalCompositeOperation = 'source-in';
    mg.fillStyle = '#FFFFFF';
    mg.fillRect(0, 0, w, h);
    if (shadow) {
      g.save(); g.globalAlpha = 0.28; g.filter = 'blur(6px)';
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) g.drawImage(mask, Math.cos(a) * outline + 6, Math.sin(a) * outline + 8);
      g.restore();
    }
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 16) g.drawImage(mask, Math.cos(a) * outline, Math.sin(a) * outline);
    g.drawImage(mask, 0, 0);
    g.drawImage(sil, 0, 0);
  }
  function fillHoles(g, w, h) {
    const img = g.getImageData(0, 0, w, h);
    const d = img.data;
    const seen = new Uint8Array(w * h);
    const stack = [];
    const push = (x, y) => { const i = y * w + x; if (!seen[i] && d[i * 4 + 3] < 24) { seen[i] = 1; stack.push(i); } };
    for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
    for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
    while (stack.length) {
      const i = stack.pop();
      const x = i % w;
      const y = (i / w) | 0;
      if (x > 0) push(x - 1, y);
      if (x < w - 1) push(x + 1, y);
      if (y > 0) push(x, y - 1);
      if (y < h - 1) push(x, y + 1);
    }
    for (let i = 0; i < w * h; i++) {
      if (!seen[i] && d[i * 4 + 3] < 255) {
        const a = d[i * 4 + 3] / 255;
        d[i * 4] = d[i * 4] * a + 255 * (1 - a);
        d[i * 4 + 1] = d[i * 4 + 1] * a + 255 * (1 - a);
        d[i * 4 + 2] = d[i * 4 + 2] * a + 255 * (1 - a);
        d[i * 4 + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  }

  const STICKERS = [];
  function addSticker(w, h, pos, tilt, px, py, draw) {
    const tex = canvasTexture(px, py, (g, cw, ch) => draw(g, cw, ch));
    const mat = std('#ffffff', 0.45, 0, { map: tex, transparent: true, alphaTest: 0.04 });
    const m = plane(w, h, mat, stickerLayer, pos[0], pos[1], -MAC.lid - 0.0004 - STICKERS.length * 0.00012);
    m.rotation.set(Math.PI, 0, tilt);
    m.castShadow = false;
    STICKERS.push({ m, tex });
    return m;
  }

  function buildStickers(characterImage) {
    const T = (g, text, font, color, x, y, opts = {}) => {
      g.font = font; g.fillStyle = color; g.textAlign = opts.align || 'center'; g.textBaseline = 'middle';
      if (opts.stroke) { g.lineWidth = opts.stroke; g.strokeStyle = C.ink900; g.lineJoin = 'round'; g.strokeText(text, x, y); }
      g.fillText(text, x, y);
    };
    /* order = stacking (later on top) */
    addSticker(0.11, 0.05, [-0.09, 0.04], -0.08, 560, 256, (g, w, h) => dieCut(g, w, h, (s) => {
      s.fillStyle = C.yellow; rr(s, 24, 24, w - 48, h - 48, 40); s.fill(); s.strokeStyle = C.ink900; s.lineWidth = 4; s.stroke();
      T(s, 'Shall', `500 92px ${FONT_DISPLAY}`, C.ink900, w / 2 - 88, h / 2 + 4);
      T(s, 'we?', `italic 500 92px ${FONT_DISPLAY}`, C.ink900, w / 2 + 112, h / 2 + 4);
    }));
    addSticker(0.1, 0.05, [0.095, 0.035], 0.14, 520, 260, (g, w, h) => dieCut(g, w, h, (s) => {
      const flower = (cx, cy) => {
        s.fillStyle = C.yellow; s.strokeStyle = C.ink900; s.lineWidth = 3;
        for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; s.beginPath(); s.ellipse(cx + Math.cos(a) * 48, cy + Math.sin(a) * 48, 30, 22, a, 0, Math.PI * 2); s.fill(); s.stroke(); }
        s.fillStyle = '#2E7D5B'; s.beginPath(); s.arc(cx, cy, 40, 0, Math.PI * 2); s.fill(); s.stroke();
      };
      flower(140, 140); flower(380, 140);
      s.fillStyle = '#FFF0E9'; s.fillRect(214, 124, 92, 22); s.strokeStyle = C.ink900; s.lineWidth = 3; s.strokeRect(214, 124, 92, 22);
    }));
    addSticker(0.05, 0.05, [-0.125, 0.12], -0.22, 256, 256, (g, w, h) => dieCut(g, w, h, (s) => {
      s.fillStyle = C.ink900; rr(s, 24, 24, w - 48, h - 48, 36); s.fill();
      T(s, '</>', `400 96px ${FONT_MONO}`, C.mint, w / 2, h / 2 + 4);
    }));
    addSticker(0.056, 0.056, [0.128, 0.155], 0, 256, 256, (g, w, h) => dieCut(g, w, h, (s) => {
      s.fillStyle = C.violet; s.beginPath(); s.arc(w / 2, h / 2, w / 2 - 24, 0, Math.PI * 2); s.fill(); s.strokeStyle = C.ink900; s.lineWidth = 4; s.stroke();
      T(s, 'UX', `500 104px ${FONT_DISPLAY}`, '#FFFFFF', w / 2, h / 2 + 6);
    }));
    addSticker(0.046, 0.046, [-0.13, 0.185], 0.18, 256, 256, (g, w, h) => dieCut(g, w, h, (s) => {
      s.fillStyle = '#F4F4F2'; rr(s, 28, 28, w - 56, h - 56, 30); s.fill(); s.strokeStyle = C.ink900; s.lineWidth = 4; s.stroke();
      s.fillStyle = 'rgba(0,0,0,0.08)'; rr(s, 28, h - 70, w - 56, 42, 20); s.fill();
      T(s, '⌘Z', `600 78px ${FONT_SANS}`, C.ink900, w / 2, h / 2 - 4);
    }));
    addSticker(0.04, 0.04, [0.13, 0.2], -0.1, 256, 256, (g, w, h) => dieCut(g, w, h, (s) => {
      const px = 22;
      const heart = ['01100110', '11111111', '11111111', '11111111', '01111110', '00111100', '00011000'];
      heart.forEach((row, ry) => row.split('').forEach((c, rx) => { if (c === '1') { s.fillStyle = (rx + ry) % 3 ? '#FF5C9A' : C.pink; s.fillRect(40 + rx * px, 50 + ry * px, px, px); s.strokeStyle = C.ink900; s.lineWidth = 3; s.strokeRect(40 + rx * px, 50 + ry * px, px, px); } }));
    }));
    addSticker(0.048, 0.048, [0.03, 0.2], 0.08, 256, 256, (g, w, h) => dieCut(g, w, h, (s) => {
      s.fillStyle = '#1F8A4C'; s.beginPath(); s.arc(w / 2, h / 2, w / 2 - 22, 0, Math.PI * 2); s.fill(); s.strokeStyle = C.ink900; s.lineWidth = 4; s.stroke();
      s.fillStyle = '#FFD23F'; s.beginPath(); s.moveTo(w / 2, 58); s.lineTo(w - 50, h / 2); s.lineTo(w / 2, h - 58); s.lineTo(50, h / 2); s.closePath(); s.fill();
      s.fillStyle = '#1E4FB8'; s.beginPath(); s.arc(w / 2, h / 2, 50, 0, Math.PI * 2); s.fill();
      T(s, 'ORDEM E', `600 19px ${FONT_SANS}`, '#FFFFFF', w / 2, h / 2 - 11);
      T(s, 'DESIGN', `600 19px ${FONT_SANS}`, '#FFFFFF', w / 2, h / 2 + 12);
    }));
    addSticker(0.044, 0.044, [-0.045, 0.205], 0.12, 256, 256, (g, w, h) => dieCut(g, w, h, (s) => {
      s.fillStyle = C.ink900; rr(s, 26, 26, w - 52, h - 52, 20); s.fill(); s.strokeStyle = C.ink900; s.lineWidth = 4; s.stroke();
      T(s, 'JM', `italic 500 96px ${FONT_DISPLAY}`, C.lilac, w / 2, h / 2 + 6);
    }));
    addSticker(0.1, 0.03, [-0.075, 0.088], -0.16, 560, 170, (g, w, h) => dieCut(g, w, h, (s) => {
      s.fillStyle = C.mint; rr(s, 20, 20, w - 40, h - 40, (h - 40) / 2); s.fill(); s.strokeStyle = C.ink900; s.lineWidth = 3.5; s.stroke();
      s.fillStyle = C.success; s.beginPath(); s.arc(68, h / 2, 14, 0, Math.PI * 2); s.fill();
      T(s, 'READY FOR DEV', `400 48px ${FONT_MONO}`, C.ink900, 92, h / 2 + 2, { align: 'left' });
    }));
    addSticker(0.075, 0.045, [-0.085, 0.165], 0.06, 420, 250, (g, w, h) => dieCut(g, w, h, (s) => {
      s.fillStyle = '#FFFFFF'; s.strokeStyle = C.ink900; s.lineWidth = 3.5;
      rr(s, 24, 24, w - 48, h - 90, 34); s.fill(); s.stroke();
      s.beginPath(); s.moveTo(90, h - 68); s.lineTo(70, h - 26); s.lineTo(130, h - 68); s.fill(); s.stroke();
      s.fillStyle = '#FFFFFF'; s.fillRect(86, h - 74, 48, 10);
      T(s, 'Hello 👋', `400 72px ${FONT_HAND}`, C.ink900, w / 2, (h - 66) / 2 + 12);
    }));
    addSticker(0.066, 0.044, [0.078, 0.135], 0.1, 360, 240, (g, w, h) => dieCut(g, w, h, (s) => {
      s.fillStyle = C.lilac; s.strokeStyle = C.ink900; s.lineWidth = 3;
      s.beginPath(); s.moveTo(30, 24); s.lineTo(120, 70); s.lineTo(78, 86); s.lineTo(62, 128); s.closePath(); s.fill(); s.stroke();
      sparklePath(s, 250, 150, 48); s.fillStyle = C.yellow; s.fill(); s.stroke();
    }));
    [[0.038, [0.052, 0.165], C.lilac], [0.03, [-0.12, 0.075], C.mint], [0.026, [0.118, 0.07], C.yellow]].forEach(([size, pos, color]) => {
      addSticker(size, size, pos, 0, 200, 200, (g, w, h) => dieCut(g, w, h, (s) => {
        sparklePath(s, w / 2, h / 2, w / 2 - 28); s.fillStyle = color; s.fill(); s.strokeStyle = C.ink900; s.lineWidth = 3.5; s.stroke();
      }, { outline: 10 }));
    });
    /* Jess goes last: on top, where the logo would be */
    if (characterImage) {
      const iw = characterImage.naturalWidth;
      const ih = characterImage.naturalHeight;
      const padPx = 40;
      addSticker(0.1, 0.1 * (ih + padPx * 2) / (iw + padPx * 2), [-0.002, 0.12], 0.05, iw + padPx * 2, ih + padPx * 2, (g, w, h) => dieCut(g, w, h, (s) => {
        s.drawImage(characterImage, padPx, padPx, iw, ih);
        fillHoles(s, w, h);
      }, { outline: 16 }));
    }
  }

  const loadImage = (src) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
  const fontsReady = document.fonts
    ? Promise.all([
      document.fonts.load(`500 64px ${FONT_DISPLAY}`), document.fonts.load(`italic 500 64px ${FONT_DISPLAY}`), document.fonts.load(`600 40px ${FONT_SANS}`),
      document.fonts.load(`400 40px ${FONT_HAND}`), document.fonts.load(`400 30px ${FONT_MONO}`),
    ]).catch(() => null)
    : Promise.resolve();
  const ready = Promise.all([fontsReady, loadImage(characterUrl)]).then(([, img]) => {
    disposables.forEach((d) => { if (d.isCanvasTexture && d.userData.draw) redraw(d); });
    buildStickers(img);
    setProgress(progress);
  });

  /* =====================================================================
     Camera paths (studio keys are relative to the MacBook)
     ===================================================================== */
  hinge.rotation.x = LID_OPEN;
  scene.updateMatrixWorld(true);
  const S = new THREE.Vector3();
  const N = new THREE.Vector3(0, 0, 1);
  screen.getWorldPosition(S);
  N.applyQuaternion(screen.getWorldQuaternion(new THREE.Quaternion())).normalize();
  const B = new THREE.Vector3();
  mac.getWorldPosition(B);
  const add = (v, x, y, z) => [v.x + x, v.y + y, v.z + z];
  const along = (d, dx = 0, dy = 0) => [S.x + N.x * d + dx, S.y + N.y * d + dy, S.z + N.z * d];
  const Sv = [S.x, S.y, S.z];

  const CAMERA_PATHS = [
    {
      from: 0, to: CUTS.toWorld, offset: new THREE.Vector3(),
      keys: [
        [0.0, add(B, 0.56, 0.2, 0.56), add(B, 0.02, 0.07, -0.04)],
        [0.05, add(B, -0.02, 0.22, 0.62), add(B, 0.0, 0.08, -0.05)],
        [0.1, add(B, -0.46, 0.22, 0.34), add(B, 0.02, 0.09, -0.05)],
        [0.135, along(0.44, 0.02, 0.02), Sv],
        [0.16, along(0.12), Sv],
      ],
    },
    {
      from: CUTS.toWorld, to: CUTS.toStudio, offset: W,
      keys: [
        [0.16, [0.0, 1.7, 0.4], [0.0, 1.7, -3.0]],
        [0.195, [0.0, 1.5, 3.3], [0.0, 1.62, -3.0]],
        [0.235, [0.0, 1.64, 2.7], [0.0, 1.72, -3.0]],
        [0.29, [-0.25, 1.84, 1.75], [-0.25, 1.8, -3.0]],
        [0.33, [-0.12, 1.82, 1.5], [-0.12, 1.8, -3.0]],
        [0.357, [2.6, 1.95, 1.6], [5.0, 1.7, -5.0]],
        [0.385, [5.0, 1.8, 0.2], [5.9, 1.72, -5.0]],
        [0.45, [7.0, 1.85, 0.4], [7.3, 1.72, -5.0]],
        [0.49, [9.4, 1.9, -2.6], [12.4, 1.55, -8.0]],
        [0.525, [12.5, 1.6, -4.25], [12.6, 1.52, -8.0]],
        [0.6, [12.75, 1.58, -4.3], [12.8, 1.5, -8.0]],
        [0.665, [13.2, 1.62, -4.15], [13.1, 1.48, -8.0]],
        [0.73, [13.3, 1.6, -4.0], [13.2, 1.48, -8.0]],
        [0.79, [14.8, 1.82, -3.9], [14.1, 1.4, -8.0]],
        [0.83, [14.9, 1.86, -3.8], [14.1, 1.4, -8.0]],
      ],
    },
    {
      from: CUTS.toStudio, to: 1.0001, offset: new THREE.Vector3(),
      keys: [
        [0.83, along(0.12), Sv],
        [0.865, along(0.6, 0.06, 0.06), add(B, 0.0, 0.08, -0.04)],
        [0.91, add(B, 0.08, 0.46, 0.5), add(B, 0.0, 0.03, 0.0)],
        [0.955, add(B, 0.0, 0.47, 0.21), add(B, 0.0, 0.012, 0.005)],
        [1.0, add(B, 0.0, 0.46, 0.205), add(B, 0.0, 0.012, 0.005)],
      ],
    },
  ];
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
    /* narrow screens: step back from the desk so the laptop fits the width */
    if (portrait) {
      const k = p < CUTS.toWorld ? lerp(1.4, 1, ease(p, 0.1, 0.14)) : p >= CUTS.toStudio ? lerp(1, 1.6, ease(p, 0.85, 0.93)) : 1;
      if (k !== 1) vPos.sub(vTgt).multiplyScalar(k).add(vTgt);
    }
    camera.position.copy(vPos);
    camera.lookAt(vTgt);
  }

  /* =====================================================================
     Theme
     ===================================================================== */
  const BG = {
    light: { studio: new THREE.Color('#EDE6D8'), world: new THREE.Color('#F4F0E6') },
    dark: { studio: new THREE.Color('#15140F'), world: new THREE.Color('#151611') },
  };
  function applyTheme() {
    floorMat.map = dark ? dotsDark : dotsLight;
    floorMat.needsUpdate = true;
    worldHemi.intensity = dark ? 0.9 : 1.6;
    sun.intensity = dark ? 0 : 2.6;
    studioHemi.intensity = dark ? 0.22 : 1.2;
    lampLight.intensity = dark ? 3.2 : 0;
    beamMat.uniforms.uIntensity.value = dark ? 0 : 0.12;
    dustMat.opacity = dark ? 0.35 : 0.9;
    windowMat.color.set(dark ? '#23344A' : '#DCEEFB');
    M.wall.color.set(dark ? '#3A362D' : '#EFE8DA');
    inkLine.color.set(dark ? '#F2EFE6' : C.ink900);
  }

  /* =====================================================================
     State
     ===================================================================== */
  let progress = 0;
  let inWorld = false;
  let portrait = false;

  function setProgress(p) {
    progress = clamp01(p);
    const pr = progress;
    inWorld = pr >= CUTS.toWorld && pr < CUTS.toStudio;
    studio.visible = !inWorld;
    world.visible = inWorld;
    const bg = BG[dark ? 'dark' : 'light'][inWorld ? 'world' : 'studio'];
    scene.background.copy(bg);
    scene.fog.color.copy(bg);
    scene.fog.near = inWorld ? 8 : 2.6;
    scene.fog.far = inWorld ? 28 : 8;
    scene.environmentIntensity = dark ? (inWorld ? 0.3 : 0.12) : 0.55;
    /* the board is flat colour: no filmic curve, so whites stay white */
    renderer.toneMapping = inWorld ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;

    sampleCamera(pr);

    const finale = pr >= CUTS.toStudio;
    screenMat.map = finale ? screenHifi : screenLowfi;
    const screenOn = finale ? 1 - ease(pr, 0.9, 0.925) * 0.6 : ease(pr, 0.06, 0.095);
    screenMat.color.setScalar(screenOn);
    screenGlow.intensity = screenOn * 0.25;
    hinge.rotation.x = finale ? lerp(LID_OPEN, LID_CLOSED, ease(pr, 0.88, 0.925)) : LID_OPEN;
    stickerLayer.visible = STICKERS.length > 0;

    notes.forEach((n) => {
      const fly = ease(pr, 0.17 + n.delayIn, 0.205 + n.delayIn);
      const group = ease(pr, 0.255 + n.delayCluster, 0.29 + n.delayCluster);
      n.g.position.lerpVectors(n.start, n.scatter, clamp01(backOut(fly) * 0.15 + fly * 0.85));
      n.g.position.lerp(n.cluster, group);
      n.g.rotation.set(lerp(n.rotStart.x, 0, fly), lerp(n.rotStart.y, 0, fly), lerp(lerp(n.rotStart.z, n.rotScatter, fly), n.rotCluster, group));
    });
    sections.forEach((m, k) => {
      const t = ease(pr, 0.284 + k * 0.006, 0.304 + k * 0.006);
      m.material.opacity = t;
      m.scale.setScalar(lerp(0.94, 1, t));
    });

    nodes.forEach((n, i) => {
      let on = i === 0 ? range(pr, 0.366, 0.376) : 0;
      edgeObjs.forEach((e) => { if (e.b === i) on = Math.max(on, range(pr, e.end - 0.002, e.end + 0.008)); });
      n.scale.setScalar(on <= 0 ? 0.001 : Math.max(0.001, backOut(on)));
    });
    edgeObjs.forEach((e) => {
      e.geo.setDrawRange(0, Math.floor(range(pr, e.start, e.end) * e.tubular) * e.perRing);
      e.arrow.scale.setScalar(Math.max(0.001, ease(pr, e.end - 0.002, e.end + 0.004)));
    });

    const measure = ease(pr, 0.525, 0.55) * (1 - ease(pr, 0.598, 0.618));
    redMat.opacity = measure;
    redlines.forEach((r) => { const s = Math.max(0.001, ease(pr, 0.525, 0.548)); if (r.horizontal) r.g.scale.x = s; else r.g.scale.y = s; });
    gridMat.opacity = 0.07 * ease(pr, 0.53, 0.552) * (1 - ease(pr, 0.598, 0.618));
    const align = ease(pr, 0.552, 0.582);
    handleMat.opacity = Math.min(1, ease(pr, 0.5, 0.52) * (1 - ease(pr, 0.655, 0.675)) + ease(pr, 0.76, 0.785));
    uiEls.forEach((el) => {
      const fill = ease(pr, 0.585 + el.delay, 0.608 + el.delay);
      el.mat.color.copy(el.low).lerp(el.hi, fill);
      el.m.position.x = el.home.x + el.mis.x * (1 - align);
      el.m.position.y = el.home.y + el.mis.y * (1 - align);
    });
    const hifi = ease(pr, 0.59, 0.612);
    outlineMat.opacity = 1;
    ctaOutline.position.set(-0.04 * (1 - align), 0.03 * (1 - align), 0);
    ctaShadow.material.opacity = hifi;
    cardBorderMat.opacity = hifi;
    xMat.opacity = 1 - ease(pr, 0.596, 0.61);
    areaMat.opacity = 0.6 * ease(pr, 0.6, 0.618);
    chartLineMat.opacity = ease(pr, 0.602, 0.62);

    pins.forEach((pn) => {
      const pop = range(pr, pn.at, pn.at + 0.014);
      const resolve = ease(pr, 0.726, 0.748);
      pn.g.scale.setScalar(pop <= 0 ? 0.001 : Math.max(0.001, backOut(pop) * lerp(1, 0.7, resolve)));
    });
    stamps.forEach((st) => {
      const pop = range(pr, st.at, st.at + 0.012);
      st.m.scale.setScalar(pop <= 0 ? 0.001 : Math.max(0.001, backOut(pop)));
    });
    const hot = ease(pr, 0.692, 0.702) * (1 - ease(pr, 0.745, 0.76));
    hotMat.opacity = hot;
    hotFill.opacity = hot * 0.12;
    const noodle = range(pr, 0.698, 0.722);
    noodleGeo.setDrawRange(0, Math.floor(noodle * 72) * 36);
    noodleArrow.scale.setScalar(noodle > 0 ? Math.max(0.001, ease(pr, 0.72, 0.726)) : 0.001);

    const fanOut = ease(pr, 0.752, 0.79);
    chips.forEach((c, i) => { c.rotation.z = lerp(0, (i / (chips.length - 1) - 0.5) * 1.35, fanOut) - 0.25 * fanOut; });
    specMat.opacity = ease(pr, 0.765, 0.785);
    pill.material.opacity = ease(pr, 0.772, 0.79);

    let si = 0;
    while (si < STATIONS.length - 2 && pr >= STATIONS[si + 1][0]) si++;
    stationVec.lerpVectors(STATIONS[si][1], STATIONS[si + 1][1], smooth(range(pr, STATIONS[si][0], STATIONS[si + 1][0])));
  }

  function ambient(time) {
    if (!inWorld) {
      const flicker = 0.96 + Math.sin(time * 1.3) * 0.04;
      beamMat.uniforms.uIntensity.value = dark ? 0 : 0.12 * flicker;
      for (let i = 0; i < dustCount; i++) {
        const d = dustSeed[i];
        const t = (d.t + time * 0.01 * d.s) % 1;
        const al = 0.25 + t * 0.72;
        const radius = lerp(0.42, 0.22, al) * d.r;
        const a = d.a + Math.sin(time * 0.3 + d.ph) * 0.4;
        const ix = i * 3;
        dustPos[ix] = beamFrom.x + beamDir.x * beamLen * al + (perp1.x * Math.cos(a) + perp2.x * Math.sin(a)) * radius;
        dustPos[ix + 1] = beamFrom.y + beamDir.y * beamLen * al + (perp1.y * Math.cos(a) + perp2.y * Math.sin(a)) * radius;
        dustPos[ix + 2] = beamFrom.z + beamDir.z * beamLen * al + (perp1.z * Math.cos(a) + perp2.z * Math.sin(a)) * radius;
      }
      dustGeo.attributes.position.needsUpdate = true;
    } else {
      cursors.forEach((c, i) => {
        const t = time * (0.35 + i * 0.07) + c.ph;
        c.s.position.set(stationVec.x + Math.cos(t) * (0.9 + i * 0.25) + (i - 1) * 0.5, stationVec.y + Math.sin(t * 1.3) * 0.35 - 0.1 * i, stationVec.z + 0.35);
      });
      const pulse = 1 + Math.sin(time * 4.2) * 0.035;
      hotspot.scale.set(pulse, pulse, 1);
    }
  }

  function applyProjection(w, h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    portrait = camera.aspect < 0.9;
    camera.fov = camera.aspect < 0.8 ? 58 : camera.aspect < 1.2 ? 46 : 36;
    if (camera.aspect < 0.9) camera.setViewOffset(w, h, 0, h * 0.15, w, h);
    else camera.setViewOffset(w, h, -w * 0.13, 0, w, h);
    camera.updateProjectionMatrix();
  }
  function resize() { applyProjection(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight); }
  function render(time = performance.now() / 1000) { ambient(time); renderer.render(scene, camera); }
  function snapshot(p, width, height) {
    applyProjection(width, height);
    setProgress(p);
    render(1.5);
    return canvas.toDataURL('image/jpeg', 0.84);
  }
  function setTheme(isDark) { dark = Boolean(isDark); applyTheme(); setProgress(progress); }
  function dispose() { disposables.forEach((d) => d.dispose && d.dispose()); renderer.dispose(); }
  function cutOpacity(p) {
    const d = Math.min(Math.abs(p - CUTS.toWorld), Math.abs(p - CUTS.toStudio));
    return 1 - smooth(clamp01(d / CUT_HALF));
  }

  applyTheme();
  resize();
  setProgress(0);

  return { setProgress, render, resize, snapshot, dispose, cutOpacity, setTheme, ready, camera, get progress() { return progress; } };
}
