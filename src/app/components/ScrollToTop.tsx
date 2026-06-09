// src/app/components/ScrollToTop.tsx
import { useEffect } from 'react';
import { useLocation } from 'react-router';

/**
 * Scrolls window to top INSTANTLY on every route change.
 * Uses 'instant' not 'smooth' to prevent the jarring auto-scroll effect.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Use instant scroll — 'smooth' causes the visible jarring center-scroll bug
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });

    // Also reset any scrollable containers inside main-content
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.scrollTop = 0;
    }
  }, [pathname]);

  return null;
}