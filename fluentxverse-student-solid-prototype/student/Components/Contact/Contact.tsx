import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../../utils/cssStyle";
import { Mail, MapPin, ExternalLink } from "lucide-solid";
import './Contact.css';
export default function Contact() {
    return <main class="student-contact"><div class="student-contact-inner">
    <header><img src="/assets/img/home-icons/support-v1.webp" alt="" width="56" height="56"/><div><h1>Contact Us</h1><p>FluentXVerse support</p></div></header>
    <div class="student-contact-grid"><section class="student-contact-details"><h2>Get in touch</h2><a href="mailto:support@fluentxverse.com"><Mail size={20}/><span>support@fluentxverse.com</span><ExternalLink size={16}/></a><p><MapPin size={20}/>Goa, Camarines Sur, Philippines</p><div class="student-contact-social">{[{ name: 'X', href: 'https://x.com/fluentxverse' }, { name: 'Facebook', href: 'https://www.facebook.com/fluentxverse' }, { name: 'LinkedIn', href: 'https://www.linkedin.com/company/fluentxverse' }].map(link => <a href={link.href} target="_blank" rel="noopener noreferrer">{link.name}<ExternalLink size={14}/></a>)}</div>
      <iframe title="FluentXVerse Location" src="https://www.openstreetmap.org/export/embed.html?bbox=123.45710%2C13.68728%2C123.47710%2C13.70728&layer=mapnik" loading="lazy"/>
    </section><section class="student-contact-faq"><h2>Common questions</h2><details><summary>How do I book a lesson?</summary><p><a href="/browse-tutors">Browse tutors</a> to view their schedules. Sign in to book an available lesson.</p></details><details><summary>How do I report a lesson issue?</summary><p>Open the lesson from your schedule and select Report issue.</p></details><details><summary>Where is FluentXVerse based?</summary><p>FluentXVerse is based in Bicol, Philippines, and connects learners and tutors globally.</p></details></section></div>
  </div></main>;
}
