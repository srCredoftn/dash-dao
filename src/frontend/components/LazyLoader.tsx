/**
Rôle: Composant applicatif — src/frontend/components/LazyLoader.tsx
Domaine: Frontend/Components
Exports: PageFallback, ComponentFallback, LazyLoader, withLazyLoader, createLazyComponent
Dépendances: react, lucide-react
Liens: ui/* (atomes), hooks, contexts, services côté client
*/
import { Suspense, ComponentType, ReactNode, lazy } from "react";
import { Loader2 } from "lucide-react";

interface LazyLoaderProps {
  children: ReactNode;
  fallback?: ReactNode;
}

// Composant de fallback par défaut avec un spinner ��légant
const DefaultFallback = () => (
  <div className="flex items-center justify-center min-h-[400px] w-full">
    <div className="flex flex-col items-center space-y-4">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      <p className="text-sm text-muted-foreground">Chargement...</p>
    </div>
  </div>
);

// Fallback pour les pages principales
export const PageFallback = () => (
  <div className="flex items-center justify-center min-h-screen w-full">
    <div className="flex flex-col items-center space-y-6">
      <div className="relative">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
        <div className="absolute inset-0 h-12 w-12 rounded-full border-2 border-blue-100"></div>
      </div>
      <div className="text-center space-y-2">
        <h3 className="text-lg font-medium text-gray-900">
          Chargement de la page
        </h3>
        <p className="text-sm text-muted-foreground">Veuillez patienter...</p>
      </div>
    </div>
  </div>
);

// Fallback pour les composants plus petits
export const ComponentFallback = () => (
  <div className="flex items-center justify-center p-8">
    <div className="flex items-center space-x-2">
      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
      <span className="text-sm text-muted-foreground">Chargement...</span>
    </div>
  </div>
);

// Wrapper principal pour le lazy loading
export const LazyLoader = ({
  children,
  fallback = <DefaultFallback />,
}: LazyLoaderProps) => {
  return <Suspense fallback={fallback}>{children}</Suspense>;
};

// HOC pour wrapper automatiquement les composants lazy
export function withLazyLoader<T extends {}>(
  Component: ComponentType<T>,
  fallback?: ReactNode,
) {
  return function LazyComponent(props: T) {
    return (
      <LazyLoader fallback={fallback}>
        <Component {...props} />
      </LazyLoader>
    );
  };
}

// Utilitaire pour créer des imports lazy avec fallback personnalisé
export function createLazyComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  fallback?: ReactNode,
) {
  const LazyComponent = lazy(() => importFn());

  return function WrappedLazyComponent(props: any) {
    return (
      <LazyLoader fallback={fallback || <PageFallback />}>
        <LazyComponent {...props} />
      </LazyLoader>
    );
  };
}

// Re-export lazy from React pour plus de commodité
export { lazy } from "react";
