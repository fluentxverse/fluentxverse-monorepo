# Conversational Skills Level 4 Reorganization

The user revised the structure on November 13, 2026: stop Level 3 at Chapter 5,
then continue the story in Level 4. Levels 2-10 have five chapters; Level 1 keeps
its existing one-chapter structure.

| Original Reference | Current Material Placement | Title |
| --- | --- | --- |
| Chapter 6 | Level 4 Chapter 1 | After the Truth |
| Chapter 7 | Level 4 Chapter 2 | New Paths, Unexpected Feelings |
| Chapter 8 | Level 4 Chapter 3 | A Little Closer |
| Chapter 9 | Level 4 Chapter 4 | Awaiting user outline |
| Chapter 10 | Level 4 Chapter 5 | Awaiting user outline |

Each chapter still uses story lessons 1-4 and 6-9, with personalized checkpoints
in 5 and 10. No lesson text, artwork, student notes or exercise marks are rewritten
as part of moving chapters. Level 4 is also BEGINNER in the existing badge system.

## Placement-Only Migration

```sh
bun scripts/move-conversational-stories-to-level4.ts
bun scripts/move-conversational-stories-to-level4.ts --write --expected=REVIEWED_DIGEST
```

The dry run checks every source draft and destination, chapter metadata and saved
learner references. It refuses occupied destinations, non-draft sources, duplicate
slots or saved evidence requiring review. Before writing it makes a private backup
and checks the exact snapshot again inside a transaction. It updates only level,
chapter, chapter label, badge and timestamp on lessons, and level/chapter/timestamp
on chapter metadata. Read-back compares all other fields, IDs, earlier chapters,
level metadata and learner-evidence fingerprints unchanged.

Existing lesson IDs are deliberately stable, even where their historical spelling
contains `L3-C6`, `L3-C7` or `L3-C8`. These IDs are opaque record keys, not placement
fields. This preserves earlier shared preview links and avoids orphaning future
references. The migrated lessons are listed under Level 4 using their actual
`level` and `chapter`. Dynamic checkpoint IDs derive from those placement fields.
Fresh authoring templates use `L4-C1`, `L4-C2` and `L4-C3` IDs.

Historical backups stay in their original directories. They are recovery records,
not active Level 3 chapters. Original outline numbers may remain in provenance
notes; learner-facing chapter labels and canonical authoring paths use Level 4.

## Subsequent Authoring

```sh
bun scripts/apply-exploring-kyoto.ts --level=4 --chapter=1
bun scripts/apply-exploring-kyoto.ts --level=4 --chapter=2
bun scripts/apply-exploring-kyoto.ts --level=4 --chapter=3
```

Review-only runs regenerate local candidates and preserve existing IDs. An old
`--chapter=6` invocation is rejected rather than recreating out-of-range chapters.
Server create/metadata/structure endpoints, dashboard navigation/create controls
and AI structure generation all follow the five-chapter policy. Application code
deployment is separate from the live Memgraph content migration.
