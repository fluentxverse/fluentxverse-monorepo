import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../../utils/cssStyle";
import { JSX } from "solid-js";
export type TutorArtName = 'home' | 'schedule' | 'training' | 'community' | 'growth' | 'pay' | 'dispatch';
export default function TutorArt(_props0: {
    name: TutorArtName;
    size?: number;
    className?: string;
} & JSX.HTMLAttributes<HTMLImageElement>) {
    const props = splitProps(_props0, ["name", "size", "className"])[1];
    return <img {...props} class={`tutor-art ${_props0["className"] === undefined ? '' : _props0["className"]}`} src={`/assets/img/home-icons/${_props0["name"] === 'dispatch' ? 'dispatch-v1.png' : _props0["name"] + '-v1.webp'}`} width={_props0["size"] === undefined ? 40 : _props0["size"]} height={_props0["size"] === undefined ? 40 : _props0["size"]} alt="" aria-hidden="true" style={cssStyle({ get width() {
                return _props0["size"] === undefined ? 40 : _props0["size"];
            }, get height() {
                return _props0["size"] === undefined ? 40 : _props0["size"];
            }, objectFit: 'contain', flexShrink: 0 })}/>;
}
