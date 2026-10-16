import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../../utils/cssStyle";
import { JSX } from "solid-js";
import { mediaUrl } from '../../utils/mediaUrl';
export default function ProfileAvatar(_props0: {
    src?: string | null;
    alt: string;
    className?: string;
    fallbackClassName?: string;
    style?: Record<string, string | number>;
    fallback: JSX.Element;
}) {
    const url = createMemo(() => mediaUrl(_props0["src"]));
    const [failedUrl, setFailedUrl] = createSignal<string>();
    return createMemo(() => {
        if (!url() || failedUrl() === url())
            return <div class={[_props0["className"], _props0["fallbackClassName"]].filter(Boolean).join(' ')} style={cssStyle(_props0["style"])} role="img" aria-label={_props0["alt"]}>{_props0["fallback"]}</div>;
        return <img src={url()} alt={_props0["alt"]} class={_props0["className"]} style={cssStyle(_props0["style"])} onError={() => setFailedUrl(url())}/>;
    }) as unknown as JSX.Element;
}
