# FluentXVerse Dashboard

The administration application for operating FluentXVerse's tutoring marketplace. It brings tutor review, interviews, lessons, learning content, compensation settings, and release acceptance into one staff interface.

Production entry point: https://dashboard.fluentxverse.com

## Responsibilities

- Review tutor applications, assessment results, profiles, and interview decisions.
- Schedule and conduct browser-based interviews.
- Manage tutors, students, sessions, tickets, notifications, and learning materials.
- Set each tutor's USD per-lesson base rate and inspect compensation records.
- Review recording workflows and track manual release acceptance using the testing checklist.

## Architecture

Preact, TypeScript, Vite, Axios, and Socket.IO. The dashboard is a static Cloudflare Workers application. The [application server](https://github.com/fluentxverse/fluentxverse-server) must enforce staff authorization for every privileged action; hiding a control in the browser is not an authorization boundary.

- `fluentxverse-dashboard/`: application source, assets, and Worker configuration.
- `shared/`: media normalization and interview call utilities.
- `fluentxverse-server/src/shared/tutorCompensation.ts`: the compensation contract imported by the dashboard, not a second API server.

Operational business and compensation records belong in Memgraph. PostgreSQL is used primarily for logs and supporting operational records; it is not the primary salary ledger.

## Local Development

Use Node.js 22+, npm, and Bun. From the repository root:

```bash
npm run setup
cp fluentxverse-dashboard/.env.example fluentxverse-dashboard/.env.local
npm run dev
npm run build
```

Vite starts on port 5175 unless occupied. Configure a development API/socket endpoint and use an authorized administrator test account. Never commit staff credentials or run financial mutation tests against real tutor records.

## Deployment and Acceptance

Build output is `fluentxverse-dashboard/dist/`. Its Wrangler configuration contains the existing dashboard domains; deployment requires explicit operator review and Cloudflare authorization. CI in this export builds the app without deploying it.

The testing checklist records acceptance evidence, not a security certification. Interview media requires configured signaling/TURN infrastructure. Rates, payable lesson records, refunds, and earnings must be validated server-side. Private payout authorization and shielded settlement require additional proof, lifecycle, and settlement controls; a compensation UI alone does not provide confidential onchain payouts.
