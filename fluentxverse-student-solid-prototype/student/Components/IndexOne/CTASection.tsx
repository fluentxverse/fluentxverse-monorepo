import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../../utils/cssStyle";
import './CTASection.css';
const CTASection = () => {
    return (<section class="cta-section">
      <div class="cta-container">
        <div class="cta-panel">
          <div class="cta-copy">
            <p class="cta-kicker">Ready?</p>
            <h2 class="cta-title">Start Your English Journey</h2>
            <p class="cta-subtitle">
              Join focused lessons, flexible tickets, and tutor-led practice built to help you speak with confidence.
            </p>
          </div>

          <div class="cta-actions">
            <div class="cta-buttons">
              <a href="/auth" class="cta-btn cta-btn-primary">
                <i class="fas fa-rocket"></i>
                <span>Get Started Free</span>
              </a>
              <a href="/browse-tutors" class="cta-btn cta-btn-secondary">
                <i class="fas fa-search"></i>
                <span>Browse Tutors</span>
              </a>
            </div>
            <p class="cta-note">
              <i class="fas fa-check-circle"></i>
              <span>No credit card required. Free trial available.</span>
            </p>
          </div>

          <div class="cta-visual" aria-hidden="true">
            <div class="cta-ticket">
              <span>Trial</span>
              <strong>Free</strong>
            </div>
            <div class="cta-orbit cta-orbit--one"></div>
            <div class="cta-orbit cta-orbit--two"></div>
          </div>
        </div>
      </div>
    </section>);
};
export default CTASection;
