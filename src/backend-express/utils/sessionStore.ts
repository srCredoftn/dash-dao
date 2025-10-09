/**
Rôle: Utilitaires Backend — src/backend-express/utils/sessionStore.ts
Domaine: Backend/Utils
Exports: SessionStore
Dépendances: fs, path, @shared/dao, ./logger
Sécurité: veille à la validation d’entrée, gestion JWT/refresh, et limites de débit
*/
import { writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import type { AuthUser } from "@shared/dao";
import { logger } from "./logger";

const SESSION_FILE = join(process.cwd(), ".sessions.json");

export class SessionStore {
  private static sessions = new Map<string, AuthUser>();
  private static loaded = false;

  // Charger les sessions depuis le fichier
  static loadSessions(): void {
    if (this.loaded) return;

    try {
      if (existsSync(SESSION_FILE)) {
        const data = readFileSync(SESSION_FILE, "utf8");
        const sessionsArray = JSON.parse(data);
        this.sessions = new Map(sessionsArray);
        logger.info("Sessions chargées depuis le stockage", "SESSION");
      }
    } catch (error) {
      logger.warn("Échec du chargement des sessions", "SESSION");
      this.sessions = new Map();
    }
    this.loaded = true;
  }

  // Sauvegarder les sessions dans le fichier
  static saveSessions(): void {
    try {
      const sessionsArray = Array.from(this.sessions.entries());
      writeFileSync(SESSION_FILE, JSON.stringify(sessionsArray, null, 2));
    } catch (error) {
      logger.warn("Échec de sauvegarde des sessions", "SESSION");
    }
  }

  // Récupérer une session
  static getSession(token: string): AuthUser | null {
    this.loadSessions();
    return this.sessions.get(token) || null;
  }

  // Enregistrer/mettre à jour une session
  static setSession(token: string, user: AuthUser): void {
    this.loadSessions();
    this.sessions.set(token, user);
    this.saveSessions();
  }

  // Supprimer une session
  static deleteSession(token: string): boolean {
    this.loadSessions();
    const deleted = this.sessions.delete(token);
    if (deleted) {
      this.saveSessions();
    }
    return deleted;
  }

  // Supprimer les sessions d’un utilisateur
  static deleteUserSessions(userId: string): void {
    this.loadSessions();
    let changed = false;
    for (const [token, user] of this.sessions.entries()) {
      if (user.id === userId) {
        this.sessions.delete(token);
        changed = true;
      }
    }
    if (changed) {
      this.saveSessions();
    }
  }

  // Récupérer toutes les sessions
  static getAllSessions(): Map<string, AuthUser> {
    this.loadSessions();
    return new Map(this.sessions);
  }
}
