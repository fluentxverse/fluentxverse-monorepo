/**
 * McMaster-Carr style link prefetching
 * Prefetches links on hover with a small delay to avoid unnecessary requests
 */

const prefetchedUrls = new Set<string>();
const PREFETCH_DELAY = 65; // ms delay before prefetching (like McMaster)

let hoverTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Prefetch a URL by creating a link element
 */
function prefetchUrl(url: string): void {
  if (prefetchedUrls.has(url)) return;
  
  // Only prefetch same-origin URLs
  try {
    const urlObj = new URL(url, window.location.origin);
    if (urlObj.origin !== window.location.origin) return;
  } catch {
    return;
  }

  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = url;
  link.as = 'document';
  document.head.appendChild(link);
  prefetchedUrls.add(url);
}

/**
 * Handle mouse enter on links
 */
function handleMouseEnter(e: MouseEvent): void {
  const target = e.target as HTMLElement;
  const anchor = target.closest('a');
  
  if (!anchor) return;
  
  const href = anchor.getAttribute('href');
  if (!href) return;
  
  // Skip external links, hash links, and already prefetched
  if (href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:')) return;
  if (prefetchedUrls.has(href)) return;
  
  // Delay prefetch to avoid unnecessary requests on quick mouse movements
  hoverTimer = setTimeout(() => {
    prefetchUrl(href);
  }, PREFETCH_DELAY);
}

/**
 * Handle mouse leave - cancel pending prefetch
 */
function handleMouseLeave(): void {
  if (hoverTimer) {
    clearTimeout(hoverTimer);
    hoverTimer = null;
  }
}

/**
 * Initialize prefetching listeners
 */
export function initPrefetching(): void {
  // Use event delegation for efficiency
  document.addEventListener('mouseenter', handleMouseEnter, true);
  document.addEventListener('mouseleave', handleMouseLeave, true);
}

/**
 * Prefetch an array of routes
 */
export function prefetchRoutes(routes: string[]): void {
  routes.forEach(route => {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => prefetchUrl(route));
    } else {
      setTimeout(() => prefetchUrl(route), 100);
    }
  });
}

/**
 * Prefetch critical routes that users are likely to visit
 */
export function prefetchCriticalRoutes(): void {
  // Prefetch common navigation targets during idle time
  const criticalRoutes = [
    '/dashboard',
    '/schedule',
    '/profile',
    '/inbox',
    '/interviews',
    '/materials',
    '/students',
    '/earnings'
  ];
  
  // Use requestIdleCallback for non-blocking prefetch
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      prefetchRoutes(criticalRoutes);
    }, { timeout: 2000 });
  } else {
    setTimeout(() => {
      prefetchRoutes(criticalRoutes);
    }, 1000);
  }
}

export default { initPrefetching, prefetchRoutes, prefetchCriticalRoutes };
