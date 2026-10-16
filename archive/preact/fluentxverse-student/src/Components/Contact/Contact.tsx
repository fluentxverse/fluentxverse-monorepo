import { Mail, MapPin, ExternalLink } from 'lucide-preact';
import './Contact.css';
export default function Contact() {
  return <main className="student-contact"><div className="student-contact-inner">
    <header><img src="/assets/img/home-icons/community-v1.webp" alt="" width="56" height="56" /><div><h1>Contact Us</h1><p>FluentXVerse support</p></div></header>
    <div className="student-contact-grid"><section className="student-contact-details"><h2>Get in touch</h2><a href="mailto:support@fluentxverse.com"><Mail size={20} /><span>support@fluentxverse.com</span><ExternalLink size={16} /></a><p><MapPin size={20} />Goa, Camarines Sur, Philippines</p><div className="student-contact-social">{[{ name: 'X', href: 'https://x.com/fluentxverse' }, { name: 'Facebook', href: 'https://www.facebook.com/fluentxverse' }, { name: 'LinkedIn', href: 'https://www.linkedin.com/company/fluentxverse' }].map(link => <a href={link.href} target="_blank" rel="noopener noreferrer">{link.name}<ExternalLink size={14} /></a>)}</div>
      <iframe title="FluentXVerse Location" src="https://www.openstreetmap.org/export/embed.html?bbox=123.45710%2C13.68728%2C123.47710%2C13.70728&layer=mapnik" loading="lazy" />
    </section><section className="student-contact-faq"><h2>Common questions</h2><details><summary>How do I book a lesson?</summary><p><a href="/browse-tutors">Browse tutors</a> to view their schedules. Sign in to book an available lesson.</p></details><details><summary>How do I report a lesson issue?</summary><p>Open the lesson from your schedule and select Report issue.</p></details><details><summary>Where is FluentXVerse based?</summary><p>FluentXVerse is based in Bicol, Philippines, and connects learners and tutors globally.</p></details></section></div>
  </div></main>;
}
