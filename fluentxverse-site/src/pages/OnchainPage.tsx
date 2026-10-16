import { A } from '@solidjs/router';
import { For } from 'solid-js';
import { ArrowRight, ArrowUpRight, Check, FileCheck, LockKeyhole, Plus, ShieldCheck } from 'lucide-solid';
import { ArticleHero } from '../components/ArticleHero';
import { TechnologyNav } from '../components/TechnologyNav';
import { ContactBand } from '../components/ContactBand';

const reasons = [
  { title: 'Learning lasts longer than a platform account.', text: 'A person may learn with several tutors, schools, and apps over many years. We believe useful evidence should be exportable and checkable outside the system that issued it. Shared verification could reduce dependence on one platform remaining available. That requires portable formats, trusted keys, and accessible verification tools, not just a transaction on a chain.', example: 'A future use case: carry an issued learning credential into another education app without asking it to trust a screenshot.' },
  { title: 'Trust crosses organizational boundaries.', text: 'A school, tutor network, and employer may need to evaluate the same credential without sharing a database. A public verification layer can give them a common place to check a proof or published record. Each still decides which issuers and assessments it accepts; blockchain does not create academic recognition or accreditation.', example: 'A future use case: a partner checks the same certification statement using the agreed issuer and verification keys.' },
  { title: 'A useful claim need not reveal the whole record.', text: 'Someone checking a tutor credential may need to know that specified requirements were met, not every private score or interview note. Zero-knowledge proofs can check those defined conditions while keeping the witness private. This benefit comes from the proof system, not from publishing personal data to a blockchain.', example: 'Our implemented tutor circuit checks score thresholds, profile approval, and an interview-pass flag without publishing the raw scores.' },
  { title: 'Learning access can have explicit rules.', text: 'Smart contracts can represent and transfer lesson entitlements according to defined rules. That could make ticket activity inspectable and support common access logic across future applications. Transfers, refunds, recovery, and consumer support still need careful design, and a token cannot guarantee that a lesson is delivered well.', example: 'Our direction: ERC-1155 lesson tickets for booking access. Base deployment and end-to-end ticket validation are still required.' },
];

const comparisons = [
  { need: 'Schedules, chat, materials, and feedback', fit: 'Application database', why: 'Fast-changing operational information needs editing, access controls, and responsive interfaces.' },
  { need: 'A tamper-evident credential from one issuer', fit: 'Signed credential', why: 'A digital signature can authenticate a record without needing a blockchain.' },
  { need: 'Verify a condition without exposing its inputs', fit: 'Zero-knowledge proof', why: 'Prove a defined statement while keeping the witness private; the proof can be checked offchain.' },
  { need: 'A common record across independent parties', fit: 'Onchain verification or registry', why: 'Useful when parties need shared publication and verification beyond one operator, and the benefits justify the costs.' },
];

const questions = [
  { title: 'Why not just use a normal database?', text: 'We do, for most of the education experience. A database is the right tool for private records and daily operations. Onchain infrastructure is a candidate where independent parties need to check a common record without relying only on our database. If a signature and an ordinary verification endpoint solve the problem, adding a chain may not be justified.' },
  { title: 'Do verifiable credentials require blockchain?', text: 'No. Credentials can be digitally signed and verified without a chain. We view blockchain as an optional shared verification layer, not the definition of a credential. W3C provides a useful issuer-holder-verifier model; our current custom proof workflows are not a claim of W3C credential conformance.' },
  { title: 'Does a lesson proof prove the student learned?', text: 'No. Our attendance workflow checks an issuer-signed claim that a booked lesson ended and the tutor marked the student present. It does not independently measure time in the call, mastery, or learning gains. Stronger educational claims need stronger assessments and clearly stated evidence.' },
  { title: 'Does onchain mean public student records?', text: 'It should not. Raw scores, identity records, lesson notes, recordings, and transcripts belong in controlled offchain systems. Our proof public signals use commitments and verification metadata. Commitments can still be correlated when shared repeatedly; zero knowledge does not mean complete anonymity.' },
  { title: 'Will other schools or employers accept these credentials?', text: 'Acceptance is an institutional decision, not a blockchain property. We have not announced cross-platform recognition or accreditation agreements. Clear schemas, meaningful assessments, issuer reputation, status checks, and partner adoption are work we would need to do.' },
  { title: 'What must happen before broader rollout?', text: 'Independent security review, a production-grade Groth16 setup, trusted verification-key distribution, issuer-key protection, credential correction and revocation policies, and usable recovery paths. Ticket contracts also need deployment and full transfer/refund testing. Current Base Sepolia and zkVerify Volta work is testnet activity, not a mainnet launch.' },
];

export default function OnchainPage() {
  return (
    <>
      <ArticleHero eyebrow="FLUENTXVERSE / WHY ONCHAIN" title="Onchain education" description="Learning happens between people. Its evidence should have a life beyond a single app." image="/assets/img/esl-japanese-student-v2.webp" alt="A student working on English lessons at a laptop" caption="AI-ILLUSTRATED LEARNING SCENE / OUR EDUCATION THESIS" subjectPosition="right" />
      <TechnologyNav />
      <section class="section-space" aria-labelledby="thesis-title">
        <div class="container research-split">
          <div><span class="eyebrow">THE CASE WE BELIEVE IN</span><h2 id="thesis-title">Learning is personal.<br /><span class="muted-heading">Verification can be shared.</span></h2></div>
          <div class="article-copy"><p class="lead-copy">Education is a strong candidate for onchain infrastructure because useful learning evidence needs to travel between people and institutions over time.</p><p>A screenshot of a badge is easy to share but hard to evaluate. A record inside one application is convenient until another organization needs to check it. Our thesis is that clearly defined, verifiable claims can help bridge that gap, with a public verification layer where shared trust actually matters.</p><p>This is our case for building, not a prediction of guaranteed adoption. Good teaching, meaningful assessment, affordable access, and institutional acceptance remain the foundations. A chain should strengthen those foundations, not distract from them.</p></div>
        </div>
      </section>
      <section class="research-band section-space" aria-labelledby="reasons-title">
        <div class="container">
          <div class="section-heading"><div><span class="eyebrow">FOUR PRACTICAL REASONS</span><h2 id="reasons-title">Where onchain can earn its place.</h2></div></div>
          <div class="onchain-reasons"><For each={reasons}>{(reason, index) => <article><span class="reason-number">0{index() + 1}</span><div><h3>{reason.title}</h3><p>{reason.text}</p><p class="reason-example">{reason.example}</p></div></article>}</For></div>
        </div>
      </section>
      <section class="section-space" aria-labelledby="proof-example-title">
        <div class="container">
          <div class="section-heading"><div><span class="eyebrow">A CONCRETE EXAMPLE</span><h2 id="proof-example-title">Certified to a rule.<br /><span class="muted-heading">Not reduced to a public score.</span></h2></div><p>Our tutor certification circuit.<br />An implemented, testnet-validated workflow.</p></div>
          <div class="proof-example">
            <div class="private-evidence"><LockKeyhole size={25} /><span class="eyebrow">PRIVATE INPUTS</span><h3>The assessment evidence</h3><ul><li>Written exam score</li><li>Speaking exam score</li><li>Profile approval and interview result</li><li>Private subject hash and issuer signature</li></ul><p>The circuit checks the signed values against defined certification requirements.</p></div>
            <div class="public-statement"><ShieldCheck size={25} /><span class="eyebrow">VERIFIABLE STATEMENT</span><h3>The issued credential meets the rules.</h3><ul><li><Check size={16} /> Written score at least 90</li><li><Check size={16} /> Speaking score at least 85</li><li><Check size={16} /> Profile approved and interview passed</li><li><Check size={16} /> Signature valid for the issuer key</li></ul><p>The public proof does not reveal the raw scores. Verifiers must use the trusted issuer and circuit keys, not arbitrary keys supplied with a proof.</p></div>
          </div>
          <div class="evidence-boundary"><FileCheck size={22} /><p><strong>The boundary matters.</strong> This proves conditions over an issuer-signed record. It does not independently validate the exams, the AI grading, the interview, or the tutor's teaching quality. Our documented onchain proof finalization used zkVerify Volta, a test network. <a href="https://docs.zkverify.io/overview/zkverifyjs" target="_blank" rel="noopener noreferrer">Network reference <ArrowUpRight size={13} /></a>.</p></div>
        </div>
      </section>
      <section class="research-band section-space" aria-labelledby="fit-title">
        <div class="container">
          <div class="section-heading"><div><span class="eyebrow">USE THE RIGHT LAYER</span><h2 id="fit-title">Not everything belongs onchain.</h2></div></div>
          <p class="comparison-intro">These tools solve different problems. A verifiable credential does not inherently require a blockchain, and a zero-knowledge proof can be checked without one.</p>
          <div class="comparison-table" role="region" aria-label="Technology fit comparison" tabindex="0">
            <table><caption>Choosing infrastructure for an education need</caption><thead><tr><th scope="col">The need</th><th scope="col">A suitable layer</th><th scope="col">Why it fits</th></tr></thead><tbody><For each={comparisons}>{(row) => <tr><th scope="row">{row.need}</th><td>{row.fit}</td><td>{row.why}</td></tr>}</For></tbody></table>
          </div>
          <p class="source-note">W3C's credential model separates the issuer, holder, and verifier and distinguishes authenticity from the truth of a claim. It informs our thinking; we do not claim our current custom proof format conforms to the standard. <a href="https://www.w3.org/TR/vc-data-model-2.0/" target="_blank" rel="noopener noreferrer">Verifiable Credentials Data Model v2.0</a>.</p>
        </div>
      </section>
      <section class="section-space" aria-labelledby="success-title">
        <div class="container research-split">
          <div><span class="eyebrow">WHAT SUCCESS SHOULD MEAN</span><h2 id="success-title">Better evidence.<br /><span class="muted-heading">Less friction.</span></h2><p class="section-intro">We would judge this direction by educational usefulness, not token activity. These are evaluation goals, not results we have already achieved.</p></div>
          <div class="purpose-list research-outcomes">
            <article><span>01</span><div><h3>Credentials people can actually use</h3><p>Measure whether a learner can export a meaningful record and whether another organization can verify and interpret it.</p></div></article>
            <article><span>02</span><div><h3>Privacy people can understand</h3><p>Make it clear what is shared, who can check it, what can be corrected, and what remains public after publication.</p></div></article>
            <article><span>03</span><div><h3>An experience worth the cost</h3><p>Evaluate verification time, fees, reliability, recovery, and support. Onchain adds value only if those tradeoffs work for real learners.</p></div></article>
          </div>
        </div>
      </section>
      <section class="research-band section-space" aria-labelledby="onchain-faq-title">
        <div class="container research-split">
          <div><span class="eyebrow">THE QUESTIONS WORTH ASKING</span><h2 id="onchain-faq-title">A stronger case<br /><span class="muted-heading">welcomes scrutiny.</span></h2></div>
          <div class="research-faq"><For each={questions}>{(question) => <details><summary>{question.title}<Plus size={18} /></summary><p>{question.text}</p></details>}</For><A class="text-link" href="/technology">Explore our technology <ArrowRight size={18} /></A></div>
        </div>
      </section>
      <ContactBand />
    </>
  );
}
