/**
Rôle: Module TypeScript — src/frontend/App.tsx
Domaine: Général
Exports: App
Dépendances: @tanstack/react-query, react-router-dom, @/contexts/AuthContext, @/contexts/NotificationContext, ./components/AppContent, ./components/ErrorBoundary, ./utils/auth-debug
Sécurité: veille à la validation d’entrée, gestion JWT/refresh, et limites de débit
Performance: cache/partitionnement/bundling optimisés
*/
/**
 * App racine: installe ErrorBoundary, React Query, Router, Auth/Notifications.
 * Point d'entrée SPA.
 */
import "./global.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import AppContent from "./components/AppContent";
import ErrorBoundary from "./components/ErrorBoundary";
import { setupAuthDebug } from "./utils/auth-debug";
import "./utils/auth-test"; // Import auth test utilities

const queryClient = new QueryClient();

// Activer les utilitaires de débogage d’authentification en développement
setupAuthDebug();

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <NotificationProvider>
              <AppContent />
            </NotificationProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
