# Déploiement (Netlify / Vercel via MCP)

Options prises en charge

- Netlify (recommandé pour sites statiques + fonctions)
- Vercel (déploiement automatique)

Procédure (via MCP dans Builder.io)

1. Connectez l'intégration souhaitée:
   - Netlify: cliquez sur [Connect Netlify MCP](#open-mcp-popover)
   - Vercel: cliquez sur [Connect Vercel MCP](#open-mcp-popover)
2. Lancez le déploiement depuis l'outil MCP correspondant.

Notes

- Netlify construit le projet côté Netlify. Vérifier `pnpm build` localement peut aider mais n'est pas obligatoire.
- Vercel déploie automatiquement une fois connecté.
- Pour un lien de prévisualisation non production, utilisez [Open Preview](#open-preview).

Variables d'environnement

- Définissez JWT_SECRET et autres clés via l'interface d'env de la plateforme (ne pas commiter .env).

Dépannage

- Si un build échoue, consultez les logs de l'hébergeur et vérifiez les versions Node/pnpm.
- Assurez-vous que BACKEND_URL/FRONTEND_URL sont cohérents si vous séparez frontend/backend.
