import type { JSX, ParentProps } from 'solid-js';
const unitless = new Set(['opacity', 'z-index', 'font-weight', 'line-height', 'flex', 'flex-grow', 'flex-shrink', 'order', 'grid-row', 'grid-column', 'scale']);
export function cssStyle(style: string | object | undefined): string | JSX.CSSProperties {
    if (!style)
        return '';
    if (typeof style === 'string')
        return style;
    return Object.fromEntries(Object.entries(style).map(([key, value]) => {
        const property = key.startsWith('--') ? key : key.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase());
        return [property, typeof value === 'number' && value !== 0 && !unitless.has(property) && !property.startsWith('--') ? `${value}px` : value];
    })) as JSX.CSSProperties;
}
export const Fragment = (props: ParentProps) => props.children;
