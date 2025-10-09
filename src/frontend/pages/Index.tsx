/*
  Page Index / Dashboard
  - useState: pour états UI (recherche, dialogues ouverts)
  - useEffect: initialisation et effets dépendants (ex: préchargement)
  Ces hooks sont utilisés pour maintenir la réactivité sans surcharger le store global.
*/
import { useState, useEffect } from "react";
/**
 * Tableau de bord des DAO
 * Rôle: afficher statistiques, recherche/filtre, liste des DAO et actions (création, export).
 * Perf: debouncing de recherche, cache API, composants optimisés.
 */
import { useNavigate } from "react-router-dom";
import { useDebounce } from "@/hooks/use-performance";
import {
  Search,
  Calendar,
  Users,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  User,
  ChevronDown,
  ChevronUp,
  Download,
} from "lucide-react";
import NewDaoDialog from "@/components/NewDaoDialog";
import FilterDialog from "@/components/FilterDialog";
import GlobalExportDialog from "@/components/GlobalExportDialog";
import { AppHeader } from "@/components/AppHeader";
import { StatsCard } from "@/components/StatsCard";
import { useAuth } from "@/contexts/AuthContext";
import { useDaoStats } from "@/hooks/use-dao-stats";
import { useDaoFilters } from "@/hooks/use-dao-filters";
import { devLog } from "@/utils/devLogger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn, getBlinkingDateClasses } from "@/lib/utils";
import { GRID_CLASSES } from "@/types/responsive";
import { apiService } from "@/services/api";
import { cacheService } from "@/services/cacheService";
import { testProgressCalculations } from "@/utils/test-calculations";
import { testGlobalStatistics } from "@/utils/test-global-stats";
import { runAllTests } from "@/utils/test-dao-functionality";
import {
  calculateDaoStatus,
  calculateDaoProgress,
  type Dao,
  type DaoStatus,
  type DaoFilters,
} from "@shared/dao";
import OptimizedDaoCard from "@/components/OptimizedDaoCard";

/**
 * getStatusBadgeVariant — mapping statut → variante visuelle de Badge
 */
function getStatusBadgeVariant(
  status: DaoStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "completed":
      return "secondary";
    case "urgent":
      return "destructive";
    case "safe":
      return "default";
    case "default":
      return "outline";
  }
}

/**
 * getStatusLabel — traduction lisible du statut
 */
function getStatusLabel(status: DaoStatus): string {
  switch (status) {
    case "completed":
      return "Terminé";
    case "urgent":
      return "À risque";
    case "safe":
      return "En cours";
    case "default":
      return "En cours";
  }
}

/**
 * Composant carte (version non utilisée, laissée pour référence historique)
 */
export function DaoCard_removed({ dao }: { dao: Dao }) {
  const progress = calculateDaoProgress(dao.tasks);
  const status = calculateDaoStatus(dao.dateDepot, progress);
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  // Navigation au clic (sauf si clic sur action marquée data-no-navigate)
  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("[data-no-navigate]")) {
      return;
    }
    navigate(`/dao/${dao.id}`);
  };

  return (
    <Card
      className="hover:shadow-md transition-shadow relative group cursor-pointer"
      onClick={handleCardClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <CardTitle className="text-lg font-semibold">
              {dao.numeroListe}
            </CardTitle>
            <CardDescription
              className="text-sm font-medium line-clamp-2"
              title={dao.objetDossier}
            >
              {dao.objetDossier}
            </CardDescription>
          </div>
          <Badge variant={getStatusBadgeVariant(status)}>
            {getStatusLabel(status)}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Toujours visible: Date et Progression */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Date de dépôt:</span>
            <span
              className={cn(
                "px-2 py-1 rounded text-xs font-medium blink-attention",
                getBlinkingDateClasses(progress, dao.dateDepot),
              )}
            >
              {formatDate(dao.dateDepot)}
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progression:</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress
              value={progress}
              className={cn("h-2", progress === 100 ? "[&>*]:bg-gray-400" : "")}
            />
          </div>
        </div>

        {/* Bouton mobile: déplier/replier */}
        <div className="md:hidden">
          <Button
            variant="ghost"
            size="sm"
            className="w-full flex items-center gap-2 text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            data-no-navigate
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4" />
                Moins d'infos
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                Plus d'infos
              </>
            )}
          </Button>
        </div>

        {/* Contenu repliable (mobile) / Toujours visible sur desktop */}
        <div
          className={cn(
            "space-y-3 sm:space-y-4",
            "md:block",
            isExpanded ? "block" : "hidden",
          )}
        >
          {/* Références */}
          <div className="space-y-3">
            <div className="text-sm">
              <span className="text-muted-foreground block mb-1">
                Référence:
              </span>
              <p className="font-medium break-words" title={dao.reference}>
                {dao.reference}
              </p>
            </div>

            <div className="text-sm">
              <span className="text-muted-foreground block mb-1">
                Autorité Contractante:
              </span>
              <p
                className="font-medium break-words"
                title={dao.autoriteContractante}
              >
                {dao.autoriteContractante}
              </p>
            </div>
          </div>

          {/* Équipe */}
          <div className="space-y-3 pt-3 border-t border-border">
            {/* Chef d'équipe */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                <User className="h-4 w-4 text-gray-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground mb-0.5">
                  Chef d'équipe
                </p>
                <p
                  className="text-sm font-medium text-foreground break-words"
                  title={
                    dao.equipe.find((m) => m.role === "chef_equipe")?.name ||
                    "Non assigné"
                  }
                >
                  {dao.equipe.find((m) => m.role === "chef_equipe")?.name ||
                    "Non assigné"}
                </p>
              </div>
            </div>

            {/* Membres */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Users className="h-4 w-4 text-gray-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground mb-0.5">
                  Membres d'équipe
                </p>
                <p className="text-sm font-medium text-foreground">
                  {dao.equipe.filter((m) => m.role === "membre_equipe").length}{" "}
                  membre
                  {dao.equipe.filter((m) => m.role === "membre_equipe").length >
                  1
                    ? "s"
                    : ""}
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Index() {
  // États principaux: recherche, liste, chargement, erreur, filtres
  const [searchTerm, setSearchTerm] = useState("");
  const [daos, setDaos] = useState<Dao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<DaoFilters>({});

  // Debounce pour limiter les recalculs sur saisie
  useDebounce(searchTerm, 300);
  const { user, isAdmin, isLoading: authLoading, isAuthenticated } = useAuth();

  // Chargement initial des DAO (attend l'état d'auth prêt)
  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      setDaos([]);
      setLoading(false);
      return;
    }

    const loadDaos = async () => {
      try {
        setLoading(true);
        setError(null);
        const fetchedDaos = await apiService.getAllDaos();
        setDaos(fetchedDaos);

        // Tests de calculs en développement
        if (process.env.NODE_ENV === "development") {
          testProgressCalculations();
          testGlobalStatistics();
        }
      } catch (err) {
        devLog.error("Erreur lors du chargement des DAO:", err);
        setError("Échec du chargement des DAO");
      } finally {
        setLoading(false);
      }
    };

    loadDaos();
  }, [authLoading, isAuthenticated]);

  // Raccourcis de développement (Ctrl+Shift+T/C)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === "T") {
        devLog.clear();
        devLog.log("▶️ Exécution des tests de fonctionnalité...\n");
        runAllTests();
      }

      if (event.ctrlKey && event.shiftKey && event.key === "C") {
        devLog.log("🧹 Nettoyage du cache des DAO...");
        cacheService.invalidatePattern("dao");
        cacheService.clear();
        devLog.log("✅ Cache nettoyé, rechargement des DAO...");
        window.location.reload();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Création d’un nouveau DAO
  const handleCreateDao = async (
    newDaoData: Omit<Dao, "id" | "createdAt" | "updatedAt">,
    options?: { idempotencyKey?: string },
  ) => {
    try {
      const createdDao = await apiService.createDao(newDaoData, options);
      setDaos((prev) => [createdDao, ...prev]);
    } catch (err) {
      devLog.error("Erreur lors de la création du DAO:", err);
      setError("Échec de la création du DAO");
    }
  };

  // Filtre mémoïsé via hook custom
  const filteredDaos = useDaoFilters(daos, searchTerm, filters);
  // Statistiques globales
  const stats = useDaoStats(daos);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="container mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {/* Aperçu des statistiques */}
        <div className={cn(GRID_CLASSES.stats, "gap-3 sm:gap-4 mb-6 sm:mb-8")}>
          <StatsCard
            title="Total DAO"
            value={stats.total}
            description="Dossiers dans la plateforme"
            icon={Calendar}
            variant="total"
          />
          <StatsCard
            title="En cours"
            value={stats.active}
            description="Dossiers actifs"
            icon={Clock}
            variant="active"
          />
          <StatsCard
            title="Terminés"
            value={stats.completed}
            description="Dossiers finalisés"
            icon={CheckCircle2}
            variant="completed"
          />
          <StatsCard
            title="À risque"
            value={stats.urgent}
            description="Échéance ≤ 3 jours"
            icon={AlertTriangle}
            variant="urgent"
          />
        </div>

        {/* Progression globale */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Progression Globale des DAO
            </CardTitle>
            <CardDescription>
              Taux moyen d'avancement de l'ensemble des DAO en cours
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">
                  {stats.globalProgress}%
                </span>
                <span className="text-sm text-muted-foreground">
                  {stats.active} dossier{stats.active > 1 ? "s" : ""} en cours
                </span>
              </div>
              <Progress
                value={stats.globalProgress}
                className={cn(
                  "h-3",
                  stats.globalProgress === 100 ? "[&>*]:bg-gray-400" : "",
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Recherche et actions */}
        <Card className="mb-4 sm:mb-6">
          <CardHeader className="pb-3 sm:pb-6">
            <CardTitle className="text-base sm:text-lg">
              Rechercher DAO
            </CardTitle>
            <CardDescription className="text-sm">
              Recherchez et filtrez vos dossiers d'appel d'offres
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-col md:flex-row gap-3 md:gap-4 md:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par numéro, objet, référence ou autorité..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 text-sm"
                />
              </div>
              <div className="flex flex-col xs:flex-row md:flex-row items-stretch xs:items-center md:items-center gap-2 xs:gap-3 md:flex-shrink-0">
                <div className="flex-1 xs:flex-none md:flex-none">
                  <FilterDialog
                    filters={filters}
                    onFiltersChange={setFilters}
                    availableAuthorities={[
                      ...new Set(daos.map((dao) => dao.autoriteContractante)),
                    ]}
                    availableTeamMembers={[
                      ...new Set(
                        daos.flatMap((dao) =>
                          dao.equipe.map((member) => member.name),
                        ),
                      ),
                    ]}
                  />
                </div>
                <div className="flex-1 xs:flex-none md:flex-none">
                  <GlobalExportDialog daos={daos}>
                    <Button variant="outline" className="w-full">
                      <Download className="h-4 w-4 mr-2" />
                      Exporter
                    </Button>
                  </GlobalExportDialog>
                </div>
                {user && isAdmin() && (
                  <>
                    <div className="flex-1 xs:flex-none md:flex-none">
                      <NewDaoDialog
                        existingDaos={daos}
                        onCreateDao={handleCreateDao}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
            {(searchTerm ||
              filters.dateRange ||
              filters.autoriteContractante ||
              filters.statut) && (
              <div className="mt-3 sm:mt-4 space-y-2">
                <span className="text-xs sm:text-sm text-muted-foreground">
                  Filtres actifs:
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {searchTerm && (
                    <Badge
                      variant="secondary"
                      className="text-xs max-w-[200px]"
                    >
                      <span className="truncate">
                        Recherche: "{searchTerm}"
                      </span>
                    </Badge>
                  )}
                  {filters.autoriteContractante && (
                    <Badge
                      variant="secondary"
                      className="text-xs max-w-[150px]"
                    >
                      <span className="truncate">
                        Autorité: {filters.autoriteContractante}
                      </span>
                    </Badge>
                  )}
                  {filters.statut && (
                    <Badge variant="secondary" className="text-xs">
                      Statut: {filters.statut}
                    </Badge>
                  )}
                  {filters.dateRange && (
                    <Badge variant="secondary" className="text-xs">
                      Période sélectionnée
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearchTerm("");
                      setFilters({});
                    }}
                    className="h-6 text-xs px-2 py-1"
                  >
                    Effacer tout
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Liste des DAO */}
        <div className="space-y-3 sm:space-y-4">
          <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-2">
            <h2 className="text-base sm:text-lg font-semibold">
              Dossiers d'Appel d'Offres
            </h2>
            <span className="text-xs sm:text-sm text-muted-foreground">
              {loading
                ? "Chargement..."
                : `${filteredDaos.length} dossier${filteredDaos.length > 1 ? "s" : ""}`}
            </span>
          </div>

          {error && (
            <Card className="p-6 text-center">
              <div className="text-red-600 mb-2">❌ Erreur</div>
              <p className="text-muted-foreground">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => window.location.reload()}
              >
                R��essayer
              </Button>
            </Card>
          )}

          {/* Conteneur scrollable (évite la pagination) */}
          <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-3 sm:space-y-4">
            {loading && (
              <div
                className={cn(GRID_CLASSES.loading, "gap-3 sm:gap-4 md:gap-6")}
              >
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="p-4 sm:p-6 animate-pulse">
                    <div className="h-5 sm:h-6 bg-gray-200 rounded mb-3 sm:mb-4"></div>
                    <div className="h-3 sm:h-4 bg-gray-200 rounded mb-2"></div>
                    <div className="h-3 sm:h-4 bg-gray-200 rounded w-3/4"></div>
                  </Card>
                ))}
              </div>
            )}

            {!loading && !error && (
              <div
                className={cn(GRID_CLASSES.cards, "gap-3 sm:gap-4 md:gap-6")}
              >
                {filteredDaos.length > 0 ? (
                  filteredDaos.map((dao) => {
                    const progress = calculateDaoProgress(dao.tasks);
                    const status = calculateDaoStatus(dao.dateDepot, progress);
                    return (
                      <OptimizedDaoCard
                        key={dao.id}
                        dao={dao}
                        progress={progress}
                        status={status}
                      />
                    );
                  })
                ) : (
                  <Card className="col-span-full p-6 text-center">
                    <div className="text-muted-foreground">
                      Aucun DAO trouvé
                    </div>
                  </Card>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
