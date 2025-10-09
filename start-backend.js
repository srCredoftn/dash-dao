import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Use tsx to run TypeScript files directly
const backendPath = join(__dirname, "src", "backend-express", "index.ts");

try {
  console.log("🚀 Starting secure backend server...");
  execSync(`npx tsx ${backendPath}`, {
    stdio: "inherit",
    cwd: __dirname,
  });
} catch (error) {
  console.error("❌ Failed to start backend server:", error);
  process.exit(1);
}
