import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { TICKETING_VISIBLE } from '../../config/launch';
import { cssStyle, Fragment } from "../../utils/cssStyle";
import './Footer.css';
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
                    <span class="logo-text">
                      Fluent<span class="brand-x">X</span>Verse
                    </span>
                  </a>
                </div>
                <p>
                  Connecting talented Filipino tutors with students across Asia through innovative technology and meaningful human connection.
                </p>
                <div class="footer-social-links">
                  <a href="https://x.com/fluentxverse" target="_blank" rel="noopener noreferrer" title="X">
                    <span style={cssStyle({ fontWeight: 700, fontSize: '16px' })}>𝕏</span>
                  </a>
                  <a href="https://www.facebook.com/fluentxverse" target="_blank" rel="noopener noreferrer" title="Facebook" aria-label="Facebook">
                    <span aria-hidden="true">f</span>
                  </a>
                  <a href="https://www.youtube.com/@fluentxverse" target="_blank" rel="noopener noreferrer" title="YouTube" aria-label="YouTube">
                    <span aria-hidden="true">YT</span>
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
