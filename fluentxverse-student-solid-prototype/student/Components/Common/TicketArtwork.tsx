import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../../utils/cssStyle";
import './TicketArtwork.css';
interface TicketArtworkProps {
    tier: 'basic' | 'premium' | 'trial';
    compact?: boolean;
}
const TicketArtwork = (_props0: TicketArtworkProps) => (<div class={`ticket-artwork ticket-artwork--${_props0["tier"]}${(_props0["compact"] === undefined ? false : _props0["compact"]) ? ' ticket-artwork--compact' : ''}`} role="img" aria-label={`${_props0["tier"]} lesson ticket`}>
    <span class="ticket-artwork__brand">
      <img src="/assets/img/logo/icon_logo.webp" alt=""/>
      FXV
    </span>
    <strong>{_props0["tier"]}</strong>
    <small>Lesson pass</small>
  </div>);
export default TicketArtwork;
