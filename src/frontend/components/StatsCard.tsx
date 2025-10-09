/**
Rôle: Composant applicatif — src/frontend/components/StatsCard.tsx
Domaine: Frontend/Components
Exports: StatsCard
Dépendances: @/components/ui/card, @/lib/utils, lucide-react
Liens: ui/* (atomes), hooks, contexts, services côté client
*/
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type StatsVariant = "total" | "active" | "completed" | "urgent" | "default";

interface StatsCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: LucideIcon;
  variant?: StatsVariant;
  className?: string;
}

const VARIANT_STYLES: Record<
  StatsVariant,
  {
    cardClass: string;
    titleClass: string;
    valueClass: string;
    descriptionClass: string;
    iconClass: string;
  }
> = {
  total: {
    cardClass: "bg-green-50/80 border-green-200/60 backdrop-blur-sm",
    titleClass: "text-green-700 font-medium text-sm",
    valueClass: "text-green-800",
    descriptionClass: "text-green-600/80 text-xs",
    iconClass: "h-7 w-7 bg-green-500 text-white rounded-lg p-1.5 shadow-sm",
  },
  active: {
    cardClass: "bg-orange-50/80 border-orange-200/60 backdrop-blur-sm",
    titleClass: "text-orange-700 font-medium text-sm",
    valueClass: "text-orange-800",
    descriptionClass: "text-orange-600/80 text-xs",
    iconClass: "h-7 w-7 bg-orange-500 text-white rounded-lg p-1.5 shadow-sm",
  },
  completed: {
    cardClass: "bg-gray-50/80 border-gray-200/60 backdrop-blur-sm",
    titleClass: "text-gray-700 font-medium text-sm",
    valueClass: "text-gray-800",
    descriptionClass: "text-gray-600/80 text-xs",
    iconClass: "h-7 w-7 bg-gray-500 text-white rounded-lg p-1.5 shadow-sm",
  },
  urgent: {
    cardClass: "bg-red-50/80 border-red-200/60 backdrop-blur-sm",
    titleClass: "text-red-700 font-medium text-sm",
    valueClass: "text-red-800",
    descriptionClass: "text-red-600/80 text-xs",
    iconClass: "h-7 w-7 bg-red-500 text-white rounded-lg p-1.5 shadow-sm",
  },
  default: {
    cardClass: "",
    titleClass: "text-sm font-medium",
    valueClass: "text-2xl font-bold",
    descriptionClass: "text-xs text-muted-foreground",
    iconClass: "h-4 w-4 text-muted-foreground",
  },
};

export function StatsCard({
  title,
  value,
  description,
  icon: Icon,
  variant = "default",
  className,
}: StatsCardProps) {
  const styles = VARIANT_STYLES[variant];

  return (
    <Card
      className={cn(
        "hover:shadow-lg transition-all duration-200 border-0 shadow-sm hover:-translate-y-0.5",
        styles.cardClass,
        className,
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 sm:pb-3 px-4 sm:px-6 pt-4 sm:pt-6">
        <CardTitle className={cn("text-xs sm:text-sm", styles.titleClass)}>
          {title}
        </CardTitle>
        <Icon
          className={cn(
            "h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7",
            styles.iconClass.replace("h-7 w-7", ""),
            variant === "urgent" ? "blink-attention" : "",
          )}
        />
      </CardHeader>
      <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
        <div
          className={cn(
            "text-xl sm:text-2xl font-bold mb-0.5",
            styles.valueClass,
          )}
        >
          {value}
        </div>
        <p className={cn("text-xs", styles.descriptionClass)}>{description}</p>
      </CardContent>
    </Card>
  );
}
