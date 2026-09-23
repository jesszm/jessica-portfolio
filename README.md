# Jessica Monteiro — Portfolio

Static site, no build step. Open `index.html` through any static server (ES modules need http, not file://).

```
portfolio/
├── index.html              # Landing: cinematic 3D story (process) → Work → Services → About → Contact
├── guidelines.html         # Design guidelines / design system + full UI/UX process
└── assets/
    ├── css/tokens.css      # Design tokens (primitive → semantic → component), light + dark
    ├── css/styles.css      # Site styles and the wireframe/annotation visual language
    ├── css/story.css       # Pinned 3D story: chapters, rail, cut, static + no-JS fallbacks
    ├── css/guidelines.css  # Documentation layout for guidelines.html
    ├── js/main.js          # Theme, grid/annotation toggles, reveals, pins, cursor, nav
    ├── js/story-scene.js   # Three.js scene: desk (hero/finale) + design canvas world
    ├── js/story.js         # GSAP ScrollTrigger + Lenis orchestration, anchors, fallbacks
    ├── tokens/tokens.json  # Source of truth for tokens (W3C DTCG format)
    └── img/                # Put portrait.jpg and case-study images here
```

## The scroll story

The hero is a pinned WebGL canvas. Scroll progress (0 → 1) drives the scene deterministically, so scrolling back rewinds it:

| Progress | Scene | Chapter |
| --- | --- | --- |
| 0 – 0.16 | Designer's desk, tablet wakes up, camera dives into the screen | Hero |
| 0.16 – 0.34 | Sticky notes arrive, then cluster (affinity mapping) | Discover, Research |
| 0.35 – 0.47 | User flow lights up node by node | Define |
| 0.48 – 0.66 | Wireframe → redlines + grid → aligned → high fidelity | Design |
| 0.66 – 0.81 | Comment pins resolve, prototype link, token fan | Validate, Deliver |
| 0.83 – 1 | Back at the desk: final UI on screen, sketchbook closes | Contact CTA |

Every word on screen is HTML. Chapter timing lives in `data-in` / `data-out` / `data-at` on each `.chapter` in `index.html`.

- **Mobile:** lighter renderer (lower pixel ratio, no shadows, fewer particles) and a shorter scroll.
- **Reduced motion** (`prefers-reduced-motion` or `?motion=reduced`): no pinning, no smooth scroll; each chapter gets a still rendered from the same scene.
- **No JS / no WebGL:** chapters stack as static panels.
- Libraries load from jsDelivr: three 0.170, GSAP 3.13 + ScrollTrigger, Lenis 1.3.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `G` | Toggle the 12-column layout grid |
| `A` | Toggle annotations (pins, redlines, hotspots) |
| `D` | Toggle light / dark theme |

## Still to fill in (search for `TODO` in index.html)

1. **Portrait**: add `assets/img/portrait.jpg` (3:4) in About.
2. **Dates** on the three experience entries.
3. **Email** in Contact (`hello@example.com`).
4. **Case studies**: real project stories, screens and metrics for Cases 01–03.

## Deploying

Pushes to `main` on GitHub (`jesszm/jessica-portfolio`) deploy to Vercel automatically.
