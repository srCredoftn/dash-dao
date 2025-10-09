/**
Rôle: Utilitaires Frontend — src/frontend/utils/avatar.ts
Domaine: Frontend/Utils
Exports: getStoredAvatar, setStoredAvatar, removeStoredAvatar, getAvatarUrl, default
*/
// Utilitaires d’avatar : prend en charge les photos de profil stockées localement avec repli élégant vers les initiales DiceBear.

export function getStoredAvatar(userKey?: string): string | null {
  if (!userKey) return null;
  try {
    const byId = localStorage.getItem(`avatar_user_${userKey}`);
    if (byId) return byId;
  } catch {}
  return null;
}

export function setStoredAvatar(userKey: string, dataUrl: string) {
  try {
    localStorage.setItem(`avatar_user_${userKey}`, dataUrl);
    // Notifie les écouteurs de l’onglet courant pour rafraîchir les avatars immédiatement
    try {
      window.dispatchEvent(
        new CustomEvent("avatar-updated", { detail: { userKey } }),
      );
    } catch {}
  } catch {}
}

export function removeStoredAvatar(userKey: string) {
  try {
    localStorage.removeItem(`avatar_user_${userKey}`);
    try {
      window.dispatchEvent(
        new CustomEvent("avatar-updated", { detail: { userKey } }),
      );
    } catch {}
  } catch {}
}

// Génère une URL d’avatar déterministe pour tout utilisateur à partir d’une graine stable (id, email ou nom)
// Vérifie d’abord s’il existe un avatar stocké, sinon se replie sur les initiales DiceBear
export function getAvatarUrl(
  userKeyOrSeed?: string,
  displayName?: string,
): string {
  const stored = getStoredAvatar(userKeyOrSeed);
  if (stored) return stored;
  const seed = (displayName || userKeyOrSeed || "user").toString();
  const params = new URLSearchParams({
    seed,
    backgroundType: "gradientLinear",
    fontSize: "40",
    radius: "50",
  });
  return `https://api.dicebear.com/7.x/initials/svg?${params.toString()}`;
}

export default getAvatarUrl;
