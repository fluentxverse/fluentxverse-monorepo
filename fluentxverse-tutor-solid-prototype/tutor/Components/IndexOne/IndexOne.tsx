import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../../utils/cssStyle";
import Banner from './Banner';
import CareerSection from './CareerSection';
import BenefitsSection from './BenefitsSection';
import HowItWorks from './HowItWorks';
import CallToAction from '../Common/CallToAction';
import './IndexOne.css';
const IndexOne = () => {
    return (<main>
      <Banner />
      <CareerSection />
      <BenefitsSection />
      <HowItWorks />
      <CallToAction />
    </main>);
};
export default IndexOne;
