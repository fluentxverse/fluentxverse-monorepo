import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../../utils/cssStyle";
import Banner from './Banner';
import BeginnerWelcome from './BeginnerWelcome';
import WhyChooseUs from './WhyChooseUs';
import HowItWorks from './HowItWorks';
import PricingSection from './PricingSection';
import { TICKETING_VISIBLE } from '../../config/launch';
import './IndexOne.css';
const IndexOne = () => {
    return (<main>
      <Banner />
      <BeginnerWelcome />
      <WhyChooseUs />
      <HowItWorks />
      {TICKETING_VISIBLE && <PricingSection />}
    </main>);
};
export default IndexOne;
