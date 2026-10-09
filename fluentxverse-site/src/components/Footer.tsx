import { A } from '@solidjs/router';
import { ArrowUpRight } from 'lucide-solid';
import { Brand } from './Brand';
import { contactEmail } from '../data/site';

export function Footer() {
  return (
    <footer class="site-footer">
      <div class="container">
        <div class="footer-main">
          <div class="footer-brand">
            <Brand />
            <p>Learning, backed by proof.<br />An ecosystem for onchain education.</p>
          </div>
          <div class="footer-column">
            <h2>Discover</h2>
            <A href="/">Home</A>
            <A href="/about">About us</A>
            <A href="/#ecosystem">Our ecosystem</A>
          </div>
          <div class="footer-column">
            <h2>FluentXVerse ESL</h2>
            <a href="https://student.fluentxverse.com" target="_blank" rel="noopener noreferrer">Student app <ArrowUpRight size={14} /></a>
            <a href="https://tutor.fluentxverse.com" target="_blank" rel="noopener noreferrer">Tutor app <ArrowUpRight size={14} /></a>
          </div>
          <div class="footer-column footer-contact">
            <h2>Start a conversation</h2>
            <a href={`mailto:${contactEmail}`}>{contactEmail} <ArrowUpRight size={14} /></a>
            <span>Built in the Philippines. Thinking globally.</span>
          </div>
        </div>
        <div class="footer-bottom">
          <span>&copy; {new Date().getFullYear()} FluentXVerse. All rights reserved.</span>
          <span>Education, connected onchain.</span>
        </div>
      </div>
    </footer>
  );
}
