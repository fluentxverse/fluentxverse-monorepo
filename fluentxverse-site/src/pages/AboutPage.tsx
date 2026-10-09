import { For, Show } from 'solid-js';
import { ArrowDown, ArrowUpRight, UserRound } from 'lucide-solid';
import { founder, teamMembers } from '../data/site';
import { ContactBand } from '../components/ContactBand';

export function AboutPage() {
  return (
    <>
      <section class="about-hero" aria-labelledby="about-title">
        <div class="container">
          <span class="eyebrow">ABOUT US</span>
          <h1 id="about-title">Fluent<span class="brand-x">X</span>Verse<span class="brand-period">.</span></h1>
          <p class="about-statement">An education ecosystem. <span class="brand-x">Built onchain.</span></p>
          <div class="about-hero-bottom"><p>We build applications that bring education onchain,<br class="desktop-break" /> starting with online ESL and growing into new subjects and skills.</p><a href="#our-story" class="circle-link" aria-label="Read our story" title="Read our story"><ArrowDown size={24} /></a></div>
        </div>
        <div class="about-panorama"><img src="/assets/img/office.webp" srcset="/assets/img/office-small.webp 960w, /assets/img/office.webp 1920w" sizes="100vw" alt="An open workspace with shared tables and natural light" width="1920" height="1280" fetchpriority="high" /><span>BUILT IN THE PHILIPPINES. THINKING GLOBALLY.</span></div>
      </section>

      <section id="our-story" class="section-space story-section" aria-labelledby="story-title">
        <div class="container story-grid">
          <div><span class="eyebrow">OUR DIRECTION</span><h2 id="story-title">Education onchain.<br />ESL is the beginning.</h2></div>
          <div class="story-copy"><p class="large-copy">FluentXVerse is building an ecosystem of onchain education applications. Our first platform, FluentXVerse ESL, connects Filipino tutors with English learners through dedicated student and tutor apps.</p><p>ESL gives that vision a practical starting point: live lessons, learning materials, scheduling, and feedback, with onchain lesson tickets and ongoing work on verifiable tutor and lesson credentials.</p><p>Our scope extends beyond English. We plan to develop education applications for other subjects, skills, and learning formats, bringing useful learning experiences and onchain infrastructure together under FluentXVerse.</p><a class="story-signature" href={founder.linkedin} target="_blank" rel="noopener noreferrer" aria-label={`${founder.name}, ${founder.role}, on LinkedIn`}><img src={founder.image} width="56" height="56" alt={founder.name} loading="lazy" /><span>{founder.name}<span class="founder-role">{founder.role}</span></span><ArrowUpRight size={18} /></a></div>
        </div>
      </section>

      <section class="values-section section-space" aria-labelledby="values-title">
        <div class="container">
          <div class="section-heading"><div><span class="eyebrow">WHAT GUIDES OUR WORK</span><h2 id="values-title">Built for education.</h2></div><p>From the classroom experience<br />to the systems that support it.</p></div>
          <div class="values-grid">
            <article><span class="value-number">01 /</span><h3>Education comes first.</h3><p>Start with what learners and educators need. Use blockchain where it adds value to accessing lessons, verifying credentials, or supporting learning.</p></article>
            <article><span class="value-number">02 /</span><h3>Make trust verifiable.</h3><p>Build toward credentials and records that can be checked, while being clear about what they verify and protecting personal information.</p></article>
            <article><span class="value-number">03 /</span><h3>Grow across disciplines.</h3><p>Use what we learn from ESL to inform new education projects. Keep the ecosystem open to different subjects, skills, and teaching formats.</p></article>
          </div>
        </div>
      </section>

      <section id="team" class="team-section section-space" aria-labelledby="team-title">
        <div class="container">
          <div class="section-heading"><div><span class="eyebrow">THE PEOPLE BUILDING FLUENTXVERSE</span><h2 id="team-title">One team.<br /><span class="muted-heading">Education onchain.</span></h2></div><p>Building learning applications<br />and the onchain systems behind them.</p></div>
          <div class="team-grid">
            <For each={teamMembers}>{(member, index) => (
              <article class="team-member">
                <div class="team-portrait">
                  <Show when={member.image} fallback={<div class="portrait-placeholder"><UserRound size={82} strokeWidth={0.8} /><span>FLUENTXVERSE / {String(index() + 1).padStart(2, '0')}</span></div>}>
                    <img src={member.image} alt={member.name} width="600" height="720" loading="lazy" />
                  </Show>
                  <span class="portrait-index">0{index() + 1}</span>
                </div>
                <div class="team-name-row"><h3>{member.name}</h3><Show when={member.linkedin}><a href={member.linkedin} target="_blank" rel="noopener noreferrer" class="team-social" aria-label={`${member.name} on LinkedIn`} title="LinkedIn"><img src="/assets/img/linkedin.svg" width="19" height="19" alt="" aria-hidden="true" /></a></Show></div>
                <span class="team-role">{member.role}</span>
                <p>{member.bio}</p>
              </article>
            )}</For>
          </div>
        </div>
      </section>
      <ContactBand />
    </>
  );
}
