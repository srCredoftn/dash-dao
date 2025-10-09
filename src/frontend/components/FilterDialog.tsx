/**
Rôle: Composant applicatif — src/frontend/components/FilterDialog.tsx
Domaine: Frontend/Components
Exports: FilterDialog
Dépendances: react, @/components/ui/button, @/components/ui/input, @/components/ui/label, @/components/ui/badge, @/components/ui/separator, @shared/dao
Liens: ui/* (atomes), hooks, contexts, services côté client
Sécurité: veille à la validation d’entrée, gestion JWT/refresh, et limites de débit
*/
import { useState, useEffect } from "react";
import {
  Filter,
  X,
  Calendar,
  Building2,
  Users,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { type DaoFilters } from "@shared/dao";

interface FilterDialogProps {
  filters: DaoFilters;
  onFiltersChange: (filters: DaoFilters) => void;
  availableAuthorities: string[];
  availableTeamMembers: string[];
}

export default function FilterDialog({
  filters,
  onFiltersChange,
  availableAuthorities,
  availableTeamMembers,
}: FilterDialogProps) {
  const [open, setOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState<DaoFilters>(filters);
  const [dateError, setDateError] = useState<string>("");

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  // Validate date range whenever it changes
  useEffect(() => {
    const start = localFilters.dateRange?.start;
    const end = localFilters.dateRange?.end;
    if (start && end && start > end) {
      setDateError(
        "La date de début doit être antérieure ou égale à la date de fin.",
      );
    } else {
      setDateError("");
    }
  }, [localFilters.dateRange?.start, localFilters.dateRange?.end]);

  const handleApplyFilters = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Block apply if invalid date range
    if (dateError) return;
    onFiltersChange(localFilters);
    setOpen(false);
  };

  const handleClearFilters = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const emptyFilters: DaoFilters = {};
    setLocalFilters(emptyFilters);
    onFiltersChange(emptyFilters);
    setOpen(false);
  };

  const hasActiveFilters = () => {
    return (
      Object.keys(filters).length > 0 &&
      Object.values(filters).some(
        (value) =>
          value !== undefined &&
          value !== "" &&
          (typeof value !== "object" || Object.keys(value).length > 0),
      )
    );
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.dateRange?.start && filters.dateRange?.end) count++;
    if (filters.autoriteContractante) count++;
    if (filters.statut) count++;
    if (filters.equipe) count++;
    return count;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="relative w-full xs:w-auto lg:w-32"
        >
          <Filter className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline ml-2">Filtres</span>
          {hasActiveFilters() && (
            <Badge
              variant="destructive"
              className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {getActiveFiltersCount()}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Filtrer les DAO</DialogTitle>
          <DialogDescription>
            Appliquez des filtres pour affiner la liste des dossiers
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Date Range Filter */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Période de dépôt
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label
                  htmlFor="dateStart"
                  className="text-xs text-muted-foreground"
                >
                  Du
                </Label>
                <Input
                  id="dateStart"
                  type="date"
                  value={localFilters.dateRange?.start || ""}
                  max={localFilters.dateRange?.end || undefined}
                  onChange={(e) =>
                    setLocalFilters((prev) => ({
                      ...prev,
                      dateRange: {
                        start: e.target.value,
                        end: prev.dateRange?.end || "",
                      },
                    }))
                  }
                />
              </div>
              <div>
                <Label
                  htmlFor="dateEnd"
                  className="text-xs text-muted-foreground"
                >
                  Au
                </Label>
                <Input
                  id="dateEnd"
                  type="date"
                  value={localFilters.dateRange?.end || ""}
                  min={localFilters.dateRange?.start || undefined}
                  onChange={(e) =>
                    setLocalFilters((prev) => ({
                      ...prev,
                      dateRange: {
                        start: prev.dateRange?.start || "",
                        end: e.target.value,
                      },
                    }))
                  }
                />
              </div>
              {dateError && <p className="text-xs text-red-600">{dateError}</p>}
            </div>
          </div>

          <Separator />

          {/* Authority Filter */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Autorité contractante
            </Label>
            <Select
              value={localFilters.autoriteContractante || "all"}
              onValueChange={(value) =>
                setLocalFilters((prev) => ({
                  ...prev,
                  autoriteContractante: value === "all" ? undefined : value,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Toutes les autorités" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les autorités</SelectItem>
                {availableAuthorities.map((authority) => (
                  <SelectItem key={authority} value={authority}>
                    {authority}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Status Filter */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Statut
            </Label>
            <Select
              value={localFilters.statut || "all"}
              onValueChange={(value) =>
                setLocalFilters((prev) => ({
                  ...prev,
                  statut:
                    value === "all"
                      ? undefined
                      : (value as "en_cours" | "termine" | "a_risque"),
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Tous les statuts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="en_cours">En cours</SelectItem>
                <SelectItem value="termine">Terminé</SelectItem>
                <SelectItem value="a_risque">À risque (≤ 3 jours)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Team Filter */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Équipe
            </Label>
            <Select
              value={localFilters.equipe || "all"}
              onValueChange={(value) =>
                setLocalFilters((prev) => ({
                  ...prev,
                  equipe: value === "all" ? undefined : value,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Toutes les équipes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les équipes</SelectItem>
                {Array.from(new Set(availableTeamMembers)).map(
                  (member, idx) => (
                    <SelectItem key={`${member}-${idx}`} value={member}>
                      {member}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={handleClearFilters}>
            <X className="h-4 w-4 mr-2" />
            Effacer
          </Button>
          <Button onClick={handleApplyFilters}>Appliquer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
