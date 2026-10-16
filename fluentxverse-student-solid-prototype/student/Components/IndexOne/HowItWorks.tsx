import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../../utils/cssStyle";
import { ArrowRight, ChevronRight } from "lucide-solid";
import './HowItWorks.css';
const steps = [
    {
        number: '01',
        label: 'Book',
        icon: 'fas fa-calendar-check',
        description: 'Pick a tutor and reserve the lesson time that fits your day.',
        meta: 'Choose your slot'
    },
    {
        number: '02',
        label: 'Learn',
        icon: 'fas fa-video',
        description: 'Join your live class and practice speaking, listening, and real conversation.',
        meta: 'Live 1-on-1 class'
    },
    {
        number: '03',
        label: 'Progress',
        icon: 'fas fa-chart-line',
        description: 'Review feedback, track gains, and keep building confidence every week.',
        meta: 'Weekly growth'
    },
];
const HowItWorks = () => {
    return (<section class="how-it-works" id="how-it-works">
      <div class="how-it-works__container">
        <div class="how-it-works__header">
          <p class="how-it-works__kicker">Start In Three Steps</p>
          <h2 class="how-it-works__title">How It Works</h2>
        </div>

        <div class="how-it-works__steps" aria-label="How FluentXVerse lessons work">
          {steps.map((step, index) => (<Fragment>
              <article class={`how-it-works__step how-it-works__step--${index + 1}`}>
                <div class="how-it-works__step-number">{step.number}</div>
                <div class="how-it-works__step-icon">
                  <img src={`/assets/img/home-icons/${index === 0 ? 'schedule' : index === 1 ? 'community' : 'growth'}-v1.webp`} alt="" width="64" height="64"/>
                </div>
                <div class="how-it-works__step-content">
                  <span>{step.meta}</span>
                  <h3>{step.label}</h3>
                  <p>{step.description}</p>
                </div>
              </article>

              {index < steps.length - 1 && (<div class="how-it-works__connector" aria-hidden="true">
                  <span></span>
                  <ChevronRight size={20}/>
                </div>)}
            </Fragment>))}
        </div>

        <div class="how-it-works__cta">
          <a href="/register" class="how-it-works__button">
            <span>Get Started Now</span>
            <ArrowRight size={18}/>
          </a>
        </div>
      </div>
    </section>);
};
export default HowItWorks;
