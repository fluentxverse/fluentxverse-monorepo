
# FluentXVerse — ESL Learning Platform

FluentXVerse is an ESL (English as a Second Language) learning platform that blends interactive lessons, real‑time practice, and community features to help learners improve reading, writing, listening, and speaking skills.

## Key Features

- Adaptive lessons: progressive modules for grammar, vocabulary, and comprehension
- Speaking practice: prompts and recordings with feedback
- Writing exercises: guided tasks with rubrics and progress tracking
- Live activities: quizzes, challenges, and collaborative tasks
- Progress dashboard: goals, streaks, badges, and detailed analytics
- Community: profiles, posts, and moderated discussion

## Tech Stack

- Student/tutor frontend: SolidJS + TypeScript + Vite (Cloudflare Workers)
- API: Elysia + Eden Treaty (type‑safe client)
- Data: Memgraph (graph database) for users, lessons, and activity relations
- Storage: SeaweedFS/MinIO for media (audio, images) — optional

## Development

The active frontends are `fluentxverse-student-solid-prototype/` and
`fluentxverse-tutor-solid-prototype/`. Their historical folder suffix is retained
to preserve local project paths. Preact working trees are archived in
`archive/preact/`, excluded from active builds and deployments.

Use `bun run dev:student`, `bun run dev:tutor`, `bun run build:student`, and
`bun run build:tutor` from the repository root. Deploy with `bun run deploy:student`
or `bun run deploy:tutor`; see [Workers deployment](docs/cloudflare-workers-frontends.md).

- `bun run dev` — start the frontend dev server
- `bun run build` — build production assets
- `bun run preview` — preview the production build locally

## Project Structure

- `src/` — application source (components, pages, context, hooks)
- `public/` — static assets
- `assets/` — CSS, fonts, images

## API Integration

- Typed API via Eden Treaty; see `src/api/`
- Auth context handles login, logout, and session (`/me`)

## Environment

Configure backend and storage services as needed:

- Backend server (Elysia): `http://localhost:8765`
- Optional storage (SeaweedFS): Filer `:8888`, S3 `:8333`

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE) for details.

## Contact

For questions, partnership, or support:

- Email: <hello@fluentxverse.com>
- Website: <https://www.fluentxverse.com>

## Technologies Used

- **React/Preact** (TypeScript)
- **Vite** (Frontend tooling)
- **Bun** (Server-side)
- **CSS/Glassmorphism** (Modern UI)
- **OpenStreetMap** (Map integration)
- **Docker** (Server deployment)
- **Vercel** (Hosting)

## Getting Started

1. **Clone the repository:**

   ```bash
   git clone <your-repo-url> fluentxverse
   cd fluentxverse
   ```
2. **Install dependencies:**

   ```bash
   bun install
   # or
   npm install
   ```
3. **Run the development server:**

   ```bash
   bun run dev
   # or
   npm run dev
   ```
4. **Build for production:**

   ```bash
   bun run build
   # or
   npm run build
   ```
5. **Deploy:**
   - Recommended: Vercel, Netlify, or Docker

## Project Structure

- `src/` — Main frontend source code
- `fluentxverse-server/` — Backend server (Elysia + Bun)
- `public/` — Static assets (images, CSS, JS)
- `uploads/` — User-uploaded files

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE) for details.

## Contact

For questions, partnership, or support:

- Email: hello@fluentxverse.com
- Website: https://www.fluentxverse.com
