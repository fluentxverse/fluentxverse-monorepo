import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../../utils/cssStyle";
import './CallToAction.css';
interface CallToActionProps {
    title?: string;
    subtitle?: string;
    primaryButtonText?: string;
    primaryButtonLink?: string;
    secondaryButtonText?: string;
    secondaryButtonLink?: string;
    className?: string;
}
const CallToAction: Component<CallToActionProps> = (_props0) => {
    return (<section class={`cta-section ${_props0["className"] === undefined ? "" : _props0["className"]}`}>
      <div class="container">
        <h2>{_props0["title"] === undefined ? "Ready to Transform Your Farming Experience?" : _props0["title"]}</h2>
        {(_props0["subtitle"] === undefined ? "Join hundreds of farmers already benefiting from our innovative solutions" : _props0["subtitle"]) && <p>{_props0["subtitle"] === undefined ? "Join hundreds of farmers already benefiting from our innovative solutions" : _props0["subtitle"]}</p>}
        <div class="cta-buttons">
          <a href={_props0["primaryButtonLink"] === undefined ? "/contact" : _props0["primaryButtonLink"]} class="btn btn-primary">
            {_props0["primaryButtonText"] === undefined ? "Get in Touch" : _props0["primaryButtonText"]}
          </a>
          {_props0["secondaryButtonText"] && _props0["secondaryButtonLink"] && (<a href={_props0["secondaryButtonLink"]} class="btn btn-outline">
              {_props0["secondaryButtonText"]}
            </a>)}
        </div>
      </div>
    </section>);
};
export default CallToAction;
