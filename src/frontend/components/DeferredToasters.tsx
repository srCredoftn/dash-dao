/**
Rôle: Composant applicatif — src/frontend/components/DeferredToasters.tsx
Domaine: Frontend/Components
Exports: DeferredToasters
Dépendances: react, @/components/ui/toaster, @/components/ui/sonner
Liens: ui/* (atomes), hooks, contexts, services côté client
*/
import { useEffect, useState } from "react";
import { Toaster as ShadToaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

export default function DeferredToasters() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const schedule = (cb: () => void) => {
      if (typeof (window as any).requestIdleCallback === "function") {
        (window as any).requestIdleCallback(cb, { timeout: 2000 });
      } else {
        setTimeout(cb, 300);
      }
    };
    schedule(() => setReady(true));
  }, []);

  if (!ready) return null;

  return (
    <>
      <ShadToaster />
      <SonnerToaster />
    </>
  );
}
