/**
Rôle: Modèle de données (Mongoose/TS) — src/backend-express/models/User.ts
Domaine: Backend/Models
Exports: UserDocument, default
Dépendances: mongoose, @shared/dao
Liens: repositories, services (métier)
Sécurité: veille à la validation d’entrée, gestion JWT/refresh, et limites de débit
*/
import mongoose, { Schema } from "mongoose";
import type { UserRole } from "@shared/dao";

export interface UserDocument extends mongoose.Document {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
  lastLogin?: string;
  isActive: boolean;
  isSuperAdmin?: boolean;
  passwordHash: string;
}

const UserSchema = new Schema<UserDocument>(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    role: { type: String, enum: ["admin", "user", "viewer"], required: true },
    createdAt: { type: String, required: true },
    lastLogin: { type: String },
    isActive: { type: Boolean, default: true },
    isSuperAdmin: { type: Boolean, default: false },
    passwordHash: { type: String, required: true },
  },
  { timestamps: false },
);

const UserModel = mongoose.model<UserDocument>("User", UserSchema);
export default UserModel;
