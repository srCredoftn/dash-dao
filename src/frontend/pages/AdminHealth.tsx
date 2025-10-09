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

export default function AdminHealth() {
  const { isAdmin } = useAuth();

  // Sécurité: ne rien afficher si non-admin
  if (!isAdmin()) return null;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Santé du système" />
      <main className="container mx-auto px-4 py-8">
        <Card className="max-w-xl mx-auto">
          <CardHeader>
            <CardTitle>Vérifications</CardTitle>
            <CardDescription>Outils de diagnostic</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Les notifications sont actives. Les e-mails sont envoyés si SMTP_*
              est configuré.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
