#!/bin/bash

# Script pour basculer entre les backends

echo "🔧 DAO Management - Backend Switcher"
echo "=================================="

case "$1" in
  "express"|"")
    echo "🚀 Démarrage du backend Express (intégré)"
    echo "Port: 8080 (frontend + backend)"
    echo "Stockage: Mémoire"
    echo "Hot reload: ✅"
    echo ""
    pnpm dev
    ;;
  
  "mongodb"|"mongo")
    echo "🗄️ Démarrage du backend MongoDB (standalone)"
    echo "Port: 5000 (backend uniquement)"
    echo "Stockage: MongoDB"
    echo "Hot reload: ✅"
    echo ""
    echo "⚠️  Assurez-vous que MongoDB est démarré et configuré !"
    echo "📝 Vérifiez le fichier backend-mongodb/.env"
    echo ""
    cd backend-mongodb
    if [ ! -f ".env" ]; then
      echo "❌ Fichier .env manquant dans backend-mongodb/"
      echo "📋 Copiez .env.example vers .env et configurez-le"
      exit 1
    fi
    pnpm install
    pnpm dev
    ;;
    
  "help"|"-h"|"--help")
    echo "Usage: ./switch-backend.sh [express|mongodb|help]"
    echo ""
    echo "Backends disponibles:"
    echo "  express  - Backend Express intégré (par défaut)"
    echo "  mongodb  - Backend MongoDB standalone"
    echo "  help     - Affiche cette aide"
    echo ""
    echo "Exemples:"
    echo "  ./switch-backend.sh          # Backend Express"
    echo "  ./switch-backend.sh express  # Backend Express"
    echo "  ./switch-backend.sh mongodb  # Backend MongoDB"
    ;;
    
  *)
    echo "❌ Backend '$1' non reconnu"
    echo "💡 Utilisez: ./switch-backend.sh help"
    exit 1
    ;;
esac
