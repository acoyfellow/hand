# Site rebuild report

Branch `site-foldkit`. The hand marketing site now runs on the cafe stack: Foldkit 0.168.0, Tailwind v4 through `@tailwindcss/vite`, Vite 8.3.3 and Effect 4.0.0. It deploys with Alchemy 2.0.0-beta.83 from `site/alchemy.run.ts`. Nothing was pushed or deployed.

## Layout

- `site/` is its own package, the way hark keeps its deploy package separate, so Alchemy can pin Effect 4.0.0. It has its own `package.json`, `bun.lock`, `bunfig.toml` and `tsconfig.json`.
- Every page is a Foldkit view. All five are server-rendered at build time with `foldkit({ ssr: { build: { prerender } } })` and then hydrated with `Runtime.hydrate`. Styling is Tailwind classes only (`site/src/styles.css` holds only the theme tokens, keyframes and base layer).
- `views/layout.ts` defines one Header, one Footer and one shell width (`max-w-[72rem]`) used on every page. The Header has the logo link to `/` (named "hand home"), Benchmarks, and a GitHub link with its icon. The Footer has the astronaut peek, the Cloudflare logo, the endorsement note, the pixel dragon, and the links hand · MIT · source · lab.
- `mark.js` and `swarm.js` stay plain JS modules in `site/public/brand`. Vite bundles them, and they are still published at `/brand/*.js`. Foldkit Mounts start the backdrop on every page, the swarm on `/` and `/brand/lab/`, and the live preview in the mark lab. All of them stop when the element unmounts.
- `/lab/` reads `site/public/lab/data.json`. `site:build` writes that file first by running `bun lab/build.ts --offline`, then decodes it with an Effect Schema at build time.
- `/cursor.js` is still a symlink to `src/cursor.js`. `/llms.txt`, the fonts, the demo video and every brand asset are copied from `site/public` as before.
- `404.html` is prerendered and served by the asset layer with `notFoundHandling: "404-page"`.
- Removed: `site/dev.ts`, `site/wrangler.jsonc`, the hand-written HTML pages, `footer.js`, and the unused root dependencies `foldkit`, `@foldkit/vite-plugin`, `tailwindcss`, `@tailwindcss/vite` and `vite`.

## Accessibility (WCAG 2.2 AA)

`bun run site:a11y` builds the site, serves `dist/client` with the same trailing-slash and 404 rules as the asset layer, and runs `@axe-core/playwright` with the tags wcag2a, wcag2aa, wcag21a, wcag21aa and wcag22aa. It covers 5 pages × light and dark × 1280 and 390 px × motion on and reduced, which is 40 runs. A run fails on any axe violation, on any horizontal scroll, on any page error, on a wrong HTTP status, or if the first Tab does not land on a visible skip link with an outline.

Fixes made along the way:
- A skip link and `header`, `nav`, `main` and `footer` landmarks.
- `:focus-visible` outlines.
- `motion-reduce` handling, plus a global reduced-motion rule.
- Contrast tokens tuned for both themes.
- Tables with column and row headers, inside labelled, focusable scroll regions.
- Labelled code regions and `aria-pressed` toggles.
- The swarm demo is `inert` and `aria-hidden`, and its caption describes it.

I checked the checker: on the built `/lab/` page, an image without alt text and a low-contrast paragraph injected after load were both reported (`image-alt`, `color-contrast`).

## Commands run

| Command | Exit | Last line |
| --- | --- | --- |
| `bun run site:build` | 0 | site built: /index.html /lab/index.html /brand/index.html /brand/lab/index.html /404.html /llms.txt /cursor.js /lab/data.json |
| `bun run site:a11y` | 0 | a11y: 5 pages x 2 schemes x 2 widths x 2 motion settings, no violations, no horizontal scroll |
| `bun run site:shots` | 0 | a11y: 5 pages x 2 schemes x 2 widths x 2 motion settings, no violations, no horizontal scroll |
| `bun run check` | 0 | Ran 48 tests across 9 files. [1423.00ms] |
| `cd site && bun run typecheck` | 0 | $ tsc -p tsconfig.json |

Not run: `bun run site:deploy` (`alchemy deploy`), as instructed.

## Screenshots

`shots/site-{home,lab,brand,brand-lab,404}-{light,dark}-{desktop,mobile}.png`: 20 files written by `bun run site:shots` with reduced motion on.

## Notes

- Use `bun run site:install` to install the site package. Its `bunfig.toml` pins the npm registry, because the scoped Cloudflare registry in the user config needs Access.
- `bun run check` still does not typecheck `site/`. Run `cd site && bun run typecheck` for that; it is also part of `site:build`.
