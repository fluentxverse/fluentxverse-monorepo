# Archived Preact Frontends

Archived on 2026-10-11 during the SolidJS Cloudflare cutover. The complete working
trees, including uncommitted source changes and local ignored files, were moved
here without reverting or deleting anything.

- `fluentxverse-student/`: former Preact student frontend.
- `fluentxverse-tutor/`: former Preact tutor frontend.

These projects are excluded from active workspaces, CI, Docker build contexts,
and root development/build/deployment commands. Their deployment configurations
are historical: do not deploy them to the production Workers.

Active projects remain `fluentxverse-student-solid-prototype/` and
`fluentxverse-tutor-solid-prototype/` at the repository root. The historical folder
suffix does not mean the archived apps remain the production build source.

For emergency frontend rollback, use the Cloudflare version commands documented
in `docs/cloudflare-workers-frontends.md`; do not rebuild from this archive.
