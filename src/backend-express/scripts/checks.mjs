import fs from "fs";
import process from "process";

const BACKEND = process.env.BACKEND_URL || "http://localhost:3001";

async function run() {
  try {
    console.log("Running automated backend checks against", BACKEND);

    const out = (label, data) => {
      console.log(`--- ${label} ---`);
      console.log(JSON.stringify(data, null, 2));
    };

    // helper
    const doFetch = async (path, options = {}) => {
      const url = BACKEND + path;
      const resp = await fetch(url, options);
      const text = await resp.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch (e) {
        json = { raw: text };
      }
      return { status: resp.status, ok: resp.ok, data: json };
    };

    // 1) health
    const health = await doFetch("/api/health");
    out("HEALTH", health);

    // 2) boot
    const boot = await doFetch("/api/boot");
    out("BOOT", boot);

    // 3) login
    const adminEmail = process.env.ADMIN_EMAIL || "admin@2snd.fr";
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

    const loginResp = await doFetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    });
    out("LOGIN", loginResp);

    let token = null;
    if (loginResp.ok && loginResp.data && loginResp.data.token) {
      token = loginResp.data.token;
    }

    // 4) DAOS
    const daosResp = await doFetch(
      "/api/dao",
      token ? { headers: { Authorization: `Bearer ${token}` } } : {},
    );
    out("DAOS", daosResp);

    // 5) NOTIFICATIONS
    const notifsResp = await doFetch(
      "/api/notifications",
      token ? { headers: { Authorization: `Bearer ${token}` } } : {},
    );
    out("NOTIFICATIONS", notifsResp);

    // 6) SMTP health
    const smtp = await doFetch("/api/health/smtp");
    out("SMTP", smtp);

    console.log("Automated checks complete");
    process.exit(0);
  } catch (e) {
    console.error("Automated checks failed:", e);
    process.exit(2);
  }
}

run();
