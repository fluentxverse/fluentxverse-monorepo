import { For } from 'solid-js';
import { ArrowUpRight } from 'lucide-solid';
import './Web3Ecosystem.css';

const foundations = [
  { id: 'arbitrum', name: 'Arbitrum', image: 'arbitrum.svg', href: 'https://arbitrum.io/', detail: 'Onchain credentials & lesson records', wordmark: false },
  { id: 'zkverify', name: 'zkVerify', image: 'zkverify.svg', href: 'https://zkverify.io/', detail: 'Zero-knowledge proof verification', wordmark: true },
  { id: 'robinhood', name: 'Robinhood Chain', image: 'robinhood.png', href: 'https://robinhood.com/chain/', detail: 'Tutor reward infrastructure', wordmark: false },
];
const providers = [
  { id: 'alchemy', name: 'Alchemy', image: 'alchemy.svg', href: 'https://www.alchemy.com/', detail: 'RPC & token pricing', wordmark: false },
  { id: 'privy', name: 'Privy', image: 'privy.svg', href: 'https://www.privy.io/', detail: 'Student sign-in', wordmark: true },
  { id: 'openzeppelin', name: 'OpenZeppelin', image: 'openzeppelin.svg', href: 'https://www.openzeppelin.com/contracts', detail: 'Smart contract libraries', wordmark: true },
  { id: 'aero', name: 'Aero', image: 'aero.svg', href: 'https://app.aero.xyz/', detail: 'Reward token swaps', wordmark: false },
];

export function Web3Ecosystem() {
  return <section class="web3-ecosystem section-space" aria-labelledby="web3-ecosystem-title">
    <div class="container">
      <header class="web3-ecosystem-heading">
        <span class="eyebrow">ECOSYSTEM &amp; PROVIDERS</span>
        <h2 id="web3-ecosystem-title">Built on Arbitrum.<br /><span class="muted-heading">Connected by Web3.</span></h2>
        <p>Onchain records, private verification, and tutor rewards.<br class="desktop-break" /> The networks and tools behind FluentXVerse.</p>
      </header>
      <div class="web3-foundations">
        <For each={foundations}>{item => <a class={`web3-foundation web3-${item.id}`} href={item.href} target="_blank" rel="noopener noreferrer" aria-label={`${item.name}: ${item.detail}`}>
          <div class="web3-brand"><img src={`/assets/img/providers/${item.image}`} alt={item.wordmark ? item.name : ''} width={item.wordmark ? 200 : 40} height="40" loading="lazy" /><span class={item.wordmark ? 'web3-visually-hidden' : ''}>{item.name}</span></div>
          <span class="web3-role">{item.detail}</span><ArrowUpRight size={17} aria-hidden="true" />
        </a>}</For>
      </div>
      <div class="web3-provider-strip">
        <span class="web3-provider-label">OUR WEB3 TOOLKIT</span>
        <div class="web3-provider-grid">
          <For each={providers}>{item => <a class={`web3-provider web3-${item.id}`} href={item.href} target="_blank" rel="noopener noreferrer" aria-label={`${item.name}: ${item.detail}`}>
            <div class="web3-brand"><img src={`/assets/img/providers/${item.image}`} alt={item.wordmark ? item.name : ''} width={item.wordmark ? 160 : 30} height="30" loading="lazy" /><span class={item.wordmark ? 'web3-visually-hidden' : ''}>{item.name}</span></div>
            <span class="web3-role">{item.detail}</span>
          </a>}</For>
        </div>
      </div>
    </div>
  </section>;
}
