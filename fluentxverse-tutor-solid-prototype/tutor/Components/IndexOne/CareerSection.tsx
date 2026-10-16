import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../../utils/cssStyle";
import './CareerSection.css';
const CareerSection = () => {
    return (<section class="career-section">
      <div class="career-organic-shape shape-green"></div>
      <div class="career-organic-shape shape-peach"></div>
      <div class="career-organic-shape shape-yellow"></div>
      
      <div class="container">
        <div class="career-content">
          <div class="career-image">
            <picture>
              <source srcset="/assets/img/banner/teacher_home.webp" type="image/webp"/>
              <img src="/assets/img/banner/teacher_home.png" alt="Online ESL Tutor" loading="lazy" decoding="async"/>
            </picture>
          </div>
          
          <div class="career-text">
            <h2 class="career-title">Where Filipino Talent Meets Global ESL Opportunity</h2>
            <p class="career-description">
              FluentXVerse is shaping the next generation of online English teaching. Built with Filipino tutors in mind, our platform connects dedicated educators with learners across Japan, Korea, and beyond.
            </p>
            <p class="career-description">
              We focus on creating real opportunities: flexible schedules, fair compensation, and a supportive environment where tutors can grow their skills and build stable online careers. As we expand, we're committed to delivering high-quality lessons and meaningful learning experiences for students who value clear communication, cultural exchange, and professional guidance.
            </p>
            <p class="career-description">
              Join us as we build a modern ESL ecosystem, one that empowers tutors, strengthens communities, and raises the standard of online education from day one.
            </p>
            <a href="/become-tutor" class="career-btn">
              Learn more
            </a>
          </div>
        </div>
      </div>
    </section>);
};
export default CareerSection;
