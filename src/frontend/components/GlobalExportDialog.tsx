/**
Rôle: Composant applicatif — src/frontend/components/GlobalExportDialog.tsx
Domaine: Frontend/Components
Exports: GlobalExportDialog
Dépendances: react, lucide-react, @/components/ui/button, @/components/ui/checkbox, @/components/ui/separator, @/components/ui/badge
Liens: ui/* (atomes), hooks, contexts, services côté client
Performance: cache/partitionnement/bundling optimisés
*/
import { useState } from "react";
import { FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  type Dao,
  calculateDaoStatus,
  calculateDaoProgress,
} from "@shared/dao";
import jsPDF from "jspdf";

type ExportFormat = "PDF" | "CSV";

interface GlobalExportOptions {
  includeCompleted: boolean;
  includeInProgress: boolean;
  includeAtRisk: boolean;
  format: ExportFormat;
}

interface GlobalExportDialogProps {
  daos: Dao[];
  children: React.ReactNode;
}

export default function GlobalExportDialog({
  daos,
  children,
}: GlobalExportDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<GlobalExportOptions>({
    includeCompleted: true,
    includeInProgress: true,
    includeAtRisk: true,
    format: "PDF",
  });

  // Calculer les statistiques des DAOs
  const completedDaos = daos.filter((dao) => {
    const progress = calculateDaoProgress(dao.tasks);
    const status = calculateDaoStatus(dao.dateDepot, progress);
    return status === "completed";
  });

  const inProgressDaos = daos.filter((dao) => {
    const progress = calculateDaoProgress(dao.tasks);
    const status = calculateDaoStatus(dao.dateDepot, progress);
    return status === "safe" || status === "default";
  });

  const atRiskDaos = daos.filter((dao) => {
    const progress = calculateDaoProgress(dao.tasks);
    const status = calculateDaoStatus(dao.dateDepot, progress);
    return status === "urgent";
  });

  const handleExport = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const filteredDaos = daos.filter((dao) => {
      const progress = calculateDaoProgress(dao.tasks);
      const status = calculateDaoStatus(dao.dateDepot, progress);

      if (status === "completed" && !options.includeCompleted) return false;
      if (status === "urgent" && !options.includeAtRisk) return false;
      if (
        (status === "safe" || status === "default") &&
        !options.includeInProgress
      )
        return false;

      return true;
    });

    if (options.format === "PDF") {
      exportToPDF(filteredDaos);
    } else {
      exportToCSV(filteredDaos);
    }

    setIsOpen(false);
  };

  const exportToPDF = async (filteredDaos: Dao[]) => {
    const pdf = new jsPDF({ orientation: "landscape" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 14;
    let y = margin;

    // Assets and helpers for top header
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
            if (!ctx) return reject(new Error("Canvas context not available"));
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
                if (r > 240 && g > 240 && b > 240) d[i + 3] = 0; // make near-white transparent
              }
              ctx.putImageData(imageData, 0, 0);
            } catch {}
            resolve({
              dataUrl: canvas.toDataURL("image/png"),
              width: img.naturalWidth,
              height: img.naturalHeight,
            });
          };
          img.onerror = () => reject(new Error("Échec du chargement du logo"));
          img.src = url;
        },
      );
    const logo = await loadImageAsPngDataUrl(LOGO_URL).catch(() => null);

    const drawTopHeader = () => {
      y = margin;
      if (logo) {
        const logoW = 34;
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
        y += logoH + 12;
      }

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(20);
      pdf.text("Liste des DAO", pageWidth / 2, y, { align: "center" });
      y += 12;

      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
      pdf.text(
        `Date d'export: ${new Date().toLocaleDateString("fr-FR")}`,
        pageWidth / 2,
        y,
        { align: "center" },
      );
      y += 10;

      const statsLine = `Total: ${filteredDaos.length}  •  Terminés: ${filteredDaos.filter((d) => calculateDaoStatus(d.dateDepot, calculateDaoProgress(d.tasks)) === "completed").length}  •  En cours: ${
        filteredDaos.filter((d) => {
          const s = calculateDaoStatus(
            d.dateDepot,
            calculateDaoProgress(d.tasks),
          );
          return s === "safe" || s === "default";
        }).length
      }  •  À risque: ${filteredDaos.filter((d) => calculateDaoStatus(d.dateDepot, calculateDaoProgress(d.tasks)) === "urgent").length}`;
      const statsLines = pdf.splitTextToSize(statsLine, pageWidth - margin * 2);
      statsLines.forEach((line: string) => {
        pdf.text(line, pageWidth / 2, y, { align: "center" });
        y += 6;
      });
      y += 4;
    };

    // Table columns (precise widths to avoid overflow)
    const contentWidth = pageWidth - margin * 2 - 1; // safety pixel to avoid clipping
    const widths = [0.12, 0.3, 0.12, 0.18, 0.1, 0.08, 0.1].map((f, i, arr) =>
      i < arr.length - 1 ? Math.floor(contentWidth * f) : 0,
    );
    const sumBeforeLast = widths.slice(0, -1).reduce((a, b) => a + b, 0);
    widths[widths.length - 1] = contentWidth - sumBeforeLast;

    const columns = [
      { header: "Numéro", width: widths[0] },
      { header: "Objet", width: widths[1] },
      { header: "Référence", width: widths[2] },
      { header: "Autorité", width: widths[3] },
      { header: "Date", width: widths[4] },
      { header: "Statut", width: widths[5] },
      { header: "Progression", width: widths[6] },
    ];

    const drawHeader = () => {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      let x = margin;
      const h = 9;
      pdf.setFillColor(232, 240, 254);
      pdf.rect(x, y, contentWidth, h, "F");
      columns.forEach((c) => {
        pdf.rect(x, y, c.width, h, "S");
        pdf.text(c.header, x + 2, y + 6);
        x += c.width;
      });
      y += h;
      pdf.setFont("helvetica", "normal");
    };

    const ensureSpace = (rowHeight: number) => {
      if (y + rowHeight > pageHeight - margin) {
        pdf.addPage();
        drawTopHeader();
        drawHeader();
      }
    };

    drawTopHeader();
    drawHeader();

    const lineHeight = 5;
    let rowIndex = 0;
    for (const dao of filteredDaos) {
      const progress = calculateDaoProgress(dao.tasks);
      const status = calculateDaoStatus(dao.dateDepot, progress);
      const statusText =
        status === "completed"
          ? "Terminé"
          : status === "urgent"
            ? "À risque"
            : "En cours";

      const row = [
        dao.numeroListe,
        dao.objetDossier,
        dao.reference,
        dao.autoriteContractante,
        dao.dateDepot,
        statusText,
        `${progress}%`,
      ];

      const wrapped = row.map((cell, i) =>
        pdf.splitTextToSize(String(cell), columns[i].width - 4),
      );
      const rowHeight =
        Math.max(...wrapped.map((w) => w.length)) * lineHeight + 4;
      ensureSpace(rowHeight);

      // Zebra background rows & soft colors
      if (rowIndex % 2 === 0) {
        pdf.setFillColor(249, 251, 255);
        pdf.rect(margin, y, contentWidth, rowHeight, "F");
      }

      let x = margin;
      for (let i = 0; i < columns.length; i++) {
        const col = columns[i];
        pdf.rect(x, y, col.width, rowHeight, "S");
        let ty = y + 3.5;

        // Color coding similar to DAO spécifique
        if (i === 5) {
          if (status === "completed") pdf.setTextColor(16, 121, 63);
          else if (status === "urgent") pdf.setTextColor(176, 38, 38);
          else pdf.setTextColor(23, 92, 211);
        } else if (i === 6) {
          if (progress >= 100) pdf.setTextColor(16, 121, 63);
          else if (progress >= 50) pdf.setTextColor(23, 92, 211);
          else pdf.setTextColor(178, 105, 0);
        } else {
          pdf.setTextColor(0, 0, 0);
        }

        (wrapped[i] as string[]).forEach((ln) => {
          pdf.text(ln, x + 2, ty + 3);
          ty += lineHeight;
        });
        pdf.setTextColor(0, 0, 0);
        x += col.width;
      }
      y += rowHeight;
      rowIndex++;
    }

    // Footer page numbers (bottom-right)
    const totalPages = pdf.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(`${i} / ${totalPages}`, pw - margin, ph - 8, { align: "right" });
    }

    pdf.save(`export_daos_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  const exportToCSV = (filteredDaos: Dao[]) => {
    const csvContent = [
      [
        "Numéro DAO",
        "Objet",
        "Référence",
        "Autorité",
        "Date de dépôt",
        "Statut",
        "Progression (%)",
        "Chef d'équipe",
        "Membres d'équipe",
      ],
      ...filteredDaos.map((dao) => {
        const progress = calculateDaoProgress(dao.tasks);
        const status = calculateDaoStatus(dao.dateDepot, progress);

        let statusText = "";
        switch (status) {
          case "completed":
            statusText = "Terminé";
            break;
          case "urgent":
            statusText = "À risque";
            break;
          case "safe":
            statusText = "En cours (sûr)";
            break;
          case "default":
            statusText = "En cours";
            break;
        }

        const chef =
          dao.equipe.find((m) => m.role === "chef_equipe")?.name ||
          "Non assigné";
        const membres = dao.equipe
          .filter((m) => m.role === "membre_equipe")
          .map((m) => m.name)
          .join("; ");

        return [
          dao.numeroListe,
          dao.objetDossier,
          dao.reference,
          dao.autoriteContractante,
          dao.dateDepot,
          statusText,
          progress.toString(),
          chef,
          membres,
        ];
      }),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `export_daos_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFormatChange = (format: ExportFormat) => {
    setOptions((prev) => ({ ...prev, format }));
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
  };

  const getSelectedDaosCount = () => {
    let count = 0;
    if (options.includeCompleted) count += completedDaos.length;
    if (options.includeInProgress) count += inProgressDaos.length;
    if (options.includeAtRisk) count += atRiskDaos.length;
    return count;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <span>{children}</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Global des DAOs
          </DialogTitle>
          <DialogDescription>
            Exportez tous les DAOs selon leur statut au format PDF ou CSV.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Format Selection */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Format d'export</h4>
            <div className="flex gap-2">
              <Button
                variant={options.format === "PDF" ? "default" : "outline"}
                size="sm"
                onClick={() => handleFormatChange("PDF")}
                className="flex-1"
              >
                <FileText className="h-4 w-4 mr-2" />
                PDF
              </Button>
              <Button
                variant={options.format === "CSV" ? "default" : "outline"}
                size="sm"
                onClick={() => handleFormatChange("CSV")}
                className="flex-1"
              >
                <FileText className="h-4 w-4 mr-2" />
                CSV
              </Button>
            </div>
          </div>

          <Separator />

          {/* Status Filters */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Statut des DAOs à inclure</h4>

            <div className="space-y-3">
              {/* Terminées */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="completed"
                    checked={options.includeCompleted}
                    onCheckedChange={(checked) =>
                      setOptions((prev) => ({
                        ...prev,
                        includeCompleted: checked as boolean,
                      }))
                    }
                  />
                  <label
                    htmlFor="completed"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Terminées
                  </label>
                </div>
                <Badge
                  variant="secondary"
                  className="text-xs bg-dao-completed text-white"
                >
                  {completedDaos.length}
                </Badge>
              </div>

              {/* En cours */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="inprogress"
                    checked={options.includeInProgress}
                    onCheckedChange={(checked) =>
                      setOptions((prev) => ({
                        ...prev,
                        includeInProgress: checked as boolean,
                      }))
                    }
                  />
                  <label
                    htmlFor="inprogress"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    En cours
                  </label>
                </div>
                <Badge
                  variant="secondary"
                  className="text-xs bg-dao-safe text-white"
                >
                  {inProgressDaos.length}
                </Badge>
              </div>

              {/* À risque */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="atrisk"
                    checked={options.includeAtRisk}
                    onCheckedChange={(checked) =>
                      setOptions((prev) => ({
                        ...prev,
                        includeAtRisk: checked as boolean,
                      }))
                    }
                  />
                  <label
                    htmlFor="atrisk"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    À risque
                  </label>
                </div>
                <Badge
                  variant="secondary"
                  className="text-xs bg-dao-urgent text-white"
                >
                  {atRiskDaos.length}
                </Badge>
              </div>
            </div>
          </div>

          <Separator />

          {/* Summary */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">DAOs sélectionnés:</span>
              <span className="font-medium">
                {getSelectedDaosCount()} / {daos.length}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsOpen(false);
            }}
          >
            Annuler
          </Button>
          <Button
            onClick={handleExport}
            disabled={getSelectedDaosCount() === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Exporter {options.format}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type { GlobalExportOptions };
