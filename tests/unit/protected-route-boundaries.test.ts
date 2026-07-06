import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const adminLayout = readFileSync("app/admin/layout.tsx", "utf8");
const privacyCenterLayout = readFileSync("app/privacy-center/layout.tsx", "utf8");
const adminGate = readFileSync("components/AdminGate.tsx", "utf8");

describe("protected route boundaries", () => {
  it("gates the complete admin route tree with a trusted admin claim", () => {
    expect(adminLayout).toContain("<AdminGate>{children}</AdminGate>");
    expect(adminGate).toContain("<AuthGate adminOnly>");
  });

  it("marks admin and privacy-center route trees as noindex", () => {
    for (const source of [adminLayout, privacyCenterLayout]) {
      expect(source).toContain("index: false");
      expect(source).toContain("follow: false");
      expect(source).toContain("noarchive: true");
      expect(source).toContain("nosnippet: true");
    }
  });
});
