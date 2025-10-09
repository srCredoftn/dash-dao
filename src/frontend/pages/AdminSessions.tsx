import { useEffect, useState } from "react";
/**
 * Sessions actives — administration
 * Rôle: lister les sessions, révoquer une session ou toutes, avec confirmations.
 */
import { Link } from "react-router-dom";
import { ArrowLeft, Shield, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { authService } from "@/services/authService";
import type { AuthUser } from "@shared/dao";

export default function AdminSessions() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<
    { token: string; user: AuthUser | null }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  // Chargement initial
  useEffect(() => {
    loadSessions();
  }, []);

  // Récupérer les sessions actives
  const loadSessions = async () => {
    setError(null);
    setLoading(true);
    try {
      const list = await authService.getActiveSessions();
      setSessions(list);
    } catch (e: any) {
      console.error("Erreur lors du chargement des sessions:", e);
      setError(e?.message || "Erreur lors du chargement des sessions");
    } finally {
      setLoading(false);
    }
  };

  // Masquer un token (sécurité UI)
  const maskToken = (t: string) => {
    if (!t) return "";
    if (t.length <= 16) return `${t.slice(0, 4)}...${t.slice(-4)}`;
    return `${t.slice(0, 8)}...${t.slice(-8)}`;
  };

  // Révoquer une session
  const handleRevoke = async (token: string) => {
    const ok = window.confirm(
      "Révoquer cette session ? Cela déconnectera l'utilisateur immédiatement.",
    );
    if (!ok) return;
    try {
      setRevoking(token);
      await authService.revokeSession(token);
      await loadSessions();
    } catch (e) {
      console.error("Échec de la révocation de la session:", e);
      alert("Erreur lors de la révocation de la session");
    } finally {
      setRevoking(null);
    }
  };

  // Révoquer toutes les sessions (sauf la vôtre)
  const handleRevokeAll = async () => {
    const ok = window.confirm(
      "Révoquer toutes les sessions actives sur le serveur (sauf la vôtre) ?",
    );
    if (!ok) return;

    const currentToken = authService.getToken();
    const tokens = sessions.map((s) => s.token).filter(Boolean) as string[];
    const toRevoke = tokens.filter((t) => t !== currentToken);

    if (toRevoke.length === 0) {
      alert("Aucune autre session à révoquer.");
      return;
    }

    try {
      setRevokingAll(true);
      const results = await Promise.allSettled(
        toRevoke.map((t) => authService.revokeSession(t)),
      );
      const successCount = results.filter(
        (r) => r.status === "fulfilled",
      ).length;
      await loadSessions();
      alert(`${successCount} session(s) révoquée(s).`);
    } catch (e) {
      console.error("Échec de la révocation de toutes les sessions:", e);
      alert("Erreur lors de la révocation des sessions");
    } finally {
      setRevokingAll(false);
    }
  };

  // Accès protégé
  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Accès refusé</CardTitle>
            <CardDescription>
              Vous n'avez pas les permissions nécessaires pour accéder à cette
              page.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild>
              <Link to="/">Retour au tableau de bord</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* En-tête */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/">
                <ArrowLeft className="h-4 w-4 mr-2" /> Retour
              </Link>
            </Button>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <Shield className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Sessions actives</h1>
                <p className="text-sm text-muted-foreground">
                  Visualisez et révoquez les sessions actives.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={handleRevokeAll}
              disabled={revokingAll || loading || sessions.length === 0}
            >
              {revokingAll
                ? "Révocation en cours..."
                : "Révoquer toutes les sessions"}
            </Button>
          </div>
        </div>
      </header>

      {/* Contenu */}
      <main className="container mx-auto px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle>Sessions</CardTitle>
            <CardDescription>
              Liste des sessions actives sur le serveur
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center">Chargement...</div>
            ) : error ? (
              <div className="py-4 text-center text-destructive">{error}</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Token</TableHead>
                      <TableHead>Utilisateur</TableHead>
                      <TableHead>Rôle</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-6">
                          Aucune session active
                        </TableCell>
                      </TableRow>
                    )}

                    {sessions.map((s) => (
                      <TableRow key={s.token}>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <code className="text-xs text-muted-foreground">
                              {maskToken(s.token)}
                            </code>
                            <span className="text-xs text-muted-foreground">
                              {s.token ? `(${s.token.length} chars)` : ""}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {s.user ? (
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {s.user.email}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {s.user.name}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">
                              (inconnu)
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {s.user ? (
                            <Badge>{s.user.role}</Badge>
                          ) : (
                            <Badge variant="secondary">sans</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleRevoke(s.token)}
                              disabled={!!revoking}
                            >
                              {revoking === s.token ? (
                                <>
                                  <X className="h-4 w-4 mr-2 animate-spin" />{" "}
                                  Révocation...
                                </>
                              ) : (
                                "Révoquer"
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
