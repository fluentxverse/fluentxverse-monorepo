import { A } from '@solidjs/router';

export function Brand() {
  return (
    <A href="/" class="brand" aria-label="FluentXVerse home">
      <img src="/assets/img/logo/icon_logo.png" width="34" height="38" alt="" />
      <span>Fluent<span class="brand-x">X</span>Verse<span class="brand-period">.</span></span>
    </A>
  );
}
