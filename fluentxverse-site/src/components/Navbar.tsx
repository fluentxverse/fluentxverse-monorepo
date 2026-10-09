import { A, useLocation } from '@solidjs/router';
import { createEffect, createSignal, onCleanup, onMount } from 'solid-js';
import { ArrowUpRight, Menu, X } from 'lucide-solid';
import { Brand } from './Brand';
import { contactEmail } from '../data/site';

export function Navbar() {
  const [open, setOpen] = createSignal(false);
  const location = useLocation();
  let toggle!: HTMLButtonElement;

  createEffect(() => {
    location.pathname;
    location.hash;
    setOpen(false);
  });

  onMount(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open()) {
        setOpen(false);
        toggle.focus();
      }
    };
    const handleOutside = (event: PointerEvent) => {
      if (open() && !(event.target as Element).closest('.site-header')) setOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    document.addEventListener('pointerdown', handleOutside);
    onCleanup(() => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('pointerdown', handleOutside);
    });
  });

  return (
    <header class="site-header">
      <div class="container nav-bar">
        <Brand />
        <nav id="primary-navigation" class="primary-navigation" classList={{ 'is-open': open() }} aria-label="Main navigation">
          <A href="/" end activeClass="is-active">Home</A>
          <A href="/about" activeClass="is-active">About</A>
          <A href="/#ecosystem" class="ecosystem-nav" onClick={() => setOpen(false)}>Our ecosystem</A>
          <a class="nav-contact" href={`mailto:${contactEmail}`}>Let's connect <ArrowUpRight size={17} /></a>
        </nav>
        <button ref={toggle} type="button" class="menu-toggle" aria-label={open() ? 'Close menu' : 'Open menu'} aria-controls="primary-navigation" aria-expanded={open()} onClick={() => setOpen(!open())}>
          {open() ? <X size={23} /> : <Menu size={23} />}
        </button>
      </div>
    </header>
  );
}
