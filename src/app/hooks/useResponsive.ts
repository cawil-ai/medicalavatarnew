import { useState, useEffect } from 'react';

export function useWindowWidth() {
  const [width, setWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1200
  );
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return width;
}

export function useResponsive() {
  const width = useWindowWidth();
  return {
    width,
    isMobile:  width < 768,
    isTablet:  width < 992,
    isDesktop: width >= 992,
  };
}