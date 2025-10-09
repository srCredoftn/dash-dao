/**
Rôle: Configuration Vite — vite.config.ts
Domaine: Config
Exports: default
Dépendances: vite, @vitejs/plugin-react-swc, path
Sécurité: veille à la validation d’entrée, gestion JWT/refresh, et limites de débit
Performance: cache/partitionnement/bundling optimisés
*/
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const backendTarget = process.env.BACKEND_URL || "http://localhost:3001";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src/frontend"),
      "@shared": path.resolve(__dirname, "./src/shared"),
    },
  },
  server: {
    port: 8080,
    proxy: {
      "/api": {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  define: {
    "process.env.NODE_ENV": '"development"',
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-ui": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-select",
          ],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-charts": ["recharts"],
          "vendor-utils": ["date-fns", "clsx", "class-variance-authority"],

          // Large dependencies (loaded dynamically)
          "vendor-export": ["jspdf"],
          "vendor-icons": ["lucide-react"],

          // Application chunks
          shared: ["./src/shared/dao.ts", "./src/shared/api.ts"],
        },
      },
    },
    // Code splitting optimizations
    target: "esnext",
    minify: "esbuild",
    cssCodeSplit: true,
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "@tanstack/react-query",
      "lucide-react",
    ],
  },
});
