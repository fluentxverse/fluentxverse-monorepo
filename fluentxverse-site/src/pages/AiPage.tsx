import { A } from '@solidjs/router';
import { For } from 'solid-js';
import { ArrowRight, ArrowUpRight, BookOpen, Languages, MessageSquare, Mic, Plus } from 'lucide-solid';
import { Dynamic } from 'solid-js/web';
import { ArticleHero } from '../components/ArticleHero';
import { TechnologyNav } from '../components/TechnologyNav';
import { ContactBand } from '../components/ContactBand';

const uses = [
  { icon: BookOpen, title: 'Lesson authoring', text: 'Generate structured drafts for vocabulary, exercises, roleplays, and lesson sections, using reference materials and target-level guidance. A draft is a starting point for curriculum work, not an automatic quality guarantee.' },
  { icon: Languages, title: 'Language assistance', text: 'Support tutors with grammar corrections and explanations, vocabulary meanings and translations, and pronunciation guides. These tools help address specific questions without replacing live conversation.' },
  { icon: Mic, title: 'Transcription and assessment support', text: 'Transcribe recorded speaking responses and generate rubric-based feedback in tutor assessment workflows. Transcription can miss words, and text-only analysis cannot reliably measure accent, pronunciation, or speaking delivery.' },
  { icon: MessageSquare, title: 'Practice with a purpose', text: 'Draft prompts and real-world speaking scenarios tied to a lesson goal. Our aim is more relevant opportunities to practice, with a tutor adapting the activity to the learner in front of them.' },
];

const questions = [
  { title: 'Is FluentXVerse replacing tutors with AI?', text: 'No. FluentXVerse ESL is built around human-led lessons. Our AI services support language assistance, content preparation, and assessment workflows; they do not replace the relationship, judgment, and live feedback an educator brings.' },
  { title: 'Does an AI score prove someone is a good teacher?', text: 'No. Model output is evidence to interpret, not a complete measure of teaching ability. Our tutor certification rules also include profile approval and an interview result. A cryptographic proof can confirm that recorded rules were met, but it cannot establish that the assessment itself was fair or accurate.' },
  { title: 'Are AI outputs or classroom recordings published onchain?', text: 'Raw transcripts, recordings, and private assessment inputs are not the public signals in our credential proof circuits. AI processing is a separate offchain workflow. Keeping information offchain still requires access controls, consent, retention decisions, and careful provider configuration.' },
  { title: 'How will AI expand beyond ESL?', text: 'We want to reuse the approach, not blindly reuse the curriculum: domain-specific learning goals, relevant practice, and educator-reviewed materials. Applications for other subjects and skills remain part of our future direction, not launched products.' },
];

export default function AiPage() {
  return (
    <>
      <ArticleHero eyebrow="FLUENTXVERSE / ARTIFICIAL INTELLIGENCE" title="AI in education" description="More useful preparation. More relevant practice. Human judgment at the center of the learning experience." image="/assets/img/esl-tutor-tailored.webp" alt="An online English tutor teaching from her laptop" caption="AI-ILLUSTRATED TEACHING SCENE / FLUENTXVERSE ESL" subjectPosition="left" />
      <TechnologyNav />
      <section class="section-space" aria-labelledby="ai-purpose-title">
        <div class="container research-split">
          <div><span class="eyebrow">OUR APPROACH</span><h2 id="ai-purpose-title">Assist the educator.<br /><span class="muted-heading">Serve the learner.</span></h2></div>
          <div class="article-copy"><p class="lead-copy">The point of AI in education is not to produce more content. It is to make the work around a good learning experience more useful.</p><p>A tutor still needs to understand a learner's hesitation, decide when to challenge them, and explain an idea in a way that makes sense. AI can help with drafts, language questions, and structured feedback. It does not supply the whole educational relationship.</p><p>Our implemented services use Mastra agents with OpenAI models, alongside audio transcription. The opportunity is practical: give educators more ways to prepare and learners more focused ways to practice. We have not established a measured learning-outcome improvement from these tools.</p></div>
        </div>
      </section>
      <section class="research-band section-space" aria-labelledby="ai-use-title">
        <div class="container">
          <div class="section-heading"><div><span class="eyebrow">IMPLEMENTED IN OUR SERVICES</span><h2 id="ai-use-title">Where AI can be useful.</h2></div><p>Specific tasks, grounded in a learning goal.<br />Availability depends on the application workflow.</p></div>
          <div class="ai-use-grid"><For each={uses}>{(use) => <article><Dynamic component={use.icon} size={27} strokeWidth={1.5} /><h3>{use.title}</h3><p>{use.text}</p></article>}</For></div>
        </div>
      </section>
      <section class="section-space" aria-labelledby="ai-example-title">
        <div class="container research-split">
          <div><span class="eyebrow">IN PRACTICE</span><h2 id="ai-example-title">A draft is not<br /><span class="muted-heading">a finished lesson.</span></h2><p class="section-intro">An illustrative authoring process for a Business English lesson. These steps express our instructional approach, not a claim that a model verifies its own quality.</p></div>
          <ol class="editorial-steps">
            <li><span>01</span><div><h3>Start with the skill</h3><p>For example: help a learner make a polite request in a workplace conversation.</p></div></li>
            <li><span>02</span><div><h3>Give the model a useful brief</h3><p>Specify the level, target language, activity format, and relevant reference material.</p></div></li>
            <li><span>03</span><div><h3>Review the educational content</h3><p>Check accuracy, natural language, cultural context, and whether the activity actually exercises the intended skill.</p></div></li>
            <li><span>04</span><div><h3>Let the tutor adapt</h3><p>Use the learner's response to adjust pace, clarify a misunderstanding, or change the example.</p></div></li>
          </ol>
        </div>
      </section>
      <section class="research-band section-space" aria-labelledby="ai-responsibility-title">
        <div class="container">
          <div class="section-heading"><div><span class="eyebrow">THE STANDARD WE BUILD TOWARD</span><h2 id="ai-responsibility-title">Useful assistance.<br /><span class="muted-heading">Clear boundaries.</span></h2></div></div>
          <div class="values-grid research-values">
            <article><span class="value-number">01 / ACCURACY</span><h3>Keep outputs open to correction.</h3><p>Models can generate fluent but incorrect answers. Content needs review, and assessment tools need evaluation across levels, accents, and contexts before their scores can support consequential decisions.</p></article>
            <article><span class="value-number">02 / PRIVACY</span><h3>Minimize what is shared.</h3><p>Use the information needed for a specific task. Consent, retention, provider settings, and age-appropriate safeguards matter. A zero-knowledge credential is not a substitute for responsible AI data handling.</p></article>
            <article><span class="value-number">03 / HUMAN AGENCY</span><h3>Make room for judgment.</h3><p>Educators and reviewers must be able to question model output. We do not treat generated feedback or a verified proof as a complete account of a learner's ability or a tutor's quality.</p></article>
          </div>
          <p class="source-note">UNESCO's guidance emphasizes human-centered educational use, privacy, and the evaluation of AI tools. These principles inform our approach; they are not a claim of external certification. <a href="https://www.unesco.org/en/articles/guidance-generative-ai-education-and-research" target="_blank" rel="noopener noreferrer">Read the UNESCO guidance <ArrowUpRight size={13} /></a>.</p>
        </div>
      </section>
      <section class="section-space" aria-labelledby="ai-faq-title">
        <div class="container research-split">
          <div><span class="eyebrow">A FEW IMPORTANT QUESTIONS</span><h2 id="ai-faq-title">What AI does.<br /><span class="muted-heading">And what it doesn't.</span></h2></div>
          <div class="research-faq"><For each={questions}>{(question) => <details><summary>{question.title}<Plus size={18} /></summary><p>{question.text}</p></details>}</For><A class="text-link" href="/onchain-education">How evidence becomes verifiable <ArrowRight size={18} /></A></div>
        </div>
      </section>
      <ContactBand />
    </>
  );
}
