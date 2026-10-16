import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../../utils/cssStyle";
type ContactIllustrationName = 'email' | 'phone';
export default function ContactIllustration(_props0: {
    name: ContactIllustrationName;
}) {
    return (<img class="contact-illustration" src={`/assets/img/contact-icons/${_props0["name"]}-v1.webp`} width={384} height={384} alt="" aria-hidden="true" loading="lazy" decoding="async"/>);
}
