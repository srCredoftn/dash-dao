/**
Rôle: Composant applicatif — src/frontend/components/TaskComments.tsx
Domaine: Frontend/Components
Exports: TaskComments
Dépendances: react, @/components/ui/confirmation-dialog, @/components/ui/button, @/components/ui/textarea, @/components/ui/card, @/components/ui/badge, @/components/ui/separator, @/components/ui/avatar
Liens: ui/* (atomes), hooks, contexts, services côté client
*/
/*
  Hooks utilisés:
  - useState: gère l'état des commentaires, input utilisateur, états de chargement.
  - useEffect: pour précharger et rafraîchir les commentaires lors de montages ou changements
    de DAO/tâche, et pour écouter les événements globaux (ex: mise à jour d'avatar).
*/
import { useState, useEffect } from "react";
import {
  MessageSquare,
  Send,
  Trash2,
  Calendar,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { commentService } from "@/services/commentService";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { TaskComment, TeamMember } from "@shared/dao";
import { getAvatarUrl } from "@/utils/avatar";

interface TaskCommentsProps {
  daoId: string;
  taskId: number;
  taskName: string;
  availableMembers: TeamMember[];
  showAddInput?: boolean;
  stagingMode?: boolean;
  stagedComments?: TaskComment[];
  onStageComment?: (c: TaskComment) => void;
  onUnstageComment?: (id: string) => void;
}

export default function TaskComments({
  daoId,
  taskId,
  taskName,
  availableMembers,
  showAddInput = true,
  stagingMode = false,
  stagedComments = [],
  onStageComment,
  onUnstageComment,
}: TaskCommentsProps) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const { user } = useAuth();
  const { refresh: refreshNotifications } = useNotifications();

  // Précharger les commentaires au montage et à chaque changement de DAO/tâche
  useEffect(() => {
    loadComments();
    // charge lors d’un changement de DAO/tâche
  }, [daoId, taskId]);

  // Rafraîchir lors du déploiement
  useEffect(() => {
    if (isExpanded) {
      loadComments();
    }
  }, [isExpanded]);

  const uniqueById = (arr: TaskComment[]) => {
    const seen = new Set<string>();
    const res: TaskComment[] = [];
    for (const c of arr) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        res.push(c);
      }
    }
    return res;
  };

  const loadComments = async () => {
    try {
      setLoading(true);
      const taskComments = await commentService.getTaskComments(daoId, taskId);
      const sorted = taskComments.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      setComments(uniqueById(sorted));
    } catch (error) {
      console.error("Erreur lors du chargement des commentaires :", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !user) return;

    const content = newComment.trim();
    const tempId = `temp-${Date.now()}`;
    const optimisticComment: TaskComment = {
      id: tempId,
      taskId,
      daoId,
      userId: user.id,
      userName: user.name,
      content,
      createdAt: new Date().toISOString(),
    };

    // Mise à jour optimiste de l’UI
    setComments((prev) => [optimisticComment, ...prev]);
    setNewComment("");
    setShowSuggestions(false);
    setSubmitLoading(true);

    const idempotencyKey = `comment:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;

    try {
      const saved = await commentService.addComment(daoId, taskId, content, {
        idempotencyKey,
        silent: stagingMode === true,
      });

      // Remplacer le commentaire optimiste par celui sauvegardé
      setComments((prev) => {
        const next = prev.map((c) => (c.id === tempId ? saved : c));
        const seen = new Set<string>();
        const dedup: TaskComment[] = [];
        for (const c of next) {
          if (!seen.has(c.id)) {
            seen.add(c.id);
            dedup.push(c);
          }
        }
        return dedup;
      });

      // Enregistrer côté parent les commentaires stagés
      if (stagingMode) {
        try {
          onStageComment?.(saved);
        } catch {}
      }

      // Garantir que l’état est synchronisé avec le serveur
      await loadComments();

      // Synchroniser uniquement avec les notifications serveur (pas de toasts locaux pour la tâche)
      if (!stagingMode) {
        await refreshNotifications();
      }
    } catch (error) {
      // Annuler la mise à jour optimiste en cas d’échec
      setComments((prev) => prev.filter((c) => c.id !== tempId));
      console.error("Erreur lors de l'ajout d'un commentaire :", error);
      alert("Erreur lors de l'ajout du commentaire");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const idempotencyKey = `delete-comment:${commentId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
      await commentService.deleteComment(commentId, { idempotencyKey });
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      if (stagingMode) {
        try {
          onUnstageComment?.(commentId);
        } catch {}
      }
      if (!stagingMode) {
        await refreshNotifications();
      }
    } catch (error) {
      console.error("Erreur lors de la suppression du commentaire :", error);
      alert("Erreur lors de la suppression du commentaire");
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const position = e.target.selectionStart;

    setNewComment(value);
    setCursorPosition(position);

    // Détecter les mentions @
    const textBeforeCursor = value.substring(0, position);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      setMentionQuery(mentionMatch[1]);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
      setMentionQuery("");
    }
  };

  const handleMentionSelect = (memberName: string) => {
    const textBeforeCursor = newComment.substring(0, cursorPosition);
    const textAfterCursor = newComment.substring(cursorPosition);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      const beforeMention = textBeforeCursor.substring(0, mentionMatch.index);
      const newText = beforeMention + `@${memberName} ` + textAfterCursor;
      setNewComment(newText);
      setShowSuggestions(false);
    }
  };

  const getFilteredMembers = () => {
    if (!mentionQuery) return availableMembers;
    return availableMembers.filter((member) =>
      member.name.toLowerCase().includes(mentionQuery.toLowerCase()),
    );
  };

  // Rafraîchir immédiatement les avatars si une photo de profil a été mise à jour ailleurs
  useEffect(() => {
    const onAvatarUpdate = () => {
      // Déclencher un rerender ; getAvatarUrl lit localStorage donc un rerender suffit
      setComments((prev) => [...prev]);
    };
    window.addEventListener("avatar-updated", onAvatarUpdate as EventListener);
    return () =>
      window.removeEventListener(
        "avatar-updated",
        onAvatarUpdate as EventListener,
      );
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours =
      Math.abs(now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInHours * 60);
      return `Il y a ${diffInMinutes} minute${diffInMinutes > 1 ? "s" : ""}`;
    } else if (diffInHours < 24) {
      const hours = Math.floor(diffInHours);
      return `Il y a ${hours} heure${hours > 1 ? "s" : ""}`;
    } else {
      return date.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  };

  if (!isExpanded) {
    // Construire la liste unique des commentateurs par ordre du dernier commentaire
    const seenUsers = new Set<string>();
    const uniqueCommenters = comments.filter((c) => {
      if (!c.userId) return false;
      if (seenUsers.has(c.userId)) return false;
      seenUsers.add(c.userId);
      return true;
    });
    const visible = uniqueCommenters.slice(0, 3);
    const extra = Math.max(uniqueCommenters.length - visible.length, 0);

    return (
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setIsExpanded(true);
            if (!comments.length) loadComments();
          }}
          onMouseEnter={() => {
            if (!isExpanded && !loading && !comments.length) loadComments();
          }}
          className="p-0 h-auto flex items-center"
        >
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-blue-600" />
            <span className="text-sm text-blue-600 hover:text-blue-700">
              {comments.length > 0
                ? extra > 0
                  ? `+${extra} commentaire${extra > 1 ? "s" : ""}`
                  : `${comments.length} commentaire${comments.length > 1 ? "s" : ""}`
                : "Commentaires"}
            </span>
            <div className="flex -space-x-2">
              {visible.map((c, idx) => (
                <Avatar
                  key={(c.userId || c.userName || String(idx)) + idx}
                  className="h-6 w-6 ring-2 ring-white dark:ring-gray-900 -ml-2 first:ml-0"
                >
                  <AvatarImage
                    src={getAvatarUrl(c.userId || c.userName, c.userName)}
                    alt={c.userName || "Utilisateur"}
                  />
                  <AvatarFallback className="text-[10px] bg-blue-100 text-blue-700">
                    {(c.userName?.charAt(0) || "?").toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
          </div>
        </Button>
        <div className="w-8 flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsExpanded(true);
              if (!comments.length) loadComments();
            }}
            onMouseEnter={() => {
              if (!isExpanded && !loading && !comments.length) loadComments();
            }}
            className="p-0 h-auto w-8 justify-center"
            aria-label="Ouvrir les commentaires"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Card className="mt-3">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">
            <MessageSquare className="h-4 w-4 mr-2 inline" />
            Commentaires · {taskName}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(false)}
            className="h-6 w-6 p-0"
            aria-label="Replier les commentaires"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Ajouter un commentaire (masqué quand showAddInput=false) */}
        {showAddInput && user && user.role !== "viewer" && (
          <div className="space-y-3">
            <div className="relative">
              <Textarea
                value={newComment}
                onChange={handleTextareaChange}
                placeholder="Ajouter un commentaire ou une observation... (utilisez @nom pour mentionner)"
                className="resize-none"
                rows={3}
              />
              {showSuggestions && getFilteredMembers().length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-32 overflow-y-auto">
                  {getFilteredMembers()
                    .slice(0, 5)
                    .map((member) => (
                      <button
                        key={member.id}
                        onClick={() => handleMentionSelect(member.name)}
                        className="w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 border-b last:border-b-0"
                      >
                        <div className="flex items-center space-x-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage
                              src={getAvatarUrl(
                                member.id || member.name,
                                member.name,
                              )}
                              alt={member.name}
                            />
                            <AvatarFallback className="text-[10px] bg-blue-100 text-blue-700">
                              {member.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{member.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {member.role === "chef_equipe" ? "Chef" : "Membre"}
                          </Badge>
                        </div>
                      </button>
                    ))}
                </div>
              )}
            </div>
            <div className="flex justify-between items-center">
              <p className="text-xs text-muted-foreground">
                Tapez @ pour mentionner un membre de l'équipe
              </p>
              <Button
                onClick={handleSubmitComment}
                disabled={!newComment.trim() || submitLoading}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Send className="h-4 w-4 mr-2" />
                {submitLoading ? "Envoi..." : "Publier"}
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-4">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto"></div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Chargement des commentaires...
            </p>
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-6">
            <MessageSquare className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Aucun commentaire pour le moment.
            </p>
            {user && user.role === "viewer" && (
              <p className="text-xs text-muted-foreground mt-1">
                Vous n'avez pas l'autorisation d'ajouter des commentaires.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <Separator />
            <div className="flex items-center justify-between">
              <div />
              <Badge variant="secondary" className="text-xs">
                {comments.length} commentaire{comments.length > 1 ? "s" : ""}
              </Badge>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto">
              {comments.map((comment) => {
                const isStaged = stagedComments.some(
                  (c) => c.id === comment.id,
                );
                return (
                  <div
                    key={comment.id}
                    className="border rounded-lg p-3 bg-gray-50"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage
                              src={getAvatarUrl(
                                comment.userId || comment.userName,
                                comment.userName,
                              )}
                              alt={comment.userName || "Utilisateur"}
                            />
                            <AvatarFallback className="text-xs">
                              {comment.userName?.charAt(0) || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium text-gray-900">
                            {comment.userName}
                          </span>
                          <span className="text-xs text-gray-500 flex items-center">
                            <Calendar className="h-3 w-3 mr-1" />
                            {formatDate(comment.createdAt)}
                          </span>
                          {isStaged && (
                            <Badge
                              variant="outline"
                              className="text-[10px] ml-1"
                            >
                              Stagé
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                          {comment.content}
                        </p>
                      </div>
                      {user &&
                        (user.id === comment.userId ||
                          user.role === "admin") && (
                          <ConfirmationDialog
                            trigger={
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            }
                            title="Supprimer le commentaire"
                            description="Êtes-vous sûr de vouloir supprimer ce commentaire ? Cette action est irréversible."
                            confirmText="Supprimer"
                            onConfirm={() => handleDeleteComment(comment.id)}
                            icon="trash"
                          />
                        )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
