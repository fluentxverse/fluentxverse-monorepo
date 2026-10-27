import { For } from 'solid-js';
import { ArrowUpRight, Check, FileCheck, LockKeyhole, ShieldCheck } from 'lucide-solid';
import { ArticleHero } from '../components/ArticleHero';
import { TechnologyNav } from '../components/TechnologyNav';
import { ContactBand } from '../components/ContactBand';
import { onchainEducationPillars } from '../data/onchainEducation';
import './OnchainPage.css';

const comparisons = [
  { need: 'Schedules, chat, materials, and feedback', fit: 'Application database', why: 'Fast-changing operational information needs editing, access controls, and responsive interfaces.' },
  { need: 'A tamper-evident credential from one issuer', fit: 'Signed credential', why: 'A digital signature can authenticate a record without needing a blockchain.' },
  { need: 'Verify a condition without exposing its inputs', fit: 'Zero-knowledge proof', why: 'Prove a defined statement while keeping the witness private; the proof can be checked offchain.' },
  { need: 'A common record across independent parties', fit: 'Onchain verification or registry', why: 'Useful when parties need shared publication and verification beyond one operator, and the benefits justify the costs.' },
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
          <div class="section-heading"><div><span class="eyebrow">FIVE REASONS TO BUILD</span><h2 id="reasons-title">Why bring online education onchain?</h2></div></div>
          <p class="onchain-pillar-intro">More portable learning records. Better ways to verify a claim. Clearer incentives and educator payments. These are opportunities for education, not a list of features FluentXVerse has already launched.</p>
          <div class="onchain-pillars">
            <For each={onchainEducationPillars}>{(pillar, index) => (
              <article class="onchain-pillar" id={pillar.id} aria-labelledby={`${pillar.id}-title`}>
                <span class="onchain-pillar-number" aria-hidden="true">0{index() + 1}</span>
                <div class="onchain-pillar-summary"><h3 id={`${pillar.id}-title`}>{pillar.title}</h3><p>{pillar.introduction}</p></div>
                <ul class="onchain-pillar-benefits"><For each={pillar.benefits}>{(benefit) => <li><strong>{benefit.title}</strong><p>{benefit.text}</p></li>}</For></ul>
                <p class="onchain-pillar-boundary">{pillar.boundary}</p>
              </article>
            )}</For>
          </div>
        </div>
      </section>
      <section class="section-space" aria-labelledby="proof-example-title">
        <div class="container">
          <div class="section-heading"><div><span class="eyebrow">A CONCRETE EXAMPLE</span><h2 id="proof-example-title">Certified to a rule.<br /><span class="muted-heading">Not reduced to a public score.</span></h2></div><p>Our tutor certification circuit.<br />An implemented example of private verification.</p></div>
          <div class="proof-example">
            <div class="private-evidence"><LockKeyhole size={25} /><span class="eyebrow">PRIVATE INPUTS</span><h3>The assessment evidence</h3><ul><li>Written exam score</li><li>Speaking exam score</li><li>Profile approval and interview result</li><li>Private subject hash and issuer signature</li></ul><p>The circuit checks the signed values against defined certification requirements.</p></div>
            <div class="public-statement"><ShieldCheck size={25} /><span class="eyebrow">VERIFIABLE STATEMENT</span><h3>The issued credential meets the rules.</h3><ul><li><Check size={16} /> Written score at least 90</li><li><Check size={16} /> Speaking score at least 85</li><li><Check size={16} /> Profile approved and interview passed</li><li><Check size={16} /> Signature valid for the issuer key</li></ul><p>The public proof does not reveal the raw scores. Verifiers must use the trusted issuer and circuit keys, not arbitrary keys supplied with a proof.</p></div>
          </div>
          <div class="evidence-boundary"><FileCheck size={22} /><p><strong>The boundary matters.</strong> This proves conditions over an issuer-signed record. It does not independently validate the exams, the AI grading, the interview, or the tutor's teaching quality. This screening example is separate from the payout verification pilot described above. <a href="https://docs.zkverify.io/overview/zkverifyjs" target="_blank" rel="noopener noreferrer">Verification reference <ArrowUpRight size={13} /></a>.</p></div>
        </div>
      </section>
      <section class="research-band section-space" aria-labelledby="fit-title">
        <div class="container">
          <div class="section-heading"><div><span class="eyebrow">USE THE RIGHT LAYER</span><h2 id="fit-title">Not everything belongs onchain.</h2></div></div>
          <p class="comparison-intro">These tools solve different problems. A verifiable credential does not inherently require a blockchain, and a zero-knowledge proof can be checked without one.</p>
          <div class="comparison-table" role="region" aria-label="Technology fit comparison" tabindex="0">
            <table><caption>Choosing infrastructure for an education need</caption><thead><tr><th scope="col">The need</th><th scope="col">A suitable layer</th><th scope="col">Why it fits</th></tr></thead><tbody><For each={comparisons}>{(row) => <tr><th scope="row">{row.need}</th><td>{row.fit}</td><td>{row.why}</td></tr>}</For></tbody></table>
          </div>
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
      <ContactBand />
    </>
  );
}
