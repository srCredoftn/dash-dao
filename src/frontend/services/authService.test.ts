/**
Rôle: Service HTTP/Client — src/frontend/services/authService.test.ts
Domaine: Frontend/Services
Dépendances: vitest, ./authService, @shared/dao
Liens: appels /api, utils de fetch, types @shared/*
Sécurité: veille à la validation d’entrée, gestion JWT/refresh, et limites de débit
*/
import { describe, it, expect, vi, beforeEach } from "vitest";
import { authService } from "./authService";
import type { LoginCredentials, AuthResponse } from "@shared/dao";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("AuthService", () => {
  beforeEach(() => {
    mockFetch.mockClear();
    localStorage.clear();
  });

  describe("login", () => {
    it("should successfully login with valid credentials", async () => {
      const mockResponse: AuthResponse = {
        user: {
          id: "1",
          name: "Test User",
          email: "test@example.com",
          role: "user",
        },
        token: "mock-jwt-token",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const credentials: LoginCredentials = {
        email: "test@example.com",
        password: "password123",
      };

      const result = await authService.login(credentials);

      expect(mockFetch).toHaveBeenCalledWith("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
        signal: expect.any(AbortSignal),
      });

      expect(result).toEqual(mockResponse);
      expect(localStorage.setItem).toHaveBeenCalledWith(
        "auth_token",
        "mock-jwt-token",
      );
      expect(localStorage.setItem).toHaveBeenCalledWith(
        "auth_user",
        JSON.stringify(mockResponse.user),
      );
    });

    it("should throw error for invalid credentials", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: "Invalid credentials" }),
      });

      const credentials: LoginCredentials = {
        email: "wrong@example.com",
        password: "wrongpassword",
      };

      await expect(authService.login(credentials)).rejects.toThrow(
        "Identifiants incorrects, veuillez réessayer",
      );
    });
  });

  describe("logout", () => {
    it("should clear local storage on logout", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await authService.logout();

      expect(localStorage.removeItem).toHaveBeenCalledWith("auth_token");
      expect(localStorage.removeItem).toHaveBeenCalledWith("auth_user");
    });
  });

  describe("isAuthenticated", () => {
    it("should return true when token and user exist", () => {
      // Simuler l'existence d'un token dans l'instance du service
      (authService as any).token = "mock-token";
      localStorage.setItem(
        "auth_user",
        JSON.stringify({
          id: "1",
          name: "Test User",
          email: "test@example.com",
          role: "user",
        }),
      );

      const result = authService.isAuthenticated();

      expect(result).toBe(true);

      // Nettoyer
      (authService as any).token = null;
    });

    it("should return false when token or user is missing", () => {
      const result = authService.isAuthenticated();
      expect(result).toBe(false);
    });
  });

  describe("getStoredUser", () => {
    it("should return parsed user from localStorage", () => {
      const mockUser = {
        id: "1",
        name: "Test User",
        email: "test@example.com",
        role: "user" as const,
      };

      localStorage.setItem("auth_user", JSON.stringify(mockUser));

      const result = authService.getStoredUser();
      expect(result).toEqual(mockUser);
    });

    it("should return null for invalid JSON", () => {
      // Nettoyer le localStorage d'abord
      localStorage.clear();

      // Mock localStorage.getItem pour retourner du JSON invalide
      const mockGetItem = vi.fn().mockReturnValue("invalid-json");
      (global.localStorage as any).getItem = mockGetItem;

      const result = authService.getStoredUser();
      expect(result).toBeNull();

      // Restaurer le mock
      mockGetItem.mockRestore();
    });
  });

  describe("clearAuth", () => {
    it("should clear authentication data", () => {
      authService.clearAuth();

      expect(localStorage.removeItem).toHaveBeenCalledWith("auth_token");
      expect(localStorage.removeItem).toHaveBeenCalledWith("auth_user");
    });
  });
});
