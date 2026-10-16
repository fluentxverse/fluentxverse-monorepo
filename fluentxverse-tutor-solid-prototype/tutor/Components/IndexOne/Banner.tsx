import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../../utils/cssStyle";
import TutorIcon from "../Common/TutorIcon";
import HomeIllustration from './HomeIllustration';
import './Banner.css';
const Banner = () => {
    return (<section class="hero-section" aria-labelledby="hero-title">
      <div class="hero-image-wrapper" aria-hidden="true">
        <div class="hero-image-bg"></div>
        <picture>
          <source srcset="/assets/img/banner/banner_man.webp" type="image/webp"/>
          <img src="/assets/img/banner/banner_man.png" alt="" class="hero-image" loading="eager" fetchpriority="high" decoding="async"/>
        </picture>
      </div>
      <div class="container">
        <div class="row align-items-center">
          <div class="col-lg-6 col-md-12">
            <div class="hero-content">
              <span class="hero-badge" aria-hidden="true">Join Our Teaching Community</span>
              <h1 id="hero-title" class="hero-title">
                Teach English <span class="highlight">Online</span> on Your Terms
              </h1>
              <p class="hero-text">
                Work from anywhere, set your own hours. No commute, no boss, no minimum hours just you and your students.
              </p>
              <div class="hero-buttons" role="group" aria-label="Call to action buttons">
                <a href="/register" class="cta-button primary">
                  Apply Now
                  <TutorIcon name="fas fa-arrow-right" aria-hidden="true"/>
                </a>
                <a href="/about" class="cta-button secondary">
                  Learn More
                  <TutorIcon name="fas fa-info-circle" aria-hidden="true"/>
                </a>
              </div>
              <div class="hero-features" role="list" aria-label="Key benefits">
                <div class="feature-badge" role="listitem">
                  <div class="feature-illustration"><HomeIllustration name="pay" loading="eager"/></div>
                  <span><strong>Earn</strong> at your pace</span>
                </div>
                <div class="feature-badge" role="listitem">
                  <div class="feature-illustration"><HomeIllustration name="schedule" loading="eager"/></div>
                  <span><strong>Flexible</strong> Schedule</span>
                </div>
                <div class="feature-badge" role="listitem">
                  <div class="feature-illustration"><HomeIllustration name="home" loading="eager"/></div>
                  <span><strong>Work</strong> Remotely</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>);
};
export default Banner;
