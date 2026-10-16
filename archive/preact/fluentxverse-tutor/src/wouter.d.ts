// Type augmentation to fix wouter Link/Router/Switch children type with Preact
// Wouter imports ReactNode from "react" but @types/react's ReactNode includes
// ReactPortal (requires 'children' prop) which Preact's VNode doesn't satisfy.
// This adds a permissive overload that accepts Preact's ComponentChildren.
import { ComponentChildren, VNode } from 'preact';

declare module 'wouter' {
  export function Link(props: {
    href?: string;
    to?: string;
    replace?: boolean;
    asChild?: boolean;
    className?: string | ((isActive: boolean) => string | undefined);
    onClick?: (e: any) => void;
    children?: ComponentChildren;
    style?: any;
    'aria-label'?: string;
    target?: string;
    rel?: string;
    [key: string]: any;
  }): VNode;
}
