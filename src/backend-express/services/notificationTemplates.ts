/**
Rôle: Service métier côté serveur — src/backend-express/services/notificationTemplates.ts
Domaine: Backend/Services
Exports: formatDateFr, formatDateFrDateOnly, tplLoginSuccess, tplNewLogin, tplUserDeleted, tplDaoCreated, tplDaoUpdated, tplDaoDeleted
Dépendances: ./notificationService, @shared/dao
Liens: appels /api, utils de fetch, types @shared/*
*/
import { ServerNotification } from "./notificationService";
import { calculateDaoProgress, type Dao, type DaoTask } from "@shared/dao";

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

export function formatDateFr(d: Date = new Date()): string {
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${day}/${month}/${year} - ${hours}h${minutes}`;
}

// Date seule (sans heure) pour notifications compactes
export function formatDateFrDateOnly(d: Date = new Date()): string {
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function tplLoginSuccess(params: {
  userName: string;
}): Pick<ServerNotification, "type" | "title" | "message" | "data"> {
  const date = formatDateFr();
  return {
    type: "system",
    title: "Connexion réussie",
    message: `Utilisateur : ${params.userName}\nDate : ${date}`,
    data: { event: "login_success" },
  };
}

export function tplNewLogin(params: {
  userName: string;
}): Pick<ServerNotification, "type" | "title" | "message" | "data"> {
  return {
    type: "system",
    title: "Nouvelle Connexion",
    message: `Utilisateur : ${params.userName}\nVeuillez vous connecter pour changer votre mot de passe`,
    data: { event: "login_notice" },
  };
}

export function tplUserDeleted(params: {
  deletedUserName: string;
  actorName: string;
}): Pick<ServerNotification, "type" | "title" | "message" | "data"> {
  const date = formatDateFr();
  return {
    type: "system",
    title: "Suppression d’un utilisateur",
    message: `Utilisateur supprimé : ${params.deletedUserName}\nAction effectuée par : ${params.actorName}\nDate : ${date}`,
    data: { event: "user_deleted" },
  };
}

// ===== DAO templates =====

function teamForDao(dao: Dao): { chef: string; membres: string } {
  const chef = dao.equipe.find((m) => m.role === "chef_equipe");
  const membres = dao.equipe.filter((m) => m.role !== "chef_equipe");
  return {
    chef: chef ? chef.name : "Non défini",
    membres: membres.length ? membres.map((m) => m.name).join(", ") : "Aucun",
  };
}

function daoSummaryLines(dao: Dao, changed?: Set<string>): string[] {
  const t = teamForDao(dao);
  const suffix = (key: string): string => {
    switch (key) {
      case "reference":
      case "autoriteContractante":
      case "dateDepot":
        return " modifiée"; // feminine
      case "membres":
        return " modifiés"; // plural
      default:
        return " modifié"; // masculine/default
    }
  };
  const tag = (key: string, label: string) =>
    `${label}${changed?.has(key) ? suffix(key) : ""} :`;

  return [
    `${tag("numeroListe", "Numéro de liste")} ${dao.numeroListe}`,
    `${tag("reference", "Référence")} ${dao.reference}`,
    `${tag("objetDossier", "Objet du dossier")} ${dao.objetDossier}`,
    `${tag("autoriteContractante", "Autorité contractante")} ${dao.autoriteContractante}`,
    `${tag("chef", "Chef d’équipe")} ${t.chef}`,
    `${tag("membres", "Membres")} ${t.membres}`,
    `${tag("dateDepot", "Date de dépôt")} ${formatDateFrDateOnly(new Date(dao.dateDepot))}`,
  ];
}

export function tplDaoCreated(
  dao: Dao,
): Pick<ServerNotification, "type" | "title" | "message" | "data"> {
  const lines = daoSummaryLines(dao);
  const kv = lines
    .map((l) => {
      const idx = l.indexOf(":");
      if (idx === -1) return null;
      return { label: l.slice(0, idx).trim(), value: l.slice(idx + 1).trim() };
    })
    .filter(Boolean) as Array<{ label: string; value: string }>;

  const htmlParts: string[] = [];
  htmlParts.push(
    `<div style="font-family:Arial,Helvetica,sans-serif;color:#111827;line-height:1.4;padding:18px;">`,
  );
  htmlParts.push(
    `<h2 style="margin:0 0 8px;font-size:18px;color:#0f172a;">Création d’un DAO</h2>`,
  );
  if (kv.length) {
    htmlParts.push(
      `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">`,
    );
    kv.forEach((p) =>
      htmlParts.push(
        `<div style="font-size:14px;color:#374151;"><span style="color:#6b7280;">${p.label} :</span> <strong>${p.value}</strong></div>`,
      ),
    );
    htmlParts.push(`</div>`);
  }
  htmlParts.push(
    `<footer style="margin-top:12px;color:#6b7280;font-size:12px;">Date : ${formatDateFrDateOnly(new Date())}</footer>`,
  );
  htmlParts.push(`</div>`);

  return {
    type: "dao_created",
    title: "Création d’un DAO",
    message: lines.join("\n"),
    data: { event: "dao_created", daoId: dao.id, html: htmlParts.join("") },
  };
}

const VALUE_PLACEHOLDER = "—";

function formatBoolean(value: boolean | undefined | null): string {
  return value ? "Oui" : "Non";
}

function formatList(values: string[]): string {
  if (!values.length) return VALUE_PLACEHOLDER;
  return values.join(", ");
}

function formatDateOnly(value: string | undefined | null): string {
  if (!value) return VALUE_PLACEHOLDER;
  return formatDateFrDateOnly(new Date(value));
}

function namesFromIds(ids: string[] | undefined, dao: Dao): string[] {
  if (!ids || !ids.length) return [];
  const memberMap = new Map(dao.equipe.map((m) => [m.id, m.name]));
  return ids.map((id) => memberMap.get(id) || id);
}

export function tplDaoUpdated(params: {
  before: Dao;
  after: Dao;
  changedFields: Iterable<string>;
  teamChanges?: string[];
  taskChanges?: Array<{
    id: number;
    name: string;
    changes: string[];
    comments?: Array<{ userName: string; content: string; createdAt?: string }>;
  }>;
}): Pick<ServerNotification, "type" | "title" | "message" | "data"> {
  const { before, after, changedFields, teamChanges, taskChanges } = params;
  const changedSet = new Set(changedFields);

  const baseLines = [
    "Mise à jour d’un DAO",
    `Numéro de liste : ${after.numeroListe}`,
    `Autorité contractante : ${after.autoriteContractante}`,
    `Date de dépôt : ${formatDateOnly(after.dateDepot)}`,
  ];

  const changeLines: string[] = [];
  if (changedSet.has("numeroListe")) {
    changeLines.push(
      `Numéro de liste antérieur : ${before.numeroListe || VALUE_PLACEHOLDER}`,
    );
    changeLines.push(
      `Numéro de liste modifié : ${after.numeroListe || VALUE_PLACEHOLDER}`,
    );
  }
  if (changedSet.has("reference")) {
    changeLines.push(
      `Référence antérieure : ${before.reference || VALUE_PLACEHOLDER}`,
    );
    changeLines.push(
      `Référence modifiée : ${after.reference || VALUE_PLACEHOLDER}`,
    );
  }
  if (changedSet.has("objetDossier")) {
    changeLines.push(
      `Objet du dossier antérieur : ${
        before.objetDossier || VALUE_PLACEHOLDER
      }`,
    );
    changeLines.push(
      `Objet du dossier modifié : ${after.objetDossier || VALUE_PLACEHOLDER}`,
    );
  }
  if (changedSet.has("autoriteContractante")) {
    changeLines.push(
      `Autorité contractante antérieure : ${
        before.autoriteContractante || VALUE_PLACEHOLDER
      }`,
    );
    changeLines.push(
      `Autorité contractante modifiée : ${
        after.autoriteContractante || VALUE_PLACEHOLDER
      }`,
    );
  }
  if (changedSet.has("dateDepot")) {
    changeLines.push(
      `Date de dépôt antérieure : ${formatDateOnly(before.dateDepot)}`,
    );
    changeLines.push(
      `Date de dépôt modifiée : ${formatDateOnly(after.dateDepot)}`,
    );
  }

  if (changedSet.has("chef") || changedSet.has("membres")) {
    const beforeTeam = teamForDao(before);
    const afterTeam = teamForDao(after);
    changeLines.push(
      `Chef d’équipe antérieur : ${beforeTeam.chef || VALUE_PLACEHOLDER}`,
    );
    changeLines.push(
      `Chef d’équipe modifié : ${afterTeam.chef || VALUE_PLACEHOLDER}`,
    );
    const beforeMembers = before.equipe
      .filter((m) => m.role !== "chef_equipe")
      .map((m) => m.name);
    const afterMembers = after.equipe
      .filter((m) => m.role !== "chef_equipe")
      .map((m) => m.name);
    changeLines.push(`Membres antérieurs : ${formatList(beforeMembers)}`);
    changeLines.push(`Membres modifiés : ${formatList(afterMembers)}`);
  }

  const previousProgress = calculateDaoProgress(before.tasks || []);
  const currentProgress = calculateDaoProgress(after.tasks || []);
  if (previousProgress !== currentProgress) {
    changeLines.push(`Progression antérieure : ${previousProgress}%`);
    changeLines.push(`Progression modifiée : ${currentProgress}%`);
  }

  const lines = [...baseLines];
  if (changeLines.length > 0) {
    lines.push("", ...changeLines);
  }

  if (teamChanges && teamChanges.length > 0) {
    lines.push("", "Équipe :");
    teamChanges.forEach((change, index) => {
      lines.push(`${index + 1}. ${change}`);
    });
  }

  if (taskChanges && taskChanges.length > 0) {
    lines.push("", "Tâches modifiées :");
    taskChanges.forEach((taskChange, index) => {
      lines.push(`${index + 1}. ${taskChange.name}`);
      taskChange.changes.forEach((detail) => {
        lines.push(`   • ${detail}`);
      });
      if (
        Array.isArray(taskChange.comments) &&
        taskChange.comments.length > 0
      ) {
        lines.push(`   • Commentaires :`);
        taskChange.comments.forEach((c) => {
          const when = c.createdAt
            ? ` — ${formatDateFrDateOnly(new Date(c.createdAt))}`
            : "";
          lines.push(`      - ${c.userName}: ${c.content}${when}`);
        });
      }
    });
  }

  // Build a rich HTML representation for emails
  const htmlSections: string[] = [];
  htmlSections.push(
    `<div style="font-family:Arial,Helvetica,sans-serif;color:#111827;line-height:1.4;padding:18px;">`,
  );
  htmlSections.push(
    `<h2 style="margin:0 0 8px;font-size:18px;color:#0f172a;">Mise à jour d’un DAO</h2>`,
  );
  htmlSections.push(
    `<p style="margin:0 0 12px;color:#374151;font-size:14px;">`,
  );
  htmlSections.push(
    `<strong>Numéro de liste :</strong> ${after.numeroListe}<br/>`,
  );
  htmlSections.push(
    `<strong>Chef d’équipe :</strong> ${teamForDao(after).chef}<br/>`,
  );
  htmlSections.push(`<strong>Membres :</strong> ${teamForDao(after).membres}`);
  htmlSections.push(`</p>`);

  if (changeLines.length > 0) {
    htmlSections.push(
      `<section style="margin-top:12px;padding:12px;border-radius:8px;background:#f8fafc;border:1px solid #e6eef6;">`,
    );
    htmlSections.push(
      `<h3 style="margin:0 0 8px;font-size:15px;color:#0f172a;">Changements principaux</h3>`,
    );
    htmlSections.push(`<ul style="margin:0;padding-left:18px;color:#374151;">`);
    changeLines.forEach((ln) =>
      htmlSections.push(`<li style="margin-bottom:6px;">${ln}</li>`),
    );
    htmlSections.push(`</ul>`);
    htmlSections.push(`</section>`);
  }

  if (taskChanges && taskChanges.length > 0) {
    htmlSections.push(`<section style="margin-top:12px;">`);
    htmlSections.push(
      `<h3 style="margin:0 0 8px;font-size:15px;color:#0f172a;">Détails des tâches modifiées</h3>`,
    );
    taskChanges.forEach((tc) => {
      htmlSections.push(
        `<div style="border:1px solid #e6eef6;padding:10px;border-radius:8px;background:#ffffff;margin-bottom:10px;">`,
      );
      htmlSections.push(
        `<div style="font-weight:600;color:#0f172a;margin-bottom:6px;">${tc.name}</div>`,
      );
      if (tc.changes && tc.changes.length > 0) {
        htmlSections.push(
          `<ul style="margin:0;padding-left:18px;color:#374151;">`,
        );
        tc.changes.forEach((c) =>
          htmlSections.push(`<li style="margin-bottom:6px;">${c}</li>`),
        );
        htmlSections.push(`</ul>`);
      }
      if (tc.comments && tc.comments.length > 0) {
        htmlSections.push(
          `<div style="margin-top:8px;color:#0f172a;font-weight:600;">Commentaires</div>`,
        );
        htmlSections.push(
          `<ul style="margin:6px 0 0;padding-left:18px;color:#374151;">`,
        );
        tc.comments.forEach((cm) => {
          const when = cm.createdAt
            ? ` — ${formatDateFrDateOnly(new Date(cm.createdAt))}`
            : "";
          htmlSections.push(
            `<li style="margin-bottom:6px;"><strong>${cm.userName}</strong>${when}: ${cm.content}</li>`,
          );
        });
        htmlSections.push(`</ul>`);
      }
      htmlSections.push(`</div>`);
    });
    htmlSections.push(`</section>`);
  }

  htmlSections.push(
    `<footer style="margin-top:12px;color:#6b7280;font-size:12px;">Date : ${formatDateFrDateOnly(new Date())}</footer>`,
  );
  htmlSections.push(`</div>`);
  const html = htmlSections.join("");

  return {
    type: "dao_updated",
    title: "Mise à jour d’un DAO",
    message: lines.join("\n"),
    data: {
      event: "dao_updated",
      daoId: after.id,
      changed: Array.from(changedSet),
      teamChanges: teamChanges || [],
      taskChanges: taskChanges || [],
      html,
    },
  };
}

export function tplDaoDeleted(
  dao: Dao,
): Pick<ServerNotification, "type" | "title" | "message" | "data"> {
  const lines = daoSummaryLines(dao);
  const kv = lines
    .map((l) => {
      const idx = l.indexOf(":");
      if (idx === -1) return null;
      return { label: l.slice(0, idx).trim(), value: l.slice(idx + 1).trim() };
    })
    .filter(Boolean) as Array<{ label: string; value: string }>;

  const htmlParts: string[] = [];
  htmlParts.push(
    `<div style="font-family:Arial,Helvetica,sans-serif;color:#111827;line-height:1.4;padding:18px;">`,
  );
  htmlParts.push(
    `<h2 style="margin:0 0 8px;font-size:18px;color:#0f172a;">Suppression DAO</h2>`,
  );
  if (kv.length) {
    htmlParts.push(
      `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">`,
    );
    kv.forEach((p) =>
      htmlParts.push(
        `<div style="font-size:14px;color:#374151;"><span style="color:#6b7280;">${p.label} :</span> <strong>${p.value}</strong></div>`,
      ),
    );
    htmlParts.push(`</div>`);
  }
  htmlParts.push(
    `<footer style="margin-top:12px;color:#6b7280;font-size:12px;">Date : ${formatDateFrDateOnly(new Date())}</footer>`,
  );
  htmlParts.push(`</div>`);

  return {
    type: "dao_deleted",
    title: "Suppression DAO",
    message: lines.join("\n"),
    data: { event: "dao_deleted", daoId: dao.id, html: htmlParts.join("") },
  };
}

// ===== TASK templates =====
export function tplTaskNotification(params: {
  dao: Dao;
  previous?: DaoTask | null;
  current: DaoTask;
  changeType:
    | "progress"
    | "applicability"
    | "assignees"
    | "comment"
    | "general";
  added?: string[];
  removed?: string[];
  comment?: string;
}): Pick<ServerNotification, "type" | "title" | "message" | "data"> {
  const { dao, previous, current, changeType, added, removed, comment } =
    params;

  const header: string[] = [
    "Mise à jour d’une tâche",
    `Numéro de liste : ${dao.numeroListe}`,
    `Autorité contractante : ${dao.autoriteContractante}`,
    `Date de dépôt : ${formatDateOnly(dao.dateDepot)}`,
    `Nom de la Tâche : ${current.name}`,
    `Numéro de la Tâche : ${current.id}`,
  ];

  const details: string[] = [];
  if (previous) {
    if ((previous.progress ?? 0) !== (current.progress ?? 0)) {
      details.push(`Progression antérieure : ${previous.progress ?? 0}%`);
      details.push(`Progression modifiée : ${current.progress ?? 0}%`);
    }
    if (previous.isApplicable !== current.isApplicable) {
      details.push(
        `Applicabilité antérieure : ${formatBoolean(previous.isApplicable)}`,
      );
      details.push(
        `Applicabilité modifiée : ${formatBoolean(current.isApplicable)}`,
      );
    }
    if ((previous.comment || "") !== (current.comment || "")) {
      details.push(
        `Commentaire antérieur : ${previous.comment || VALUE_PLACEHOLDER}`,
      );
      details.push(
        `Commentaire modifié : ${current.comment || VALUE_PLACEHOLDER}`,
      );
    }
    if (changeType === "assignees") {
      const beforeAssignees = namesFromIds(previous.assignedTo, dao);
      const afterAssignees = namesFromIds(current.assignedTo, dao);
      details.push(`Assignations antérieures : ${formatList(beforeAssignees)}`);
      details.push(`Assignations modifiées : ${formatList(afterAssignees)}`);
    }
  }

  if (Array.isArray(added) && added.length) {
    details.push(
      `Assignations ajoutées : ${formatList(namesFromIds(added, dao))}`,
    );
  }
  if (Array.isArray(removed) && removed.length) {
    details.push(
      `Assignations retirées : ${formatList(namesFromIds(removed, dao))}`,
    );
  }
  if (comment && comment.trim()) {
    details.push(`Commentaire saisi : "${comment.trim()}"`);
  }

  const messageLines = details.length ? [...header, "", ...details] : header;

  // Build HTML version
  const htmlParts: string[] = [];
  htmlParts.push(
    `<div style=\"font-family:Arial,Helvetica,sans-serif;color:#111827;line-height:1.4;padding:18px;\">`,
  );
  htmlParts.push(
    `<h2 style=\"margin:0 0 8px;font-size:18px;color:#0f172a;\">Mise à jour d’une tâche</h2>`,
  );
  const meta = [
    { label: "Numéro de liste", value: String(dao.numeroListe) },
    { label: "Autorité contractante", value: String(dao.autoriteContractante) },
    { label: "Date de dépôt", value: formatDateOnly(dao.dateDepot) },
    { label: "Nom de la Tâche", value: String(current.name) },
    { label: "Numéro de la T��che", value: String(current.id) },
  ];
  htmlParts.push(
    `<div style=\"display:grid;grid-template-columns:1fr 1fr;gap:8px;\">`,
  );
  meta.forEach((p) =>
    htmlParts.push(
      `<div style=\"font-size:14px;color:#374151;\"><span style=\"color:#6b7280;\">${p.label} :</span> <strong>${p.value}</strong></div>`,
    ),
  );
  htmlParts.push(`</div>`);
  if (details.length) {
    htmlParts.push(`<section style=\"margin-top:12px;\">`);
    htmlParts.push(
      `<h3 style=\"margin:0 0 8px;font-size:15px;color:#0f172a;\">Détails</h3>`,
    );
    htmlParts.push(`<ul style=\"margin:0;padding-left:18px;color:#374151;\">`);
    details.forEach((d) =>
      htmlParts.push(`<li style=\"margin-bottom:6px;\">${d}</li>`),
    );
    htmlParts.push(`</ul>`);
    htmlParts.push(`</section>`);
  }
  htmlParts.push(
    `<footer style=\"margin-top:12px;color:#6b7280;font-size:12px;\">Date : ${formatDateFrDateOnly(new Date())}</footer>`,
  );
  htmlParts.push(`</div>`);

  return {
    type: "task_notification",
    title: "Mise à jour d’une tâche",
    message: messageLines.join("\n"),
    data: {
      event: "task_notification",
      daoId: dao.id,
      taskId: current.id,
      changeType,
      changes: details,
      html: htmlParts.join(""),
    },
  };
}
