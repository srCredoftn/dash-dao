/*
  Utilisation des hooks React principaux dans ce fichier:
  - useState: pour gérer l'état local des formulaires, DAO, flags de chargement, etc.
  - useEffect: pour effets de bord (chargement initial, subscriptions, rafraîchissement de données).
  - useCallback: pour mémoriser des fonctions passées en props afin d'éviter des rerenders inutiles
    quand les dépendances ne changent pas.
  Ces commentaires expliquent pourquoi chaque hook est utilisé et quelles garanties de perf ils
  apportent (stabilité des références, side-effects contrôlés).
*/
import { useState, useEffect, useCallback } from "react";
/**
 * Détail d'un DAO
 * Rôle: afficher et éditer les informations d'un DAO, ses tâches, l'équipe et exporter des rapports (PDF/CSV).
 * Perf: mises à jour optimistes, debounce des sauvegardes, import dynamique de jsPDF.
 */
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  FileText,
  Download,
  Edit3,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { devLog } from "@/utils/devLogger";
import { cn, getBlinkingDateClasses } from "@/lib/utils";
import { apiService } from "@/services/api";
import {
  calculateDaoProgress,
  type Dao,
  type DaoTask,
  type TeamMember,
  type TaskComment,
} from "@shared/dao";
import TeamEditDialog from "@/components/TeamEditDialog";
import DeleteLastDaoButton from "@/components/DeleteLastDaoButton";
import { TaskRow } from "@/components/TaskRow";
import ExportFilterDialog, {
  type ExportOptions,
} from "@/components/ExportFilterDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";

export default function DaoDetail() {
  // Paramètres / état global de navigation et droits
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  // État métier
  const [dao, setDao] = useState<Dao | null>(null);
  const [isLastDao, setIsLastDao] = useState(false);
  const { toast } = useToast();
  const { refresh: refreshNotifications } = useNotifications();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [stagedComments, setStagedComments] = useState<
    Record<number, TaskComment[]>
  >({});

  // Édition inline (autorité, référence, objet du dossier)
  const [isEditingAuthority, setIsEditingAuthority] = useState(false);
  const [tempAuthority, setTempAuthority] = useState("");
  const [isEditingReference, setIsEditingReference] = useState(false);
  const [tempReference, setTempReference] = useState("");
  const [isEditingObjet, setIsEditingObjet] = useState(false);
  const [tempObjet, setTempObjet] = useState("");

  const markDirty = useCallback(() => {
    setHasPendingChanges(true);
  }, []);

  const markSaved = useCallback(() => {
    setHasPendingChanges(false);
  }, []);

  // Chargement du DAO
  useEffect(() => {
    const loadDao = async () => {
      if (!id) {
        setError("ID du DAO manquant");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const fetchedDao = await apiService.getDaoById(id);
        setDao(fetchedDao);
        markSaved();

        // Déterminer s'il s'agit du dernier DAO cr��é (fonctionnalité admin)
        try {
          const next = await apiService.getNextDaoNumber();
          const m = next.match(/^DAO-(\d{4})-(\d{3})$/i);
          if (m) {
            const year = m[1];
            const seq = Math.max(1, parseInt(m[2], 10) - 1)
              .toString()
              .padStart(3, "0");
            const expectedLast = `DAO-${year}-${seq}`;
            setIsLastDao(fetchedDao.numeroListe === expectedLast);
          } else {
            setIsLastDao(false);
          }
        } catch (_) {
          setIsLastDao(false);
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Échec du chargement du DAO";

        // 404 → redirection douce vers la liste
        if (
          /not\s*found/i.test(errorMessage) ||
          /\b404\b/.test(errorMessage) ||
          /HTTP error! status:\s*404/i.test(errorMessage)
        ) {
          devLog.log("DAO introuvable, redirection vers la liste...");
          toast({
            title: "DAO introuvable",
            description: "Le dossier a été supprimé ou n'existe plus.",
          });
          navigate("/", { replace: true });
          return;
        }

        devLog.error("Erreur lors du chargement du DAO:", err);
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    loadDao();
  }, [id]);

  // Écrans d'état (chargement / erreur / introuvable)
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <h2 className="text-lg font-semibold text-foreground mb-2">
            Chargement de la page
          </h2>
          <p className="text-muted-foreground">Veuillez patienter...</p>
        </div>
      </div>
    );
  }

  if (error || !dao) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>DAO introuvable</CardTitle>
            <CardDescription>
              {error || "Le dossier demandé n'existe pas ou a été supprimé."}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild>
              <Link to="/">Retour au tableau de bord</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculs dérivés
  const progress = calculateDaoProgress(dao.tasks);

  /**
   * Gestion des mises à jour de tâche (progress, commentaire, applicabilité, assignations)
   * - Mises à jour optimistes locales
   * - Persistance via services dédiés
   */
  const handleTaskProgressChange = (
    taskId: number,
    newProgress: number | null,
  ) => {
    if (!dao) return;

    // MAJ optimiste locale uniquement (stagé) — ne pas persister immédiatement
    setDao((prev) =>
      prev
        ? {
            ...prev,
            tasks: prev.tasks.map((task) =>
              task.id === taskId
                ? {
                    ...task,
                    progress: newProgress ?? 0,
                    lastUpdatedAt: new Date().toISOString(),
                  }
                : task,
            ),
          }
        : prev,
    );
    markDirty();
  };

  const handleTaskCommentChange = (taskId: number, newComment: string) => {
    setDao((prev) =>
      prev
        ? {
            ...prev,
            tasks: prev.tasks.map((task) =>
              task.id === taskId ? { ...task, comment: newComment } : task,
            ),
          }
        : null,
    );
    markDirty();
  };

  const handleTaskApplicableChange = (taskId: number, applicable: boolean) => {
    if (!dao) return;

    const updates = { isApplicable: applicable } as Partial<DaoTask>;

    // MAJ optimiste locale uniquement (stagé)
    setDao((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tasks: prev.tasks.map((task) =>
          task.id === taskId
            ? { ...task, ...updates, lastUpdatedAt: new Date().toISOString() }
            : task,
        ),
      };
    });
    markDirty();
  };

  const handleTeamUpdate = (newTeam: TeamMember[]) => {
    setDao((prev) =>
      prev
        ? {
            ...prev,
            equipe: newTeam,
          }
        : null,
    );
    markDirty();
    // Sauvegarde via validation uniquement
  };

  // Mise à jour d'une tâche (nom ou autres propriétés)
  const handleTaskUpdate = async (
    taskId: number,
    updates: Partial<DaoTask>,
  ) => {
    if (!dao) return;

    try {
      // MAJ optimiste locale (timestamp) — stagé uniquement
      setDao((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          tasks: prev.tasks.map((task) =>
            task.id === taskId
              ? { ...task, ...updates, lastUpdatedAt: new Date().toISOString() }
              : task,
          ),
        };
      });
      markDirty();
    } catch (error) {
      devLog.error("Erreur lors de la mise à jour locale de la tâche:", error);
      setError("Erreur lors de la mise à jour locale de la tâche");
      try {
        const freshDao = await apiService.getDaoById(dao.id);
        setDao(freshDao);
      } catch (reloadError) {
        devLog.error(
          "Erreur lors du rechargement du DAO après échec de mise à jour locale:",
          reloadError,
        );
      }
    }
  };

  const handleTaskAssignmentChange = async (
    taskId: number,
    memberIds: string[],
  ) => {
    if (!dao) return;

    // MAJ optimiste locale uniquement (stagé)
    setDao((prev) =>
      prev
        ? {
            ...prev,
            tasks: prev.tasks.map((t) =>
              t.id === taskId
                ? {
                    ...t,
                    assignedTo: memberIds,
                    lastUpdatedAt: new Date().toISOString(),
                  }
                : t,
            ),
          }
        : prev,
    );
    markDirty();
  };

  // Export avec options (filtrage des tâches)
  const handleExportWithOptions = (options: ExportOptions) => {
    if (!dao) return;

    let filteredTasks = dao.tasks.filter((task) => {
      if (!task.isApplicable && !options.includeNotApplicable) return false;
      if (task.isApplicable) {
        const progress = task.progress || 0;
        if (progress === 0 && !options.includeTodos) return false;
        if (progress > 0 && progress < 100 && !options.includeInProgress)
          return false;
        if (progress >= 100 && !options.includeCompleted) return false;
      }
      return true;
    });

    if (
      options.includeTodos &&
      options.includeInProgress &&
      options.includeCompleted &&
      options.includeNotApplicable
    ) {
      filteredTasks = dao.tasks;
    }

    if (options.format === "PDF") {
      handleExportPDF(filteredTasks);
    } else {
      handleExportCSV(filteredTasks);
    }
  };

  // Export PDF (jsPDF import statique)
  const handleExportPDF = async (tasks: DaoTask[]) => {
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 14;
    let y = margin;

    // Utilitaires d'entête
    const LOGO_URL = "/logo.png";
    const loadImageAsPngDataUrl = (url: string) =>
      new Promise<{ dataUrl: string; width: number; height: number }>(
        (resolve, reject) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext("2d");
            if (!ctx) return reject(new Error("Contexte canvas indisponible"));
            ctx.drawImage(img, 0, 0);
            try {
              const imageData = ctx.getImageData(
                0,
                0,
                canvas.width,
                canvas.height,
              );
              const d = imageData.data;
              for (let i = 0; i < d.length; i += 4) {
                const r = d[i],
                  g = d[i + 1],
                  b = d[i + 2];
                if (r > 240 && g > 240 && b > 240) d[i + 3] = 0;
              }
              ctx.putImageData(imageData, 0, 0);
            } catch {}
            resolve({
              dataUrl: canvas.toDataURL("image/png"),
              width: img.naturalWidth,
              height: img.naturalHeight,
            });
          };
          img.onerror = () =>
            reject(new Error("Impossible de charger le logo"));
          img.src = url;
        },
      );

    const logo = await loadImageAsPngDataUrl(LOGO_URL).catch(() => null);

    const drawTopHeader = (isFirstPage: boolean) => {
      if (!isFirstPage) return;

      // Logo
      if (logo) {
        const logoW = 28;
        const ratio = logo.height && logo.width ? logo.height / logo.width : 1;
        const logoH = logoW * ratio;
        pdf.addImage(
          logo.dataUrl,
          "PNG",
          pageWidth / 2 - logoW / 2,
          y,
          logoW,
          logoH,
        );
        y += logoH + 6;
      }

      // Titre
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(16);
      pdf.text("Rapport DAO", pageWidth / 2, y, { align: "center" });
      y += 6;
      // Sous-titre (société)
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text("2SND Technologies", pageWidth / 2, y, { align: "center" });
      y += 6;

      // Bloc d'infos (2 colonnes)
      const headerBlockPadding = 8;
      const columnGap = 10;
      const startY = y;
      const contentWidth = pageWidth - margin * 2;
      const halfWidth = (contentWidth - columnGap) / 2;
      const lineH = 5;
      const rowSpacing = 4;
      const singleLine = 5;

      // Helpers mesures
      pdf.setFontSize(11);
      const labelWidth = (t: string) => {
        pdf.setFont("helvetica", "bold");
        const w = pdf.getTextWidth(`${t}: `);
        pdf.setFont("helvetica", "normal");
        return w;
      };

      const leftColWidth = halfWidth - headerBlockPadding * 2;
      const rightColWidth = halfWidth - headerBlockPadding * 2;

      const objetLines = pdf.splitTextToSize(
        dao?.objetDossier || "",
        leftColWidth,
      );
      const autoriteLines = pdf.splitTextToSize(
        dao?.autoriteContractante || "",
        rightColWidth,
      );

      const refLines = pdf.splitTextToSize(
        dao?.reference || "",
        rightColWidth - labelWidth("Référence"),
      );

      const leftHeight =
        singleLine +
        rowSpacing +
        objetLines.length * lineH +
        rowSpacing +
        singleLine;
      const rightHeight =
        refLines.length * lineH +
        rowSpacing +
        autoriteLines.length * lineH +
        rowSpacing +
        singleLine;

      const blockHeight =
        headerBlockPadding * 2 + Math.max(leftHeight, rightHeight);

      // Fond + bordure + séparateur vertical
      pdf.setFillColor(232, 240, 254);
      pdf.rect(margin, startY, contentWidth, blockHeight, "F");
      pdf.setDrawColor(210, 225, 250);
      pdf.rect(margin, startY, contentWidth, blockHeight, "S");
      const dividerX = margin + contentWidth / 2;
      pdf.setDrawColor(210, 225, 250);
      pdf.line(dividerX, startY, dividerX, startY + blockHeight);

      // Colonne gauche
      let hx = margin + headerBlockPadding;
      let hy = startY + headerBlockPadding + 2;
      pdf.setFont("helvetica", "bold");
      pdf.text(`DAO: ${dao?.numeroListe || ""}`, hx, hy);

      const objetLabelY = hy + rowSpacing + singleLine;
      pdf.text("Objet:", hx, objetLabelY);
      pdf.setFont("helvetica", "normal");
      const objetStartY = objetLabelY + lineH;
      (objetLines as string[]).forEach((ln: string, idx: number) => {
        pdf.text(ln, hx, objetStartY + idx * lineH);
      });

      const dateY = objetStartY + objetLines.length * lineH + rowSpacing;
      pdf.setFont("helvetica", "bold");
      pdf.text("Date de dépôt:", hx, dateY);
      pdf.setFont("helvetica", "normal");
      pdf.text(dao?.dateDepot || "", hx + labelWidth("Date de dépôt"), dateY);

      // Colonne droite
      const col2X = dividerX + headerBlockPadding;
      hy = startY + headerBlockPadding + 2;
      const refLabel = "Référence";
      const refLabelW = labelWidth(refLabel);
      pdf.setFont("helvetica", "bold");
      pdf.text(`${refLabel}:`, col2X, hy);
      pdf.setFont("helvetica", "normal");
      const refValue = dao?.reference || "";
      const refLinesDraw = pdf.splitTextToSize(
        refValue,
        rightColWidth - refLabelW,
      );
      pdf.text((refLinesDraw as string[])[0] || "", col2X + refLabelW, hy);
      for (let i = 1; i < (refLinesDraw as string[]).length; i++) {
        pdf.text(
          (refLinesDraw as string[])[i],
          col2X + refLabelW,
          hy + i * lineH,
        );
      }

      const autoriteLabelY =
        hy + (refLinesDraw as string[]).length * lineH + rowSpacing;
      pdf.setFont("helvetica", "bold");
      pdf.text("Autorité Contractante:", col2X, autoriteLabelY);
      pdf.setFont("helvetica", "normal");
      const autoriteStartY = autoriteLabelY + lineH;
      (autoriteLines as string[]).forEach((ln: string, idx: number) => {
        pdf.text(ln, col2X, autoriteStartY + idx * lineH);
      });

      const progY = autoriteStartY + autoriteLines.length * lineH + rowSpacing;
      pdf.setFont("helvetica", "bold");
      pdf.text("Progression globale:", col2X, progY);
      pdf.setFont("helvetica", "normal");
      pdf.text(
        `${progress}%`,
        col2X + labelWidth("Progression globale"),
        progY,
      );

      y = startY + blockHeight + 8;
    };

    drawTopHeader(true);

    // Liste succincte de l'équipe
    if (dao?.equipe?.length) {
      pdf.setFont("helvetica", "bold");
      pdf.text("Équipe", margin, y);
      y += 6;
      pdf.setFont("helvetica", "normal");
      const team = dao.equipe
        .map(
          (m) => `${m.name} (${m.role === "chef_equipe" ? "Chef" : "Membre"})`,
        )
        .join(", ");
      const teamLines = pdf.splitTextToSize(team, pageWidth - margin * 2);
      for (const line of teamLines as string[]) {
        if (y > pageHeight - margin) {
          pdf.addPage();
          y = margin;
          drawTopHeader(false);
        }
        pdf.text(line, margin + 2, y);
        y += 6;
      }
      y += 2;
    }

    // Tableau des tâches
    y += 4;
    const contentWidth = pageWidth - margin * 2;
    const columns = [
      { header: "Tâches", width: Math.round(contentWidth * 0.44) },
      { header: "Applicable", width: Math.round(contentWidth * 0.14) },
      { header: "Progression", width: Math.round(contentWidth * 0.16) },
      { header: "Assigné à", width: Math.round(contentWidth * 0.26) },
    ];

    const drawTableHeader = () => {
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      let x = margin;
      const h = 9;
      pdf.setFillColor(232, 240, 254);
      pdf.rect(x, y, contentWidth, h, "F");
      columns.forEach((col) => {
        pdf.rect(x, y, col.width, h, "S");
        const textY = y + 6;
        pdf.text(col.header, x + 2, textY);
        x += col.width;
      });
      y += h;
      pdf.setFont("helvetica", "normal");
    };

    const ensureSpace = (rowHeight: number) => {
      if (y + rowHeight > pageHeight - margin) {
        pdf.addPage();
        y = margin;
        drawTopHeader(false);
        drawTableHeader();
      }
    };

    drawTableHeader();

    const lineHeight = 5;
    let rowIndex = 0;
    for (const task of tasks) {
      const progressValue = task.progress || 0;
      const progressText = task.isApplicable ? `${progressValue}%` : "N/A";
      const applicableText = task.isApplicable ? "Oui" : "Non";
      const assignee =
        task.assignedTo && task.assignedTo.length
          ? task.assignedTo
              .map(
                (id) => dao?.equipe.find((m) => m.id === id)?.name || "Inconnu",
              )
              .join(", ")
          : "Non assigné";
      const row = [task.name, applicableText, progressText, assignee];

      const wrapped = row.map((cell, i) =>
        pdf.splitTextToSize(String(cell), columns[i].width - 4),
      );
      const rowHeight =
        Math.max(...wrapped.map((w) => (w as string[]).length)) * lineHeight +
        4;
      ensureSpace(rowHeight);

      // Fond zébré
      if (rowIndex % 2 === 0) {
        pdf.setFillColor(249, 251, 255);
        pdf.rect(margin, y, contentWidth, rowHeight, "F");
      }

      let x = margin;
      for (let i = 0; i < columns.length; i++) {
        const col = columns[i];
        pdf.rect(x, y, col.width, rowHeight, "S");
        const lines = wrapped[i] as string[];
        let ty = y + 3.5;

        if (i === 1) {
          if (task.isApplicable) pdf.setTextColor(16, 121, 63);
          else pdf.setTextColor(176, 38, 38);
        } else if (i === 2) {
          if (!task.isApplicable) pdf.setTextColor(102, 102, 102);
          else if (progressValue >= 100) pdf.setTextColor(16, 121, 63);
          else if (progressValue >= 50) pdf.setTextColor(23, 92, 211);
          else pdf.setTextColor(178, 105, 0);
        } else {
          pdf.setTextColor(0, 0, 0);
        }

        lines.forEach((ln) => {
          pdf.text(ln, x + 2, ty + 3);
          ty += lineHeight;
        });
        pdf.setTextColor(0, 0, 0);
        x += col.width;
      }
      y += rowHeight;
      rowIndex++;
    }

    // Statistiques de bas de page
    if (y > pageHeight - margin - 24) {
      pdf.addPage();
      y = margin;
      drawTopHeader(false);
    }
    pdf.setFont("helvetica", "bold");
    pdf.text("Statistiques", margin, y + 8);
    pdf.setFont("helvetica", "normal");
    const stats = [
      `Tâches exportées: ${tasks.length}`,
      `Terminées: ${tasks.filter((t) => t.isApplicable && (t.progress || 0) >= 100).length}`,
      `En cours: ${tasks.filter((t) => t.isApplicable && (t.progress || 0) > 0 && (t.progress || 0) < 100).length}`,
      `À faire: ${tasks.filter((t) => t.isApplicable && (t.progress || 0) === 0).length}`,
    ];
    let sy = y + 14;
    for (const s of stats) {
      if (sy > pageHeight - margin) {
        pdf.addPage();
        sy = margin;
        drawTopHeader(false);
        pdf.setFont("helvetica", "bold");
        pdf.text("Statistiques", margin, sy + 8);
        pdf.setFont("helvetica", "normal");
        sy += 14;
      }
      pdf.text(`• ${s}`, margin, sy);
      sy += 6;
    }

    // Pagination pied de page
    const totalPages = pdf.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      pdf.setFontSize(10);
      if (i > 1) {
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(120, 162, 224);
        pdf.text(`Rapport ${dao?.numeroListe || ""}`, margin, ph - 8, {
          align: "left",
        });
        pdf.setTextColor(0, 0, 0);
      }
      pdf.setFont("helvetica", "normal");
      pdf.text(`${i} / ${totalPages}`, pw - margin, ph - 8, { align: "right" });
    }

    pdf.save(`${dao?.numeroListe}_export.pdf`);
  };

  // Export CSV
  const handleExportCSV = (tasks: DaoTask[]) => {
    const csvContent = [
      ["Tâche", "Applicable", "Progression (%)", "Commentaire", "Assigné à"],
      ...tasks.map((task) => [
        task.name,
        task.isApplicable ? "Oui" : "Non",
        task.isApplicable ? (task.progress || 0).toString() : "N/A",
        task.comment || "",
        task.assignedTo && task.assignedTo.length
          ? task.assignedTo
              .map(
                (id) => dao?.equipe.find((m) => m.id === id)?.name || "Inconnu",
              )
              .join(", ")
          : "Non assigné",
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${dao?.numeroListe}_tasks.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Édition de l'autorité contractante
  const handleStartEditingAuthority = () => {
    setTempAuthority(dao?.autoriteContractante || "");
    setIsEditingAuthority(true);
  };
  const handleSaveAuthority = async () => {
    const next = tempAuthority.trim();
    if (!dao || !next) return;
    // Stage locally only; persist on global Valider
    setDao((prev) => (prev ? { ...prev, autoriteContractante: next } : prev));
    markDirty();
    setIsEditingAuthority(false);
  };
  const handleCancelEditingAuthority = () => {
    setTempAuthority("");
    setIsEditingAuthority(false);
  };

  // Édition de la référence
  const handleStartEditingReference = () => {
    setTempReference(dao?.reference || "");
    setIsEditingReference(true);
  };
  const handleSaveReference = async () => {
    const next = tempReference.trim();
    if (!dao || !next) return;
    // Stage locally only; persist on global Valider
    setDao((prev) => (prev ? { ...prev, reference: next } : prev));
    markDirty();
    setIsEditingReference(false);
  };
  const handleCancelEditingReference = () => {
    setTempReference("");
    setIsEditingReference(false);
  };

  // Édition de l'objet du dossier
  const handleStartEditingObjet = () => {
    setTempObjet(dao?.objetDossier || "");
    setIsEditingObjet(true);
  };
  const handleSaveObjet = async () => {
    const next = tempObjet.trim();
    if (!dao || !next) return;
    // Stage locally only; persist on global Valider
    setDao((prev) => (prev ? { ...prev, objetDossier: next } : prev));
    markDirty();
    setIsEditingObjet(false);
  };
  const handleCancelEditingObjet = () => {
    setTempObjet("");
    setIsEditingObjet(false);
  };

  // Utilitaires d'affichage
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const daysDiff = Math.ceil(
      (date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );
    const formattedDate = date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    return {
      date: formattedDate,
      daysDiff: daysDiff,
      daysDiffAbs: Math.abs(daysDiff),
      isOverdue: daysDiff < 0,
    };
  };

  const dateInfo = formatDate(dao.dateDepot);
  const completedTasks = dao.tasks.filter(
    (task) => task.isApplicable && (task.progress || 0) >= 100,
  ).length;
  const inProgressTasks = dao.tasks.filter(
    (task) =>
      task.isApplicable &&
      (task.progress || 0) > 0 &&
      (task.progress || 0) < 100,
  ).length;
  const todoTasks = dao.tasks.filter(
    (task) => task.isApplicable && (task.progress || 0) === 0,
  ).length;
  const applicableTasks = dao.tasks.filter((task) => task.isApplicable).length;

  const handleValidate = async () => {
    if (!dao) return;
    try {
      const updated = await apiService.updateDao(dao.id, dao);
      setDao(updated);
      markSaved();
      setStagedComments({});
      toast({
        title: "Modifications validées",
        description: "Les changements ont été enregistrés.",
      });
      try {
        await refreshNotifications();
      } catch {}
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Échec de la validation des modifications";
      setError(message);
      toast({
        title: "Échec de la validation",
        description: message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* En-tête */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-2 sm:px-4 py-3 sm:py-4">
          {/* Mobile & Tablette */}
          <div className="block lg:hidden">
            {/* Ligne haute: Retour • Exporter • % */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="flex-shrink-0"
              >
                <Link to="/">
                  <ArrowLeft className="h-4 w-4" />
                  <span className="ml-1 text-sm">Retour</span>
                </Link>
              </Button>
              <div className="flex items-center gap-2">
                <Badge variant="destructive" className="text-xs font-bold">
                  {progress}% terminé
                </Badge>
                <ExportFilterDialog
                  tasks={dao.tasks}
                  onExport={handleExportWithOptions}
                >
                  <Button variant="outline" size="sm" className="px-3 h-8">
                    <Download className="h-4 w-4 mr-1" />
                    <span className="text-sm">Exporter</span>
                  </Button>
                </ExportFilterDialog>
              </div>
            </div>

            {/* Ligne basse: Titre + référence */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText className="h-4 w-4 text-blue-600" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-bold truncate">Détails DAO</h1>
                <p className="text-xs text-muted-foreground truncate">
                  {dao.numeroListe} • {dao.reference}
                </p>
              </div>
            </div>
          </div>

          {/* Desktop */}
          <div className="hidden lg:block">
            {/* Ligne haute: Retour • Exporter • % */}
            <div className="flex items-center justify-between mb-2">
              <Button variant="ghost" size="sm" asChild>
                <Link to="/">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Retour
                </Link>
              </Button>
              <div className="flex items-center gap-3">
                <Badge variant="destructive" className="text-sm font-bold">
                  {progress}% terminé
                </Badge>
                <ExportFilterDialog
                  tasks={dao.tasks}
                  onExport={handleExportWithOptions}
                >
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Exporter
                  </Button>
                </ExportFilterDialog>
              </div>
            </div>
            {/* Ligne basse: Titre + référence */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h1 className="text-lg lg:text-xl font-bold">Détails DAO</h1>
                <p className="text-sm text-muted-foreground">
                  {dao.numeroListe} • {dao.reference}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-2 sm:px-4 py-4 sm:py-6">
        {/* Informations du DAO */}
        <Card className="mb-6 sm:mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                {isEditingObjet ? (
                  <div className="space-y-2">
                    <Input
                      value={tempObjet}
                      onChange={(e) => setTempObjet(e.target.value)}
                      placeholder="Saisir l'objet du dossier..."
                      className="font-medium"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveObjet}>
                        Sauvegarder
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancelEditingObjet}
                      >
                        Annuler
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <CardTitle className="text-lg md:text-xl">
                      {dao.objetDossier}
                    </CardTitle>
                    {isAdmin() && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={handleStartEditingObjet}
                        aria-label="Modifier l'objet du dossier"
                      >
                        <Edit3 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-muted-foreground">
                    Référence
                  </Label>
                  {!isEditingReference && isAdmin() && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={handleStartEditingReference}
                    >
                      <Edit3 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                {isEditingReference ? (
                  <div className="space-y-2">
                    <Input
                      value={tempReference}
                      onChange={(e) => setTempReference(e.target.value)}
                      placeholder="Saisir la référence..."
                      className="font-medium"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveReference}>
                        Sauvegarder
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancelEditingReference}
                      >
                        Annuler
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="font-medium break-words">{dao.reference}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">
                  Date de dépôt
                </Label>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "px-2 py-1 rounded text-sm font-medium blink-attention",
                      getBlinkingDateClasses(progress, dao.dateDepot),
                    )}
                  >
                    {dateInfo.date} ({dateInfo.daysDiffAbs}j{" "}
                    {dateInfo.isOverdue ? "dépassé" : "restants"})
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-muted-foreground">
                    Autorité contractante
                  </Label>
                  {!isEditingAuthority && isAdmin() && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={handleStartEditingAuthority}
                    >
                      <Edit3 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                {isEditingAuthority ? (
                  <div className="space-y-2">
                    <Input
                      value={tempAuthority}
                      onChange={(e) => setTempAuthority(e.target.value)}
                      placeholder="Saisir l'autorité contractante..."
                      className="font-medium"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveAuthority}>
                        Sauvegarder
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancelEditingAuthority}
                      >
                        Annuler
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="font-medium">{dao.autoriteContractante}</p>
                )}
              </div>
            </div>

            <Separator className="my-6" />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Avancement global</span>
                <span className="text-2xl font-bold">{progress}%</span>
              </div>
              <Progress
                value={progress}
                className={cn(
                  "h-4",
                  progress === 100 ? "[&>*]:bg-gray-400" : "",
                )}
              />

              <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center">
                <div>
                  <div className="text-xl md:text-2xl font-bold text-green-600">
                    {completedTasks}
                  </div>
                  <div className="text-xs text-muted-foreground">Terminées</div>
                </div>
                <div>
                  <div className="text-xl md:text-2xl font-bold text-blue-600">
                    {inProgressTasks}
                  </div>
                  <div className="text-xs text-muted-foreground">En cours</div>
                </div>
                <div>
                  <div className="text-xl md:text-2xl font-bold text-gray-600">
                    {todoTasks}
                  </div>
                  <div className="text-xs text-muted-foreground">À faire</div>
                </div>
              </div>
            </div>

            <Separator className="my-6" />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Chef d'équipe</Label>
                {isAdmin() && (
                  <TeamEditDialog
                    currentTeam={dao.equipe}
                    onTeamUpdate={handleTeamUpdate}
                    type="both"
                  />
                )}
              </div>
              <p className="font-medium break-words">
                {dao.equipe.find((m) => m.role === "chef_equipe")?.name ||
                  "Non assigné"}
              </p>

              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Membres d'équipe</Label>
              </div>
              <div className="space-y-2">
                {dao.equipe
                  .filter((m) => m.role === "membre_equipe")
                  .map((member) => (
                    <div
                      key={member.id}
                      className="flex flex-col sm:flex-row sm:items-center gap-2"
                    >
                      <span className="font-medium break-words">
                        {member.name}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Détail des tâches */}
        <Card>
          <CardHeader>
            <CardTitle>Détail des tâches</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="space-y-3 sm:space-y-4">
              {dao.tasks.map((task, index) => {
                const displayIndex = index + 1;
                const staged = stagedComments[task.id] || [];
                return (
                  <TaskRow
                    key={task.id}
                    task={task}
                    daoId={dao.id}
                    onProgressChange={handleTaskProgressChange}
                    onCommentChange={handleTaskCommentChange}
                    onApplicableChange={handleTaskApplicableChange}
                    onAssignmentChange={handleTaskAssignmentChange}
                    onTaskUpdate={handleTaskUpdate}
                    availableMembers={dao.equipe}
                    daysDiff={dateInfo.daysDiff}
                    taskIndex={displayIndex}
                    stagingMode={true}
                    stagedComments={staged}
                    onStageComment={(taskId, c) => {
                      setStagedComments((prev) => {
                        const arr = prev[taskId] || [];
                        const exist = arr.some((x) => x.id === c.id);
                        const nextArr = exist ? arr : [c, ...arr];
                        return { ...prev, [taskId]: nextArr };
                      });
                    }}
                    onUnstageComment={(taskId, id) => {
                      setStagedComments((prev) => {
                        const arr = prev[taskId] || [];
                        const nextArr = arr.filter((x) => x.id !== id);
                        if (!nextArr.length) {
                          const { [taskId]: _, ...rest } = prev;
                          return rest as Record<number, TaskComment[]>;
                        }
                        return { ...prev, [taskId]: nextArr };
                      });
                    }}
                  />
                );
              })}
            </div>

            {/* Total des tâches applicables */}
            <div className="flex justify-center pt-4 mt-4 border-t border-gray-200">
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-gray-700">
                  Total :
                </span>
                <span className="text-sm font-bold text-primary">
                  {applicableTasks} tâches applicables
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 flex flex-row flex-nowrap gap-4 justify-center items-center">
          {isAdmin() && isLastDao && (
            <div className="flex justify-center">
              <DeleteLastDaoButton
                hasDaos={true}
                disabled={hasPendingChanges}
                onDeleted={() => {
                  navigate("/");
                }}
              />
            </div>
          )}

          <div className="flex justify-center">
            <Button
              type="button"
              onClick={handleValidate}
              disabled={!hasPendingChanges}
              aria-label="Valider"
              className={`h-12 w-36 flex items-center justify-center gap-2 px-3 bg-blue-600 hover:bg-blue-700 text-white ${
                !hasPendingChanges ? "opacity-60 cursor-not-allowed" : ""
              }`}
            >
              <CheckCircle className="h-5 w-5" />
              <span className="text-sm font-medium text-white">Valider</span>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

function Label({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <label className={className}>{children}</label>;
}
