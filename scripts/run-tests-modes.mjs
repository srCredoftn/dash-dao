#!/usr/bin/env node
import { spawn } from "node:child_process";

function run(env) {
  return new Promise((res, rej) => {
    const child = spawn("pnpm", ["test"], {
      stdio: "inherit",
      env: { ...process.env, ...env },
      shell: true,
    });
    child.on("close", (code) => {
      if (code === 0) res(code);
      else rej(code);
    });
  });
}

(async () => {
  console.log("Running tests in memory mode (USE_MONGO=false)");
  try {
    await run({ USE_MONGO: "false" });
    console.log("Memory-mode tests passed");
  } catch (e) {
    console.error("Memory-mode tests failed", e);
  }

  console.log("\nRunning tests in mongo mode (USE_MONGO=true)");
  try {
    await run({ USE_MONGO: "true" });
    console.log("Mongo-mode tests passed");
  } catch (e) {
    console.error("Mongo-mode tests failed", e);
  }
})();
