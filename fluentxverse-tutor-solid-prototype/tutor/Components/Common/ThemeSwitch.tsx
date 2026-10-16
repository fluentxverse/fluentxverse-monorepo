import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../../utils/cssStyle";
import TutorIcon from ".//TutorIcon";
import { useThemeStore, type ThemeMode } from '../../context/ThemeContext';
import './ThemeSwitch.css';
interface ThemeSwitchProps {
    className?: string;
    showLabels?: boolean;
    size?: 'sm' | 'md';
}
const themeOptions: Array<{
    value: ThemeMode;
    label: string;
    icon: string;
    hint: string;
}> = [
    {
        value: 'light',
        label: 'Light',
        icon: 'fas fa-sun',
        hint: 'Bright interface'
    },
    {
        value: 'dark',
        label: 'Dark',
        icon: 'fas fa-moon',
        hint: 'Low-light interface'
    },
    {
        value: 'system',
        label: 'System',
        icon: 'fas fa-desktop',
        hint: 'Match your device'
    },
];
const ThemeSwitch = (_props0: ThemeSwitchProps) => {
    const themeMode = createMemo(() => useThemeStore((state) => state.themeMode));
    const resolvedTheme = createMemo(() => useThemeStore((state) => state.resolvedTheme));
    const setThemeMode = createMemo(() => useThemeStore((state) => state.setThemeMode));
    return (<div class={`fxv-theme-switch fxv-theme-switch--${_props0["size"] === undefined ? 'md' : _props0["size"]}${(_props0["showLabels"] === undefined ? false : _props0["showLabels"]) ? ' fxv-theme-switch--labels' : ''}${(_props0["className"] === undefined ? '' : _props0["className"]) ? ` ${_props0["className"] === undefined ? '' : _props0["className"]}` : ''}`} role="group" aria-label="Theme switcher">
      {themeOptions.map((option) => {
            const isActive = () => themeMode() === option.value;
            const systemMeta = () => option.value === 'system' ? ` (${resolvedTheme()})` : '';
            return (<button type="button" class={`fxv-theme-switch__option${isActive() ? ' is-active' : ''}`} onClick={() => setThemeMode()(option.value)} aria-pressed={isActive()} aria-label={`${option.label} theme${systemMeta()}`} title={(_props0["showLabels"] === undefined ? false : _props0["showLabels"]) ? undefined : `${option.label}${systemMeta()}`}>
            <span class="fxv-theme-switch__icon" aria-hidden="true">
              <TutorIcon name={option.icon}/>
            </span>
            {(_props0["showLabels"] === undefined ? false : _props0["showLabels"]) && (<span class="fxv-theme-switch__copy">
                <span class="fxv-theme-switch__label">{option.label}</span>
                <span class="fxv-theme-switch__hint">
                  {option.value === 'system' ? `Uses ${resolvedTheme()}` : option.hint}
                </span>
              </span>)}
          </button>);
        })}
    </div>);
};
export default ThemeSwitch;
