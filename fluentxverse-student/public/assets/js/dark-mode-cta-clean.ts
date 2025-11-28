// Script to ensure CTA section has proper dark mode styling
document.addEventListener('DOMContentLoaded', function() {
  // Function to apply dark mode to CTA section
  function applyCTADarkMode() {
    const isDarkMode = document.documentElement.classList.contains('dark-mode');
    const ctaSections = document.querySelectorAll('.homepage-cta-section');
    
    ctaSections.forEach(section => {
      if (isDarkMode) {
        // Ensure decorative elements are hidden
        const decorations = section.querySelectorAll('.cta-decoration');
        decorations.forEach(decoration => {
          (decoration as HTMLElement).style.display = 'none';
        });
        
        // Apply clean dark background
        (section as HTMLElement).style.background = '#121212';
        (section as HTMLElement).style.boxShadow = 'none';
        
        // Add border for visual separation
        (section as HTMLElement).style.borderTop = '1px solid rgba(255, 255, 255, 0.05)';
        (section as HTMLElement).style.borderBottom = '1px solid rgba(255, 255, 255, 0.05)';
      } else {
        // Restore light mode styling
        const decorations = section.querySelectorAll('.cta-decoration');
        decorations.forEach(decoration => {
          (decoration as HTMLElement).style.display = '';
        });
        
        // Remove inline styles to let CSS take over
        (section as HTMLElement).style.background = '';
        (section as HTMLElement).style.boxShadow = '';
        (section as HTMLElement).style.borderTop = '';
        (section as HTMLElement).style.borderBottom = '';
      }
    });
  }
  
  // Run on initial load
  applyCTADarkMode();
  
  // Create a MutationObserver to watch for dark mode class changes
  const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.attributeName === 'class') {
        applyCTADarkMode();
      }
    });
  });
  
  // Start observing the document element for class changes
  observer.observe(document.documentElement, { attributes: true });
});
