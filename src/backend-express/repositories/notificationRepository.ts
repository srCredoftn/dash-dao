/**
Rôle: Repository (persistance) — src/backend-express/repositories/notificationRepository.ts
Domaine: Backend/Repositories
Exports: NotificationType, ServerNotification, PersistedNotification, NotificationRepository
Liens: models (Mongo), services (métier), config DB
*/
export type NotificationType =
  | "role_update"
  | "task_notification"
  | "dao_created"
  | "dao_updated"
  | "dao_deleted"
  | "user_created"
  | "system";

export interface ServerNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  recipients: "all" | string[];
  readBy: Set<string>;
  createdAt: string;
}

export interface PersistedNotification
  extends Omit<ServerNotification, "readBy"> {
  readBy: string[];
}

export interface NotificationRepository {
  listForUser(userId: string): Promise<PersistedNotification[]>;
  add(n: PersistedNotification): Promise<PersistedNotification>;
  markRead(userId: string, notifId: string): Promise<boolean>;
  markAllRead(userId: string): Promise<number>;
  clearAll(): Promise<void>;
}
