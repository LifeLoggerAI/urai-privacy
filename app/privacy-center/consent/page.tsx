"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { AuthGate } from "@/components/AuthGate";
import { subscribeUserCollection, updateConsentPreference } from "@/lib/firebase-privacy-client";

const CONSENT_NOTICE_VERSION = "privacy-consent-2026-07-11";

const consentPurposes = [
  { purpose: "memory.storage", label: "Memory storage", tier: "C1", description: "Store memories and user-created content." },
  { purpose: "behavior.passive-context", label: "Passive context", tier: "C2", description: "Use app metadata and interaction rhythms." },
  { purpose: "location.context", label: "Location context", tier: "C3", description: "Use location and place-category context." },
  { purpose: "inference.sensitive", label: "Sensitive inference", tier: "C4", description: "Create sensitive inferences only when explicitly allowed." },
  { purpose: "biometric.identity", label: "Biometric identity", tier: "C5", description: "Use biometric identity data for approved identity features." },
  { purpose: "ai.personalization", label: "AI personalization", tier: "C6", description: "Use companion memory and personalization context." },
  { purpose: "data.export", label: "Data export", tier: "C7", description: "Prepare structured records and consent history for export." },
  { purpose: "data.monetization.anonymized", label: "Anonymized monetization", tier: "C8", description: "Use approved de-identified patterns for monetization." }
] as const;

type ConsentStatus = "granted" | "denied" | "revoked";

export default function ConsentPage() {
  return (
    <section>
      <div className="eyebrow">Consent</div>
      <h1>Manage privacy consent preferences</h1>
      <p className="lede">Each change uses the canonical C1–C8 purpose registry, is recorded through authenticated server code, and fails closed when a purpose or policy version is unknown.</p>
      <AuthGate>{(user) => <ConsentPanel user={user} />}</AuthGate>
    </section>
  );
}

function ConsentPanel({ user }: { user: User }) {
  const [records, setRecords] = useState<Array<Record<string, unknown>>>([]);
  const [message, setMessage] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => subscribeUserCollection("consentRecords", user.uid, setRecords), [user.uid]);

  const statusByPurpose = new Map(records.map((record) => [String(record.purpose), String(record.status)]));

  async function submit(purpose: string, status: ConsentStatus) {
    setBusyKey(`${purpose}:${status}`);
    setMessage("");
    try {
      const result = await updateConsentPreference({
        purpose,
        status,
        surface: "privacy-center",
        jurisdiction: "unknown",
        noticeVersion: CONSENT_NOTICE_VERSION
      });
      setMessage(`Consent updated: ${String(result.consentId ?? purpose)} -> ${status}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Consent update failed");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="grid">
      {consentPurposes.map((item) => {
        const activeStatus = statusByPurpose.get(item.purpose) ?? "not set";
        return (
          <article className="card" key={item.purpose}>
            <h3>{item.label}</h3>
            <p className="muted">{item.description}</p>
            <p><span className="status warn">{activeStatus}</span></p>
            <p className="muted">Tier: {item.tier}</p>
            <button className="button" disabled={busyKey !== null} type="button" onClick={() => submit(item.purpose, "granted")}>Grant</button>
            <button className="button" disabled={busyKey !== null} type="button" onClick={() => submit(item.purpose, "denied")}>Deny</button>
            <button className="button" disabled={busyKey !== null} type="button" onClick={() => submit(item.purpose, "revoked")}>Revoke</button>
          </article>
        );
      })}
      {message ? <article className="card"><h3>Latest update</h3><p className="muted">{message}</p></article> : null}
    </div>
  );
}
