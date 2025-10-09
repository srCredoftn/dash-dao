/**
Rôle: Modèle de données (Mongoose/TS) — src/backend-express/models/Comment.ts
Domaine: Backend/Models
Exports: default
Dépendances: mongoose, @shared/dao
Liens: repositories, services (métier)
*/
import mongoose, { Schema } from "mongoose";
import type { TaskComment } from "@shared/dao";

const CommentSchema = new Schema<TaskComment>({
  id: { type: String, required: true, unique: true },
  taskId: { type: Number, required: true },
  daoId: { type: String, required: true, index: true },
  userId: { type: String, required: true },
  userName: { type: String, required: true },
  content: { type: String, required: true },
  createdAt: { type: String, required: true },
});

const CommentModel =
  (mongoose.models.Comment as mongoose.Model<TaskComment>) ||
  mongoose.model<TaskComment>("Comment", CommentSchema);
export default CommentModel;
