/**
Rôle: Repository (persistance) — src/backend-express/repositories/mongoCommentRepository.ts
Domaine: Backend/Repositories
Exports: MongoCommentRepository
Dépendances: ./commentRepository, @shared/dao, ../models/Comment
Liens: models (Mongo), services (métier), config DB
*/
import type { CommentRepository } from "./commentRepository";
import type { TaskComment } from "@shared/dao";
import CommentModel from "../models/Comment";

export class MongoCommentRepository implements CommentRepository {
  async listByDao(daoId: string): Promise<TaskComment[]> {
    const docs = await CommentModel.find({ daoId })
      .sort({ createdAt: -1 })
      .exec();
    return docs.map((d) => d.toObject() as TaskComment);
  }
  async listByTask(daoId: string, taskId: number): Promise<TaskComment[]> {
    const docs = await CommentModel.find({ daoId, taskId })
      .sort({ createdAt: -1 })
      .exec();
    return docs.map((d) => d.toObject() as TaskComment);
  }
  async getById(id: string): Promise<TaskComment | null> {
    const doc = await CommentModel.findOne({ id }).exec();
    return doc ? (doc.toObject() as TaskComment) : null;
  }
  async add(c: TaskComment): Promise<TaskComment> {
    const created = await CommentModel.create(c as any);
    return created.toObject() as TaskComment;
  }
  async update(
    id: string,
    updates: Partial<TaskComment>,
  ): Promise<TaskComment | null> {
    const updated = await CommentModel.findOneAndUpdate(
      { id },
      { $set: updates },
      { new: true },
    ).exec();
    return updated ? (updated.toObject() as TaskComment) : null;
  }
  async delete(id: string): Promise<boolean> {
    const r = await CommentModel.deleteOne({ id }).exec();
    return (r.deletedCount || 0) > 0;
  }
  async listRecent(limit: number): Promise<TaskComment[]> {
    const docs = await CommentModel.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
    return docs.map((d) => d.toObject() as TaskComment);
  }
  async deleteAll(): Promise<void> {
    await CommentModel.deleteMany({}).exec();
  }
}
