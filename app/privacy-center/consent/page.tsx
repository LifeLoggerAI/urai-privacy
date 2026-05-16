"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { AuthGate } from "@/components/AuthGate";
import { subscribeUserCollection, updateConsentPreference } from "@/lib/firebase-privacy-client";

const consentPurposes = [
  { purpose: "audio_transcription", label: "Audio transcription", tier: "C3" },
  { purpose: "gps_context", label: "GPS context", tier: "C2" },
  { purpose: "ai_insights", label: "AI insights", tier: "C4" },
  { purpose: "deidentified_analytics", label: "De-identified analytics", tier: "C5" },
  { purpose: "data_monetization", label: "Data monetization", tier: "C8" }
] as const;

type ConsentStatus = "granted" | "denied" | "revoked";

export default function ConsentPage() {
  return (
    <section>
      <div className="eyebrow">Consent</div>
      <h1>Manage privacy consent preferences</h1>
      <p className="lede">Consent changes are submitted through the authenticated Firebase callable workflow and recorded as audit events. No demo consent record is used.</p>
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

  async function submit(purpose: string, consentTier: string, status: ConsentStatus) {
    setBusyKey(`${purpose}:${status}`);
    setMessage("");
    try {
      const result = await updateConsentPreference({ purpose, consentTier, status });
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
            <p><span className="status warn">{activeStatus}</span></p>
            <p className="muted">Tier: {item.tier}</p>
            <button className="button" disabled={busyKey !== null} type="button" onClick={() => submit(item.purpose, item.tier, "granted")}>Grant</button>
            <button className="button" disabled={busyKey !== null} type="button" onClick={() => submit(item.purpose, item.tier, "denied")}>Deny</button>
            <button className="button" disabled={busyKey !== null} type="button" onClick={() => submit(item.purpose, item.tier, "revoked")}>Revoke</button>
          </article>
        );
      })}
      {message ? <article className="card"><h3>Latest update</h3><p className="muted">{message}</p></article> : null}
    </div>
  );
}