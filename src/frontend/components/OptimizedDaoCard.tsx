/**
Rôle: Composant applicatif — src/frontend/components/OptimizedDaoCard.tsx
Domaine: Frontend/Components
Exports: default
Dépendances: react, react-router-dom, lucide-react, @/components/ui/button, @/components/ui/progress, @/components/ui/badge, @/lib/utils, @shared/dao
Liens: ui/* (atomes), hooks, contexts, services côté client
Performance: cache/partitionnement/bundling optimisés
*/
/*
  Carte optimisée pour l'affichage d'un DAO dans les listes
  - useState: toggles UI (expand/collapse)
  - useCallback: mémorise handlers pour éviter rerenders des enfants
  Ce composant est conçu pour être léger et réutilisable dans des listes virtuelles.
*/
import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronUp, User, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn, getBlinkingDateClasses } from "@/lib/utils";
import type { Dao, DaoStatus } from "@shared/dao";
import { apiService } from "@/services/api";

interface DaoCardProps {
  dao: Dao;
  progress: number;
  status: DaoStatus;
}

function getStatusBadgeVariant(status: DaoStatus) {
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

const OptimizedDaoCard = React.memo(
  ({ dao, progress, status }: DaoCardProps) => {
    const navigate = useNavigate();
    const [isExpanded, setIsExpanded] = useState(false);

    const formatDate = useCallback((dateString: string) => {
      return new Date(dateString).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    }, []);

    const handleCardClick = useCallback(
      (e: React.MouseEvent) => {
        // Don't navigate if clicking on the expand button or detail button
        const target = e.target as HTMLElement;
        if (target.closest("[data-no-navigate]")) {
          return;
        }
        navigate(`/dao/${dao.id}`);
      },
      [navigate, dao.id],
    );

    const handleExpandToggle = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsExpanded(!isExpanded);
      },
      [isExpanded],
    );

    return (
      <Card
        className="hover:shadow-md transition-shadow relative group cursor-pointer"
        onClick={handleCardClick}
        onMouseEnter={() => {
          // Prefetch DAO details to speed up detail page
          apiService.getDaoById(dao.id).catch(() => {});
        }}
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
          {/* Toujours visible : Date et progression */}
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
                className={cn(
                  "h-2",
                  progress === 100 ? "[&>*]:bg-gray-400" : "",
                )}
              />
            </div>
          </div>

          {/* Bouton mobile: déplier/replier */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="sm"
              className="w-full flex items-center gap-2 text-muted-foreground hover:text-foreground"
              onClick={handleExpandToggle}
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

          {/* Contenu repliable sur mobile / Toujours visible sur desktop */}
          <div
            className={cn(
              "space-y-3 sm:space-y-4",
              "md:block", // Always visible on desktop
              isExpanded ? "block" : "hidden", // Conditional on mobile
            )}
          >
            {/* Reference Section */}
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

            {/* Team Section */}
            <div className="space-y-3 pt-3 border-t border-border">
              {/* Team Leader */}
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

              {/* Team Members */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Users className="h-4 w-4 text-gray-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-muted-foreground mb-0.5">
                    Équipe ({dao.equipe.length})
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {dao.equipe.slice(0, 3).map((member, idx) => (
                      <span
                        key={idx}
                        className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-full"
                        title={member.name}
                      >
                        {member.name.split(" ")[0]}
                      </span>
                    ))}
                    {dao.equipe.length > 3 && (
                      <span
                        className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-full"
                        title={`+${dao.equipe.length - 3} autres membres`}
                      >
                        +{dao.equipe.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  },
);

OptimizedDaoCard.displayName = "OptimizedDaoCard";

export default OptimizedDaoCard;
