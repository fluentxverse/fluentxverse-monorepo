import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { TICKETING_VISIBLE } from '../../config/launch';
import './Footer.css';
import BrandWordmark from '../../../../shared/ui/BrandWordmark';
const Footer = () => {
    const currentYear = new Date().getFullYear();
    return (<footer class="landing-footer">
      <div class="footer-top-wrap">
        <div class="container">
          <div class="row justify-content-between">
            <div class="col-xl-4 col-lg-4 col-md-5 col-sm-9">
              <div class="footer-widget footer-about-widget">
                <div class="footer-logo mb-25">
                  <a href="/" class="footer-brand-lockup" aria-label="FluentXVerse home">
                    <span class="footer-brand-icon" aria-hidden="true">
                      <img src="/assets/img/logo/icon_logo.png" alt="" width="40" height="40"/>
                    </span>
                    <span class="logo-text"><BrandWordmark inverse /></span>
                  </a>
                </div>
                <p>
                  Connecting talented Filipino tutors with students across Asia through innovative technology and meaningful human connection.
                </p>
                <div class="footer-social-links">
                  <a href="https://www.linkedin.com/company/fluentxverse" target="_blank" rel="noopener noreferrer" title="LinkedIn" aria-label="FluentXVerse on LinkedIn">
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M5.372 24H.398V7.982h4.974V24ZM2.882 5.797a2.884 2.884 0 1 1 .032-5.768 2.884 2.884 0 0 1-.032 5.768ZM24 24h-4.965v-7.797c0-1.858-.038-4.249-2.589-4.249-2.589 0-2.986 2.025-2.986 4.115V24H8.49V7.982h4.771v2.185h.069c.665-1.26 2.286-2.589 4.705-2.589C23.065 7.578 24 10.888 24 15.192V24Z"/>
                    </svg>
                  </a>
                  <a href="https://www.facebook.com/fluentxverse" target="_blank" rel="noopener noreferrer" title="Facebook" aria-label="FluentXVerse on Facebook">
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.095 10.125 24v-8.437H7.078v-3.49h3.047v-2.66c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.971H15.83c-1.49 0-1.955.931-1.955 1.887v2.263h3.328l-.532 3.49h-2.796V24C19.612 23.095 24 18.1 24 12.073Z"/>
                    </svg>
                  </a>
                  <a href="https://x.com/fluentxverse" target="_blank" rel="noopener noreferrer" title="X" aria-label="FluentXVerse on X">
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.64 7.584H.47l8.6-9.835L0 1.154h7.594l5.243 6.932 6.064-6.933Zm-1.29 19.49h2.039L6.487 3.24H4.3l13.31 17.403Z"/>
                    </svg>
                  </a>
                </div>
              </div>
            </div>
            <div class="col-lg-2 col-md-3 col-sm-6">
              <div class="footer-widget">
                <h4 class="fw-title">Quick Links</h4>
                <ul class="fw-links">
                  <li><a href="/browse-tutors">Find Tutors</a></li>
                  <li><a href="/materials">Materials</a></li>
                  {TICKETING_VISIBLE && <li><a href="/tickets">Tickets</a></li>}
                  <li><a href="/contact">Contact</a></li>
                </ul>
              </div>
            </div>
            <div class="col-lg-3 col-md-4 col-sm-6">
              <div class="footer-widget">
                <h4 class="fw-title">Contact Us</h4>
                <ul class="fw-links contact-info">
                  <li>
                    <a href="mailto:support@fluentxverse.com">support@fluentxverse.com</a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="copyright-wrap">
        <div class="container">
          <div class="row align-items-center">
            <div class="col-md-6">
              <div class="copyright-text">
                <p>© {currentYear} FluentXVerse. All rights reserved.</p>
              </div>
            </div>
            <div class="col-md-6">
              <ul class="copyright-link-list">
                <li><a href="/privacy-policy">Privacy Policy</a></li>
                <li><a href="/terms-of-service">Terms of Service</a></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </footer>);
};
export default Footer;
