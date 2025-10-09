/**
Rôle: Utilitaires Frontend — src/frontend/utils/lazy-components.tsx
Domaine: Frontend/Utils
Exports: PageLoadingSpinner, withSuspense, LazyIndex, LazyDaoDetail, LazyAdminUsers, LazyProfile, LazyUserManagement, LazyLogin
Dépendances: react, lucide-react
*/
import { Suspense, ComponentType } from "react";
import { Loader2 } from "lucide-react";
import Index from "@/pages/Index";
import DaoDetail from "@/pages/DaoDetail";
import AdminUsers from "@/pages/AdminUsers";
import Profile from "@/pages/Profile";
import UserManagement from "@/pages/UserManagement";
import Login from "@/pages/Login";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import GlobalExportDialog from "@/components/GlobalExportDialog";

// Composant de chargement utilisé comme fallback de Suspense
export function PageLoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="flex flex-col items-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-sm text-gray-600">Chargement...</p>
      </div>
    </div>
  );
}

// HOC pour envelopper les composants lazy avec Suspense
export function withSuspense<P extends object>(
  LazyComponent: ComponentType<P>,
): ComponentType<P> {
  return function SuspenseWrapper(props: P) {
    return (
      <Suspense fallback={<PageLoadingSpinner />}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

// Pages importées statiquement
export const LazyIndex = withSuspense(Index);
export const LazyDaoDetail = withSuspense(DaoDetail);
export const LazyAdminUsers = withSuspense(AdminUsers);
export const LazyProfile = withSuspense(Profile);
export const LazyUserManagement = withSuspense(UserManagement);

// Pages d'auth (points d'entrée)
export const LazyLogin = withSuspense(Login);
export const LazyForgotPassword = withSuspense(ForgotPassword);
export const LazyResetPassword = withSuspense(ResetPassword);

// Composants lourds
export const LazyGlobalExportDialog = withSuspense(GlobalExportDialog);

// États de chargement pour les petits composants
export function ComponentLoadingSpinner() {
  return (
    <div className="flex items-center justify-center p-4">
      <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
    </div>
  );
}

// Wrapper Suspense léger pour les petits composants
export function withLightSuspense<P extends object>(
  LazyComponent: ComponentType<P>,
): ComponentType<P> {
  return function LightSuspenseWrapper(props: P) {
    return (
      <Suspense fallback={<ComponentLoadingSpinner />}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}
