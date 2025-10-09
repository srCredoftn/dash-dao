/**
Rôle: Repository (persistance) — src/backend-express/repositories/commentRepository.ts
Domaine: Backend/Repositories
Exports: CommentRepository
Dépendances: @shared/dao
Liens: models (Mongo), services (métier), config DB
*/
import type { TaskComment } from "@shared/dao";

export interface CommentRepository {
  listByDao(daoId: string): Promise<TaskComment[]>;
  listByTask(daoId: string, taskId: number): Promise<TaskComment[]>;
  getById(id: string): Promise<TaskComment | null>;
  add(c: TaskComment): Promise<TaskComment>;
  update(
    id: string,
    updates: Partial<TaskComment>,
  ): Promise<TaskComment | null>;
  delete(id: string): Promise<boolean>;
  listRecent(limit: number): Promise<TaskComment[]>;
  deleteAll(): Promise<void>;
}
