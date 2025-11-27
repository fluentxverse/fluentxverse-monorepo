// This script ensures the banner image is loaded properly
document.addEventListener('DOMContentLoaded', function() {
  // Force the banner background image to be shown
  const bannerElements = document.querySelectorAll('.banner-bg');
  
  if (bannerElements.length > 0) {
    bannerElements.forEach(banner => {
      // Set explicit styles to force the background image
      (banner as HTMLElement).style.backgroundImage = 'url("/assets/img/banner/dashboard_banner.jpg")';
      (banner as HTMLElement).style.backgroundSize = 'cover';
      (banner as HTMLElement).style.backgroundPosition = 'top center';
      (banner as HTMLElement).style.zIndex = '0';
      
      // Ensure the ::before element has the correct z-index
      const style = document.createElement('style');
      style.textContent = `
        .banner-bg::before {
          z-index: 0 !important;
        }
        
        .banner-bg > * {
          position: relative;
          z-index: 1 !important;
        }
      `;
      document.head.appendChild(style);
    });
  }
});
