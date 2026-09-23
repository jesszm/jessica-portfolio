# Jessica Monteiro — Portfolio

Static site, no build step. Open `index.html` in a browser or serve the folder with any static server.

```
portfolio/
├── index.html              # Portfolio (hero, about, process, work, services, contact)
├── guidelines.html         # Design guidelines / design system + full UI/UX process
├── README.md
└── assets/
    ├── css/tokens.css      # Design tokens (primitive → semantic → component), light + dark
    ├── css/styles.css      # Site styles and the wireframe/annotation visual language
    ├── css/guidelines.css  # Documentation layout for guidelines.html
    ├── js/main.js          # Theme, grid/annotation toggles, reveals, pins, cursor, nav
    ├── tokens/tokens.json  # Source of truth for tokens (W3C DTCG format)
    └── img/                # Put portrait.jpg and case-study images here
```

## Keyboard shortcuts (on the site)

| Key | Action |
| --- | --- |
| `G` | Toggle the 12-column layout grid |
| `A` | Toggle annotations (pins, redlines, hotspots) |
| `D` | Toggle light / dark theme |
| `Esc` | Close an open comment pin |

## Things to fill in (search for `TODO` in index.html)

1. **Portrait** — add `assets/img/portrait.jpg` (3:4, ≥ 800×1066) and replace the placeholder block in the About section.
2. **Dates** on the three experience entries (Upwork, Potência 40, Xorg).
3. **Email** in the Contact section (`hello@example.com`).
4. **Case studies** — Cases 01–03 are structured from your public profile. Replace the descriptions with the real project story and add real screens/metrics. Keep the "Under NDA · details on request" tag when a client can't be named.
5. **Languages** in the About facts (currently "Portuguese (native) · English (professional)").
6. Optional: a pt-BR version (`index.pt.html`) using the same structure.

## Deploying

Any static host works (Vercel, Netlify, GitHub Pages, Cloudflare Pages). Point it at this folder; there is nothing to build.

## Design system

Everything visual is documented in `guidelines.html`: palette (with contrast ratios), type scale, spacing, grid, motion, annotation language, components with states and accessibility notes, the eight-phase UI/UX process, research methods and metrics, handoff checklist, governance and changelog.
