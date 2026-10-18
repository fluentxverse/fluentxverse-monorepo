# App Repositories

## Purpose

Provide focused repositories for reviewers and contributors without dismantling the monorepo or changing production deployments. Each repository has an application-specific README, source, required shared files, and an exact source revision. Documentation describes implemented scope and limitations rather than implying that proposed privacy work is already audited or live.

## Source of Truth

The monorepo remains authoritative. Submit changes here, validate them, commit them, then refresh app exports. Do not independently develop conflicting versions in both repositories. Changes proposed in an app repository must be ported back to the monorepo before the next export.

Exports use a committed revision, not the working tree. This deliberately excludes unfinished work in other windows. Fresh repositories receive a source snapshot instead of the monorepo's entire history, reducing unrelated history and historical secret exposure. This does not erase or sanitize the original monorepo's history.

The existing application directory is retained inside each repository so relative imports and tests preserve their established paths. Node applications have root-level convenience commands. Required `shared/` files and selected shared API contracts are included alongside the app. The server export also includes contract and review-tally source needed by optional tooling.

## Export

From the monorepo root:

```bash
node scripts/export-app-repos.mjs --list
node scripts/export-app-repos.mjs --ref HEAD --destination /tmp/fluentxverse-app-export
```

Use a fresh absolute destination outside the monorepo. Existing app directories are never overwritten. To export only one application:

```bash
node scripts/export-app-repos.mjs --app fluentxverse-student --ref HEAD --destination /tmp/fluentxverse-student-export
```

Each `SOURCE.json` records the monorepo commit, app directory, exported source paths, and excluded paths. README templates live in `docs/app-repositories/`; export logic and documentation can be improved without touching app runtime code.

## Safety Review Before Publishing

1. Inspect the generated source and `SOURCE.json`. Environment values are not copied; frontend examples are generated with local endpoints and an empty public app ID.
2. Run a secret scanner on the complete generated repository. Investigate every finding. Do not disable a scanner rule globally merely because a checksum or synthetic fixture matches it.
3. Verify there are no real user records, recordings, assessment inputs, private keys, seed phrases, or internal runtime data. Generated proving/setup files, build output, backups, and machine-local configuration are omitted.
4. Install dependencies and run documented checks in the extracted repository. Frontend build checks do not replace live integration tests. Mobile release/device checks and Go migration parity have separate requirements.
5. Confirm GitHub visibility explicitly. Start private if public publication has not been approved. Do not enable auto-deployment or change Cloudflare's connected source repository as part of documentation publishing.
6. Create the repository in `fluentxverse`, push the reviewed snapshot to `main`, and set its description/homepage. Never force-push over someone else's work.

## Refresh Existing Repositories

For later updates, export into a fresh directory and scan/test again. Clone the existing app repository separately, review the new snapshot against it, and commit only the intended source/documentation update with the new `SOURCE.json`. Preserve any separately maintained repository configuration and investigate divergent changes rather than deleting them blindly. Push a normal fast-forward commit or open a pull request; do not recreate repositories or rewrite their history for routine syncs.

Publishing is intentionally not an automatic push hook. A committed source change may require additional security review before its app repository becomes public. The export tool never creates repositories, pushes, deploys, transfers funds, or executes application code.

## Initial Publication Status

Published on 2026-10-18 from `c9696e491149275bc01df3b8d05d29a15263257a`, with local uncommitted application work deliberately excluded. After the owner authenticated GitHub CLI as `fluentxverse`, all seven repositories were created and pushed to `main`. Each remote commit matches its validated local repository. Following the owner's explicit request, all seven repositories were changed from private to public and their visibility was verified. Grant reviewers can access them without collaborator invitations.

| Repository | Published initial commit |
| --- | --- |
| [fluentxverse-student](https://github.com/fluentxverse/fluentxverse-student) | `d8ea7b66e038` |
| [fluentxverse-tutor](https://github.com/fluentxverse/fluentxverse-tutor) | `553e8412308a` |
| [fluentxverse-dashboard](https://github.com/fluentxverse/fluentxverse-dashboard) | `3d0aa6112c97` |
| [fluentxverse-site](https://github.com/fluentxverse/fluentxverse-site) | `329a882dc354` |
| [fluentxverse-server](https://github.com/fluentxverse/fluentxverse-server) | `7e1d4bbd30a7` |
| [fluentxverse-mobile](https://github.com/fluentxverse/fluentxverse-mobile) | `18bdddd4336d` |
| [fluentxverse-go-server](https://github.com/fluentxverse/fluentxverse-go-server) | `91de5387136d` |

Initial publication used the reviewed local repositories and the owner-only publisher:

```bash
node scripts/publish-app-repos.mjs --source /home/paulanthonyarriola/Desktop/fluentxverse-app-repos-20261018
```

This publisher requires the exact owner login, a clean committed prepared repository, and the expected provenance. It creates private repositories, checks their default branch and pushed revision, and never force-pushes. It is intended for the initial publication, not automatic synchronization or re-running against repositories subsequently made public. The owner has approved public visibility for the seven repositories above; future refreshes should preserve that visibility and follow the reviewed refresh process.

Initial local validation:

| Check | Result |
| --- | --- |
| Student, tutor, dashboard, site production builds | Passed independently after extraction |
| Student standalone tests | 38 passed |
| Tutor standalone tests | 54 passed |
| Server source TypeScript check | Passed; integration scripts excluded explicitly |
| Go `go test ./...` | Passed; not a production parity test |
| Mobile `:shared:jvmTest` with JDK 17 and rerun tasks | Passed; no Android device or iOS release claim |
| Export-tool tests | 7 passed |
| Secret scan of every initial repository commit | No unresolved findings; two exact public proving-checksum false positives reviewed |

Dependency-install audit warnings remain outstanding; successful extraction/building does not resolve the previously reported dependency vulnerabilities. CI checks in the prepared Node repositories perform source/build checks only and never deploy. No Cloudflare configuration or production connection was changed.

The initial hosted Actions attempts for the student and tutor repositories reported `startup_failure` before jobs were created. Their shared generated workflow passes Actionlint 1.7.7 locally; the hosted failure cause is not yet established. Local validation results above must not be interpreted as green hosted CI. Investigate the hosted workflow diagnostics before using Actions status as a release gate; do not connect these repositories to production deployment to bypass that problem.

## Validation Boundaries

- Student/tutor root tests are standalone helper tests. Cross-app parity and live-provider tests remain a monorepo responsibility.
- Dashboard/site checks build their static bundles. They do not establish administrator authorization or production DNS correctness.
- Server checks validate TypeScript. Integration tests require isolated backing services; the full Compose file references sibling apps.
- Mobile Android/iOS setup remains platform-specific. Linux does not validate iOS signing or SwiftUI compilation.
- Go code is an independently inspectable migration workstream, not a declaration of production route parity.
- Source availability does not grant a license where no root license file exists. Do not manufacture an open-source license or claim grant approval, KYC completion, audit completion, or mainnet activation in repository metadata.
