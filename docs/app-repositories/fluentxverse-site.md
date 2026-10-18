# FluentXVerse Site

The public website for FluentXVerse, an online English tutoring platform with learner, tutor, and operations applications. It explains the product, educational approach, and privacy technology, and links visitors to the appropriate application.

Production entry points: https://fluentxverse.com and https://www.fluentxverse.com

## Scope

- Product and ecosystem overview, company information, and contact details.
- Dedicated AI, onchain technology, and privacy explanations.
- Links to student and tutor applications.
- Responsive layouts, locally served artwork, and search/social metadata.

## Architecture

SolidJS, Solid Router, TypeScript, and Vite. Cloudflare Workers serves static assets with single-page application routing. This site does not hold wallet keys, authenticate students, or execute marketplace transactions.

All site source is under `fluentxverse-site/`:

- `src/data/site.ts`: product descriptions, portal links, and team content.
- `src/pages/`: public pages, including AI and onchain explanations.
- `src/styles/`: styling and responsive behavior.
- `public/assets/`: artwork and public assets.
- `docs/`: content references and image provenance notes.

## Local Development

Use Node.js 22+, npm, and Bun. From the repository root:

```bash
npm run setup
npm run dev
npm run build
npm run preview
```

Use the development URL printed by Vite. No API credentials are required. Update approved product/team content in `src/data/site.ts`, and preserve asset attribution when replacing imagery.

## Deployment and Claims

The build produces `fluentxverse-site/dist/`. `wrangler.toml` declares the existing apex and `www` domains. CI builds source only; review domain ownership and routing before manual deployment. Do not use a catch-all asset rewrite that serves HTML for JavaScript or CSS requests.

Technology pages should distinguish implemented application behavior, deployment evidence, testnet work, and proposed features. Publishing a roadmap does not establish mainnet activation, an independent cryptographic audit, grant approval, regulatory compliance, or confidentiality of ordinary token transfers.
