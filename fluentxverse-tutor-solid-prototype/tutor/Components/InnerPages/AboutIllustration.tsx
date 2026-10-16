import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../../utils/cssStyle";
type AboutIllustrationName = 'globe' | 'innovation' | 'location';
export default function AboutIllustration(_props0: {
    name: AboutIllustrationName;
}) {
    return (<img class="about-illustration" src={`/assets/img/about-icons/${_props0["name"]}-v1.webp`} width={384} height={384} alt="" aria-hidden="true" loading="lazy" decoding="async"/>);
}
