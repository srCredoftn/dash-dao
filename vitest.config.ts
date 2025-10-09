/**
Rôle: Configuration Vitest — vitest.config.ts
Domaine: Config
Exports: default
Dépendances: vite, @vitejs/plugin-react-swc, path
*/
/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src/frontend"),
      "@shared": path.resolve(__dirname, "./src/shared"),
    },
  },
  test: {
    environment: "node", // Changé temporairement pour éviter l'erreur jsdom
    globals: true,
    setupFiles: ["./test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80,
      exclude: [
        "node_modules/",
        "dist/",
        "coverage/",
        "**/*.d.ts",
        "**/*.config.{js,ts}",
        "**/test/**",
      ],
    },
    include: [
      "src/frontend/**/*.{test,spec}.{js,ts,tsx}",
      "src/backend-express/**/*.{test,spec}.{js,ts}",
      "src/shared/**/*.{test,spec}.{js,ts}",
    ],
    exclude: ["node_modules/", "dist/", "coverage/"],
  },
});
