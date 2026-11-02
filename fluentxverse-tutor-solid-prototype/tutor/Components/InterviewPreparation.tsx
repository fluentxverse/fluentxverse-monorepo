import { createSignal, For } from 'solid-js';
import { ArrowRight, Check, Circle, RotateCcw } from 'lucide-solid';
import TutorArt, { type TutorArtName } from './Common/TutorArt';
import './InterviewPreparation.css';

const tips: { art: TutorArtName; title: string; text: string }[] = [
  { art: 'headset', title: 'Make your voice easy to hear', text: 'Test your headset, microphone and camera. Close noisy apps and choose a quiet place with light in front of you.' },
  { art: 'contactCheck', title: 'Have your same ID ready', text: 'Bring the exact document you submitted. Your interviewer will compare it with your upload and your face. Wait for their instruction before showing it on camera.' },
  { art: 'speakingTest', title: 'Speak naturally', text: 'Practise a short introduction: who you are, why you want to tutor, and how you would help a learner. Clear, understandable English matters more than complicated words.' },
  { art: 'training', title: 'Keep explanations simple', text: 'Try explaining an everyday topic such as a daily routine. Give one clear example, ask a short question, and allow time for an answer.' },
  { art: 'community', title: 'Listen, then respond', text: 'Let the interviewer finish. It is fine to pause or ask them to repeat a question. Show patience and a friendly, professional manner.' },
  { art: 'network', title: 'Plan for interruptions', text: 'Charge your laptop, check your connection and keep your contact details current. If the call drops, try rejoining and contact support if you cannot return.' },
];
const checks = ['Same submitted ID within reach', 'Camera, microphone and headset tested', 'Quiet space and front-facing lighting', 'Interview time checked in Manila time'];
export default function InterviewPreparation(props: { compact?: boolean }) {
  const [checked, setChecked] = createSignal<string[]>([]);
  return <section class="interview-preparation" aria-label="Interview preparation">
    <header class="interview-prep-heading"><TutorArt name="interviewGuide" size={props.compact ? 56 : 80}/><div>
      <p class="interview-prep-eyebrow">A conversation, not a performance</p>
      <h2>{props.compact ? 'Feel ready for your interview' : 'Prepare one step at a time'}</h2>
      <p>You have already put work into your application. Bring that same care, speak at your own pace, and let us get to know the tutor behind the scores.</p>
    </div></header>
    <div class="interview-prep-tips"><For each={props.compact ? tips.slice(0, 3) : tips}>{tip => <article>
      <TutorArt name={tip.art} size={48} loading="lazy"/><div><h3>{tip.title}</h3><p>{tip.text}</p></div>
    </article>}</For></div>
    {props.compact ? <a class="interview-prep-link" href="/interview-guide">Read the interview guide <ArrowRight size={17}/></a> : <>
      <section class="interview-prep-expect" aria-labelledby="interview-expect-title"><h2 id="interview-expect-title">What to expect on the call</h2>
        <ol><li><strong>Meet your interviewer.</strong> Introduce yourself and settle into the conversation.</li>
          <li><strong>Complete the identity check.</strong> Present the same ID when asked. In-app recording is stopped for this step. A mismatch means resubmitting your ID and booking again.</li>
          <li><strong>Show how you communicate.</strong> Your interviewer reviews pronunciation, delivery, clarity and professionalism. You may be asked to explain a simple teaching example; the tips here are practice ideas, not a fixed question list.</li>
          <li><strong>Wait for the staff decision.</strong> Speaking-test AI scores are provisional. Your identity decision and teaching/interview decision are recorded separately. A profile review is also required before teaching.</li></ol>
      </section>
      <section class="interview-prep-checklist" aria-labelledby="interview-checklist-title"><div class="interview-prep-check-title"><h2 id="interview-checklist-title">Your pre-call check</h2><button type="button" title="Reset checklist" aria-label="Reset checklist" onClick={() => setChecked([])}><RotateCcw size={17}/></button></div>
        <For each={checks}>{item => <label><input type="checkbox" checked={checked().includes(item)} onChange={e => setChecked(old => e.currentTarget.checked ? [...old, item] : old.filter(i => i !== item))}/><span aria-hidden="true">{checked().includes(item) ? <Check size={18}/> : <Circle size={18}/>}</span>{item}</label>}</For>
        <p role="status">{checked().length} of {checks.length} ready</p>
      </section>
      <section class="interview-prep-rules"><h2>Before you book</h2><p>Pass both assessments and submit one accepted ID. Once staff accepts the ID, you have <strong>84 hours to book</strong>, with no extension. Slots are opened within the next three days; times are shown in <strong>Asia/Manila (UTC+08:00)</strong>.</p><p>If you cancel or miss the interview, you must submit your ID again. If the booking deadline expires, your ID image is deleted and you will need to resubmit. Do not email your ID or send passwords, PINs or one-time codes.</p></section>
    </>}
  </section>;
}
