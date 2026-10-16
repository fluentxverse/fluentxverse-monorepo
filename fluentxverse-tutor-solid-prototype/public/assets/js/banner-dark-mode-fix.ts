// Script to ensure banner works in dark mode
document.addEventListener('DOMContentLoaded', function() {
  function fixDarkModeBanner() {
    const banner = document.querySelector('.banner-bg') as HTMLElement;
    if (!banner) return;

    // Apply important styles
    const styles = {
      backgroundImage: 'url(/assets/img/banner/dashboard_banner.jpg)',
      backgroundSize: 'cover',
      backgroundPosition: 'center 40%',
      position: 'relative',
      display: 'block',
      visibility: 'visible',
      opacity: '1',
      zIndex: '1'
    };

    Object.assign(banner.style, styles);

    // Add a class to help with CSS targeting
    banner.classList.add('dark-mode-fixed');

    // Add inline styles to force visibility in dark mode
    if (document.documentElement.classList.contains('dark-mode')) {
      banner.setAttribute('data-theme', 'dark');
      Object.assign(banner.style, {
        visibility: 'visible !important',
        display: 'block !important',
        opacity: '1 !important'
      });
    }
  }

  // Run initially
  fixDarkModeBanner();

  // Run on theme changes
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'class') {
        fixDarkModeBanner();
      }
    });
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
  });

  // Also run after a slight delay to catch any late changes
  setTimeout(fixDarkModeBanner, 100);
  setTimeout(fixDarkModeBanner, 500);
});
