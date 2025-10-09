/**
Rôle: Module TypeScript — src/frontend/types/responsive.ts
Domaine: Général
Exports: BreakpointSize, GridLayoutType, ResponsiveVisibility, ResponsiveComponentProps, BREAKPOINTS, GRID_CLASSES, VISIBILITY_CLASSES
*/
/**
 * Types pour les classes responsive et breakpoints
 */

export type BreakpointSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

export type GridLayoutType = "stats" | "cards" | "loading" | "compact";

export type ResponsiveVisibility =
  | "mobile"
  | "tablet"
  | "desktop"
  | "mobile-tablet"
  | "tablet-desktop";

/**
 * Interface pour les props de composants responsives
 */
export interface ResponsiveComponentProps {
  breakpoint?: BreakpointSize;
  hideOn?: ResponsiveVisibility[];
  showOn?: ResponsiveVisibility[];
  className?: string;
}

/**
 * Configuration des breakpoints en pixels
 */
export const BREAKPOINTS = {
  xs: 475,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const;

/**
 * Classes utilitaires pour les grilles responsive
 */
export const GRID_CLASSES = {
  stats: "grid grid-cols-1 xs:grid-cols-2 xl:grid-cols-4",
  cards: "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
  loading: "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
  compact: "grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3",
} as const;

/**
 * Classes de visibilité responsive
 */
export const VISIBILITY_CLASSES = {
  mobile: "block lg:hidden",
  tablet: "hidden md:block lg:hidden",
  desktop: "hidden lg:block",
  "mobile-tablet": "block lg:hidden",
  "tablet-desktop": "hidden md:block",
} as const;
