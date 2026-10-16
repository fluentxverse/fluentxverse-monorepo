# Two Students Competing for One Slot

Result: **PASS for the deployed ticket-based booking path with mock tickets**.
No production student, tutor, booking, balance, or financial record was changed.
Only the dashboard QA checklist result was recorded after testing.

## Coverage

- 20 races through real authenticated HTTP endpoints, using 40 synthetic students.
- One successful reservation and one rejected reservation in every race.
- Exactly one confirmed booking and one ticket deduction per slot.
- Each winner started with 2 basic tickets and finished with 1.
- Each loser retained 2 tickets, with no transfer or phantom booking.
- Losers could not steal or release the winner's reservation.
- Winning reservation retries reused the original reservation ID.
- Booking retries reused the original booking without another deduction.
- Already-booked slots rejected further reservations.

An additional browser race used the deployed student UI at
`https://student.fluentxverse.com` in independent desktop (1440px) and mobile
(390px) contexts. Both clients saw the same synthetic available slot, and their
reservation requests were released together. Authentication and tutor discovery
were synthetic; booking and mock-payment requests reached the actual deployed
server code running against disposable Memgraph and Postgres databases.

The mobile client won and displayed **Booking Confirmed!**. The desktop client
displayed **This slot is no longer available**, sent no `/tickets/consume`
request, and sent no `/schedule/book` request. The stored booking, deduction,
and balances were independently checked in Memgraph.

## Runtime Binding

The test ran the actual production server image, without rebuilding dirty source:

`sha256:8ff51645331f03c251a8bc806e48cb2cdd1cc5ee366a2520ba822330044a8efa`

Tested source SHA-256 values inside that image:

| File | SHA-256 |
| --- | --- |
| Schedule service | `8434d5c1fcf163efebc9a844801cd70bcfbd53a2ba353dcff55cead094ef5a36` |
| Schedule routes | `01af304e57cb6a05643917b8f29b94f0a42c5a8a8dbb718fdf3ac71384ea046b` |
| Ticket service | `aad82405f56a4931ec150d1d2a564d5cc3674cc2e028dc1633d62d544050c3e3` |
| Ticket routes | `7f7bf575404cf5798ad383f41fa2d7fa2f5e8cf8ca91d1d3030ce141f661cad0` |

The disposable database used the production Memgraph image (v3.13.1).
The QA Docker network was internal-only, with no production database mounts,
credentials, or signing keys. A temporary loopback-only proxy let browser tests
reach the isolated API; no booking/payment requests reached the production API.

## Reusable Tests

- `fluentxverse-server/tests/slotContention.integration.ts`: authenticated HTTP
  races, real mock-ticket accounting, database assertions, and retry checks.
- `fluentxverse-server/tests/slotContention.browserServer.ts`: isolated browser
  fixture/server, synthetic session tokens, and read-only evidence endpoint.
- `fluentxverse-student-solid-prototype/tests/slot-contention.cjs`: two browser
  contexts, simultaneous reservations, request assertions, and screenshots.

The server fixtures enforce the dedicated QA database hostnames and reject
production Engine or Privy credentials. Run them only in the isolated Docker
environment described in their headers. The browser fixture expects a fresh
synthetic slot; retries require a new browser fixture.

Evidence is retained in `/tmp/fxv-slot-contention-20261014.gFn1jt`:
`slot-contention.json`, `browser-contention.json`, and the two successful browser
screenshots. The private `browser-fixture.json` containing synthetic,
short-lived QA tokens was removed after testing. All QA containers, the
internal network, and the temporary proxy were stopped and removed.

## Limits

This validates contention and checkout ordering for the current deployed
mock-ticket path. It does not validate real ERC-1155 transfer finality, external
wallet prompts, Privy OAuth itself, a free-trial rollout, private-pass booking,
multi-region load, or every possible reservation-expiry/payment race. Those
remain separate tests. No production code fix or deployment was required.
