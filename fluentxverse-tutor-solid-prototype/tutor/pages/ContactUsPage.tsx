import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import TutorIcon from "../Components/Common/TutorIcon";
import Header from '../Components/Header/Header';
import Footer from '../Components/Footer/Footer';
import HomeIllustration from '../Components/IndexOne/HomeIllustration';
import ContactIllustration from '../Components/InnerPages/ContactIllustration';
import './ContactUsPage.css';
const questions = [
    { icon: 'training', title: 'How do I become a tutor?', answer: 'Start your application using the Apply Now button below. You will need to complete a short interview process.' },
    { icon: 'schedule', title: 'What are the working hours?', answer: 'You set your own schedule. Choose the hours that work best for you and your students.' },
    { icon: 'pay', title: 'How do I get paid?', answer: 'Payments are processed weekly. You can receive payments through a bank or digital wallet.' },
    { icon: 'home', title: 'What equipment do I need?', answer: 'A stable internet connection, a computer or laptop with a webcam, and a quiet teaching environment.' },
] as const;
const ContactUsPage = () => {
    createEffect(on(() => [], () => {
        const _cleanup0 = untrack(() => { document.title = 'Contact Us | FluentXVerse'; });
        if (typeof _cleanup0 === "function")
            onCleanup(_cleanup0);
    }));
    return (<>
      <Header showThemeSwitch={false}/>
      <main class="contact-us-page-wrapper">
        <div class="container">
          <header class="contact-us-page-header">
            <div class="contact-us-icon-wrapper"><HomeIllustration name="community" loading="eager"/></div>
            <div>
              <span class="contact-label">FLUENTXVERSE SUPPORT</span>
              <h1>Contact Us</h1>
              <p>We're here to help you succeed.</p>
            </div>
          </header>

          <section class="contact-cards-grid" aria-label="Contact options">
            <article class="contact-card">
              <div class="contact-card-icon"><ContactIllustration name="email"/></div>
              <div class="contact-card-content">
                <h2>Email support</h2>
                <p class="contact-value">support@fluentxverse.com</p>
                <p class="contact-description">Questions about your application or tutor account? Send our team a message.</p>
              </div>
              <a href="mailto:support@fluentxverse.com" class="contact-card-btn">
                <TutorIcon name="fas fa-envelope" aria-hidden="true"/> Send Email
              </a>
            </article>
            <article class="contact-card">
              <div class="contact-card-icon"><ContactIllustration name="phone"/></div>
              <div class="contact-card-content">
                <h2>Viber</h2>
                <p class="contact-value contact-unavailable">Not available yet</p>
                <p class="contact-description">Please use email support while our Viber contact is being set up.</p>
              </div>
              <button class="contact-card-btn" type="button" disabled>
                <TutorIcon name="fab fa-viber" aria-hidden="true"/> Viber unavailable
              </button>
            </article>
          </section>

          <section class="contact-faq-section" aria-labelledby="contact-faq-title">
            <div class="contact-section-header">
              <span class="contact-label">QUICK ANSWERS</span>
              <h2 id="contact-faq-title">Frequently Asked Questions</h2>
              <p>A few things you might be wondering.</p>
            </div>
            <div class="contact-faq-grid">
              {questions.map(question => (<article class="contact-faq-card">
                  <div class="contact-faq-icon"><HomeIllustration name={question.icon}/></div>
                  <h3>{question.title}</h3>
                  <p>{question.answer}</p>
                </article>))}
            </div>
          </section>
        </div>

        <section class="contact-cta-section">
          <div class="container contact-cta-content">
            <div class="contact-cta-icon"><HomeIllustration name="training"/></div>
            <div class="contact-cta-text">
              <h2>Ready to Start Teaching?</h2>
              <p>Join our community of tutors and help students around the world improve their English skills.</p>
            </div>
            <a class="contact-card-btn" href="/register">Apply Now <TutorIcon name="fas fa-arrow-right" aria-hidden="true"/></a>
          </div>
        </section>
      </main>
      <Footer />
    </>);
};
export default ContactUsPage;
