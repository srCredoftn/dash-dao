/**
Rôle: Types & contrats partagés — src/shared/api.ts
Domaine: Shared
Exports: DemoResponse
Liens: importé par frontend et backend
*/
/**
 * Code partagé entre client et serveur.
 * Utile pour partager des types et/ou de petites fonctions JS
 * réutilisables côté client et serveur.
 */

/**
 * Type d'exemple pour la réponse /api/demo
 */
export interface DemoResponse {
  message: string;
}
