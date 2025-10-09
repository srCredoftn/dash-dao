/**
Rôle: Utilitaires Frontend — src/frontend/lib/responsive-utils.ts
Domaine: Frontend/Utils
Exports: RESPONSIVE_CLASSES, combineResponsiveClasses, getGridColumns, getHeaderClasses
*/
/**
 * Constantes et fonctions utilitaires pour le responsive
 *
 * Points de rupture (breakpoints):
 * - xs: 475px (très petits écrans)
 * - sm: 640px (petits écrans)
 * - md: 768px (écrans moyens/tablettes)
 * - lg: 1024px (grands écrans/petits desktops)
 * - xl: 1280px (très grands écrans)
 * - 2xl: 1536px (extra grands écrans x2)
 */

export const RESPONSIVE_CLASSES = {
  // Classes de grille pour dispositions courantes
  statsGrid: "grid grid-cols-1 xs:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4",
  cardGrid:
    "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 md:gap-6",

  // Points de rupture d’affichage pour l’en-tête
  mobileHeader: "block lg:hidden",
  desktopHeader: "hidden lg:flex",
  tabletHideUserInfo: "hidden xl:block",

  // Espacements responsives courants
  containerPadding: "px-2 sm:px-4",
  sectionSpacing: "py-4 sm:py-6",
  cardSpacing: "mb-6 sm:mb-8",

  // Utilitaires Flex
  responsiveFlex: "flex flex-col md:flex-row gap-3 md:gap-4 md:items-center",
  responsiveButtonGroup:
    "flex flex-col xs:flex-row md:flex-row items-stretch xs:items-center md:items-center gap-2 xs:gap-3 md:flex-shrink-0",
  flexNone: "flex-1 xs:flex-none md:flex-none",
} as const;

/**
 * Fonction utilitaire pour combiner des classes responsives avec des classes personnalisées
 */
export function combineResponsiveClasses(
  responsiveClass: keyof typeof RESPONSIVE_CLASSES,
  customClasses: string = "",
): string {
  return `${RESPONSIVE_CLASSES[responsiveClass]} ${customClasses}`.trim();
}

/**
 * Récupère les classes de grille adaptées selon le type de contenu
 */
export function getGridColumns(type: "stats" | "cards" | "loading"): string {
  switch (type) {
    case "stats":
      return RESPONSIVE_CLASSES.statsGrid;
    case "cards":
    case "loading":
      return RESPONSIVE_CLASSES.cardGrid;
    default:
      return RESPONSIVE_CLASSES.cardGrid;
  }
}

/**
 * Récupère les classes d’en-tête adaptées pour visibilité mobile/desktop
 */
export function getHeaderClasses(type: "mobile" | "desktop"): string {
  return type === "mobile"
    ? RESPONSIVE_CLASSES.mobileHeader
    : RESPONSIVE_CLASSES.desktopHeader;
}
