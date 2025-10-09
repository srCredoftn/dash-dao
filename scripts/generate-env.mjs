#!/usr/bin/env node
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { join, dirname } from "node:path";

function ensureDir(file) {
  const dir = dirname(file);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function genSecret(bytes = 48) {
  return randomBytes(bytes).toString("hex");
}

function writeEnv(filePath, lines) {
  ensureDir(filePath);
  if (!existsSync(filePath)) {
    writeFileSync(filePath, lines.join("\n") + "\n", { encoding: "utf8" });
    console.log(`✅ Created ${filePath}`);
  } else {
    console.log(`ℹ️  Skipped, exists: ${filePath}`);
  }
}

const rootEnv = join(process.cwd(), ".env");
const mongoEnv = join(process.cwd(), "src/backend-mongodb/.env");

const jwt1 = genSecret();
const jwt2 = genSecret();

writeEnv(rootEnv, [
  `PORT=3001`,
  `FRONTEND_URL=http://localhost:8080`,
  `PING_MESSAGE=pong - secure`,
  `JWT_SECRET=${jwt1}`,
  `JWT_EXPIRES_IN=24h`,
  `SEED_DAOS=false`,
  `SEED_USERS=false`,
  `USE_MONGO=false`,
  `STRICT_DB_MODE=false`,
  `FALLBACK_ON_DB_ERROR=true`,
  `ADMIN_EMAIL=admin@exemple.com`,
  `ADMIN_PASSWORD=superpass`,
  `TOKEN_BOOT_ID=${genSecret(12)}`,
  `MAIL_LOGO_URL=https://2sndtechnologies.com/wp-content/uploads/2023/09/Logo2snd.png`,
]);

writeEnv(mongoEnv, [
  `PORT=5000`,
  `FRONTEND_URL=http://localhost:8080`,
  `MONGODB_URI=mongodb://localhost:27017/dao-management`,
  `JWT_SECRET=${jwt2}`,
  `JWT_EXPIRES_IN=7d`,
]);
