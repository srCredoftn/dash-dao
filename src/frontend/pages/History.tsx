/*
  Hooks utilisés:
  - useEffect: rafraîchir la liste des notifications au montage et lors de l'action "refresh"
  - useMemo: calculs dérivés performants (filtres, stats) évitant recalculs inutiles
  - useState: état local pour filtres/tri/recherche
*/
import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "@/contexts/NotificationContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { StatsCard } from "@/components/StatsCard";
import { cn } from "@/lib/utils";
import { GRID_CLASSES } from "@/types/responsive";
import {
  ArrowLeft,
  BellRing,
  FolderKanban,
  History as HistoryIcon,
  ListChecks,
  PieChart,
} from "lucide-react";

const TIMEFRAME_OPTIONS = [
  { value: "all", label: "Tout" },
  { value: "hour", label: "Dernière heure" },
  { value: "day", label: "Aujourd'hui" },
  { value: "week", label: "Cette semaine" },
  { value: "month", label: "Ce mois-ci" },
  { value: "year", label: "Cette année" },
] as const;

type Timeframe = (typeof TIMEFRAME_OPTIONS)[number]["value"];

type SortOption = "recent" | "oldest" | "dao" | "title";

type TypeFilter =
  | "all"
  | "dao_created"
  | "dao_updated"
  | "dao_deleted"
  | "task_notification"
  | "role_update"
  | "user_created"
  | "system";

const SORT_LABELS: Record<SortOption, string> = {
  recent: "Plus récentes",
  oldest: "Plus anciennes",
  dao: "Numéro de DAO",
  title: "Titre",
};

const TYPE_LABELS: Record<TypeFilter, string> = {
  all: "Tous les types",
  dao_created: "DAO créé",
  dao_updated: "DAO mis à jour",
  dao_deleted: "DAO supprimé",
  task_notification: "Tâche",
  role_update: "Équipe & rôles",
  user_created: "Utilisateur",
  system: "Système",
};

function isWithinTimeframe(dateIso: string, timeframe: Timeframe): boolean {
  if (timeframe === "all") return true;

  const created = new Date(dateIso).getTime();
  const now = Date.now();
  const diff = now - created;

  const oneHour = 60 * 60 * 1000;
  const oneDay = 24 * oneHour;
  const oneWeek = 7 * oneDay;
  const oneMonth = 30 * oneDay;
  const oneYear = 365 * oneDay;

  switch (timeframe) {
    case "hour":
      return diff <= oneHour;
    case "day":
      return new Date(dateIso).toDateString() === new Date().toDateString();
    case "week":
      return diff <= oneWeek;
    case "month":
      return diff <= oneMonth;
    case "year":
      return diff <= oneYear;
    default:
      return true;
  }
}

function getDaoMeta(notification: any) {
  const daoId = notification.data?.daoId as string | undefined;
  const daoNumberMatch = notification.message.match(/DAO-\d{4}-\d{3}/i);
  const daoNumber = notification.data?.daoNumber || daoNumberMatch?.[0] || "—";
  return { daoId, daoNumber };
}

function getTypeBadgeVariant(
  type: string,
): "default" | "secondary" | "outline" | "destructive" {
  switch (type) {
    case "dao_created":
      return "secondary";
    case "dao_deleted":
      return "destructive";
    case "task_notification":
      return "default";
    case "system":
      return "outline";
    default:
      return "default";
  }
}

// Parse message into full lines, no truncation
function splitLines(message: string): string[] {
  return message
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
}

// Extract sections for dao_updated
function parseDaoUpdated(message: string, data: any) {
  const lines = splitLines(message);
  const result: {
    summary: string[];
    changes: string[];
    team: string[];
    tasks: Array<{
      id?: number | string;
      name: string;
      changes: string[];
      comments?: Array<{
        userName: string;
        content: string;
        createdAt?: string;
      }>;
    }>;
  } = { summary: [], changes: [], team: [], tasks: [] };

  // Remove title line if present
  const work = lines[0]?.toLowerCase().includes("mise à jour d’un dao")
    ? lines.slice(1)
    : lines;

  // Collect until blank section headers in original message – we rely on keywords
  let i = 0;
  // First block: metadata (Numéro de liste, Autorité, Date...)
  while (i < work.length) {
    const ln = work[i];
    if (ln === "Équipe :" || ln === "Tâches modifiées :") break;
    // Stop metadata when we hit first pair-specific change like "… antérieur :"
    if (/antérieu|modifié/i.test(ln)) break;
    result.summary.push(ln);
    i++;
  }
  // Changes block until next section header
  while (i < work.length) {
    const ln = work[i];
    if (ln === "Équipe :" || ln === "Tâches modifiées :") break;
    result.changes.push(ln);
    i++;
  }
  // Team section
  if (work[i] === "Équipe :") {
    i++;
    while (i < work.length && work[i] !== "Tâches modifiées :") {
      const ln = work[i];
      // Remove leading numbering like "1. "
      result.team.push(ln.replace(/^\d+\.\s*/, ""));
      i++;
    }
  }
  // Tasks section
  if (work[i] === "Tâches modifiées :") {
    i++;
    let current: { name: string; changes: string[] } | null = null;
    for (; i < work.length; i++) {
      const ln = work[i];
      const taskHeader = ln.match(/^(\d+)\.\s*(.+)$/);
      if (taskHeader) {
        if (current) result.tasks.push(current);
        current = { name: taskHeader[2], changes: [] };
        continue;
      }
      const bullet = ln.replace(/^\s*[•\-]\s*/, "");
      if (current && ln) {
        current.changes.push(bullet);
      }
    }
    if (current) result.tasks.push(current);
  }

  // Prefer structured data if provided
  if (Array.isArray(data?.taskChanges) && data.taskChanges.length) {
    result.tasks = data.taskChanges.map((t: any) => ({
      id: t.id,
      name: String(t.name ?? t.id ?? "Tâche"),
      changes: Array.isArray(t.changes) ? t.changes : [],
      comments: Array.isArray(t.comments) ? t.comments : [],
    }));
  }

  return result;
}

// Generic helper to turn "Label : value" lines into pairs
function kvFromLines(lines: string[]): Array<{ label: string; value: string }> {
  return lines
    .map((l) => {
      const idx = l.indexOf(":");
      if (idx === -1) return null;
      return { label: l.slice(0, idx).trim(), value: l.slice(idx + 1).trim() };
    })
    .filter(Boolean) as Array<{ label: string; value: string }>;
}

export default function History() {
  const { notifications, refresh } = useNotifications();
  const [timeframe, setTimeframe] = useState<Timeframe>("week");
  const [sort, setSort] = useState<SortOption>("recent");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const base = notifications.filter((notification) => {
      if (!isWithinTimeframe(notification.createdAt, timeframe)) {
        return false;
      }

      if (typeFilter !== "all" && notification.type !== typeFilter) {
        return false;
      }

      if (!normalizedQuery) return true;

      const { daoNumber } = getDaoMeta(notification);
      const haystack = [
        notification.title,
        notification.message,
        daoNumber,
        notification.data?.daoId,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });

    const sorted = [...base];
    switch (sort) {
      case "recent":
        sorted.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        break;
      case "oldest":
        sorted.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
        break;
      case "dao": {
        sorted.sort((a, b) => {
          const aDao = getDaoMeta(a).daoNumber;
          const bDao = getDaoMeta(b).daoNumber;
          return aDao.localeCompare(bDao);
        });
        break;
      }
      case "title":
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      default:
        break;
    }

    return sorted;
  }, [notifications, timeframe, typeFilter, query, sort]);

  const stats = useMemo(() => {
    const total = notifications.length;
    const byType = notifications.reduce<Record<string, number>>((acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    }, {});

    const recent = notifications.filter((item) =>
      isWithinTimeframe(item.createdAt, "day"),
    ).length;

    const uniqueDaoIds = new Set<string>();
    notifications.forEach((item) => {
      const { daoId, daoNumber } = getDaoMeta(item);
      if (daoId) {
        uniqueDaoIds.add(String(daoId));
      } else if (daoNumber && daoNumber !== "—") {
        uniqueDaoIds.add(String(daoNumber));
      }
    });

    const daoActivity =
      (byType["dao_created"] || 0) +
      (byType["dao_updated"] || 0) +
      (byType["dao_deleted"] || 0);

    const taskCount = byType["task_notification"] || 0;

    return {
      total,
      byType,
      recent,
      uniqueDaoCount: uniqueDaoIds.size || daoActivity,
      daoActivity,
      taskCount,
    };
  }, [notifications]);

  const navigate = useNavigate();
  const taskCardVariant = stats.taskCount > 0 ? "urgent" : "completed";
  const daoDescription =
    stats.daoActivity > 0
      ? `${stats.daoActivity} notification${stats.daoActivity > 1 ? "s" : ""} liées`
      : "Aucune notification liée";
  const taskDescription =
    stats.taskCount > 0
      ? `${stats.taskCount} notification${stats.taskCount > 1 ? "s" : ""} tâche`
      : "Aucune alerte tâche";

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-gradient-to-r from-slate-50 via-white to-slate-50 border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="block lg:hidden">
            <div className="flex items-center space-x-3 mb-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/")}
                className="flex-shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="ml-1 text-sm">Retour</span>
              </Button>
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <HistoryIcon className="h-4 w-4 text-blue-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-base font-bold truncate">Historique</h1>
                  <p className="text-xs text-muted-foreground truncate">
                    Consultez l’historique des modifications
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="hidden lg:flex items-center space-x-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour au tableau de bord
            </Button>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <HistoryIcon className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Historique</h1>
                <p className="text-sm text-muted-foreground">
                  Consultez l’historique des modifications
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-6 space-y-6">
        <section>
          <div className={cn(GRID_CLASSES.stats, "gap-3 sm:gap-4")}>
            <StatsCard
              title="Total"
              value={stats.total}
              description="Notifications enregistrées"
              icon={PieChart}
              variant="total"
            />
            <StatsCard
              title="Aujourd'hui"
              value={stats.recent}
              description={
                stats.recent > 1
                  ? "Notifications aujourd'hui"
                  : "Notification aujourd'hui"
              }
              icon={BellRing}
              variant="info"
            />
            <StatsCard
              title="DAO concernés"
              value={stats.uniqueDaoCount}
              description={daoDescription}
              icon={FolderKanban}
              variant="active"
            />
            <StatsCard
              title="Tâches"
              value={stats.taskCount}
              description={taskDescription}
              icon={ListChecks}
              variant={taskCardVariant}
            />
          </div>
        </section>

        <Card className="shadow-sm border border-border/60 bg-white/80 backdrop-blur rounded-2xl">
          <CardHeader>
            <CardTitle>Historique des modifications</CardTitle>
            <CardDescription>
              Consultez toutes les notifications (DAO, tâches, rôles) et affinez
              par période, type ou numéro de DAO.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border bg-muted/40 p-4">
                <div className="text-xs uppercase text-muted-foreground">
                  Total
                </div>
                <div className="text-2xl font-semibold">{stats.total}</div>
              </div>
              <div className="rounded-lg border bg-muted/40 p-4">
                <div className="text-xs uppercase text-muted-foreground">
                  Notifications aujourd'hui
                </div>
                <div className="text-2xl font-semibold">{stats.recent}</div>
              </div>
              <div className="rounded-lg border bg-muted/40 p-4">
                <div className="text-xs uppercase text-muted-foreground">
                  DAO
                </div>
                <div className="text-2xl font-semibold">
                  {(stats.byType["dao_created"] || 0) +
                    (stats.byType["dao_updated"] || 0) +
                    (stats.byType["dao_deleted"] || 0)}
                </div>
              </div>
              <div className="rounded-lg border bg-muted/40 p-4">
                <div className="text-xs uppercase text-muted-foreground">
                  Tâches
                </div>
                <div className="text-2xl font-semibold">
                  {stats.byType["task_notification"] || 0}
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Select
                value={timeframe}
                onValueChange={(value: Timeframe) => setTimeframe(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Période" />
                </SelectTrigger>
                <SelectContent>
                  {TIMEFRAME_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={typeFilter}
                onValueChange={(value: TypeFilter) => setTypeFilter(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Type de notification" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={sort}
                onValueChange={(value: SortOption) => setSort(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tri" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SORT_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher (DAO-XXXX-XXX, nom, mot-clé...)"
              />
            </div>

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div>
                {filtered.length} notification{filtered.length > 1 ? "s" : ""}{" "}
                affichée
                {filtered.length > 1 ? "s" : ""}
              </div>
              <Button variant="ghost" size="sm" onClick={() => refresh()}>
                Actualiser
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {filtered.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Aucune notification ne correspond à vos filtres.
              </CardContent>
            </Card>
          ) : (
            filtered.map((notification) => {
              const { daoId, daoNumber } = getDaoMeta(notification);

              // Prepare structured content by type
              const lines = splitLines(notification.message);

              return (
                <Card key={notification.id} className="border-border/80">
                  <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="text-base font-semibold">
                        {notification.title}
                      </CardTitle>
                      <CardDescription>
                        {new Date(notification.createdAt).toLocaleString(
                          "fr-FR",
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={getTypeBadgeVariant(notification.type)}>
                        {TYPE_LABELS[notification.type as TypeFilter] ||
                          notification.type}
                      </Badge>
                      {daoNumber !== "—" && (
                        <Badge variant="outline">{daoNumber}</Badge>
                      )}
                      {daoId && <Badge variant="outline">ID: {daoId}</Badge>}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {notification.type === "dao_updated" ? (
                      (() => {
                        const s = parseDaoUpdated(
                          notification.message,
                          notification.data,
                        );
                        const metaPairs = kvFromLines(
                          s.summary.filter((l) => l.includes(":")),
                        );
                        return (
                          <div className="space-y-4">
                            {metaPairs.length > 0 && (
                              <div className="grid gap-2 sm:grid-cols-2">
                                {metaPairs.map((kv, i) => (
                                  <div key={i} className="text-sm">
                                    <span className="text-muted-foreground">
                                      {kv.label} :{" "}
                                    </span>
                                    <span className="font-medium">
                                      {kv.value}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {s.changes.length > 0 && (
                              <div>
                                <div className="mb-2 text-sm font-semibold">
                                  Changements principaux
                                </div>
                                <ul className="list-disc pl-5 space-y-1 text-sm">
                                  {s.changes.map((c, i) => (
                                    <li key={i}>{c}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {s.team.length > 0 && (
                              <div>
                                <div className="mb-2 text-sm font-semibold">
                                  Équipe
                                </div>
                                <ul className="list-disc pl-5 space-y-1 text-sm">
                                  {s.team.map((c, i) => (
                                    <li key={i}>{c}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {s.tasks.length > 0 && (
                              <div>
                                <div className="mb-2 text-sm font-semibold">
                                  Tâches modifiées
                                </div>
                                <div className="space-y-3">
                                  {s.tasks.map((t, idx) => (
                                    <div
                                      key={idx}
                                      className="rounded-md border p-3"
                                    >
                                      <div className="flex items-center gap-2">
                                        {typeof t.id !== "undefined" && (
                                          <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-1 rounded-full">
                                            {String(t.id)}
                                          </span>
                                        )}
                                        <div className="text-sm font-medium">
                                          {t.name}
                                        </div>
                                      </div>
                                      {t.changes.length > 0 && (
                                        <ul className="mt-2 list-disc pl-5 space-y-1 text-sm">
                                          {t.changes.map((d, j) => (
                                            <li key={j}>{d}</li>
                                          ))}
                                        </ul>
                                      )}
                                      {Array.isArray((t as any).comments) &&
                                        (t as any).comments.length > 0 && (
                                          <div className="mt-3">
                                            <div className="text-xs font-semibold text-muted-foreground mb-1">
                                              Commentaires
                                            </div>
                                            <ul className="space-y-1 text-sm">
                                              {(t as any).comments.map(
                                                (c: any, k: number) => (
                                                  <li
                                                    key={k}
                                                    className="flex gap-2"
                                                  >
                                                    <span className="font-medium">
                                                      {c.userName}:
                                                    </span>
                                                    <span className="text-muted-foreground">
                                                      {c.content}
                                                    </span>
                                                  </li>
                                                ),
                                              )}
                                            </ul>
                                          </div>
                                        )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()
                    ) : notification.type === "task_notification" ? (
                      (() => {
                        // First block: metadata grid (extract first lines with ":")
                        const firstBlock: string[] = [];
                        for (const l of lines) {
                          if (/^$/i.test(l)) break;
                          firstBlock.push(l);
                        }
                        const meta = kvFromLines(
                          firstBlock.filter((l) => l.includes(":")),
                        );
                        const details: string[] = Array.isArray(
                          notification.data?.changes,
                        )
                          ? notification.data?.changes
                          : lines.slice(firstBlock.length + 1);
                        return (
                          <div className="space-y-4">
                            {meta.length > 0 && (
                              <div className="grid gap-2 sm:grid-cols-2">
                                {meta.map((kv, i) => (
                                  <div key={i} className="text-sm">
                                    <span className="text-muted-foreground">
                                      {kv.label} :{" "}
                                    </span>
                                    <span className="font-medium">
                                      {kv.value}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {details.length > 0 && (
                              <div>
                                <div className="mb-2 text-sm font-semibold">
                                  Détails
                                </div>
                                <ul className="list-disc pl-5 space-y-1 text-sm">
                                  {details.map((d, i) => (
                                    <li key={i}>{d}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        );
                      })()
                    ) : notification.type === "dao_created" ||
                      notification.type === "dao_deleted" ? (
                      (() => {
                        const items = kvFromLines(lines);
                        return (
                          <div className="grid gap-2 sm:grid-cols-2">
                            {items.map((kv, i) => (
                              <div key={i} className="text-sm">
                                <span className="text-muted-foreground">
                                  {kv.label} :{" "}
                                </span>
                                <span className="font-medium">{kv.value}</span>
                              </div>
                            ))}
                          </div>
                        );
                      })()
                    ) : (
                      <div className="space-y-1">
                        {lines.map((ln, i) => (
                          <p key={i} className="text-sm leading-relaxed">
                            {ln}
                          </p>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
