import { A } from '@solidjs/router';
import { ArrowUpRight, Cpu, Fingerprint, Sparkles } from 'lucide-solid';

export function TechnologyNav() {
  return (
    <div class="technology-nav-band">
      <nav class="container technology-nav" aria-label="Technology topics">
        <A href="/technology" end activeClass="topic-active"><Cpu size={17} /> Technology</A>
        <A href="/technology/ai" activeClass="topic-active"><Sparkles size={17} /> AI in education</A>
        <A href="/onchain-education" activeClass="topic-active"><Fingerprint size={17} /> Why onchain</A>
        <A href="/#ecosystem" class="topic-ecosystem">FluentXVerse ESL <ArrowUpRight size={16} /></A>
      </nav>
    </div>
  );
}
