import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import Header from '../Components/Header/Header';
import Footer from '../Components/Footer/Footer';
import SideBar from '../Components/IndexOne/SideBar';
import Contact from '@/Components/Contact/Contact';
export default function ContactPage() {
    return (<>
      <SideBar />
      <div class="student-contact-shell">
        
        <Header />
        
        <Contact />
      </div>
      <Footer />
    </>);
}
