import { useThemeStore, type ThemeMode } from '../../context/ThemeContext';
import './ThemeSwitch.css';

interface ThemeSwitchProps {
  className?: string;
  showLabels?: boolean;
  size?: 'sm' | 'md';
}

const themeOptions: Array<{ value: ThemeMode; label: string; icon: string; hint: string }> = [
  {
    value: 'light',
    label: 'Light',
    icon: 'fas fa-sun',
    hint: 'Bright interface',
  },
  {
    value: 'dark',
    label: 'Dark',
    icon: 'fas fa-moon',
    hint: 'Low-light interface',
  },
  {
    value: 'system',
    label: 'System',
    icon: 'fas fa-desktop',
    hint: 'Match your device',
  },
];

const ThemeSwitch = ({ className = '', showLabels = false, size = 'md' }: ThemeSwitchProps) => {
  const themeMode = useThemeStore((state) => state.themeMode);
  const resolvedTheme = useThemeStore((state) => state.resolvedTheme);
  const setThemeMode = useThemeStore((state) => state.setThemeMode);

  return (
    <div
      className={`fxv-theme-switch fxv-theme-switch--${size}${showLabels ? ' fxv-theme-switch--labels' : ''}${
        className ? ` ${className}` : ''
      }`}
      role="group"
      aria-label="Theme switcher"
    >
      {themeOptions.map((option) => {
        const isActive = themeMode === option.value;
        const systemMeta = option.value === 'system' ? ` (${resolvedTheme})` : '';

        return (
          <button
            key={option.value}
            type="button"
            className={`fxv-theme-switch__option${isActive ? ' is-active' : ''}`}
            onClick={() => setThemeMode(option.value)}
            aria-pressed={isActive}
            aria-label={`${option.label} theme${systemMeta}`}
            title={showLabels ? undefined : `${option.label}${systemMeta}`}
          >
            <span className="fxv-theme-switch__icon" aria-hidden="true">
              <i className={option.icon}></i>
            </span>
            {showLabels && (
              <span className="fxv-theme-switch__copy">
                <span className="fxv-theme-switch__label">{option.label}</span>
                <span className="fxv-theme-switch__hint">
                  {option.value === 'system' ? `Uses ${resolvedTheme}` : option.hint}
                </span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default ThemeSwitch;
