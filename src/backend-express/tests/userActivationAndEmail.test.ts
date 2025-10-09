import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import mongoose from "mongoose";

// Utility to reset env values safely
function withEnv(
  vars: Record<string, string | undefined>,
  fn: () => Promise<void> | void,
) {
  const saved: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) saved[k] = process.env[k];
  Object.assign(process.env, vars);
  return Promise.resolve()
    .then(() => fn())
    .finally(() => {
      Object.assign(process.env, saved);
    });
}

describe("AuthService.ensureActiveUserByEmail", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns none by default (no auto-create) for unknown email", async () => {
    await withEnv(
      {
        USE_MONGO: "false",
        ADMIN_EMAIL: "",
        ADMIN_PASSWORD: "",
        SEED_USERS: "false",
      },
      async () => {
        // Avoid mongoose model overwrite when modules import mongo models
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((mongoose as any).models?.User) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          delete (mongoose as any).models.User;
        }
        const { AuthService } = await import("../services/authService");
        const res = await AuthService.ensureActiveUserByEmail(
          "john.doe@example.com",
          "John Doe",
        );
        expect(res.action).toBe("none");
        expect(res.user).toBeNull();
      },
    );
  });

  it("reactivates an existing inactive user and returns reactivated", async () => {
    await withEnv(
      {
        USE_MONGO: "false",
        ADMIN_EMAIL: "",
        ADMIN_PASSWORD: "",
        SEED_USERS: "false",
      },
      async () => {
        // Prevent mongoose model redefinition between runs
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((mongoose as any).models?.User) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          delete (mongoose as any).models.User;
        }
        vi.doMock("bcryptjs", () => ({
          default: {
            hash: vi.fn(async () => "hash"),
            compare: vi.fn(async () => true),
          },
        }));
        vi.doMock("../services/txEmail", () => ({
          Templates: {
            user: {
              created: () => ({ subject: "", body: "" }),
              deletedUser: () => ({ subject: "", body: "" }),
              deletedAdmin: () => ({ subject: "", body: "" }),
            },
          },
          sendEmail: vi.fn(async () => {}),
          emailAdmin: vi.fn(async () => {}),
        }));
        const { AuthService } = await import("../services/authService");
        const created = await AuthService.createUser({
          name: "Jane Doe",
          email: "jane.doe@example.com",
          role: "user" as any,
          password: "secret123",
        });
        expect(created.isActive).toBe(true);

        const deactivated = await AuthService.deactivateUser(created.id);
        expect(deactivated).toBe(true);

        const res = await AuthService.ensureActiveUserByEmail(
          created.email,
          created.name,
          { allowCreate: false },
        );
        expect(res.action).toBe("reactivated");
        expect(res.user?.email).toBe(created.email);
        expect(res.user?.isActive).toBe(true);
      },
    );
  }, 20000);

  it("creates only when explicitly allowed (allowCreate=true)", async () => {
    await withEnv(
      {
        USE_MONGO: "false",
        ADMIN_EMAIL: "",
        ADMIN_PASSWORD: "",
        SEED_USERS: "false",
      },
      async () => {
        // Prevent mongoose model redefinition between runs
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((mongoose as any).models?.User) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          delete (mongoose as any).models.User;
        }
        vi.doMock("bcryptjs", () => ({
          default: {
            hash: vi.fn(async () => "hash"),
            compare: vi.fn(async () => true),
          },
        }));
        vi.doMock("../services/txEmail", () => ({
          Templates: {
            user: {
              created: () => ({ subject: "", body: "" }),
              deletedUser: () => ({ subject: "", body: "" }),
              deletedAdmin: () => ({ subject: "", body: "" }),
            },
          },
          sendEmail: vi.fn(async () => {}),
          emailAdmin: vi.fn(async () => {}),
        }));
        const { AuthService } = await import("../services/authService");
        const res1 = await AuthService.ensureActiveUserByEmail(
          "new.user@example.com",
          "New User",
          { allowCreate: false },
        );
        expect(res1.action).toBe("none");

        const res2 = await AuthService.ensureActiveUserByEmail(
          "new.user@example.com",
          "New User",
          { allowCreate: true },
        );
        expect(res2.action).toBe("created");
        expect(res2.user?.email).toBe("new.user@example.com");
        expect(res2.user?.isActive).toBe(true);
      },
    );
  }, 20000);
});

describe("Auto user audit store", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("records events with masked emails and clears", async () => {
    const { recordAutoUserEvent, listAutoUserEvents, clearAutoUserEvents } =
      await import("../services/autoUserAudit");

    clearAutoUserEvents();
    recordAutoUserEvent({
      action: "created",
      email: "test@example.com",
      daoId: "d1",
      memberName: "John",
    });
    recordAutoUserEvent({ action: "reactivated", email: "user@domain.com" });
    recordAutoUserEvent({
      action: "error",
      email: "oops@domain.com",
      message: "Failed",
    });

    const items = listAutoUserEvents(10);
    expect(items.length).toBeGreaterThanOrEqual(3);
    for (const it of items) {
      expect(it.emailMasked.includes("***")).toBe(true);
    }

    clearAutoUserEvents();
    expect(listAutoUserEvents(10).length).toBe(0);
  });
});

describe("emailAllUsers filters to active users and valid emails", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses only active users (via AuthService.getAllUsers) and appends admin email when set", async () => {
    await withEnv(
      {
        ADMIN_EMAIL: "admin@test.local",
      },
      async () => {
        vi.doMock("../services/authService", () => ({
          AuthService: {
            getAllUsers: vi.fn(async () => [
              {
                id: "1",
                name: "A",
                email: "a@example.com",
                role: "user",
                isActive: true,
              } as any,
            ]),
          },
        }));

        const tx: any = await vi.importActual("../services/txEmail");
        const spy = vi
          .spyOn(tx, "sendEmail")
          .mockResolvedValue(undefined as any);
        await tx.emailAllUsers("Subject", "Body", "SYSTEM_TEST");

        expect(spy).toHaveBeenCalledTimes(1);
        const args = spy.mock.calls[0];
        const recipients = Array.isArray(args[0])
          ? (args[0] as string[])
          : [args[0] as string];
        expect(recipients).toContain("a@example.com");
        expect(recipients).toContain("admin@test.local");
      },
    );
  }, 15000);
});

describe("SMTP transport fallback", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("allows anonymous transport when credentials are absent", async () => {
    await withEnv(
      {
        NODE_ENV: "development",
        SMTP_DISABLE: "false",
        SMTP_DRY_RUN: "false",
        SMTP_HOST: "smtp.test.local",
        SMTP_USER: "",
        SMTP_PASS: "",
        SMTP_QUEUE_INTERVAL_MS: "0",
        SMTP_QUEUE_PATH: "./tmp/test-email-queue.json",
      },
      async () => {
        const verifyMock = vi.fn().mockResolvedValue(undefined);
        const sendMailMock = vi.fn().mockResolvedValue({});
        const createTransportMock = vi.fn(() => ({
          verify: verifyMock,
          sendMail: sendMailMock,
        }));

        vi.doMock("nodemailer", () => ({
          default: { createTransport: createTransportMock },
          createTransport: createTransportMock,
        }));

        const tx = await import("../services/txEmail");
        await expect(
          tx.sendEmail("alice@example.com", "Sujet", "Contenu", "SYSTEM_TEST"),
        ).resolves.toBeUndefined();

        expect(createTransportMock).toHaveBeenCalledTimes(1);
        const options = createTransportMock.mock.calls[0][0];
        expect(options.host).toBe("smtp.test.local");
        expect(options.auth).toBeUndefined();
        expect(verifyMock).toHaveBeenCalledTimes(1);
        expect(sendMailMock).toHaveBeenCalledTimes(1);
      },
    );
  });
});
