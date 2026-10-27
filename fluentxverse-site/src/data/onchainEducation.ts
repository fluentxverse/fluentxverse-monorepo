export const onchainEducationPillars = [
  {
    id: 'credentials',
    title: 'Tamper-evident credential verification',
    introduction: 'A qualification should be easier to check than to counterfeit. Signed credentials and shared verification records can give employers and schools a way to check the issuer and detect altered records.',
    benefits: [
      { title: 'Faster verification', text: 'Degrees, certificates, and language-proficiency claims can be checked against trusted issuer keys and credential status without a manual request to the issuing platform.' },
      { title: 'Less room for forgery', text: 'Cryptographic signatures expose unauthorized changes. Onchain commitments can provide a shared reference for an issued record, rather than relying on a screenshot or PDF alone.' },
    ],
    boundary: 'Authenticity is not accreditation. A valid signature cannot make a dishonest issuer or an inaccurate assessment trustworthy, so blockchain does not eliminate all credential fraud.',
  },
  {
    id: 'learning-records',
    title: 'Lifelong control of learning records',
    introduction: 'Learning can span years, subjects, and platforms. Learners should be able to retain useful evidence and choose what to share, instead of depending entirely on a single account staying available.',
    benefits: [
      { title: 'Learner-held credentials', text: 'Wallet-held credentials and decentralized identifiers (DIDs) can support portable identity and selective sharing. Durable exports, independent verification tools, and recovery paths are what make records useful if a provider closes.' },
      { title: 'A more unified transcript', text: 'Compatible credentials from an ESL app, a technical course, and other learning providers could form a verifiable digital resume. Shared formats and recognition between institutions are still necessary.' },
    ],
    boundary: 'A wallet is not a permanent storage guarantee. Keep private records offchain and design backups, key recovery, credential correction, and revocation from the start.',
  },
  {
    id: 'learning-incentives',
    title: 'Learn-to-earn incentives and scholarships',
    introduction: 'Well-designed incentives could help learners sustain meaningful progress and make education more accessible. Rewards should reinforce learning, not turn education into a race to collect tokens.',
    benefits: [
      { title: 'Recognition for useful progress', text: 'A funded program could award tokens or NFTs for assessed milestones, consistent practice, or helpful peer contributions, with rules that discourage farming and fabricated activity.' },
      { title: 'Global micro-scholarships', text: 'Sponsors could fund smart-contract programs that release support when agreed learning milestones are verified, including for learners in underserved regions.' },
    ],
    boundary: 'These are potential programs, not a live FluentXVerse rewards or scholarship offer. Funding, fair eligibility, reliable evidence, and safeguards against abuse must come first.',
  },
  {
    id: 'educator-payments',
    title: 'Direct, borderless educator payments',
    introduction: 'Educators and content creators should understand how they earn and how payments are calculated. Programmable payment rules could make revenue sharing clearer across a global education marketplace.',
    benefits: [
      { title: 'Programmable revenue sharing', text: 'Smart contracts could split payments between teachers, authors, and collaborators when course material is purchased through a participating system. Resale royalties depend on the rules being honored by that system.' },
      { title: 'Fewer payment intermediaries', text: 'Onchain settlement could reduce some cross-border payment friction and costs. Network fees, conversion, local access to funds, and platform charges still determine what an educator actually receives.' },
    ],
    boundary: 'Our private payout authorization workflow has passed a zkVerify mainnet/Base pilot. Actual tutor transfers and automated course royalties are not enabled; ordinary transfers would expose recipient and amount.',
  },
  {
    id: 'community-governance',
    title: 'Transparent, adaptive learning communities',
    introduction: 'Reputation should reflect meaningful contributions, and learning standards should evolve with the people using them. Shared verification can make those processes more accountable without exposing every learner\'s history.',
    benefits: [
      { title: 'Verifiable reputation', text: 'Tutoring hours, peer-review contributions, and teaching-assistant work could support reputation that other communities can check. Consent-based credentials and privacy-preserving summaries are preferable to a permanent public student dossier.' },
      { title: 'Community-led curriculum', text: 'A decentralized autonomous organization (DAO) could let educators and learners propose and vote on curriculum updates. Transparent decisions still need expert review, accessibility, and clear accountability.' },
    ],
    boundary: 'Open governance and portable reputation are future directions, not deployed FluentXVerse features. A public record alone does not establish teaching quality or prevent manipulated ratings.',
  },
] as const;
