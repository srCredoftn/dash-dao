#!/bin/bash

# Migration script to reorganize code into frontend/backend structure
# Run this from the root directory where the 'code' folder exists

echo "🚀 Starting code migration to frontend/backend structure..."

# Create directories if they don't exist
mkdir -p frontend/src
mkdir -p backend/src
mkdir -p shared

# Copy shared types
echo "📁 Copying shared types..."
cp -r code/shared/* shared/ 2>/dev/null || echo "No shared folder found"

# Copy frontend code
echo "🎨 Copying frontend code..."
cp -r code/client/* frontend/src/
cp code/index.html frontend/
cp code/tailwind.config.ts frontend/
cp code/postcss.config.js frontend/
cp code/components.json frontend/

# Copy configuration files for frontend
if [ -f "code/vite.config.ts" ]; then
    cp code/vite.config.ts frontend/
fi

if [ -f "code/tsconfig.json" ]; then
    cp code/tsconfig.json frontend/
fi

# Copy backend code
echo "⚙️ Copying backend code..."
cp -r code/server/* backend/src/

# Copy public assets
echo "🖼️ Copying public assets..."
if [ -d "code/public" ]; then
    cp -r code/public frontend/
fi

# Create environment template for backend
echo "🔧 Creating environment template..."
cat > backend/.env.example << EOF
# Database
MONGODB_URI=mongodb://localhost:27017/dao-management

# JWT Authentication
JWT_SECRET=change-this-super-secret-key-in-production
JWT_EXPIRES_IN=7d

# Server Configuration
PORT=5000
NODE_ENV=development

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000

# Email Configuration (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-app-password
EOF

# Create frontend environment template
cat > frontend/.env.example << EOF
# API Base URL (will proxy to backend in development)
VITE_API_URL=http://localhost:5000

# App Configuration
VITE_APP_NAME=DAO Management
VITE_APP_VERSION=1.0.0
EOF

# Copy Builder.io rules
echo "📝 Copying Builder.io rules..."
if [ -d "code/.builder" ]; then
    mkdir -p .builder
    cp -r code/.builder/* .builder/
fi

# Create gitignore files
echo "📄 Creating .gitignore files..."

cat > frontend/.gitignore << EOF
# Dependencies
node_modules/
.pnpm-store/

# Production builds
dist/
build/

# Environment files
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

# Runtime
*.tsbuildinfo
.eslintcache
EOF

cat > backend/.gitignore << EOF
# Dependencies
node_modules/
.pnpm-store/

# Production builds
dist/
build/

# Environment files
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Database
*.db
*.sqlite

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

# Runtime
*.tsbuildinfo
.eslintcache

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# PM2
.pm2/
EOF

# Create root gitignore
cat > .gitignore << EOF
# Dependencies
node_modules/
.pnpm-store/

# Environment files
.env
.env.local

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Logs
*.log

# Old code folder (after migration)
code/
EOF

# Update package.json scripts for frontend
echo "📦 Updating frontend paths in package.json..."
if [ -f "frontend/package.json" ]; then
    # Update import paths in frontend code
    find frontend/src -name "*.ts" -o -name "*.tsx" | xargs sed -i.bak 's|@shared/|../shared/|g'
    find frontend/src -name "*.bak" -delete
fi

echo "✅ Migration completed!"
echo ""
echo "📋 Next steps:"
echo "1. cd frontend && pnpm install"
echo "2. cd backend && pnpm install" 
echo "3. Set up MongoDB connection in backend/.env"
echo "4. Start backend: cd backend && pnpm dev"
echo "5. Start frontend: cd frontend && pnpm dev"
echo ""
echo "🌐 URLs:"
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:5000"
echo "  API:      http://localhost:5000/api"
EOF

chmod +x migrate-code.sh

echo "✅ Migration script created: migrate-code.sh"
