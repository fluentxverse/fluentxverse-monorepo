import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../../utils/cssStyle";
import TutorIcon from "../Common/TutorIcon";
import HomeIllustration from './HomeIllustration';
import './HowItWorks.css';
const HowItWorks = () => {
    const steps = [
        {
            number: '01',
            title: 'Apply Online',
            description: 'Fill out a simple application form. Share your background, availability, and passion for teaching.',
            illustration: 'home',
            gradient: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
        },
        {
            number: '02',
            title: 'Get Assessed',
            description: 'Complete a brief English proficiency check and a short demo lesson with our team.',
            illustration: 'community',
            gradient: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)'
        },
        {
            number: '03',
            title: 'Get Certified',
            description: 'Access our exclusive training modules and earn your FluentXVerse teaching certification.',
            illustration: 'training',
            gradient: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)'
        },
        {
            number: '04',
            title: 'Start Earning',
            description: 'Set your own hours, connect with students worldwide, and grow your teaching career.',
            illustration: 'growth',
            gradient: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)'
        }
    ] as const;
    return (<section class="how-it-works-section">
      <div class="how-it-works-bg-shapes">
        <div class="shape shape-1"></div>
        <div class="shape shape-2"></div>
        <div class="shape shape-3"></div>
      </div>
      
      <div class="container">
        <div class="how-it-works-header">
          <span class="how-it-works-badge">Your Journey</span>
          <h2 class="how-it-works-title">How It Works</h2>
          <p class="how-it-works-subtitle">
            Join thousands of tutors earning on their own terms. Getting started is easy.
          </p>
        </div>
        
        <div class="steps-timeline">
          <div class="timeline-connector"></div>
          
          {steps.map((step, index) => (<div class={`step-card ${index % 2 === 1 ? 'step-card-alt' : ''}`}>
              <div class="step-card-inner">
                <div class="step-number" style={cssStyle({ background: step.gradient })}>
                  {step.number}
                </div>
                <div class="step-icon-box">
                  <HomeIllustration name={step.illustration}/>
                </div>
                <div class="step-content">
                  <h3 class="step-title">{step.title}</h3>
                  <p class="step-description">{step.description}</p>
                </div>
                <div class="step-glow" style={cssStyle({ background: step.gradient })}></div>
              </div>
              
              {index < steps.length - 1 && (<div class="step-connector-dot" style={cssStyle({ background: step.gradient })}></div>)}
            </div>))}
        </div>
        
        <div class="how-it-works-cta">
          <a href="/register" class="how-it-works-btn">
            <span>Begin Your Journey</span>
            <TutorIcon name="fas fa-arrow-right"/>
          </a>
          <p class="cta-note">Free to join • No commitments</p>
        </div>
      </div>
    </section>);
};
export default HowItWorks;
