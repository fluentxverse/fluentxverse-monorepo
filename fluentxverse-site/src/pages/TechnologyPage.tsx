import { A } from '@solidjs/router';
import { For } from 'solid-js';
import { ArrowRight, Fingerprint, ShieldCheck, Sparkles } from 'lucide-solid';
import { Dynamic } from 'solid-js/web';
import { ArticleHero } from '../components/ArticleHero';
import { TechnologyNav } from '../components/TechnologyNav';
import { ContactBand } from '../components/ContactBand';

const layers = [
  {
    icon: Sparkles,
    title: 'AI: more useful learning support.',
    text: 'We use artificial intelligence to assist with language questions, lesson preparation, practice activities, and feedback. It helps turn a learning goal into material an educator can review and adapt.',
    purpose: 'Why we use it: good learning needs relevant practice and thoughtful feedback. AI can support the work that goes into both, while educators bring the context, care, and judgment that make them meaningful.',
  },
  {
    icon: Fingerprint,
    title: 'Web3: learning beyond one platform.',
    text: 'Our Web3 work builds toward verifiable learning records and onchain lesson access. The aim is a shared foundation where evidence can be checked beyond the application that issued it.',
    purpose: 'Why we use it: people learn across different educators, subjects, and stages of life. We believe useful evidence should travel with them. Shared verification can help independent organizations check a record without relying only on one platform\'s database.',
  },
  {
    icon: ShieldCheck,
    title: 'ZK: trust without oversharing.',
    text: 'Zero-knowledge proofs let a defined claim be checked without revealing the private information behind it. We use this approach in credential workflows, such as checking that a tutor met specified certification requirements without publishing their raw scores.',
    purpose: 'Why we use it: someone checking a credential may need to know that the requirements were met, not every assessment detail. ZK helps us make evidence verifiable while sharing less personal information. The quality of the assessment still matters.',
  },
];

export default function TechnologyPage() {
  return (
    <>
      <ArticleHero eyebrow="FLUENTXVERSE / OUR TECHNOLOGY" title="Technology for real learning" description="AI, Web3 technology, and zero-knowledge proofs. We use them to support learning, build trust, and protect private information." image="/assets/img/office.webp" alt="A bright shared workspace" caption="EDUCATION FIRST. TECHNOLOGY WITH A PURPOSE." />
      <TechnologyNav />
      <section class="section-space" aria-labelledby="layers-title">
        <div class="container">
          <div class="section-heading"><div><span class="eyebrow">THREE TECHNOLOGIES. THREE CLEAR PURPOSES.</span><h2 id="layers-title">Support learning.<br /><span class="muted-heading">Strengthen trust.</span></h2></div><p>Each technology answers a different need<br />in the education experience.</p></div>
          <div class="technology-layers">
            <For each={layers}>{(layer, index) => (
              <article class="technology-layer">
                <div class="layer-index"><span>0{index() + 1}</span><Dynamic component={layer.icon} size={27} strokeWidth={1.5} /></div>
                <div class="layer-content"><h3>{layer.title}</h3><p>{layer.text}</p><p class="layer-purpose">{layer.purpose}</p></div>
              </article>
            )}</For>
          </div>
        </div>
      </section>
      <section class="research-band section-space" aria-labelledby="together-title">
        <div class="container research-split">
          <div><span class="eyebrow">HOW THEY WORK TOGETHER</span><h2 id="together-title">Better learning.<br /><span class="muted-heading">More trustworthy evidence.</span></h2></div>
          <div class="article-copy"><p class="lead-copy">AI supports the learning experience. Web3 builds toward shared verification. ZK helps keep the underlying evidence private.</p><p>Together, they support our vision of an education ecosystem where useful learning experiences and trustworthy records grow side by side, starting with ESL and extending to other subjects and skills.</p><p>Technology supports that vision; it does not replace good teaching, meaningful assessment, or the judgment of the people who use a credential.</p></div>
        </div>
      </section>
      <section class="section-space" aria-labelledby="explore-tech-title">
        <div class="container">
          <div class="section-heading"><div><span class="eyebrow">GO DEEPER</span><h2 id="explore-tech-title">The thinking behind the tools.</h2></div></div>
          <div class="research-links">
            <A href="/technology/ai"><Sparkles size={25} /><div><h3>AI in education</h3><p>Where assistance helps, where it can fail, and why educators remain essential.</p></div><ArrowRight size={22} /></A>
            <A href="/onchain-education"><Fingerprint size={25} /><div><h3>Why education belongs onchain</h3><p>Our case for shared verification, private evidence, and records with a life beyond one app.</p></div><ArrowRight size={22} /></A>
          </div>
        </div>
      </section>
      <ContactBand />
    </>
  );
}
