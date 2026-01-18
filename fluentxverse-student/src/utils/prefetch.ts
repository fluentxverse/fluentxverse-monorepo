/**
 * Link Prefetching Utility
 * Prefetches pages on hover for near-instant navigation (McMaster-Carr style)
 */

const prefetchedUrls = new Set<string>();
let prefetchTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Prefetch a URL by creating a hidden link element
 */
const prefetchUrl = (url: string) => {
  if (prefetchedUrls.has(url)) return;
  
  // Don't prefetch external URLs
  if (url.startsWith('http') && !url.includes(window.location.host)) return;
  
  // Don't prefetch hash links or javascript: urls
  if (url.startsWith('#') || url.startsWith('javascript:')) return;
  
  prefetchedUrls.add(url);
  
  // Use link prefetch for the HTML
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = url;
  link.as = 'document';
  document.head.appendChild(link);
  
  console.debug(`[Prefetch] Prefetched: ${url}`);
};

/**
 * Handle mouse enter on links - start prefetch after short delay
 */
const handleMouseEnter = (event: MouseEvent) => {
  const target = event.target;
  // Ensure target is an Element before calling closest
  if (!(target instanceof Element)) return;
  const anchor = target.closest('a');
  
  if (!anchor) return;
  
  const href = anchor.getAttribute('href');
  if (!href) return;
  
  // Resolve relative URLs
  const url = new URL(href, window.location.origin).pathname;
  
  // Prefetch after 65ms delay (avoid prefetching if user is just passing over)
  prefetchTimeout = setTimeout(() => {
    prefetchUrl(url);
  }, 65);
};

/**
 * Handle mouse leave - cancel pending prefetch
 */
const handleMouseLeave = () => {
  if (prefetchTimeout) {
    clearTimeout(prefetchTimeout);
    prefetchTimeout = null;
  }
};

/**
 * Initialize prefetching - call this once on app mount
 */
export const initPrefetching = () => {
  // Use event delegation on document for efficiency
  document.addEventListener('mouseenter', handleMouseEnter, true);
  document.addEventListener('mouseleave', handleMouseLeave, true);
  
  // Also prefetch on focus (keyboard navigation)
  document.addEventListener('focusin', (e) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');
    if (anchor) {
      const href = anchor.getAttribute('href');
      if (href) {
        const url = new URL(href, window.location.origin).pathname;
        prefetchUrl(url);
      }
    }
  });
  
  console.debug('[Prefetch] Initialized link prefetching');
};

/**
 * Manually prefetch specific routes (e.g., likely navigation targets)
 */
export const prefetchRoutes = (routes: string[]) => {
  routes.forEach(route => {
    // Use requestIdleCallback to not block main thread
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => prefetchUrl(route));
    } else {
      setTimeout(() => prefetchUrl(route), 100);
    }
  });
};

/**
 * Prefetch critical routes that users commonly visit
 */
export const prefetchCriticalRoutes = () => {
  const criticalRoutes = [
    '/tutors',
    '/schedule',
    '/materials',
    '/dashboard',
  ];
  
  // Prefetch after page is fully loaded
  if (document.readyState === 'complete') {
    prefetchRoutes(criticalRoutes);
  } else {
    window.addEventListener('load', () => {
      setTimeout(() => prefetchRoutes(criticalRoutes), 1000);
    });
  }
};
