import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../../utils/cssStyle";
import TutorIcon from "../Common/TutorIcon";
import './Footer.css';
const Footer = () => {
    const currentYear = new Date().getFullYear();
    return (<footer>
      <div class="footer-top-wrap">
        <div class="container">
          <div class="row justify-content-between">
            <div class="col-xl-4 col-lg-4 col-md-6 col-sm-12">
              <div class="footer-widget">
                <div class="footer-logo mb-25">
                  <a href="/" style={cssStyle({ display: 'flex', alignItems: 'center', gap: '8px' })}>
                    <img src="assets/img/logo/icon_logo.png" alt="FluentXVerse"/>
                    <div class="footer-brand-text">Fluent<span class="brand-x">X</span>Verse</div>
                  </a>
                </div>
                <p class="footer-description">
                  Empowering language learners worldwide through innovative technology and dedicated tutors.
                </p>
                <p class="footer-email">Email us:<br />
                  <a href="mailto:support@fluentxverse.com">
                    support@fluentxverse.com
                  </a>
                </p>
                <ul class="footer-social">
                  <li><a href="https://facebook.com/fluentxverse" target="_blank" rel="noopener noreferrer"><TutorIcon name="fab fa-facebook-f"/></a></li>
                  <li><a href="https://twitter.com/fluentxverse" target="_blank" rel="noopener noreferrer"><TutorIcon name="fab fa-twitter"/></a></li>
                  <li><a href="https://linkedin.com/company/fluentxverse" target="_blank" rel="noopener noreferrer"><TutorIcon name="fab fa-linkedin-in"/></a></li>
                </ul>
              </div>
            </div>
            <div class="col-lg-2 col-md-3 col-sm-6">
              <div class="footer-widget">
                <h4 class="fw-title">Platform</h4>
                <ul class="fw-links">
                  <li><a href="/">Home</a></li>
                  <li><a href="/about">About Us</a></li>
                </ul>
              </div>
            </div>
            <div class="col-lg-2 col-md-3 col-sm-6">
              <div class="footer-widget">
                <h4 class="fw-title">Support</h4>
                <ul class="fw-links">
                  <li><a href="/contact">Contact Us</a></li>
                  {/* <li><a href="/faq">FAQ</a></li>
<li><a href="/help">Help Center</a></li>
<li><a href="/feedback">Feedback</a></li> */}
                </ul>
              </div>
            </div>
            <div class="col-lg-2 col-md-3 col-sm-6">
              <div class="footer-widget">
                <h4 class="fw-title">Resources</h4>
                <ul class="fw-links">
                  {/* <li><a href="/blog">Blog</a></li>
<li><a href="/learning-resources">Learning Tips</a></li> */}
                  <li><a href="/become-tutor">Become a Tutor</a></li>
                  {/* <li><a href="/community">Community</a></li> */}
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
                <p>All rights reserved © {currentYear} by <a href="/">FluentXVerse</a></p>
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
