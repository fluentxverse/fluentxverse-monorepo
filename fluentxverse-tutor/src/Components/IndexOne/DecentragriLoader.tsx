import { useEffect, useState, useLayoutEffect } from 'preact/hooks';
import { useThemeStore } from '../../context/ThemeContext';
import './DecentragriLoader.css';

const LOGO_SRC = '/assets/img/logo/icon_logo.png';

// Separate component for regular letters
interface LetterProps {
  char: string;
  delay: number;
  className?: string;
}

const Letter = ({ char, delay, className = '' }: LetterProps) => (
  <span 
    className={`letter ${className}`}
    style={{ 
      animationDelay: `${delay}s`,
      color: 'inherit',
      WebkitTextFillColor: 'currentColor',
    }}
  >
    {char}
  </span>
);

// Separate component for first and last letters with forced styles
interface SpecialLetterProps {
  char: string;
  delay: number;
  className?: string;
}

const SpecialLetter = ({ char, delay, className = '' }: SpecialLetterProps) => (
  <span 
    className={`special-letter ${className}`}
    style={{
      animationDelay: `${delay}s`,
      color: 'inherit',
      WebkitTextFillColor: 'currentColor',
      background: 'none',
      WebkitBackgroundClip: 'initial',
      backgroundClip: 'initial',
      textShadow: 'none',
      WebkitTextStroke: '0',
      WebkitFontSmoothing: 'antialiased',
      MozOsxFontSmoothing: 'grayscale'
    }}
  >
    {char}
  </span>
);

export default function DecentragriLoader() {
  const [show, setShow] = useState(true);
  const [flashing, setFlashing] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const { isDarkMode } = useThemeStore();

  // Set mounted state after initial render to prevent flash of incorrect theme
  useLayoutEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // Add dark mode class to html element to prevent flash of light theme
    if (isDarkMode) {
      document.documentElement.classList.add('dark-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
    }

    const flashTimer = setTimeout(() => setFlashing(true), 3000); // Start flashing at 3s
    const hideTimer = setTimeout(() => setShow(false), 5000); // Hide at 5s
    
    return () => {
      clearTimeout(flashTimer);
      clearTimeout(hideTimer);
    };
  }, [isDarkMode]);

  if (!show) return null;

  // Only apply theme class after component is mounted to prevent flash
  const themeClass = isMounted && isDarkMode ? 'dark-mode' : '';

  return (
    <div className={`decentragri-loader-bg ${themeClass}`}>
      <div className={`decentragri-loader-content${flashing ? ' decentragri-flash' : ''}`}>
        <img 
          src={LOGO_SRC} 
          alt="FluentXVerse Logo" 
          className={`decentragri-logo-anim decentragri-logo-large${flashing ? ' decentragri-flash' : ''} ${themeClass}`} 
        />
        <div className={`decentragri-title-anim decentragri-title-large${flashing ? ' decentragri-flash' : ''} ${themeClass}`}>
          {Array.from('FLUENTXVERSE').map((char, i, arr) => {
            const delay = i * 0.12;
            const isFirst = i === 0; // First letter 'D'
            const isLast = i === arr.length - 1; // Last letter 'I'
            
            if (isFirst || isLast) {
              return (
                <SpecialLetter 
                  key={i}
                  char={char}
                  delay={delay}
                  className={isFirst ? 'first-letter' : 'last-letter'}
                />
              );
            }
            
            return (
              <Letter 
                key={i}
                char={char}
                delay={delay}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
