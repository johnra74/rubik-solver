# Rubik's Cube Solver

A fully static web app that helps you solve a real 3×3 Rubik's Cube:

1. **Enter your cube.** A guided walkthrough takes you through the six faces one at a time, telling you how to hold the cube. You can also paint stickers freely on the 3D cube or the flat net.
2. **Check it.** The app checks that the layout is a real, solvable cube and explains any problem (wrong color counts, impossible pieces, a twisted corner, a flipped edge, or swapped pieces).
3. **Solve it step by step.** Each move is shown in notation and plain English and animated on a 3D cube. There are two modes:
   - **Short:** about 20–22 moves (Kociemba two-phase).
   - **Beginner:** layer by layer in seven named stages, each with an explanation of its goal (about 130 moves).

   The 3D cube is shown the way you hold yours: white on top, green facing you. Turns on faces you can't see from the front (back, bottom, left) briefly tilt into view and then return.

It works offline once it has loaded, can be installed to your home screen, and remembers your progress.

**Privacy:** nothing leaves your device. The app has no back end and never contacts another server. Its only network requests are for its own files, from its own host.

## Development

Requires Node.js 22 or newer.

| Command | Purpose |
|---------|---------|
| `npm ci` | Install dependencies |
| `npm run dev` | Dev server with hot reload (service worker disabled) |
| `npm run build` | Type-check and build the static site into `dist/` |
| `npm run preview` | Serve `dist/` on <http://localhost:4173>, the way a static host would (needed to test offline mode) |
| `npm test` | Unit tests and the 1,000-cube property test (Vitest) |
| `npm run test:e2e` | Browser tests (Playwright) against the production build |
| `npm run lint` | ESLint plus `tsc --noEmit` |
| `npm run check:size` | Fail if the first-load JavaScript is over 300 kB gzip |

The first time you run the browser tests, install the browsers with `npx playwright install --with-deps chromium webkit`.

The property test uses a fixed seed. To try a different one, set `SOLVER_SEED=12345 npm test`.

## Deploying

The site is static and can be served from any HTTPS host. The included GitHub Actions workflow (`.github/workflows/deploy.yml`) lints, tests and builds on every push and pull request, and deploys `main` to **GitHub Pages**. To enable it, go to the repository's **Settings → Pages** and set the source to **GitHub Actions**.

If the site is not served from the domain root, set `BASE_PATH` when building (for example `BASE_PATH=/my-repo/ npm run build`).

## How it's built

- **TypeScript and Vite**, with no UI framework. The 3D view uses **three.js**. Offline support uses **vite-plugin-pwa** (Workbox).
- `src/cube/`: the cube model (facelets and cubies), validation, notation and random states. It contains no DOM code.
- `src/solver/`: the short solver (wrapping `cubejs`) and the beginner layer-by-layer solver. Both run in a Web Worker, and every solution is checked before it is shown.
- `src/state/`: session state and `localStorage` persistence (`rubik-solver:v1`).
- `src/render/` and `src/ui/`: the 3D scene, animation, the flat net and the panels.

The design documents are in `specs/001-rubiks-cube-solver/`: the spec, plan, research notes, data model, contracts, quickstart and tasks.
