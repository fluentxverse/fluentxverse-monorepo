# Interview Calls

Interviews use one-to-one WebRTC with authenticated Socket.IO signaling and
Cloudflare STUN/TURN. Classroom RealtimeKit configuration is unchanged.

## Room And Result Workflow

The dashboard and candidate app load the booked interview from
`GET /interview/room/:id` before requesting devices. Candidates can access only
their own interview; interviewers require live administrator operations access.
Room entry waits for a server acknowledgement containing temporary relay
configuration. Negotiation IDs and participant socket IDs reject stale answers
and candidates after refresh. SDP operations are serialized per peer generation;
a closed peer cannot block a new negotiation.

Both apps provide mute, camera, reconnect and end controls. Changing a pre-call
device requires testing it before joining. Interview sessions renew while open.
Ending stops local media and recording, closes both participants' room, and
persists media closure so refreshing cannot reopen an ended interview. The
interviewer can finish the assessment afterward.

Results bind the server-loaded tutor to the interview. Rubric scores are integers
from 1 to 5. The decision and tutor flags commit in one Memgraph transaction;
an identical retry by the same administrator returns success without changing
the original decision. A different finalized decision is rejected.

## Recording

Recording starts only with both participants connected. The candidate sees a
recording notice. The interviewer captures both video feeds and mixed audio;
recording stops on peer departure or interview closure. Capture is limited to
30 minutes and approximately 85 MiB; uploads must be under 90 MiB. Failed uploads
retain their blob and request ID in the open tab for retry. Leaving the tab while
a recording is pending prompts the browser's navigation warning.

The server verifies administrator access, trusted dashboard Origin, interview
ownership, file type and size. Files go to private local SeaweedFS, not Cloudflare
recording storage. Distinct recording segments retain separate Memgraph records.
Playback uses the authenticated `/interview/recording/:id` proxy, never a public
Filer URL, and writes a structured administrator access log. The room's saved
recording entry opens playback, including when revisiting a closed interview.

This is browser-side capture, not crash-resilient server-side recording. A tab or
device crash can lose unsaved capture. Server recording via RealtimeKit is a
separate future interview migration. There is no new automatic deletion policy
in this change; interview evidence retention needs an explicit business policy.

## Tests

```sh
bun test shared/tests/interviewCall.test.ts \
  fluentxverse-server/tests/iceConfiguration.test.ts \
  fluentxverse-server/tests/socketAuth.test.ts
```

`fluentxverse-server/tests/interview.runtime.ts` refuses any graph except the
disposable instance at port 17698 and any logging database except port 15498.
It serves an isolated API at 18765, actual signaling at 18767 and in-memory
Seaweed-compatible storage at 18898. Never point these fixtures at production.

Run the dashboard at 5186 and tutor app at 5178 with their API/socket environment
variables targeting these fixture ports, then run
`fluentxverse-dashboard/tests/browser/interviews.cjs`. It tests actual media in
separate Chrome contexts, denied joins, refresh/reconnect, device controls,
recording retry/private playback, cleanup and a lost result response after commit.
Setting `INTERVIEW_TEST_RELAY=true` on both fixture processes uses the configured
Cloudflare TURN provider and forces both browsers to select relay candidates.
Only fake camera/audio streams and disposable accounts are used.

The paired and forced-relay tests passed. A human pilot on separate physical
networks, including mobile data, is still required to assess real devices and
mobile network changes.
