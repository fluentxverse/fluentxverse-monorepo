import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../../utils/cssStyle";
import './CallToAction.css';
const CallToAction = () => {
    return (<section class="cta-section">
      <div class="cta-organic-shape shape-blue-1"></div>
      <div class="cta-organic-shape shape-blue-2"></div>
      
      <div class="container">
        <div class="cta-content">
          <h2 class="cta-title">Ready to Start Your Teaching Journey?</h2>
          <p class="cta-description">
            Join FluentXVerse today and become part of a growing community of Filipino tutors making a difference in ESL education.
          </p>
          <div class="cta-buttons">
            <a href="/register" class="home-cta-btn primary">
              Apply as a Tutor
            </a>
            <a href="/become-tutor" class="home-cta-btn secondary">
              Learn More
            </a>
          </div>
        </div>
      </div>
    </section>);
};
export default CallToAction;
