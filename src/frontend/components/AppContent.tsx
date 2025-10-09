/**
Rôle: Composant applicatif — src/frontend/components/AppContent.tsx
Domaine: Frontend/Components
Exports: AppContent
Dépendances: react-router-dom, ./ProtectedRoute, ./LazyLoader, ./NetworkStatusAlert, @/components/DeferredToasters, @/utils/feature-flags, @/pages/Login, @/pages/NotFound
Liens: ui/* (atomes), hooks, contexts, services côté client
Sécurité: veille à la validation d’entrée, gestion JWT/refresh, et limites de débit
*/
import { Routes, Route } from "react-router-dom";
import { AuthenticatedRoute, AdminRoute } from "./ProtectedRoute";
import { LazyLoader, PageFallback } from "./LazyLoader";
import NetworkStatusAlert from "./NetworkStatusAlert";
import DeferredToasters from "@/components/DeferredToasters";
import { isDaoEnabled } from "@/utils/feature-flags";

// Imports directs pour les pages critiques (login, not found)
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";

// Pages importées statiquement
import Index from "@/pages/Index";
import DaoDetail from "@/pages/DaoDetail";
import AdminUsers from "@/pages/AdminUsers";
import AdminSessions from "@/pages/AdminSessions";
import Profile from "@/pages/Profile";
import UserManagement from "@/pages/UserManagement";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Clean from "@/pages/Clean";
import AdminHealth from "@/pages/AdminHealth";
import History from "@/pages/History";

export default function AppContent() {
  const showNetworkAlert = import.meta.env.VITE_SHOW_NETWORK_ALERT === "true";
  return (
    <>
      {showNetworkAlert && <NetworkStatusAlert />}
      {/* FetchTestButton temporaire caché */}
      {/* FetchDiagnostics caché */}
      <DeferredToasters />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/forgot-password"
          element={
            <LazyLoader fallback={<PageFallback />}>
              <ForgotPassword />
            </LazyLoader>
          }
        />
        <Route
          path="/reset-password"
          element={
            <LazyLoader fallback={<PageFallback />}>
              <ResetPassword />
            </LazyLoader>
          }
        />
        {isDaoEnabled() ? (
          <>
            <Route
              path="/"
              element={
                <AuthenticatedRoute>
                  <LazyLoader fallback={<PageFallback />}>
                    <Index />
                  </LazyLoader>
                </AuthenticatedRoute>
              }
            />
            <Route
              path="/dao/:id"
              element={
                <AuthenticatedRoute>
                  <LazyLoader fallback={<PageFallback />}>
                    <DaoDetail />
                  </LazyLoader>
                </AuthenticatedRoute>
              }
            />
            <Route
              path="/history"
              element={
                <AuthenticatedRoute>
                  <LazyLoader fallback={<PageFallback />}>
                    <History />
                  </LazyLoader>
                </AuthenticatedRoute>
              }
            />
          </>
        ) : (
          <Route
            path="/"
            element={
              <AuthenticatedRoute>
                <LazyLoader fallback={<PageFallback />}>
                  <Clean />
                </LazyLoader>
              </AuthenticatedRoute>
            }
          />
        )}
        <Route
          path="/admin/users"
          element={
            <AdminRoute>
              <LazyLoader fallback={<PageFallback />}>
                <AdminUsers />
              </LazyLoader>
            </AdminRoute>
          }
        />
        <Route
          path="/admin/health"
          element={
            <AdminRoute>
              <LazyLoader fallback={<PageFallback />}>
                <AdminHealth />
              </LazyLoader>
            </AdminRoute>
          }
        />
        <Route
          path="/admin/sessions"
          element={
            <AdminRoute>
              <LazyLoader fallback={<PageFallback />}>
                <AdminSessions />
              </LazyLoader>
            </AdminRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <AuthenticatedRoute>
              <LazyLoader fallback={<PageFallback />}>
                <Profile />
              </LazyLoader>
            </AuthenticatedRoute>
          }
        />
        <Route
          path="/user-management"
          element={
            <AdminRoute>
              <LazyLoader fallback={<PageFallback />}>
                <UserManagement />
              </LazyLoader>
            </AdminRoute>
          }
        />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
