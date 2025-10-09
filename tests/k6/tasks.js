import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  scenarios: {
    writes: {
      executor: "constant-arrival-rate",
      rate: 500 / 60, // 500 écritures par minute
      timeUnit: "1s",
      duration: "1m",
      preAllocatedVUs: 20,
      maxVUs: 100,
    },
  },
};

const BASE = __ENV.K6_BASE_URL || "http://localhost:8080";

export default function () {
  // Récupérer un jeton
  const login = http.post(
    `${BASE}/api/auth/login`,
    JSON.stringify({ email: "admin@2snd.fr", password: "admin123" }),
    { headers: { "Content-Type": "application/json" } },
  );
  check(login, { "login ok": (r) => r.status === 200 });
  const token = login.json("token");

  // Créer rapidement un DAO pour y ajouter des tâches
  const createDao = http.post(
    `${BASE}/api/dao`,
    JSON.stringify({
      numeroListe: `K6-${Math.random().toString(36).slice(2, 8)}`,
      objetDossier: "Test",
      reference: "ref",
      autoriteContractante: "AC",
      dateDepot: new Date().toISOString(),
      equipe: [],
      tasks: [],
    }),
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (createDao.status === 201 || createDao.status === 200) {
    const daoId = createDao.json("id") || createDao.json("dao.id");
    const addTask = http.post(
      `${BASE}/api/dao/${daoId}/tasks`,
      JSON.stringify({ name: "k6 task", isApplicable: true, progress: 0 }),
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
    );
    check(addTask, {
      "task created": (r) => r.status === 201 || r.status === 200,
    });
  }

  sleep(0.1);
}
