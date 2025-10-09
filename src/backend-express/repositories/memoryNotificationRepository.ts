/**
Rôle: Repository (persistance) — src/backend-express/repositories/memoryNotificationRepository.ts
Domaine: Backend/Repositories
Exports: MemoryNotificationRepository, __memoryNotifs
Liens: models (Mongo), services (métier), config DB
Performance: cache/partitionnement/bundling optimisés
*/
import type {
  NotificationRepository,
  PersistedNotification,
} from "./notificationRepository";

const store: PersistedNotification[] = [];

export class MemoryNotificationRepository implements NotificationRepository {
  async listForUser(userId: string): Promise<PersistedNotification[]> {
    return store
      .filter(
        (n) =>
          n.recipients === "all" ||
          (Array.isArray(n.recipients) && n.recipients.includes(userId)),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async add(n: PersistedNotification): Promise<PersistedNotification> {
    store.unshift(n);
    if (store.length > 500) store.pop();
    return n;
  }
  async markRead(userId: string, notifId: string): Promise<boolean> {
    const n = store.find((x) => x.id === notifId);
    if (!n) return false;
    if (!n.readBy.includes(userId)) n.readBy.push(userId);
    return true;
  }
  async markAllRead(userId: string): Promise<number> {
    let count = 0;
    for (const n of store) {
      if (
        n.recipients === "all" ||
        (Array.isArray(n.recipients) && n.recipients.includes(userId))
      ) {
        if (!n.readBy.includes(userId)) {
          n.readBy.push(userId);
          count++;
        }
      }
    }
    return count;
  }
  async clearAll(): Promise<void> {
    store.splice(0, store.length);
  }
}

export function __memoryNotifs() {
  return store;
}
