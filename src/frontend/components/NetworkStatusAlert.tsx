/**
Rôle: Composant applicatif — src/frontend/components/NetworkStatusAlert.tsx
Domaine: Frontend/Components
Exports: NetworkStatusAlert
Dépendances: react, @/components/ui/alert, @/components/ui/button, lucide-react, @/utils/network-debug
Liens: ui/* (atomes), hooks, contexts, services côté client
*/
import { useState, useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { WifiOff, AlertCircle, RefreshCw } from "lucide-react";
import { useNetworkStatus } from "@/utils/network-debug";

export default function NetworkStatusAlert() {
  const [isVisible, setIsVisible] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("networkAlertDismissed") === "true";
    } catch {
      return false;
    }
  });

  // Protection contre les erreurs de hook
  let status = {
    isOnline: true,
    backendReachable: true,
    error: undefined as string | undefined,
    lastCheck: new Date().toISOString(),
    latency: undefined as number | undefined,
  };
  let checkConnectivity = async (): Promise<boolean> => {
    return true;
  };

  try {
    const networkStatus = useNetworkStatus();
    status = {
      ...status,
      ...networkStatus.status,
    };
    checkConnectivity = networkStatus.checkConnectivity;
  } catch (error) {
    console.warn(
      "NetworkStatusAlert : impossible d'accéder au hook d'état réseau",
    );
    return null; // Ne pas afficher le composant si le hook n'est pas disponible
  }

  useEffect(() => {
    // Afficher l'alerte si hors ligne ou backend inaccessible et si non définitivement masquée
    const shouldShow =
      (!status.isOnline || (status.isOnline && !status.backendReachable)) &&
      !isDismissed;
    setIsVisible(shouldShow);
  }, [status.isOnline, status.backendReachable, isDismissed]);

  const handleRetry = async () => {
    setIsRetrying(true);
    await checkConnectivity();
    setTimeout(() => setIsRetrying(false), 1000);
  };

  const handleDismiss = () => {
    try {
      localStorage.setItem("networkAlertDismissed", "true");
    } catch {}
    setIsDismissed(true);
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  // Déterminer le type d'alerte et le message
  let alertType: "default" | "destructive" = "destructive";
  let icon = <WifiOff className="h-4 w-4" />;
  let title = "";
  let description = "";

  if (!status.isOnline) {
    title = "Pas de connexion internet";
    description = "Vérifiez votre connexion internet et réessayez.";
    icon = <WifiOff className="h-4 w-4" />;
  } else if (!status.backendReachable) {
    title = "Problème de connexion au serveur";
    description =
      status.error || "Le serveur semble temporairement inaccessible.";
    icon = <AlertCircle className="h-4 w-4" />;
    alertType = "default";
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md">
      <Alert variant={alertType} className="shadow-lg border-2">
        <div className="flex items-start space-x-3">
          {icon}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm mb-1">{title}</div>
            <AlertDescription className="text-xs">
              {description}
            </AlertDescription>

            {status.isOnline && !status.backendReachable && (
              <div className="mt-2 text-xs text-muted-foreground">
                <div>
                  Dernière vérification :{" "}
                  {new Date(status.lastCheck).toLocaleTimeString()}
                </div>
                {status.latency && <div>Latence : {status.latency}ms</div>}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end space-x-2 mt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDismiss}
            className="text-xs h-7"
          >
            Ignorer
          </Button>

          {status.isOnline && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
              disabled={isRetrying}
              className="text-xs h-7"
            >
              {isRetrying ? (
                <>
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                  Test...
                </>
              ) : (
                <>
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Réessayer
                </>
              )}
            </Button>
          )}
        </div>
      </Alert>
    </div>
  );
}
