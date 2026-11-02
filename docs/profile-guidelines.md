# Tutor Profile Guidelines

Tutor-only guidance is displayed beside Photo, Introduction Video and Interests on both initial applications and approved-profile edits. The photo cropper and interests editor repeat their applicable guidelines; Settings includes the photo guidelines too. Public student profiles do not import this guidance.

## Automatic Checks

- JPG/JPEG only, at most 3 MiB, and at least 480 pixels on each side. The browser decodes the file, and the API independently verifies JPEG bytes and dimensions using ffprobe before any storage writes or deletion of an existing photo.
- The cropper exports a full 600x600 JPEG. It does not bake the circular avatar presentation into the uploaded image. Uncovered canvas uses #C8C8C8; this is not automatic background replacement.
- Up to five distinct, nonempty interests, at most 30 characters each. API requests exceeding the limit are rejected rather than silently truncated.
- The existing server/client maximum of 30 seconds remains in force for new introduction videos.

The wording on portrait framing, clothing, recency, expression, background, identity/privacy and original spoken content is an admin-review checklist, not an automated face/background/speech claim. The video guidance requests 35-70 spoken words, an opening of at most five seconds, at most two main topics, and a brief invitation/closing. Spoken word counts cannot be inferred from duration alone.

## Display

Empty teaching qualifications are omitted. The standalone approval-success banner and standalone duration line are removed. Pending-update and rejection feedback remain visible.

## Release Dependencies

`shared/profileGuidelines.ts` is imported by both the API and tutor app and must be included at `/shared/profileGuidelines.ts` in the API image, and alongside the frontend snapshot's shared modules. The API already requires ffprobe from the intro-video-limit release. Deploy photo/interests validation with the updated tutor frontend. Do not overwrite unrelated route changes from the workspace.

Tests: `fluentxverse-server/tests/profileGuidelines.test.ts`, `profileGuidelines.persistence.ts` (empty disposable graph on 17728 only), and tutor `tests/browser/profileGuidelines.cjs`. Existing profile-media, education and intro-duration browser tests cover regression behavior.
