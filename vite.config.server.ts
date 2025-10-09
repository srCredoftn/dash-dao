/**
Rôle: Configuration Vite — vite.config.server.ts
Domaine: Config
Exports: default
Dépendances: vite, path
Sécurité: veille à la validation d’entrée, gestion JWT/refresh, et limites de débit
Performance: cache/partitionnement/bundling optimisés
*/
import { defineConfig } from "vite";
import path from "path";

// Configuration de build côté serveur
export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/backend-express/node-build.ts"),
      name: "server",
      fileName: "production",
      formats: ["es"],
    },
    outDir: "dist/server",
    target: "node22",
    ssr: true,
    rollupOptions: {
      external: [
        // Modules natifs de Node.js
        "fs",
        "path",
        "url",
        "http",
        "https",
        "os",
        "crypto",
        "stream",
        "util",
        "events",
        "buffer",
        "querystring",
        "child_process",
        // Dépendances externes à ne pas empaqueter
        "express",
        "cors",
      ],
      output: {
        format: "es",
        entryFileNames: "[name].mjs",
      },
    },
    minify: false, // Lisible pour le débogage
    sourcemap: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src/frontend"),
      "@shared": path.resolve(__dirname, "./src/shared"),
    },
  },
  define: {
    "process.env.NODE_ENV": '"production"',
  },
});
