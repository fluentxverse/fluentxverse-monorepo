# FluentXVerse Site

White-themed corporate ecosystem website built with SolidJS, Solid Router, TypeScript, and Vite. The brand colors match the light themes of the student and tutor apps.

## Development

From the monorepo root:

```bash
bun install
bun run dev:site
```

The default URL is http://localhost:3000. Vite automatically selects another port if it is occupied.

From this directory:

```bash
bun run dev
bun run build
bun run preview
```

`build` checks TypeScript and writes the static site to `dist/`. Cloudflare Workers static assets serve the build and use `not_found_handling = "single-page-application"` for page routes. Do not add a catch-all rewrite to `public/_redirects`: that also rewrites existing JavaScript and images.

## Content

- `src/data/site.ts`: project descriptions, portal URLs, contact address, founder details, and the three team slots. Replace placeholders with approved names, roles, biographies, portrait paths, and optional LinkedIn URLs.
- `src/pages/HomePage.tsx`: home page content.
- `src/pages/AboutPage.tsx`: company story and principles.
- `src/styles/main.css`: shared styles and responsive layout.
- `public/assets/img/`: locally served imagery. Existing team portraits remain in `team/` for use when member details are confirmed.

The office image is illustrative and originates from Unsplash: `photo-1497366754035-f200968a6e72`. The ESL cards use learning scenes generated with the built-in image generation tool and encoded as WebP for the site. The current tutor image uses a user-supplied portrait as its facial identity reference. Final prompts and asset paths are recorded in `docs/image-prompts.md`. Previous card assets remain available in the image directory.

## Deployment

```bash
bun run deploy
```

This builds the site and deploys Worker `fluentxverse-site`, with custom domains
`fluentxverse.com` and `www.fluentxverse.com`. The preview host is
`fluentxverse-site.paulanthonyarriola.workers.dev`. No application secrets are
needed: the site is static and links to the separately deployed student/tutor apps.
The old `src/worker.js` KV handler is no longer a deployment entry point.
No deployment is required for local development.

Production launch on 2026-10-09 passed public DNS/HTTPS and desktop/mobile browser
checks on both domains, including About-page refresh, image decoding and links
to the `.com` student/tutor apps. Run the published-site smoke check from the
monorepo root with `node tests/browser/marketingSiteHosting.cjs`. Set
`PLAYWRIGHT_MODULE` if Playwright is installed outside the repository.
