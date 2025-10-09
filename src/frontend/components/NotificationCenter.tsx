/**
Rôle: Composant applicatif — src/frontend/components/NotificationCenter.tsx
Domaine: Frontend/Components
Exports: NotificationCenter
Dépendances: react, lucide-react, @/components/ui/button, @/components/ui/badge, @/contexts/NotificationContext
Liens: ui/* (atomes), hooks, contexts, services côté client
*/
/*
  useState est utilisé pour suivre l'état local d'ouverture du popover (isOpen).
  Les notifications sont gérées via le contexte NotificationContext: ce composant n'héberge
  pas la logique métier, il se contente d'afficher et de naviguer vers la ressource liée.
*/
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, BellDot, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useNotifications } from "@/contexts/NotificationContext";
import { formatNotificationMessage } from "@/utils/notification-format";

export default function NotificationCenter() {
  const {
    notifications,
    unreadCount,
    removeNotification,
    clearAll,
    refresh,
    markAsRead,
  } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const handleNavigate = async (
    notification: (typeof notifications)[number],
  ) => {
    if (notification.data?.daoId) {
      try {
        await markAsRead(notification.id);
      } catch {}
      setIsOpen(false);
      navigate(`/dao/${notification.data.daoId}`);
    }
  };

  return (
    <Popover
      open={isOpen}
      onOpenChange={async (open) => {
        setIsOpen(open);
        if (open) {
          await refresh();
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="relative">
          {unreadCount > 0 ? (
            <BellDot className="h-4 w-4" />
          ) : (
            <Bell className="h-4 w-4" />
          )}
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-2 -right-2 h-5 w-5 p-0 text-xs flex items-center justify-center"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
          <span className="ml-2 hidden sm:inline">Notifications</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[28rem] max-w-[95vw] p-4" align="end">
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-lg font-medium">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Badge
                  variant="secondary"
                  className="rounded-full px-2 py-1 text-xs"
                >
                  {unreadCount} non lue{unreadCount > 1 ? "s" : ""}
                </Badge>
              )}
              {notifications.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAll}
                  className="h-7 px-2 text-xs"
                >
                  Tout effacer
                </Button>
              )}
            </div>
          </div>

          {notifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">Aucune notification</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[70vh] overflow-y-auto">
              {notifications.slice(0, 50).map((notification) => {
                const messageLines = formatNotificationMessage(
                  notification.message,
                );
                const excerpt =
                  messageLines && messageLines.length
                    ? messageLines.join(" ").replace(/\s+/g, " ").trim()
                    : "";
                return (
                  <div
                    key={notification.id}
                    role={notification.data?.daoId ? "button" : undefined}
                    tabIndex={notification.data?.daoId ? 0 : undefined}
                    onClick={() => handleNavigate(notification)}
                    onKeyDown={(event) => {
                      if (
                        notification.data?.daoId &&
                        (event.key === "Enter" || event.key === " ")
                      ) {
                        event.preventDefault();
                        handleNavigate(notification);
                      }
                    }}
                    className={`p-3 rounded-lg border transition-colors duration-150 h-16 flex items-center ${
                      !notification.read
                        ? "bg-blue-50 border-blue-200"
                        : "bg-gray-50"
                    } ${notification.data?.daoId ? "cursor-pointer" : ""}`}
                  >
                    <div className="flex items-center justify-between w-full gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {notification.title}
                        </p>
                        <p className="mt-1 text-xs text-gray-600 truncate">
                          {excerpt}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-1 truncate">
                          {new Date(notification.createdAt).toLocaleString(
                            "fr-FR",
                          )}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation();
                          removeNotification(notification.id);
                        }}
                        className="h-6 w-6 p-0 ml-2 flex-shrink-0"
                        aria-label="Supprimer la notification"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
