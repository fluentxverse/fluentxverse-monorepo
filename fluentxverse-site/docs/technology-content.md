# Technology Content Basis

Technology is a high-level overview of why FluentXVerse uses AI, Web3, and zero-knowledge proofs. The AI in Education and Why Onchain pages provide deeper explanations of uses, boundaries, and future directions. They do not assert mainnet deployment, accreditation, partner acceptance, measured AI learning gains, or W3C credential conformance.

## Local Evidence

- `fluentxverse-server/src/services/ai.service.ts`: Mastra/OpenAI agents for grammar, vocabulary, pronunciation guides, and structured lesson-content drafts.
- `fluentxverse-server/src/services/exam.services/speaking.service.ts`: audio transcription followed by transcript-based grading. This does not establish acoustic pronunciation or delivery accuracy.
- `fluentxverse-server/circuits/tutor-certification/tutor_certification.circom`: score thresholds, approval flags, Poseidon commitment, and issuer signature. Its adjacent older README is stale; the circuit and current service implementation take precedence.
- `docs/tutor-certification-zk-implementation.md`: a documented finalized tutor-certification proof on zkVerify Volta. The public site describes this as historical testnet evidence, not a live availability or mainnet claim.
- `fluentxverse-server/circuits/student-lesson/README.md`: issuer-attested lesson attendance, proof public signals, correlation limits, and development trusted-setup constraints.
- `docs/web3-base-sepolia.md`: Base Sepolia integration, Privy identity, viem reads, ERC-1155 direction, and the lack of a deployed Base ticket contract in the documented setup.
- `docs/video-call-infrastructure.md`: RealtimeKit classroom media, WebRTC/TURN interviews, Socket.IO application signaling, and PostgreSQL lifecycle coordination.
- Site and backend package/configuration files: SolidJS static site, Cloudflare Workers assets, Bun/Elysia, and Memgraph.

## Primary References

- [W3C Verifiable Credentials Data Model v2.0](https://www.w3.org/TR/vc-data-model-2.0/): issuer/holder/verifier roles, signatures, proof versus claim truth, privacy and status considerations. Used as a conceptual reference, not a conformance claim.
- [UNESCO guidance for generative AI in education and research](https://www.unesco.org/en/articles/guidance-generative-ai-education-and-research): human-centered use, privacy, and educational evaluation. No certification or endorsement is claimed.
- [ERC-1155 Multi Token Standard](https://eips.ethereum.org/EIPS/eip-1155): representation of multiple token types. It does not itself supply booking, refunds, or educational quality.
- [zkVerifyJS network reference](https://docs.zkverify.io/overview/zkverifyjs): Volta is a test network; Groth16 verification is supported by the integration.

The portability, cross-institution recognition, broader-subject ecosystem, and evaluation criteria are explicitly stated as FluentXVerse's thesis or future direction. Proofs authenticate constrained issuer claims; they do not independently validate the assessments or grant recognition. Correction/revocation policy, trusted-key distribution, audited setup, privacy controls, and ticket validation are identified as requirements before broader rollout.

## Verification

Run `bun run build` from `fluentxverse-site`. Browser coverage lives in `tests/browser/technology.cjs`; run with `PLAYWRIGHT_MODULE` pointing to an installed Playwright package, and optionally `SITE_URL` pointing to a local production preview. Screenshots default to `/tmp/fluentxverse-technology-qa`.
