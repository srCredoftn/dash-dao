import { AppHeader } from "@/components/AppHeader";
/**
 * Santé du système — page d'outils de diagnostic (admin)
 * Rôle: afficher un aperçu simple de l'état des fonctionnalités clés.
 */
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import secureFetch from "@/utils/secure-fetch";
import { Button } from "@/components/ui/button";

export default function AdminHealth() {
  const { isAdmin } = useAuth();
  const [diag, setDiag] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin()) return;
    (async () => {
      try {
        const res = await secureFetch("/api/system/mail/diagnostics", {
          method: "GET",
        });
        const json = await res.json();
        setDiag(json);
      } catch (e) {
        setError(String((e as Error)?.message || e));
      }
    })();
  }, [isAdmin]);

  // Sécurité: ne rien afficher si non-admin
  if (!isAdmin()) return null;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Santé du système" />
      <main className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Vérifications</CardTitle>
            <CardDescription>Outils de diagnostic</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Les notifications sont actives. Les e-mails sont envoyés si SMTP_*
              est configuré.
            </p>
            {error && (
              <pre className="text-xs text-destructive whitespace-pre-wrap">
                {error}
              </pre>
            )}
            {diag && (
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <div className="font-medium">Configuration SMTP</div>
                  <Button
                    size="sm"
                    onClick={async () => {
                      try {
                        const res = await secureFetch(
                          "/api/notifications/test-email",
                          { method: "POST" },
                        );
                        if (res.ok) {
                          setDiag(null);
                          const d = await (
                            await secureFetch("/api/system/mail/diagnostics")
                          ).json();
                          setDiag(d);
                          // toast success minimal via alert-style
                          alert(
                            "E-mail de test envoyé (consultez votre boîte)\nVérifiez aussi la section Événements récents.",
                          );
                        } else {
                          const j = await res.json().catch(() => ({}));
                          alert(
                            `Échec de l'envoi de test: ${j?.error || res.statusText}`,
                          );
                        }
                      } catch (e) {
                        alert(String((e as Error)?.message || e));
                      }
                    }}
                  >
                    Envoyer un e-mail de test
                  </Button>
                </div>
                <div>
                  <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                    <div>Host</div>
                    <div className="text-foreground">
                      {String(diag?.config?.host || "-")}
                    </div>
                    <div>Port</div>
                    <div className="text-foreground">
                      {String(diag?.config?.port || "-")}
                    </div>
                    <div>Sécurisé (TLS)</div>
                    <div className="text-foreground">
                      {String(diag?.config?.secure)}
                    </div>
                    <div>From</div>
                    <div className="text-foreground">
                      {String(diag?.config?.from || "-")}
                    </div>
                    <div>Désactivé</div>
                    <div className="text-foreground">
                      {String(diag?.config?.disabled)}
                    </div>
                    <div>Dry-run</div>
                    <div className="text-foreground">
                      {String(diag?.config?.dryRun)}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="font-medium">Statistiques</div>
                  <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                    <div>Total envoyés</div>
                    <div className="text-foreground">
                      {String(diag?.stats?.totalSent || 0)}
                    </div>
                    <div>Total échoués</div>
                    <div className="text-foreground">
                      {String(diag?.stats?.totalFailed || 0)}
                    </div>
                    <div>En file (mémoire)</div>
                    <div className="text-foreground">
                      {String(diag?.queue?.inMemory || 0)}
                    </div>
                    <div>En file (persistés)</div>
                    <div className="text-foreground">
                      {String(diag?.queue?.persisted || 0)}
                    </div>
                  </div>
                </div>
                {Array.isArray(diag?.recent) && diag.recent.length > 0 && (
                  <div>
                    <div className="font-medium">Événements récents</div>
                    <ul className="list-disc pl-5 text-muted-foreground">
                      {diag.recent.map((e: any, idx: number) => (
                        <li key={idx} className="text-xs">
                          <span className="text-foreground">[{e.ts}]</span>{" "}
                          {e.subject} —{" "}
                          {e.success ? "succès" : `échec: ${e.error || ""}`}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
