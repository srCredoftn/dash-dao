import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  thresholds: {
    http_req_failed: ["rate<0.01"], // <1% d’erreurs
    http_req_duration: ["p(95)<800"],
  },
};

const BASE = __ENV.K6_BASE_URL || "http://localhost:8080";
const EMAIL = __ENV.K6_ADMIN_EMAIL || "admin@2snd.fr";
const PASSWORD = __ENV.K6_ADMIN_PASSWORD || "admin123";

export default function () {
  const res = http.post(
    `${BASE}/api/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    {
      headers: { "Content-Type": "application/json" },
    },
  );
  check(res, { "status is 200": (r) => r.status === 200 });
  sleep(0.1);
}
