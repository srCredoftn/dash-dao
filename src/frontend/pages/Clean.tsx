/**
Rôle: Page React (SPA) — src/frontend/pages/Clean.tsx
Domaine: Frontend/Pages
Exports: Clean
Dépendances: @/components/AppHeader, @/components/ui/button
*/
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";

export default function Clean() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Espace de travail" />
      <main className="container mx-auto px-4 py-10">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <h2 className="text-2xl font-bold">DAO désactivé en local</h2>
          <p className="text-muted-foreground">
            L’interface DAO est masquée en environnement local pour éviter toute
            donnée personnelle.
          </p>
          <div className="pt-2">
            <a href="#project-download">
              <Button>Download du projet propre</Button>
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
