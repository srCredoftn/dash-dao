/**
Rôle: Composant applicatif — src/frontend/components/FetchTestButton.tsx
Domaine: Frontend/Components
Exports: FetchTestButton
Dépendances: react, @/components/ui/button, @/components/ui/alert, @/utils/fetch-test
Liens: ui/* (atomes), hooks, contexts, services côté client
*/
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { testFetchFunctionality } from "@/utils/fetch-test";

export default function FetchTestButton() {
  const [testResult, setTestResult] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const handleTest = async () => {
    setIsLoading(true);
    setTestResult("Test en cours...");

    try {
      const result = await testFetchFunctionality();
      if (result.success) {
        setTestResult(
          "✅ Test de requête réussi ! Consultez la console pour les détails.",
        );
      } else {
        setTestResult(`❌ Échec du test de requête : ${result.error}`);
      }
    } catch (error) {
      setTestResult(
        `❌ Erreur de test : ${error instanceof Error ? error.message : "Inconnue"}`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Afficher uniquement en développement
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      <Button
        onClick={handleTest}
        disabled={isLoading}
        variant="outline"
        size="sm"
        className="bg-white shadow-lg"
      >
        {isLoading ? "Test en cours..." : "🧪 Tester Fetch"}
      </Button>

      {testResult && (
        <Alert className="max-w-xs">
          <AlertDescription className="text-xs">{testResult}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
