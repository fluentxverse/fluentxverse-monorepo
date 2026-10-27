# Publishing Product Updates

`src/data/changelogEntries.json` is the single source for `/changelog` and the
downloadable `/changelog.json` feed, emitted by Vite during builds and served
by its development middleware locally. It is curated release history, not an automatic commit
dump or an operational audit log. It starts with confirmed October 24, 2026
deployments; earlier history has not been reconstructed.

## Adding An Entry

1. Confirm the change was deployed. Do not publish planned or untested work as
   released. Mention relevant rollout or verification limits plainly.
2. Append an entry with the next unused `FXV-YYYYMMDD-NNN` ID for that release
   date. The sequence is global across apps, not restarted per app. Never
   recycle or renumber an ID. Its permalink is `/changelog#<ID>`.
3. Set `apps` to one or more of `student`, `tutor`, `backend`, `engine`. A shared fix has
   one ID with multiple apps; do not duplicate it under different IDs.
4. Use `added`, `improved`, `fixed`, `changed`, or `removed`, followed by a
   concise title, summary, and details. Use the deployment date, not the date
   development began. Dates display in UTC to avoid viewer timezone shifts.
5. Run `bun run build` and the browser smoke test. Duplicate IDs, invalid dates,
   unknown apps and malformed entries fail the build. Deploy the site using
   the normal reviewed release process.

Keep corrections under the original ID and disclose substantive corrections in
the details. Use a new ID for a subsequent product change. Where useful, include
a public commit or release reference as plain text in the details; never invent
a version or claim an unmerged commit was deployed.

Only publish public-safe descriptions. Never include student or tutor records,
private scores, payment records, wallet secrets, credentials, internal URLs,
or unpublished vulnerability details. Entries are plain text, not HTML.

The app filter, change type and search are shareable query parameters. Entry
permalinks intentionally omit filters so the linked update remains visible.
Engine's filtered view is `/changelog?app=engine` and uses the same entries as
the JSON feed. Engine denotes GMR Engine, separately from the FluentXVerse backend.

```bash
bun test tests/changelog.test.ts
bun run build
SITE_URL=http://127.0.0.1:5215 node tests/browser/changelog.cjs
```
