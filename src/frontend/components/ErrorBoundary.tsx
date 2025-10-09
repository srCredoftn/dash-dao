/**
Rôle: Composant applicatif — src/frontend/components/ErrorBoundary.tsx
Domaine: Frontend/Components
Exports: useErrorHandler, default
Dépendances: react, @/components/ui/button, lucide-react
Liens: ui/* (atomes), hooks, contexts, services côté client
*/
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Ignorer certaines erreurs DOM qui peuvent être causées par le hot reload
    const isDOMError =
      error.message?.includes("removeChild") ||
      error.message?.includes("insertBefore") ||
      error.message?.includes("createRoot") ||
      error.name === "NotFoundError";

    if (isDOMError && process.env.NODE_ENV === "development") {
      console.warn(
        "Erreur de manipulation du DOM détectée, état non modifié...",
      );
      return { hasError: false };
    }

    // Mettre à jour l'état pour afficher l'UI de fallback au prochain rendu
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Vous pouvez également enregistrer l'erreur dans un service de rapport d'erreur
    console.error("ErrorBoundary a intercepté une erreur :", error, errorInfo);

    // Ignorer certaines erreurs DOM qui peuvent être causées par le hot reload
    const isDOMError =
      error.message?.includes("removeChild") ||
      error.message?.includes("insertBefore") ||
      error.message?.includes("createRoot") ||
      error.name === "NotFoundError";

    if (isDOMError && process.env.NODE_ENV === "development") {
      console.warn(
        "Erreur de manipulation du DOM détectée (probablement due au hot reload), ignorée...",
      );
      // Ne pas mettre à jour l'état pour les erreurs DOM de développement
      return;
    }

    this.setState({
      error,
      errorInfo,
    });

    // En production, vous pourriez envoyer cette erreur à un service comme Sentry
    if (process.env.NODE_ENV === "production") {
      // Exemple: sendErrorToService(error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // UI de fallback personnalisée
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isContextError = this.state.error?.message?.includes(
        "must be used within",
      );
      const isDevelopment = process.env.NODE_ENV === "development";

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
              </div>
              <CardTitle className="text-xl">
                {isContextError
                  ? "Erreur d'initialisation"
                  : "Une erreur est survenue"}
              </CardTitle>
              <CardDescription>
                {isContextError
                  ? "Un problème d'ordre d'initialisation des composants a été détecté."
                  : "L'application a rencontré une erreur inattendue."}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {isDevelopment && (
                <div className="bg-gray-100 p-3 rounded-md">
                  <h4 className="font-medium text-sm text-gray-900 mb-2">
                    Détails de l'erreur (développement):
                  </h4>
                  <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                    {this.state.error?.message}
                  </pre>
                  {this.state.errorInfo && (
                    <details className="mt-2">
                      <summary className="text-xs cursor-pointer text-gray-600">
                        Trace d'exécution
                      </summary>
                      <pre className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm text-gray-600">
                  {isContextError
                    ? "Cette erreur est généralement temporaire et peut être résolue en rechargeant la page."
                    : "Vous pouvez essayer de recharger la page ou réessayer l'action."}
                </p>

                <div className="flex gap-2 justify-center">
                  <Button
                    variant="outline"
                    onClick={this.handleRetry}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Réessayer
                  </Button>

                  <Button
                    onClick={this.handleReload}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Recharger la page
                  </Button>
                </div>
              </div>

              {isDevelopment && (
                <div className="text-xs text-gray-500 text-center pt-2 border-t">
                  <p>💡 Conseil: Vérifiez la console pour plus de détails</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook pour reporter les erreurs de manière programmatique
export function useErrorHandler() {
  return (error: Error, _errorInfo?: string) => {
    console.error("Erreur signalée via le hook :", error);

    // En production, envoyer à un service d'erreur
    if (process.env.NODE_ENV === "production") {
      // sendErrorToService(error, errorInfo);
    }

    // Re-throw pour déclencher l'error boundary si nécessaire
    throw error;
  };
}
