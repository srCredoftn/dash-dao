/**
Rôle: Hook personnalisé — src/frontend/hooks/use-mobile.tsx
Domaine: Frontend/Hooks
Exports: useIsMobile
Dépendances: react
*/
import * as React from "react";

const MOBILE_BREAKPOINT = 768;

/**
 * Détecte si l'écran est sous le breakpoint mobile (768px).
 * Retourne: boolean
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(
    undefined,
  );

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}
