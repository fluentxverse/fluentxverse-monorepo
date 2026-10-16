import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../../utils/cssStyle";
import HomeIllustration from './HomeIllustration';
import './BenefitsSection.css';
const BenefitsSection = () => {
    const benefits = [
        {
            illustration: 'schedule',
            title: 'Flexible Schedule',
            description: 'Set your own hours and work when it suits you. Early bird or night owl, you decide your teaching schedule.'
        },
        {
            illustration: 'home',
            title: 'Work From Home',
            description: 'No commute, no office politics. Teach from the comfort of your home or anywhere with a stable internet connection.'
        },
        {
            illustration: 'pay',
            title: 'Competitive Pay',
            description: 'Earn competitive rates for your expertise. The more you teach, the more you earn, with transparent payouts.'
        },
        {
            illustration: 'training',
            title: 'Free Training',
            description: 'Access our comprehensive training materials and certification program at no cost. We invest in your growth.'
        },
        {
            illustration: 'community',
            title: 'Supportive Community',
            description: 'Join a network of Filipino tutors. Share tips, get support, and grow together with fellow educators.'
        },
        {
            illustration: 'growth',
            title: 'Career Growth',
            description: 'Advance from tutor to senior tutor, mentor, or trainer. Build a real career in online ESL education.'
        }
    ] as const;
    return (<section class="benefits-section">
      <div class="benefits-bg-shape shape-1"></div>
      <div class="benefits-bg-shape shape-2"></div>
      
      <div class="container">
        <div class="benefits-header">
          <span class="benefits-badge">Why Join Us</span>
          <h2 class="benefits-title">Perks of Teaching with FluentXVerse</h2>
          <p class="benefits-subtitle">
            We believe great tutors deserve great benefits. Here's what you get when you join our team.
          </p>
        </div>
        
        <div class="benefits-grid">
          {benefits.map((benefit, index) => (<div class="benefit-card">
              <div class="benefit-icon">
                <HomeIllustration name={benefit.illustration}/>
              </div>
              <h3 class="benefit-title">{benefit.title}</h3>
              <p class="benefit-description">{benefit.description}</p>
            </div>))}
        </div>
      </div>
    </section>);
};
export default BenefitsSection;
