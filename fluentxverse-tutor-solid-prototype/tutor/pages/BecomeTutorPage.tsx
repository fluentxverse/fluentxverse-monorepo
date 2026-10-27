import { onMount, type JSX } from 'solid-js';
import { ArrowDown, ArrowRight, Check, CircleCheck, Info, Terminal, X } from 'lucide-solid';
import Header from '../Components/Header/Header';
import Footer from '../Components/Footer/Footer';
import TutorArt, { type TutorArtName } from '../Components/Common/TutorArt';
import './BecomeTutorPage.css';

const qualifications: { art: TutorArtName | 'location'; title: string; description: string }[] = [
    { art: 'profile', title: 'At least 18 years old', description: 'Bring the maturity and responsibility to support learners of different backgrounds.' },
    { art: 'classroom', title: 'Comfortable with technology', description: 'Confident using video calls, email, and everyday online tools.' },
    { art: 'community', title: 'A confident communicator', description: 'Strong English skills, clear explanations, and a genuine interest in conversation.' },
    { art: 'reviews', title: 'Professional and dependable', description: 'Patient with learners, prepared for lessons, and punctual with your commitments.' },
    { art: 'location', title: 'Based in the Philippines', description: 'Applicants must currently live in the Philippines and have a suitable home teaching setup.' },
    { art: 'certificate', title: 'Ready to help people learn', description: 'Teaching or ESL experience is a plus, but it is not required to apply.' },
];
const applicationSteps = [
    { title: 'Create your account', description: 'Register online and complete your applicant profile so we can get to know you.' },
    { title: 'Show us your skills', description: 'Complete the written and speaking assessments, then an interview to review your communication and teaching readiness.' },
    { title: 'Get ready to teach', description: 'Complete onboarding and the required profile and document checks. Once approved, you can open your teaching schedule.' },
];

function Requirement(props: { children: JSX.Element; excluded?: boolean }) {
    return <li classList={{ 'bt-check--excluded': props.excluded }}>
      {props.excluded ? <X size={17} aria-hidden="true"/> : <Check size={17} aria-hidden="true"/>}
      <span>{props.children}</span>
    </li>;
}

export default function BecomeTutorPage() {
    onMount(() => { window.scrollTo(0, 0); document.title = 'Become a Tutor | FluentXVerse'; });
    return <>
      <Header showThemeSwitch={false}/>
      <div class="become-tutor-page">
        <section class="bt-hero" aria-labelledby="bt-title">
          <picture class="bt-hero-media" aria-hidden="true">
            <img src="/assets/img/banner/about-lesson-wide-v2.webp" alt="" fetchpriority="high" width="2048" height="683"/>
          </picture>
          <div class="bt-container bt-hero-content">
            <p class="bt-eyebrow">Teach online. Make a real connection.</p>
            <h1 id="bt-title" class="tutor-hero-title">Become a<br />FluentXVerse Tutor</h1>
            <p class="bt-hero-copy">Put your English skills to work. Teach from home, build a schedule that fits your life, and help learners find their confidence.</p>
            <div class="bt-hero-actions">
              <a class="bt-button" href="/register">Apply now <ArrowRight size={18}/></a>
              <a class="bt-text-link" href="#requirements">View requirements <ArrowDown size={16}/></a>
            </div>
            <ul class="bt-hero-facts" aria-label="Teaching at FluentXVerse">
              <li><CircleCheck size={16}/>Work from home</li><li><CircleCheck size={16}/>Flexible schedule</li><li><CircleCheck size={16}/>Online application</li>
            </ul>
          </div>
        </section>
        <nav class="bt-jump-nav" aria-label="On this page">
          <div class="bt-container"><a href="#requirements">Who can apply</a><a href="#setup">Your teaching setup</a><a href="#security">Device security</a><a href="#application">Application steps</a></div>
        </nav>
        <section id="requirements" class="bt-section tutor-requirements-section" aria-labelledby="bt-requirements-title">
          <div class="bt-container">
            <header class="bt-section-heading">
              <div><p class="bt-eyebrow">The person behind a great lesson</p><h2 id="bt-requirements-title">Bring your skills.<br />And your human side.</h2></div>
              <p>Great teaching starts with clear communication, consistency, and care. Here is what we look for in every applicant.</p>
            </header>
            <div class="bt-qualifications">{qualifications.map(item => <article class="bt-qualification">{item.art === 'location' ? <img class="tutor-art" src="/assets/img/about-icons/location-v1.webp" width="64" height="64" loading="lazy" alt="" aria-hidden="true"/> : <TutorArt name={item.art} size={64} loading="lazy"/>}<h3>{item.title}</h3><p>{item.description}</p></article>)}</div>
          </div>
        </section>
        <section id="setup" class="bt-section bt-setup" aria-labelledby="bt-setup-title">
          <div class="bt-container">
            <header class="bt-section-heading">
              <div><p class="bt-eyebrow">Ready for your next lesson</p><h2 id="bt-setup-title">A setup you can rely on.</h2></div>
              <p>A clear connection, good sound, and a quiet space help you focus on what matters: your student.</p>
            </header>
            <div class="bt-setup-grid">
              <article class="bt-setup-item">
                <header><TutorArt name="classroom" size={80} loading="lazy"/><div><span class="bt-step-label">01 / Your computer</span><h3>Computer &amp; software</h3></div></header>
                <ul class="bt-checklist"><Requirement>Use a laptop or desktop for your lessons.</Requirement><Requirement excluded>Phones and tablets are not suitable for conducting lessons.</Requirement><Requirement>Keep your operating system and drivers updated.</Requirement></ul>
                <dl class="bt-specs" aria-label="Minimum computer specifications"><div><dt>Operating system</dt><dd>Windows 10 / macOS 10.14 or newer</dd></div><div><dt>Processor</dt><dd>Dual-core or better</dd></div><div><dt>Memory</dt><dd>At least 8 GB RAM</dd></div></dl>
              </article>
              <article class="bt-setup-item">
                <header><TutorArt name="network" size={80} loading="lazy"/><div><span class="bt-step-label">02 / Your connection</span><h3>Reliable internet</h3></div></header>
                <ul class="bt-checklist"><Requirement>A stable wired connection is preferred.</Requirement><Requirement>Keep Chrome or Firefox up to date.</Requirement></ul>
                <dl class="bt-specs" aria-label="Internet speed requirements"><div><dt>Recommended</dt><dd>15 Mbps upload &amp; download</dd></div><div><dt>Minimum</dt><dd>3 Mbps upload &amp; download</dd></div><div><dt>Ping</dt><dd>Below 100 ms</dd></div></dl>
              </article>
              <article class="bt-setup-item">
                <header><TutorArt name="headset" size={80} loading="lazy"/><div><span class="bt-step-label">03 / Sound &amp; picture</span><h3>Be seen. Be heard.</h3></div></header>
                <ul class="bt-checklist"><Requirement>A working webcam, microphone, and headset.</Requirement><Requirement>A noise-cancelling microphone is preferred.</Requirement><Requirement>Noise and echo reduction help keep your voice clear.</Requirement><Requirement>Easy-to-reach volume and mute controls are a plus.</Requirement></ul>
              </article>
              <article class="bt-setup-item">
                <header><TutorArt name="home" size={80} loading="lazy"/><div><span class="bt-step-label">04 / Your teaching space</span><h3>Room to focus</h3></div></header>
                <ul class="bt-checklist"><Requirement>A quiet space without unnecessary background noise.</Requirement><Requirement>Steady lighting and a clear webcam picture.</Requirement><Requirement>A tidy, distraction-free background, preferably plain.</Requirement><Requirement>Presentable attire; smart casual is recommended.</Requirement></ul>
              </article>
            </div>
          </div>
        </section>
        <section id="security" class="bt-section bt-security" aria-labelledby="bt-security-title">
          <div class="bt-container">
            <header class="bt-security-heading"><TutorArt name="privacy" size={80} loading="lazy"/><div><p class="bt-eyebrow">A little protection goes a long way</p><h2 id="bt-security-title">Keep your teaching device secure.</h2><p>Keep security protection active and up to date. Built-in protection is acceptable; check the guidance for your operating system.</p></div></header>
            <div class="bt-platforms">
              <article><svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M0 3.449 9.75 2.1v9.425H0V3.449Zm10.95-1.514L24 .133v11.392H10.95v-9.59ZM0 12.725h9.75v9.425L0 20.801v-8.076Zm10.95 0H24v11.392l-13.05-1.802v-9.59Z"/></svg><h3>Windows</h3><p>Check virus and threat protection in Windows Security, including Microsoft Defender or your installed security provider.</p><a href="https://support.microsoft.com/en-us/windows/security/threat-malware-protection/virus-and-threat-protection-in-the-windows-security-app" target="_blank" rel="noopener noreferrer">Windows security guide <ArrowRight size={15}/></a></article>
              <article><svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.05 12.536c.03 3.65 3.2 4.864 3.235 4.88-.027.086-.507 1.733-1.67 3.436-1.01 1.472-2.058 2.94-3.71 2.97-1.624.038-2.144-.96-4-.96-1.854 0-2.434.93-3.968.998-1.594.06-2.81-1.59-3.826-3.058C1.02 17.79-.575 12.282 1.57 8.567c1.064-1.845 2.97-3.01 5.04-3.04 1.574-.03 3.06 1.064 4.022 1.064.96 0 2.765-1.316 4.655-1.122.792.033 3.02.32 4.45 2.41-.115.07-2.657 1.548-2.63 4.657h-.057ZM14.011 3.51c.845-1.025 1.416-2.45 1.26-3.87-1.217.05-2.69.812-3.563 1.837-.782.907-1.467 2.358-1.283 3.75 1.358.105 2.741-.691 3.586-1.716Z"/></svg><h3>macOS</h3><p>Keep macOS and its built-in protections, including XProtect, updated. Download software from trusted sources.</p><a href="https://support.apple.com/guide/security/protecting-against-malware-sec469d47bd8/web" target="_blank" rel="noopener noreferrer">Apple security guide <ArrowRight size={15}/></a></article>
              <article><Terminal size={26} aria-hidden="true"/><h3>Linux</h3><p>Keep your distribution and security packages updated. Confirm your teaching software works before applying.</p><a href="https://documentation.ubuntu.com/security/security-updates/" target="_blank" rel="noopener noreferrer">Ubuntu security guide <ArrowRight size={15}/></a></article>
            </div>
            <p class="bt-security-note"><Info size={16}/><span>These are security resources, not software endorsements. The computer requirements above still apply.</span></p>
          </div>
        </section>
        <section id="application" class="bt-section bt-application" aria-labelledby="bt-application-title">
          <div class="bt-container">
            <header class="bt-section-heading"><div><p class="bt-eyebrow">Your next chapter starts here</p><h2 id="bt-application-title">From application to first lesson.</h2></div><p>Every step is online. Bring your communication skills, prepare your setup, and take it one step at a time.</p></header>
            <ol class="bt-process">{applicationSteps.map((step, index) => <li><span class="bt-process-number">0{index + 1}</span><h3>{step.title}</h3><p>{step.description}</p></li>)}</ol>
          </div>
        </section>
        <section class="bt-cta" aria-labelledby="bt-cta-title"><div class="bt-container"><div><p class="bt-eyebrow">Your skills. Someone else's breakthrough.</p><h2 id="bt-cta-title">Let's make a great lesson happen.</h2><p>Take the first step toward teaching with FluentXVerse.</p></div><a class="bt-button" href="/register">Start your application <ArrowRight size={18}/></a></div></section>
      </div>
      <Footer/>
    </>;
}
