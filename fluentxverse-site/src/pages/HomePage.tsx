import { A } from '@solidjs/router';
import { For } from 'solid-js';
import { ArrowDown, ArrowRight, ArrowUpRight, Layers, MoveUpRight } from 'lucide-solid';
import { Dynamic } from 'solid-js/web';
import { projects } from '../data/site';
import { ContactBand } from '../components/ContactBand';

export function HomePage() {
  return (
    <>
      <section class="home-hero" aria-labelledby="home-title">
        <img class="hero-photo" src="/assets/img/office.webp" srcset="/assets/img/office-small.webp 960w, /assets/img/office.webp 1920w" sizes="100vw" alt="A bright, open workspace filled with natural light" width="1920" height="1280" fetchpriority="high" />
        <div class="hero-photo-wash" />
        <div class="container hero-content">
          <span class="eyebrow"><span class="small-line" /> AN ECOSYSTEM FOR ONCHAIN EDUCATION.</span>
          <h1 id="home-title">Fluent<span class="brand-x">X</span>Verse<span class="brand-period">.</span></h1>
          <p class="hero-statement">Learning, backed by proof.</p>
          <p class="hero-description">We build onchain education applications.<br class="desktop-break" /> FluentXVerse ESL is our first chapter, with more ways to learn ahead.</p>
          <div class="hero-actions">
            <A class="button button-primary" href="/#ecosystem">Explore our ecosystem <ArrowDown size={18} /></A>
            <A class="text-link" href="/about">The story behind us <ArrowUpRight size={18} /></A>
          </div>
        </div>
        <div class="container hero-footnote"><span>LANGUAGE TODAY. A WIDER WORLD OF LEARNING TOMORROW.</span><span class="hero-index">01 / FLUENTXVERSE <ArrowDown size={16} /></span></div>
      </section>

      <section class="intro-band">
        <div class="container intro-inner">
          <div class="intro-label"><Layers size={22} strokeWidth={1.5} /><span>ONCHAIN FOUNDATIONS.<br />REAL LEARNING.</span></div>
          <p>Our focus is education: learning applications, onchain access, and verifiable credentials. One ecosystem, built to grow across subjects and skills.</p>
          <A class="circle-link" href="/about" aria-label="Discover our purpose" title="Discover our purpose"><ArrowUpRight size={24} /></A>
        </div>
      </section>

      <section id="ecosystem" class="ecosystem-section section-space" aria-labelledby="ecosystem-title">
        <div class="container">
          <div class="section-heading">
            <div><span class="eyebrow">OUR FIRST EDUCATION PLATFORM</span><h2 id="ecosystem-title">FluentXVerse ESL.<br /><span class="muted-heading">Two apps. One classroom.</span></h2></div>
            <p>Online English learning with onchain foundations.<br />Dedicated apps for students and tutors.</p>
          </div>
          <div class="project-grid">
            <For each={projects}>{(project) => (
              <article class={`project-card project-${project.id}`}>
                <A class="project-photo-link" href={`/esl-${project.id}-app`} aria-label={`Learn how the ESL ${project.id} app works`}>
                  <img src={project.image} alt={project.alt} width="900" height="600" loading="lazy" />
                  <span class="photo-category"><Dynamic component={project.icon} size={16} />{project.category}</span>
                  <span class="photo-arrow"><ArrowUpRight size={23} /></span>
                </A>
                <div class="project-body">
                  <span class="project-number">FLUENTXVERSE / {project.number}</span>
                  <h3>{project.name}</h3>
                  <p>{project.description}</p>
                  <ul class="project-details"><For each={project.details}>{(detail) => <li>{detail}</li>}</For></ul>
                  <div class="project-guide-link"><A class="text-link" href={`/esl-${project.id}-app`}>{project.id === 'student' ? 'How the student app works' : 'How the platform works'} <ArrowRight size={18}/></A><a class="text-link" href={project.href} target="_blank" rel="noopener noreferrer">Open {project.id} app <ArrowUpRight size={16}/></a></div>
                </div>
              </article>
            )}</For>
          </div>
          <div class="next-project">
            <span class="next-icon"><MoveUpRight size={26} strokeWidth={1.5} /></span>
            <div><span class="eyebrow">BEYOND LANGUAGE LEARNING</span><h3>More subjects. The same foundation.</h3></div>
            <p>Our vision extends to new skills and learning formats,<br />with onchain education at the core.</p>
            <span class="future-label">MORE TO COME</span>
          </div>
        </div>
      </section>

      <section class="purpose-section section-space" aria-labelledby="purpose-title">
        <div class="container purpose-grid">
          <div class="purpose-heading"><span class="eyebrow">WHY ONCHAIN EDUCATION</span><h2 id="purpose-title">Learning experiences.<br /><span class="muted-heading">Verifiable foundations.</span></h2><A class="text-link" href="/onchain-education">Read the case for onchain education <ArrowRight size={18} /></A></div>
          <div class="purpose-list">
            <article><span>01</span><div><h3>Onchain access to learning</h3><p>Our lesson-ticket design connects digital ownership with a practical use: booking an English lesson. Base Sepolia integration is in testing; contract deployment and ticket validation remain ahead.</p></div></article>
            <article><span>02</span><div><h3>Credentials that can be checked</h3><p>We're developing proof-based verification for tutor qualifications and lesson participation, with care for learners' and educators' personal information.</p></div></article>
            <article><span>03</span><div><h3>A foundation beyond ESL</h3><p>Language learning is the starting point. Our wider ambition is to build onchain applications for different subjects, skills, and ways of learning.</p></div></article>
          </div>
        </div>
      </section>
      <section class="section-space" aria-labelledby="home-tech-title">
        <div class="container">
          <div class="section-heading"><div><span class="eyebrow">HOW WE BUILD</span><h2 id="home-tech-title">The technology behind the learning.</h2></div><A class="text-link" href="/technology">Explore our technology <ArrowRight size={18} /></A></div>
          <div class="research-links">
            <A href="/technology/ai"><div><span class="eyebrow">AI / EDUCATION</span><h3>Better tools for human teaching.</h3><p>Language assistance, lesson drafts, and assessment support, with clear limits.</p></div><ArrowRight size={22} /></A>
            <A href="/onchain-education"><div><span class="eyebrow">WEB3 / VERIFICATION</span><h3>Evidence that can be checked.</h3><p>Our case for shared verification, private proofs, and portable learning records.</p></div><ArrowRight size={22} /></A>
          </div>
        </div>
      </section>
      <ContactBand />
    </>
  );
}
