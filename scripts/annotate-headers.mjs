#!/usr/bin/env node
/*
  Script: annotate-headers.mjs
  Objet: Ajouter un en-tête standardisé (FR) en haut de chaque fichier .ts/.tsx du repo
  Règles:
  - Pas de TODO/placeholder, texte concis et utile
  - Ne pas modifier node_modules/, dist/, build/, .git/
  - Respecter les shebangs (#!) en tête de fichier
  - Ne pas dupliquer un en-tête si déjà présent (détecte marqueur 'Rôle')
*/

import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const INCLUDE_DIRS = [
  "src",
  "netlify",
  "e2e",
  "test",
  "tests",
  // racine: certains fichiers de config
  ".",
];
const EXCLUDE_DIRS = [
  "node_modules",
  "dist",
  "build",
  ".git",
  ".vscode",
  ".idea",
  ".turbo",
  "coverage",
  ".cache",
  ".next",
  ".vercel",
  ".netlify",
  "e2e/report",
];

const INCLUDE_EXT = new Set([".ts", ".tsx"]);
const EXCLUDE_FILES = new Set([
  // fichiers de test / types globaux si nécessaire
]);

function isExcludedDir(p) {
  return EXCLUDE_DIRS.some((x) => p.includes(path.sep + x + path.sep));
}

function listFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (isExcludedDir(full)) continue;
      files.push(...listFiles(full));
    } else {
      const ext = path.extname(e.name);
      if (INCLUDE_EXT.has(ext) && !EXCLUDE_FILES.has(e.name)) {
        // Limiter la racine aux fichiers de config pertinents
        if (dir === ROOT) {
          const allow =
            /^(vite\.config(\.server)?|tailwind\.config|eslint\.config|vitest\.config|postcss\.config)\.\w+$/i.test(
              e.name,
            );
          if (!allow) continue;
        }
        files.push(full);
      }
    }
  }
  return files;
}

function detectCategory(file) {
  const rel = path.relative(ROOT, file).replace(/\\/g, "/");
  if (rel.startsWith("src/frontend/pages/"))
    return { role: "Page React (SPA)", domain: "Frontend/Pages" };
  if (rel.startsWith("src/frontend/components/ui/"))
    return { role: "Composant UI (Radix + Tailwind)", domain: "Frontend/UI" };
  if (rel.startsWith("src/frontend/components/"))
    return { role: "Composant applicatif", domain: "Frontend/Components" };
  if (rel.startsWith("src/frontend/contexts/"))
    return { role: "Contexte/Provider React", domain: "Frontend/State" };
  if (rel.startsWith("src/frontend/services/"))
    return { role: "Service HTTP/Client", domain: "Frontend/Services" };
  if (rel.startsWith("src/frontend/hooks/"))
    return { role: "Hook personnalisé", domain: "Frontend/Hooks" };
  if (
    rel.startsWith("src/frontend/utils/") ||
    rel.startsWith("src/frontend/lib/")
  )
    return { role: "Utilitaires Frontend", domain: "Frontend/Utils" };
  if (rel.startsWith("src/backend-express/routes/"))
    return { role: "Route API Express", domain: "Backend/Routes" };
  if (rel.startsWith("src/backend-express/services/"))
    return { role: "Service métier côté serveur", domain: "Backend/Services" };
  if (rel.startsWith("src/backend-express/repositories/"))
    return { role: "Repository (persistance)", domain: "Backend/Repositories" };
  if (rel.startsWith("src/backend-express/middleware/"))
    return { role: "Middleware Express", domain: "Backend/Middleware" };
  if (rel.startsWith("src/backend-express/models/"))
    return {
      role: "Modèle de données (Mongoose/TS)",
      domain: "Backend/Models",
    };
  if (rel.startsWith("src/backend-express/config/"))
    return { role: "Configuration backend", domain: "Backend/Config" };
  if (rel.startsWith("src/backend-express/utils/"))
    return { role: "Utilitaires Backend", domain: "Backend/Utils" };
  if (rel.startsWith("src/backend-express/"))
    return { role: "Entrée/Bootstrap backend", domain: "Backend/Core" };
  if (rel.startsWith("src/shared/"))
    return { role: "Types & contrats partagés", domain: "Shared" };
  // configs à la racine
  if (/vite\.config/.test(rel))
    return { role: "Configuration Vite", domain: "Config" };
  if (/tailwind\.config/.test(rel))
    return { role: "Configuration Tailwind", domain: "Config" };
  if (/vitest\.config/.test(rel))
    return { role: "Configuration Vitest", domain: "Config" };
  if (/eslint\.config/.test(rel))
    return { role: "Configuration ESLint", domain: "Config" };
  if (/postcss\.config/.test(rel))
    return { role: "Configuration PostCSS", domain: "Config" };
  return { role: "Module TypeScript", domain: "Général" };
}

function extractImports(src) {
  const regex = /import\s+[^'"\n]+from\s+['\"]([^'\"]+)['\"]/g;
  const set = new Set();
  let m;
  while ((m = regex.exec(src))) set.add(m[1]);
  return Array.from(set);
}

function extractExports(src) {
  const names = new Set();
  const reNamed =
    /export\s+(?:const|function|class|type|interface|enum)\s+([A-Za-z0-9_]+)/g;
  const reDefault = /export\s+default\s+(?:function\s+([A-Za-z0-9_]+))?/g;
  let m;
  while ((m = reNamed.exec(src))) names.add(m[1]);
  while ((m = reDefault.exec(src))) names.add(m[1] || "default");
  return Array.from(names);
}

function alreadyAnnotated(src) {
  return /\*\*\s*\n\s*Rôle\s*:/m.test(src);
}

function buildHeader(file, src) {
  const { role, domain } = detectCategory(file);
  const rel = path.relative(ROOT, file).replace(/\\/g, "/");
  const imports = extractImports(src).slice(0, 8);
  const exports = extractExports(src).slice(0, 8);

  const lines = [];
  lines.push("/**");
  lines.push(`Rôle: ${role} — ${rel}`);
  lines.push(`Domaine: ${domain}`);
  if (exports.length) lines.push(`Exports: ${exports.join(", ")}`);
  if (imports.length) lines.push(`Dépendances: ${imports.join(", ")}`);
  // Liens simples par heuristique
  if (rel.includes("/routes/"))
    lines.push(
      "Liens: services (métier), middleware (auth, validation), repositories (persistance)",
    );
  else if (rel.includes("/components/"))
    lines.push("Liens: ui/* (atomes), hooks, contexts, services côté client");
  else if (rel.includes("/services/"))
    lines.push("Liens: appels /api, utils de fetch, types @shared/*");
  else if (rel.includes("/contexts/"))
    lines.push(
      "Liens: services, pages/ composantes consommatrices, types @shared/*",
    );
  else if (rel.includes("/repositories/"))
    lines.push("Liens: models (Mongo), services (métier), config DB");
  else if (rel.includes("/models/"))
    lines.push("Liens: repositories, services (métier)");
  else if (rel.includes("/shared/"))
    lines.push("Liens: importé par frontend et backend");
  // Aspects Sécu/Perf heuristiques
  if (
    /auth|token|jwt|password|rate[-]?limit|helmet|cors/.test(src) ||
    /auth|middleware\//.test(rel)
  ) {
    lines.push(
      "Sécurité: veille à la validation d’entrée, gestion JWT/refresh, et limites de débit",
    );
  }
  if (
    /cache|memo|useMemo|useCallback|QueryClient|manualChunks|split/.test(src) ||
    /vite\.config/.test(rel)
  ) {
    lines.push("Performance: cache/partitionnement/bundling optimisés");
  }
  lines.push("*/");
  return lines.join("\n");
}

function annotateFile(file) {
  let src = fs.readFileSync(file, "utf8");
  if (alreadyAnnotated(src)) return false;

  const header = buildHeader(file, src);

  // Respecter shebang si présent
  if (src.startsWith("#!/")) {
    const idx = src.indexOf("\n");
    const shebang = src.slice(0, idx + 1);
    const rest = src.slice(idx + 1);
    src = shebang + header + "\n" + rest;
  } else {
    src = header + "\n" + src;
  }

  fs.writeFileSync(file, src, "utf8");
  return true;
}

function run() {
  const targets = [];
  for (const d of INCLUDE_DIRS) {
    const abs = path.resolve(ROOT, d);
    if (!fs.existsSync(abs)) continue;
    targets.push(...listFiles(abs));
  }

  let changed = 0;
  for (const f of targets) {
    try {
      if (annotateFile(f)) changed++;
    } catch (e) {
      // ignorer silencieusement les fichiers non modifiables
    }
  }
  console.log(`Annotation terminée: ${changed} fichier(s) modifié(s).`);
}

run();
