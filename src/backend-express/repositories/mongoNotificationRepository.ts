/**
Rôle: Repository (persistance) — src/backend-express/repositories/mongoNotificationRepository.ts
Domaine: Backend/Repositories
Exports: MongoNotificationRepository
Dépendances: ../models/Notification
Liens: models (Mongo), services (métier), config DB
*/
import type {
  NotificationRepository,
  PersistedNotification,
} from "./notificationRepository";
import NotificationModel from "../models/Notification";

export class MongoNotificationRepository implements NotificationRepository {
  async listForUser(userId: string): Promise<PersistedNotification[]> {
    const docs = await NotificationModel.find({
      $or: [
        { recipients: "all" },
        { recipients: { $elemMatch: { $eq: userId } } },
      ],
    })
      .sort({ createdAt: -1 })
      .exec();
    return docs.map((d) => d.toObject() as PersistedNotification);
  }
  async add(n: PersistedNotification): Promise<PersistedNotification> {
    const created = await NotificationModel.create(n as any);
    return created.toObject() as PersistedNotification;
  }
  async markRead(userId: string, notifId: string): Promise<boolean> {
    const res = await NotificationModel.updateOne(
      { id: notifId },
      { $addToSet: { readBy: userId } },
    ).exec();
    return (res.modifiedCount || 0) > 0 || (res.matchedCount || 0) > 0;
  }
  async markAllRead(userId: string): Promise<number> {
    const res = await NotificationModel.updateMany(
      {
        $or: [
          { recipients: "all" },
          { recipients: { $elemMatch: { $eq: userId } } },
        ],
      },
      { $addToSet: { readBy: userId } },
    ).exec();
    return res.modifiedCount || 0;
  }
  async clearAll(): Promise<void> {
    await NotificationModel.deleteMany({}).exec();
  }
}
