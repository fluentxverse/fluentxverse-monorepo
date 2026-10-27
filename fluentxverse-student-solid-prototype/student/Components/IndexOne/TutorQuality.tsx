import { A } from '@solidjs/router';
import { ArrowRight, BadgeCheck, BookOpenCheck, BriefcaseBusiness, Clock, MessagesSquare, Mic, Target } from 'lucide-solid';
import './TutorQuality.css';

const TutorQuality = () => (
  <section class="tutor-quality" id="our-tutors" aria-labelledby="tutor-quality-title">
    <div class="tutor-quality__inner">
      <div class="tutor-quality__copy">
        <p class="tutor-quality__eyebrow">Carefully selected. Committed to your progress.</p>
        <h2 id="tutor-quality-title">Your goals deserve<br />a great tutor.</h2>
        <p class="tutor-quality__intro">
          Great English is only the beginning. Our tutors go through a stringent selection
          process that looks beyond language ability to teaching skills, conversation skills,
          and professionalism. You deserve someone who can teach, listen, and make every lesson count.
        </p>

        <ul class="tutor-quality__standards">
          <li>
            <BadgeCheck size={22} aria-hidden="true" />
            <div>
              <h3>Screened before they teach</h3>
              <p>Tutors must pass written and speaking assessments, complete a profile review, and pass an interview before joining our teaching community.</p>
            </div>
          </li>
          <li>
            <BookOpenCheck size={22} aria-hidden="true" />
            <div>
              <h3>Teaching that makes things click</h3>
              <p>Clear explanations, patient correction, and practical feedback turn a conversation into a learning opportunity, not just time spent talking.</p>
            </div>
          </li>
          <li>
            <MessagesSquare size={22} aria-hidden="true" />
            <div>
              <h3>Conversation skills that bring out yours</h3>
              <p>Learn with someone who listens, asks thoughtful questions, and gives you room to speak. Practice expressing your ideas without feeling rushed or judged.</p>
            </div>
          </li>
          <li>
            <Clock size={22} aria-hidden="true" />
            <div>
              <h3>Professional standards. Respect for your time.</h3>
              <p>We set clear expectations for punctuality, lesson preparation, and professional conduct. Reliability matters just as much as a friendly conversation.</p>
            </div>
          </li>
          <li>
            <Target size={22} aria-hidden="true" />
            <div>
              <h3>Your goals, not a one-size-fits-all lesson</h3>
              <p>Starting out, speaking up at work, or getting comfortable in everyday English? Explore tutor profiles and teaching interests to find the right fit for your next step.</p>
            </div>
          </li>
        </ul>

        <A class="tutor-quality__cta" href="/browse-tutors">
          Find your tutor <ArrowRight size={19} aria-hidden="true" />
        </A>
      </div>

      <div class="tutor-quality__visual">
        <div class="tutor-quality__art">
          <span class="tutor-quality__note">More than fluent.<br /><strong>Ready to teach.</strong></span>
          <img src="/assets/img/home-icons/classroom-v1.webp" alt="" width="384" height="384" loading="lazy" decoding="async" />
        </div>
        <div class="tutor-quality__goals">
          <p>A better fit. A better learning experience.</p>
          <ul>
            <li><MessagesSquare size={19} aria-hidden="true" /><div><strong>Everyday conversations</strong><span>Practice English you can use beyond the classroom.</span></div></li>
            <li><BriefcaseBusiness size={19} aria-hidden="true" /><div><strong>English for your career</strong><span>Bring your ideas to meetings, interviews, and work conversations.</span></div></li>
            <li><Mic size={19} aria-hidden="true" /><div><strong>Confidence to speak up</strong><span>Build comfort with a tutor who encourages you to keep trying.</span></div></li>
          </ul>
          <span class="tutor-quality__signoff">Your English. Your pace. Your people.</span>
        </div>
      </div>
    </div>
  </section>
);

export default TutorQuality;
