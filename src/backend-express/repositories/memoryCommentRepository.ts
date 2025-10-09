/**
Rôle: Repository (persistance) — src/backend-express/repositories/memoryCommentRepository.ts
Domaine: Backend/Repositories
Exports: MemoryCommentRepository, __memoryComments
Dépendances: ./commentRepository, @shared/dao
Liens: models (Mongo), services (métier), config DB
Performance: cache/partitionnement/bundling optimisés
*/
import type { CommentRepository } from "./commentRepository";
import type { TaskComment } from "@shared/dao";

const comments: TaskComment[] = [];

export class MemoryCommentRepository implements CommentRepository {
  async listByDao(daoId: string): Promise<TaskComment[]> {
    return comments
      .filter((c) => c.daoId === daoId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async listByTask(daoId: string, taskId: number): Promise<TaskComment[]> {
    return comments
      .filter((c) => c.daoId === daoId && c.taskId === taskId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async getById(id: string): Promise<TaskComment | null> {
    return comments.find((c) => c.id === id) || null;
  }
  async add(c: TaskComment): Promise<TaskComment> {
    comments.push(c);
    return c;
  }
  async update(
    id: string,
    updates: Partial<TaskComment>,
  ): Promise<TaskComment | null> {
    const idx = comments.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    comments[idx] = { ...comments[idx], ...updates };
    return comments[idx];
  }
  async delete(id: string): Promise<boolean> {
    const idx = comments.findIndex((c) => c.id === id);
    if (idx === -1) return false;
    comments.splice(idx, 1);
    return true;
  }
  async listRecent(limit: number): Promise<TaskComment[]> {
    return comments
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }
  async deleteAll(): Promise<void> {
    comments.splice(0, comments.length);
  }
}

export function __memoryComments() {
  return comments;
}
