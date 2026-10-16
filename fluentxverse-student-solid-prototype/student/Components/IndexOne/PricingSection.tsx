import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../../utils/cssStyle";
import { CircleCheck, ArrowRight } from "lucide-solid";
import './PricingSection.css';
const pricingPlans = [
    {
        type: 'basic',
        title: 'Basic Ticket',
        tagline: 'General English Lessons',
        price: '$6',
        accent: 'Blue Pass',
        icon: 'fas fa-ticket-alt',
        features: ['Standard tutors', '25-minute lessons', 'General lesson materials', 'Tickets never expire']
    },
    {
        type: 'premium',
        title: 'Premium Ticket',
        tagline: 'All Tutors + Certified Premium',
        price: '$9',
        accent: 'Top Pick',
        icon: 'fas fa-crown',
        features: ['Access all tutors', 'Certified premium tutors', 'Premium lesson materials', 'Tickets never expire']
    },
];
const PricingSection = () => {
    return (<section class="pricing-section" id="pricing">
      <div class="pricing-container">
        <div class="pricing-header">
          <p class="pricing-kicker">Pricing</p>
          <h2 class="pricing-title">Choose Your Learning Path</h2>
          <p class="pricing-subtitle">Simple tickets. No subscriptions. Learn at your own pace.</p>
        </div>

        <div class="pricing-cards" aria-label="Lesson ticket options">
          {pricingPlans.map((plan) => (<article class={`pricing-card pricing-card--${plan.type}`}>
              <div class="pricing-card__accent">{plan.accent}</div>

              <div class="pricing-card__header">
                <div class="pricing-card__icon">
                  <img src={`/assets/img/home-icons/${plan.type}-ticket-v2.png`} alt="" width="80" height="45"/>
                </div>
                <div>
                  <h3>{plan.title}</h3>
                  <span>{plan.tagline}</span>
                </div>
              </div>

              <div class="pricing-card__price">
                <strong>{plan.price}</strong>
                <span>per ticket</span>
              </div>

              <ul class="pricing-card__features">
                {plan.features.map((feature) => (<li>
                    <CircleCheck size={18}/>
                    <span>{feature}</span>
                  </li>))}
              </ul>

              <div class="pricing-card__ticket" aria-hidden="true"><img src={`/assets/img/home-icons/${plan.type}-ticket-v2.png`} alt="" width="240" height="135"/></div>
            </article>))}
        </div>

        <div class="pricing-trial-banner">
          <div class="trial-copy">
            <span>Free Trial</span>
            <strong>New here?</strong>
            <p>Get a free trial ticket to experience a lesson before purchasing.</p>
          </div>
          <a href="/register" class="trial-btn">
            <span>Start Free Trial</span>
            <ArrowRight size={18}/>
          </a>
        </div>
      </div>
    </section>);
};
export default PricingSection;
