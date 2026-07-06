import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const functionsSource = readFileSync("functions/src/index.ts", "utf8");
const firestoreRules = readFileSync("firestore.rules", "utf8");

describe("privacy security boundaries", () => {
  it("does not trust user-controlled Firestore role documents for administrator authority", () => {
    expect(functionsSource).not.toContain('snap.data()?.role === "admin"');
    expect(functionsSource).not.toContain('db.collection("users").doc(uid).get()\n  return snap.exists');
    expect(firestoreRules).not.toContain("function isRoleAdmin()");
    expect(firestoreRules).toContain("request.auth.token.admin == true");
    expect(firestoreRules).toContain("request.auth.token.role == 'admin'");
  });

  it("blocks owners from creating or changing authority fields", () => {
    expect(firestoreRules).toContain("ownerIsNotCreatingAuthority");
    expect(firestoreRules).toContain("ownerIsNotChangingAuthority");
    expect(firestoreRules).toContain("['role', 'admin', 'isAdmin']");
  });

  it("requires a stable approved plan hash for destructive deletion", () => {
    expect(functionsSource).toContain("function deletionPlanHash");
    expect(functionsSource).toContain("A current dry-run plan hash is required before destructive deletion.");
    expect(functionsSource).toContain("deletion_execute_blocked_stale_plan_hash");
    expect(functionsSource).not.toContain("if (args.expectedPlanHash && args.expectedPlanHash !== planHash)");
  });
});
