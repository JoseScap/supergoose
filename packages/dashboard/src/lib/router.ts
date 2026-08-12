import { useEffect, useState } from 'react';

export interface AppLocation {
  pathname: string;
}

function readPathname(): string {
  if (typeof window === 'undefined') {
    return '/';
  }

  return window.location.pathname || '/';
}

export function useAppLocation(): AppLocation {
  const [pathname, setPathname] = useState(readPathname);

  useEffect(() => {
    const handlePopState = () => {
      setPathname(readPathname());
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  return { pathname };
}

export function navigate(pathname: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.history.pushState({}, '', pathname);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function scrollToSection(id: string): void {
  if (typeof document === 'undefined') {
    return;
  }

  const element = document.getElementById(id);

  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
