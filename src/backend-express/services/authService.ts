/**
Rôle: Service métier côté serveur — src/backend-express/services/authService.ts
Domaine: Backend/Services
Exports: AuthService
Dépendances: bcryptjs, jsonwebtoken, ../utils/devLog, ../config/database, ../config/runtime, ../repositories/userRepository, ../repositories/memoryUserRepository, ../repositories/mongoUserRepository
Liens: appels /api, utils de fetch, types @shared/*
Sécurité: veille à la validation d’entrée, gestion JWT/refresh
Performance: cache/partitionnement/bundling optimisés
*/
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { devLog, authLog } from "../utils/devLog";
import type {
  User,
  AuthUser,
  LoginCredentials,
  AuthResponse,
  UserRole,
} from "@shared/dao";
import { connectToDatabase } from "../config/database";
import { getStorageConfig } from "../config/runtime";
import type { UserRepository } from "../repositories/userRepository";
import { MemoryUserRepository } from "../repositories/memoryUserRepository";
import { MongoUserRepository } from "../repositories/mongoUserRepository";
import { sendEmail, Templates, emailAdmin } from "./txEmail";
import { isValidEmail, normalizeEmail } from "../utils/email";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "15m";
const REFRESH_TTL_MS = Number(
  process.env.REFRESH_TTL_MS || 1000 * 60 * 60 * 24 * 7,
); // 7 jours

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  devLog.error("🚨 ERREUR CRITIQUE: JWT_SECRET manquant ou trop court");
  devLog.error(
    "   Veuillez définir une variable d'environnement JWT_SECRET de plus de 32 caractères",
  );
  process.exit(1);
}

// Password reset tokens (ephemeral)
const resetTokens: Record<string, { email: string; expires: Date }> = {};

// Session tracking (ephemeral)
const activeSessions: Set<string> = new Set();

// Refresh token store (ephemeral; can be moved to Mongo later)
const refreshStore = new Map<string, { userId: string; expiresAt: number }>();

function hashToken(token: string): string {
  return require("crypto").createHash("sha256").update(token).digest("hex");
}

let userRepo: UserRepository | null = null;
let attempted = false;

async function getUserRepo(): Promise<UserRepository> {
  if (userRepo) return userRepo;
  if (attempted) return userRepo || new MemoryUserRepository();
  attempted = true;

  const cfg = getStorageConfig();
  if (!cfg.useMongo) {
    userRepo = new MemoryUserRepository();
    return userRepo;
  }
  try {
    await connectToDatabase();
    userRepo = new MongoUserRepository();
    return userRepo;
  } catch (e) {
    if (cfg.strictDbMode && !cfg.fallbackOnDbError) throw e;
    devLog.warn(
      "USE_MONGO=true but DB unreachable, using in-memory users repository",
    );
    userRepo = new MemoryUserRepository();
    return userRepo;
  }
}

let superAdminIdCache: string | null = null;
async function refreshSuperAdminCache() {
  try {
    const repo = await getUserRepo();
    const list = await repo.listActive();

    // Dédupliquer par email (conserver le plus ancien createdAt)
    const byEmail = new Map<string, (typeof list)[number]>();
    for (const u of list) {
      const key = u.email.toLowerCase();
      const prev = byEmail.get(key);
      if (!prev) byEmail.set(key, u);
      else {
        const keep =
          new Date(prev.createdAt) <= new Date(u.createdAt) ? prev : u;
        const remove = keep === prev ? u : prev;
        await repo.deactivateById(remove.id).catch(() => {});
        byEmail.set(key, keep);
      }
    }

    const envAdmin = process.env.ADMIN_EMAIL?.toLowerCase();
    let chosen: (typeof list)[number] | undefined;
    if (envAdmin) {
      chosen = Array.from(byEmail.values()).find(
        (u) => u.email.toLowerCase() === envAdmin && u.role === "admin",
      );
    }
    if (!chosen) {
      chosen = Array.from(byEmail.values()).find((u) => u.role === "admin");
    }

    // Garantir qu’un seul utilisateur a le statut super administrateur
    if (chosen) {
      superAdminIdCache = chosen.id;
      for (const u of byEmail.values()) {
        const shouldBeSuper = u.id === chosen.id;
        if (u.isSuperAdmin !== shouldBeSuper) {
          await repo.updateById(u.id, { isSuperAdmin: shouldBeSuper });
        }
      }
    } else {
      superAdminIdCache = null;
    }
  } catch {
    superAdminIdCache = null;
  }
}

function normalizeName(name: string): string {
  return (name || "")
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

async function ensureInitialUsers() {
  const repo = await getUserRepo();

  const shouldSeed =
    process.env.SEED_USERS === "1" || process.env.SEED_USERS === "true";
  if (shouldSeed) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SEED_USERS ne peut pas être activé en production");
    }
    const defaults = [
      {
        name: "Admin User",
        email: "admin@2snd.fr",
        role: "admin" as UserRole,
        password: "admin123",
      },
      {
        name: "Marie Dubois",
        email: "marie.dubois@2snd.fr",
        role: "user" as UserRole,
        password: "marie123",
      },
      {
        name: "Pierre Martin",
        email: "pierre.martin@2snd.fr",
        role: "user" as UserRole,
        password: "pierre123",
      },
    ];
    await repo.deleteAll();
    for (const u of defaults) {
      const passwordHash = await bcrypt.hash(u.password, 12);
      await repo.create({
        name: normalizeName(u.name),
        email: u.email.toLowerCase(),
        role: u.role,
        isActive: true,
        isSuperAdmin: u.role === "admin",
        lastLogin: undefined,
        passwordHash,
      } as any);
    }
    await refreshSuperAdminCache();
    devLog.info("🔐 Users initialized with demo users");
    return;
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const existing = await repo.findByEmail(adminEmail.toLowerCase());
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    if (!existing) {
      await repo.create({
        name: "Administrator",
        email: adminEmail.toLowerCase(),
        role: "admin",
        isActive: true,
        isSuperAdmin: true,
        passwordHash,
      } as any);
      devLog.info(`🔐 Admin user created from environment: ${adminEmail}`);
    } else if (!existing.isSuperAdmin || existing.role !== "admin") {
      await repo.updateById(existing.id, {
        isSuperAdmin: true,
        role: "admin",
        passwordHash,
      });
      devLog.info(`🔐 Admin user ensured from environment: ${adminEmail}`);
    }
    await refreshSuperAdminCache();
    return;
  }

  // No seed, no env-admin -> nothing to do, but set cache if possible
  await refreshSuperAdminCache();
}

export class AuthService {
  private static async issueAccessToken(user: AuthUser): Promise<string> {
    return jwt.sign(
      user,
      JWT_SECRET as jwt.Secret,
      {
        expiresIn: JWT_EXPIRES_IN as any,
        issuer: "dao-management",
        audience: "dao-app",
      } as any,
    );
  }

  private static async issueRefreshToken(userId: string): Promise<string> {
    const crypto = require("crypto");
    const raw = crypto.randomBytes(64).toString("base64url");
    const key = hashToken(raw);
    refreshStore.set(key, { userId, expiresAt: Date.now() + REFRESH_TTL_MS });
    return raw;
  }

  static async createRefreshTokenForUser(userId: string): Promise<string> {
    return this.issueRefreshToken(userId);
  }

  private static verifyRefreshToken(raw: string): { userId: string } | null {
    const key = hashToken(raw);
    const rec = refreshStore.get(key);
    if (!rec) return null;
    if (Date.now() > rec.expiresAt) {
      refreshStore.delete(key);
      return null;
    }
    return { userId: rec.userId };
  }

  static async refreshSession(
    refreshToken: string,
  ): Promise<{ token: string; user: AuthUser } | null> {
    const payload = this.verifyRefreshToken(refreshToken);
    if (!payload) return null;
    try {
      const repo = await getUserRepo();
      const u = await repo.findById(payload.userId);
      if (!u || !u.isActive) return null;
      const authUser: AuthUser = {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
      };
      const token = await this.issueAccessToken(authUser);
      // rotate
      this.revokeRefreshToken(refreshToken);
      await this.issueRefreshToken(authUser.id);
      activeSessions.add(token);
      return { token, user: authUser };
    } catch {
      return null;
    }
  }

  private static revokeRefreshToken(raw: string) {
    try {
      refreshStore.delete(hashToken(raw));
    } catch {}
  }

  static async initialize() {
    try {
      await ensureInitialUsers();
    } catch (e) {
      devLog.error(
        "Auth initialization skipped due to DB connectivity issues",
        e,
      );
    }
  }

  static async login(
    credentials: LoginCredentials,
  ): Promise<AuthResponse | null> {
    const email = credentials.email.toLowerCase();
    try {
      const repo = await getUserRepo();
      const user = await repo.findByEmail(email);
      if (!user || !user.isActive) {
        authLog.login(credentials.email, false);
        return null;
      }
      const ok = await bcrypt.compare(credentials.password, user.passwordHash);
      if (!ok) {
        authLog.login(credentials.email, false);
        return null;
      }

      const authUser: AuthUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      };
      const token = await AuthService.issueAccessToken(authUser as AuthUser);
      activeSessions.add(token);

      await (
        await getUserRepo()
      ).updateById(user.id, { lastLogin: new Date().toISOString() });

      authLog.login(user.email, true);
      return { user: authUser, token };
    } catch (error) {
      devLog.error("Login error:", error);
      return null;
    }
  }

  static async verifyToken(token: string): Promise<AuthUser | null> {
    try {
      const decoded = jwt.verify(token, JWT_SECRET as string, {
        issuer: "dao-management",
        audience: "dao-app",
      }) as AuthUser;
      try {
        const repo = await getUserRepo();
        const user = await repo.findById(decoded.id);
        if (!user || !user.isActive) {
          activeSessions.delete(token);
          return null;
        }
        if (!activeSessions.has(token)) activeSessions.add(token);
        authLog.tokenVerification(user.email, true);
        return decoded;
      } catch {
        activeSessions.delete(token);
        return null;
      }
    } catch {
      activeSessions.delete(token);
      return null;
    }
  }

  static async listActiveSessions(): Promise<
    {
      sessionId: string;
      user: AuthUser | null;
      issuedAt?: number;
      expiresAt?: number;
    }[]
  > {
    const sessions = Array.from(activeSessions);
    const result: {
      sessionId: string;
      user: AuthUser | null;
      issuedAt?: number;
      expiresAt?: number;
    }[] = [];
    for (const token of sessions) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET as string, {
          issuer: "dao-management",
          audience: "dao-app",
        }) as AuthUser & { iat?: number; exp?: number };
        const sessionId = require("crypto")
          .createHash("sha256")
          .update(token)
          .digest("hex")
          .substring(0, 16);
        result.push({
          sessionId,
          user: {
            id: decoded.id,
            email: decoded.email,
            role: decoded.role,
            name: decoded.name,
          },
          issuedAt: decoded.iat ? decoded.iat * 1000 : undefined,
          expiresAt: decoded.exp ? decoded.exp * 1000 : undefined,
        });
      } catch {
        const sessionId = require("crypto")
          .createHash("sha256")
          .update(token)
          .digest("hex")
          .substring(0, 16);
        result.push({ sessionId, user: null });
      }
    }
    return result;
  }

  static async logout(token: string, refreshToken?: string): Promise<void> {
    activeSessions.delete(token);
    if (refreshToken) this.revokeRefreshToken(refreshToken);
  }

  static async getCurrentUser(token: string): Promise<AuthUser | null> {
    return this.verifyToken(token);
  }

  static async getAllUsers(): Promise<User[]> {
    const repo = await getUserRepo();
    const docs = await repo.listActive();
    return docs.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt,
      lastLogin: u.lastLogin,
      isActive: u.isActive,
      isSuperAdmin: u.isSuperAdmin,
    }));
  }

  static async getUserByEmail(email: string): Promise<User | null> {
    const repo = await getUserRepo();
    const u = await repo.findByEmail(email.toLowerCase());
    if (!u) return null;
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt,
      lastLogin: u.lastLogin,
      isActive: u.isActive,
      isSuperAdmin: u.isSuperAdmin,
    };
  }

  static async getUserById(id: string): Promise<User | null> {
    const repo = await getUserRepo();
    const u = await repo.findById(id);
    if (!u) return null;
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt,
      lastLogin: u.lastLogin,
      isActive: u.isActive,
      isSuperAdmin: u.isSuperAdmin,
    };
  }

  static getSuperAdmin(): User | null {
    if (superAdminIdCache) {
      return {
        id: superAdminIdCache,
        name: "Super Admin",
        email: "",
        role: "admin",
        createdAt: "",
        isActive: true,
        isSuperAdmin: true,
      } as User;
    }
    return null;
  }

  static isSuperAdmin(userId: string): boolean {
    return superAdminIdCache === userId;
  }

  static async verifyPasswordByEmail(
    email: string,
    password: string,
  ): Promise<boolean> {
    const repo = await getUserRepo();
    const u = await repo.findByEmail(email.toLowerCase());
    if (!u) return false;
    try {
      return await bcrypt.compare(password, u.passwordHash);
    } catch {
      return false;
    }
  }

  static async verifyPasswordById(
    id: string,
    password: string,
  ): Promise<boolean> {
    const repo = await getUserRepo();
    const u = await repo.findById(id);
    if (!u) return false;
    try {
      return await bcrypt.compare(password, u.passwordHash);
    } catch {
      return false;
    }
  }

  static async createUser(userData: {
    name: string;
    email: string;
    role: UserRole;
    password?: string;
  }): Promise<User> {
    const repo = await getUserRepo();
    const normalizedName = normalizeName(userData.name);
    const normalizedEmail = normalizeEmail(userData.email);

    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
      throw new Error("Invalid email address");
    }

    // Vérification email rapide (évite un scan complet)
    const existingByEmail = await repo.findByEmail(normalizedEmail);
    if (existingByEmail) throw new Error("User already exists");

    // Unicité du nom (scan actif uniquement pour ce critère)
    const all = await repo.listActive();
    const nameAlreadyUsed = all.some((x) => {
      if (typeof x.name !== "string") return false;
      return x.name.toLowerCase() === normalizedName.toLowerCase();
    });
    if (nameAlreadyUsed) throw new Error("User name already taken");

    const defaultPassword = userData.password || "changeme123";
    const rounds = Math.max(
      8,
      Number(
        process.env.BCRYPT_ROUNDS ||
          (process.env.NODE_ENV === "production" ? 12 : 10),
      ),
    );
    const passwordHash = await bcrypt.hash(defaultPassword, rounds);
    const created = await repo.create({
      name: normalizedName,
      email: normalizedEmail,
      role: userData.role,
      isActive: true,
      isSuperAdmin: userData.role === "admin",
      passwordHash,
    } as any);

    await refreshSuperAdminCache();

    // Emails: informer l'utilisateur et l'admin — déclenchés en arrière-plan pour ne pas bloquer la création
    try {
      const tpl = Templates.user.created({
        name: created.name,
        email: created.email,
        password: defaultPassword,
      });
      const adminSubject = "Nouvel utilisateur";
      const adminBody = `${created.name} (${created.email}) a été créé`;

      // Fire-and-forget: ne pas attendre l'envoi SMTP pour répondre à l'API
      setTimeout(() => {
        Promise.allSettled([
          sendEmail(created.email, tpl.subject, tpl.body, "USER_CREATED"),
          emailAdmin(adminSubject, adminBody, "USER_CREATED"),
        ]).catch(() => {});
      }, 0);
    } catch (_) {}

    devLog.info(`👤 New user created: ${created.email} Role: ${created.role}`);
    return {
      id: created.id,
      name: created.name,
      email: created.email,
      role: created.role,
      createdAt: created.createdAt,
      isActive: created.isActive,
      lastLogin: created.lastLogin,
      isSuperAdmin: created.isSuperAdmin,
    };
  }

  static async ensureActiveUserByEmail(
    email: string | undefined | null,
    name?: string,
    options?: { allowCreate?: boolean },
  ): Promise<{
    user: User | null;
    action: "created" | "reactivated" | "already_active" | "none";
  }> {
    if (!email) return { user: null, action: "none" };
    const repo = await getUserRepo();
    const normalized = String(email).toLowerCase();
    const existingActive = await repo.findByEmail(normalized);
    if (existingActive) {
      return {
        user: {
          id: existingActive.id,
          name: existingActive.name,
          email: existingActive.email,
          role: existingActive.role,
          createdAt: existingActive.createdAt,
          lastLogin: existingActive.lastLogin,
          isActive: existingActive.isActive,
          isSuperAdmin: existingActive.isSuperAdmin,
        },
        action: "already_active",
      };
    }

    // Try to find inactive user by email to reactivate
    const existingAny =
      typeof (repo as any).findAnyByEmail === "function"
        ? await (repo as any).findAnyByEmail(normalized)
        : null;
    if (existingAny && existingAny.isActive === false) {
      const updated = await repo.updateById(existingAny.id, { isActive: true });
      if (!updated) return { user: null, action: "none" };
      await refreshSuperAdminCache();
      devLog.info(`♻️ Reactivated user: ${updated.email}`);
      return {
        user: {
          id: updated.id,
          name: updated.name,
          email: updated.email,
          role: updated.role,
          createdAt: updated.createdAt,
          lastLogin: updated.lastLogin,
          isActive: updated.isActive,
          isSuperAdmin: updated.isSuperAdmin,
        },
        action: "reactivated",
      };
    }

    // If creation is not explicitly allowed, do not auto-create — return none
    if (!options || !options.allowCreate) {
      return { user: null, action: "none" };
    }

    // Create a lightweight active user without sending the welcome email
    const candidateName = (
      name ||
      String(email).split("@")[0] ||
      "User"
    ).trim();
    const normalizedName = normalizeName(candidateName);

    // Ensure unique name among active users
    const activeList = await repo.listActive();
    let uniqueName = normalizedName;
    let suffix = 0;
    while (
      activeList.some(
        (u) =>
          typeof u.name === "string" &&
          u.name.toLowerCase() === uniqueName.toLowerCase(),
      )
    ) {
      suffix += 1;
      uniqueName = `${normalizedName} (${suffix})`;
    }

    const rounds = Math.max(
      8,
      Number(
        process.env.BCRYPT_ROUNDS ||
          (process.env.NODE_ENV === "production" ? 12 : 10),
      ),
    );
    const passwordHash = await bcrypt.hash("changeme123", rounds);

    const created = await repo.create({
      name: uniqueName,
      email: normalized,
      role: "user",
      isActive: true,
      isSuperAdmin: false,
      passwordHash,
    } as any);

    await refreshSuperAdminCache();
    devLog.info(`➕ Auto-created active user for team email: ${created.email}`);
    return {
      user: {
        id: created.id,
        name: created.name,
        email: created.email,
        role: created.role,
        createdAt: created.createdAt,
        lastLogin: created.lastLogin,
        isActive: created.isActive,
        isSuperAdmin: created.isSuperAdmin,
      },
      action: "created",
    };
  }

  static async updateUserRole(
    id: string,
    role: UserRole,
  ): Promise<User | null> {
    const repo = await getUserRepo();
    const updated = await repo.updateById(id, {
      role,
      isSuperAdmin: role === "admin",
    });
    if (!updated) return null;
    await refreshSuperAdminCache();
    devLog.info(`🔄 User role updated: ${updated.email} → ${role}`);
    return {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      createdAt: updated.createdAt,
      lastLogin: updated.lastLogin,
      isActive: updated.isActive,
      isSuperAdmin: updated.isSuperAdmin,
    };
  }

  static async deactivateUser(id: string): Promise<boolean> {
    const repo = await getUserRepo();
    const ok = await repo.deactivateById(id);
    if (!ok) return false;
    for (const token of Array.from(activeSessions)) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET as string) as AuthUser;
        if (decoded.id === id) activeSessions.delete(token);
      } catch {}
    }
    devLog.info(`🚫 User deactivated: ${id}`);
    return true;
  }

  static async deleteUser(id: string): Promise<boolean> {
    const repo = await getUserRepo();
    const u = await repo.findById(id);
    if (!u) return false;
    const ok = await repo.deleteById(id);
    if (!ok) return false;
    for (const token of Array.from(activeSessions)) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET as string) as AuthUser;
        if (decoded.id === id) activeSessions.delete(token);
      } catch {}
    }
    await refreshSuperAdminCache();

    // Emails: informer l'utilisateur supprimé et l'admin
    try {
      const tplUser = Templates.user.deletedUser({ name: u.name });
      await sendEmail(
        u.email,
        tplUser.subject,
        tplUser.body,
        "USER_DELETED_USER",
      );
      const tplAdmin = Templates.user.deletedAdmin({
        name: u.name,
        email: u.email,
      });
      await emailAdmin(tplAdmin.subject, tplAdmin.body, "USER_DELETED_ADMIN");
    } catch (_) {}

    devLog.info(`🗑️ User permanently deleted: ${u.email}`);
    return true;
  }

  static async changePassword(
    id: string,
    newPassword: string,
  ): Promise<boolean> {
    const repo = await getUserRepo();
    const u = await repo.findById(id);
    if (!u || !u.isActive) return false;
    const rounds = Math.max(
      8,
      Number(
        process.env.BCRYPT_ROUNDS ||
          (process.env.NODE_ENV === "production" ? 12 : 10),
      ),
    );
    const passwordHash = await bcrypt.hash(newPassword, rounds);
    await repo.updateById(id, { passwordHash });

    try {
      await sendEmail(
        u.email,
        "Votre mot de passe a été modifié",
        `Bonjour ${u.name},\n\nVotre mot de passe vient d'être modifié. Si vous n'êtes pas à l'origine de ce changement, contactez un administrateur immédiatement.`,
        "AUTH_PASSWORD_CHANGED",
      );
    } catch (_) {}

    devLog.info(`🔑 Password changed for: ${u.email}`);
    return true;
  }

  static async updateProfile(
    id: string,
    updates: { name: string; email?: string },
  ): Promise<User | null> {
    const repo = await getUserRepo();
    const u = await repo.findById(id);
    if (!u || !u.isActive) return null;

    if (
      updates.email &&
      updates.email.toLowerCase() !== u.email.toLowerCase()
    ) {
      throw new Error("Email change not allowed");
    }

    const normalizedName = normalizeName(updates.name);
    const all = await repo.listActive();
    const conflict = all.find(
      (x) =>
        x.id !== id && x.name.toLowerCase() === normalizedName.toLowerCase(),
    );
    if (conflict) throw new Error("User name already taken");

    const updated = await repo.updateById(id, { name: normalizedName });
    if (!updated) return null;

    devLog.info(`📝 Profile updated for: ${updated.email}`);
    return {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      createdAt: updated.createdAt,
      lastLogin: updated.lastLogin,
      isActive: updated.isActive,
      isSuperAdmin: updated.isSuperAdmin,
    };
  }

  static async generateResetToken(email: string): Promise<string | null> {
    const repo = await getUserRepo();
    const user = await repo.findByEmail(email.toLowerCase());
    if (!user) return null;
    const crypto = require("crypto");
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 15 * 60 * 1000);
    resetTokens[token] = { email: user.email, expires };

    try {
      await sendEmail(
        user.email,
        "Réinitialisation de mot de passe",
        `Bonjour ${user.name},\n\nVoici votre code de réinitialisation: ${token}\nCe code expire dans 15 minutes.`,
        "AUTH_PASSWORD_RESET",
      );
    } catch (_) {}

    devLog.info(`🔒 Password reset token generated for: ${user.email}`);
    return token;
  }

  static async verifyResetToken(
    token: string,
    email: string,
  ): Promise<boolean> {
    const resetData = resetTokens[token];
    if (!resetData) return false;
    if (resetData.email.toLowerCase() !== email.toLowerCase()) return false;
    if (new Date() > resetData.expires) {
      delete resetTokens[token];
      return false;
    }
    return true;
  }

  static async resetPasswordWithToken(
    token: string,
    email: string,
    newPassword: string,
  ): Promise<boolean> {
    const isValid = await this.verifyResetToken(token, email);
    if (!isValid) return false;
    const repo = await getUserRepo();
    const user = await repo.findByEmail(email.toLowerCase());
    if (!user || !user.isActive) return false;
    const rounds = Math.max(
      8,
      Number(
        process.env.BCRYPT_ROUNDS ||
          (process.env.NODE_ENV === "production" ? 12 : 10),
      ),
    );
    const passwordHash = await bcrypt.hash(newPassword, rounds);
    await repo.updateById(user.id, { passwordHash });
    delete resetTokens[token];

    try {
      await sendEmail(
        user.email,
        "Mot de passe réinitialisé",
        `Bonjour ${user.name},\n\nVotre mot de passe a été réinitialisé avec succès.`,
        "AUTH_PASSWORD_CHANGED",
      );
    } catch (_) {}

    devLog.info(`🔑 Password reset successful for: ${user.email}`);
    return true;
  }

  static getActiveSessionCount(): number {
    return activeSessions.size;
  }

  static cleanupExpiredTokens(): void {
    let cleaned = 0;
    for (const token of Array.from(activeSessions)) {
      try {
        jwt.verify(token, JWT_SECRET as string);
      } catch {
        activeSessions.delete(token);
        cleaned++;
      }
    }
    if (cleaned > 0) devLog.info(`🧹 Cleaned ${cleaned} expired tokens`);
  }

  static async clearAllSessions(): Promise<void> {
    activeSessions.clear();
    devLog.info("🧹 All sessions cleared");
  }

  static async reinitializeUsers(): Promise<void> {
    const repo = await getUserRepo();
    const shouldSeed =
      process.env.SEED_USERS === "1" || process.env.SEED_USERS === "true";
    if (shouldSeed) {
      await repo.deleteAll();
      await ensureInitialUsers();
      await refreshSuperAdminCache();
      devLog.info("🔄 Users reinitialized to defaults (seed)");
      return;
    }
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (adminEmail && adminPassword) {
      await repo.deleteAll();
      await ensureInitialUsers();
      await refreshSuperAdminCache();
      devLog.info("🔄 Users reinitialized to single env admin");
      return;
    }
    devLog.info("ℹ️ Users reinitialize skipped (no seed/env admin specified)");
  }
}

AuthService.initialize().catch(console.error);

if (process.env.NODE_ENV === "development") {
  setInterval(() => {
    devLog.debug(`📊 Active sessions: ${activeSessions.size}`);
  }, 30 * 1000);
}

setInterval(
  () => {
    AuthService.cleanupExpiredTokens();
  },
  60 * 60 * 1000,
);
