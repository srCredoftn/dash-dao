/**
Rôle: Entrée/Bootstrap backend — src/backend-express/tests/security.spec.ts
Domaine: Backend/Core
Dépendances: vitest, zod
*/
import { describe, it, expect } from "vitest";
import { z } from "zod";

// Reuse similar schemas from routes
const createTaskSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  isApplicable: z.boolean(),
  progress: z.number().min(0).max(100).nullable(),
  comment: z.string().max(1000).optional(),
  assignedTo: z.array(z.string().max(50)).optional(),
});

function sanitizeString(input: string): string {
  return input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .trim();
}

describe("Security validations", () => {
  it("rejects NoSQL injection payloads in string fields", () => {
    const payload: any = {
      name: { $ne: "" },
      isApplicable: true,
      progress: 0,
    };
    expect(() => createTaskSchema.parse(payload)).toThrow();
  });

  it("rejects $gt injection in arrays", () => {
    const payload: any = {
      name: "Valid",
      isApplicable: true,
      progress: 0,
      assignedTo: [{ $gt: "" }],
    };
    expect(() => createTaskSchema.parse(payload)).toThrow();
  });

  it("sanitizes XSS content from strings", () => {
    const dirty = "<script>alert('x')</script>Hello <b>World</b>";
    const clean = sanitizeString(dirty);
    expect(clean).toBe("Hello World");
  });
});
