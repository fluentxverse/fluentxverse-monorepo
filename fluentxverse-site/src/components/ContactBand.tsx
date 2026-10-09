import { ArrowUpRight } from 'lucide-solid';
import { contactEmail } from '../data/site';

export function ContactBand() {
  return (
    <section class="contact-band">
      <div class="container contact-inner">
        <div><span class="eyebrow">FOR EDUCATORS, BUILDERS, AND PARTNERS</span><h2>Bring education<br />onchain with us.</h2></div>
        <div class="contact-copy"><p>Developing an education project or exploring onchain learning?<br />Let's talk about what we can build together.</p><a class="button button-primary" href={`mailto:${contactEmail}`}>Let's connect <ArrowUpRight size={18} /></a></div>
      </div>
    </section>
  );
}
