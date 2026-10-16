import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../../utils/cssStyle";
import './WhyChooseUs.css';
import { TICKETING_VISIBLE } from '../../config/launch';
const successFeatures = [
    {
        title: 'Professional Tutors',
        description: 'Learn from certified, experienced tutors selected for clear lessons, useful feedback, and student-first coaching.',
        visual: 'tutors'
    },
    {
        title: 'Flexible Scheduling',
        description: 'Book lessons around your routine with available slots across time zones and simple rescheduling when plans change.',
        visual: 'schedule'
    },
    {
        title: 'Smart Progress Tracking',
        description: 'See vocabulary growth, fluency gains, and weekly learning milestones with reports that make improvement visible.',
        visual: 'progress'
    },
    {
        title: TICKETING_VISIBLE ? 'Flexible Payment' : 'Free Trial Lesson',
        description: TICKETING_VISIBLE ? 'Buy tickets only when you need them. No subscriptions, no hidden fees, and no wasted lessons.' : 'Meet a tutor and try a focused English lesson before committing.',
        visual: TICKETING_VISIBLE ? 'tickets' : 'tutors'
    },
];
const WhyChooseUs = () => {
    return (<section class="why-choose-section" id="why-choose">
      <div class="why-choose-container">
        <div class="why-choose-header">
          <h2 class="why-title">Everything You Need To Succeed</h2>
          <p class="why-with">WITH...</p>
        </div>

        <div class="success-card-grid" aria-label="Student success features">
          {successFeatures.map((feature) => (<article class={`success-card success-card--${feature.visual}`}>
              <div class="success-card__copy">
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </div>

              <div class={`success-card__visual success-card__visual--${feature.visual}`} aria-hidden="true">
                <img class="success-art" src={`/assets/img/home-icons/${feature.visual === 'tutors' ? 'community' : feature.visual === 'schedule' ? 'schedule' : feature.visual === 'progress' ? 'growth' : 'pay'}-v1.webp`} alt="" width="144" height="144"/>
              </div>
            </article>))}
        </div>
      </div>
    </section>);
};
export default WhyChooseUs;
