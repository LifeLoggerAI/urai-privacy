import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DeletionRequestStatus } from "../../components/DeletionRequestStatus";
import { describe, expect, it } from "vitest";

const adminLayout = readFileSync("app/admin/layout.tsx", "utf8");
const privacyCenterLayout = readFileSync("app/privacy-center/layout.tsx", "utf8");
const adminGate = readFileSync("components/AdminGate.tsx", "utf8");
const privacyRequestsPage = readFileSync("app/admin/privacy-requests/page.tsx", "utf8");

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

  it("does not display destructive deletion as final before residual verification", () => {
    const ownerPage = readFileSync("app/privacy-center/delete/page.tsx", "utf8");
    for (const page of [ownerPage, privacyRequestsPage]) {
      expect(page).toContain("<DeletionRequestStatus request={request}");
    }
    for (const fields of [{}, { deletionCompletionVerified: false }, {
      deletionCompletionVerified: true, deletionCompletionVerificationRequired: false
    }]) {
      const html = renderToStaticMarkup(createElement(DeletionRequestStatus, { request: { status: "completed", ...fields } }));
      expect(html).toContain("verification pending");
      expect(html).not.toContain("completed");
    }
  });

  it("shows only the recognized Jobs evidence in the subject's account deletion status", () => {
    const request = { status: "processing", scope: "account", jobsDeletionEvidenceState: "source-receipt-matched" };
    const render = (fields: Record<string, unknown>) =>
      renderToStaticMarkup(createElement(DeletionRequestStatus, { request: { ...request, ...fields } }));
    expect(render({})).toContain("Privacy matched a Jobs processing receipt");
    expect(render({})).toContain("requires verification across services");
    expect(render({ status: "rejected", deletionCompletionVerificationRequired: true })).toContain(">rejected<");
    expect(render({ jobsDeletionEvidenceState: undefined })).not.toContain("receipt");
    expect(render({ jobsDeletionEvidenceState: true })).not.toContain("receipt");
    expect(render({ scope: "privacy-data" })).not.toContain("receipt");
  });
});
