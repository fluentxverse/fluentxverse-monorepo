import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../../utils/cssStyle";
import './HomeIllustration.css';
type HomeIllustrationName = 'schedule' | 'home' | 'pay' | 'training' | 'community' | 'growth';
interface HomeIllustrationProps {
    name: HomeIllustrationName;
    loading?: 'eager' | 'lazy';
}
export default function HomeIllustration(_props0: HomeIllustrationProps) {
    return (<img class="home-illustration" src={`/assets/img/home-icons/${_props0["name"]}-v1.webp`} width={384} height={384} alt="" aria-hidden="true" loading={_props0["loading"] === undefined ? 'lazy' : _props0["loading"]} decoding="async"/>);
}
