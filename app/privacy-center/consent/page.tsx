"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { AuthGate } from "@/components/AuthGate";
import {
  getConsentPurposeRegistry,
  subscribeUserCollection,
  updateConsentPreference
} from "@/lib/firebase-privacy-client";

type ConsentStatus = "granted" | "denied" | "revoked";
type ConsentPurpose = {
  purpose: string;
  label: string;
  consentTier: string;
  grantDurationDays: number;
  description: string;
};

type ConsentRecord = Record<string, unknown> & { id: string };

function isConsentPurpose(value: unknown): value is ConsentPurpose {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.purpose === "string" &&
    typeof item.label === "string" &&
    typeof item.consentTier === "string" &&
    typeof item.grantDurationDays === "number" &&
    typeof item.description === "string"
  );
}

function formatExpiry(value: unknown) {
  if (!value) return "Not active";
  if (typeof value === "object" && value && "toDate" in value) {
    const converter = (value as { toDate?: () => Date }).toDate;
    if (typeof converter === "function") return converter.call(value).toLocaleString();
  }
  const parsed = typeof value === "string" ? new Date(value) : null;
  return parsed && Number.isFinite(parsed.getTime()) ? parsed.toLocaleString() : "Unavailable";
}

export default function ConsentPage() {
  return (
    <section>
      <div className="eyebrow">Consent</div>
      <h1>Manage privacy consent preferences</h1>
      <p className="lede">
        Consent controls come from the active server policy. Grants expire, denials and revocations fail closed,
        and every change is recorded through the authenticated privacy workflow.
      </p>
      <AuthGate>{(user) => <ConsentPanel user={user} />}</AuthGate>
    </section>
  );
}

function ConsentPanel({ user }: { user: User }) {
  const [records, setRecords] = useState<ConsentRecord[]>([]);
  const [purposes, setPurposes] = useState<ConsentPurpose[]>([]);
  const [policyVersion, setPolicyVersion] = useState<string | null>(null);
  const [registryError, setRegistryError] = useState("");
  const [message, setMessage] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(
    () => subscribeUserCollection("consentRecords", user.uid, (rows) => setRecords(rows as ConsentRecord[])),
    [user.uid]
  );

  useEffect(() => {
    let cancelled = false;
    setRegistryError("");
    getConsentPurposeRegistry()
      .then((result) => {
        if (cancelled) return;
        if (!result || typeof result !== "object") {
          throw new Error("Consent policy registry is unavailable or invalid.");
        }
        const nextPurposes = Array.isArray(result.purposes)
          ? result.purposes.filter(isConsentPurpose)
          : [];
        if (nextPurposes.length === 0 || typeof result.policyVersion !== "string") {
          throw new Error("Consent policy registry is unavailable or invalid.");
        }
        setPurposes(nextPurposes);
        setPolicyVersion(result.policyVersion);
      })
      .catch((error) => {
        if (!cancelled) {
          setPurposes([]);
          setPolicyVersion(null);
          setRegistryError(error instanceof Error ? error.message : "Consent policy registry failed to load.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const recordByPurpose = useMemo(
    () => new Map(records.map((record) => [String(record.purpose), record])),
    [records]
  );

  async function submit(purpose: string, consentTier: string, status: ConsentStatus) {
    setBusyKey(`${purpose}:${status}`);
    setMessage("");
    try {
      const result = await updateConsentPreference({ purpose, consentTier, status });
      if (!result || typeof result !== "object") {
        throw new Error("Consent update did not return a valid confirmation.");
      }
      const expiry = typeof result.expiresAt === "string"
        ? ` Expires ${new Date(result.expiresAt).toLocaleString()}.`
        : "";
      const consentId = typeof result.consentId === "string" && result.consentId
        ? result.consentId
        : purpose;
      setMessage(`Consent updated: ${consentId} → ${status}.${expiry}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Consent update failed");
    } finally {
      setBusyKey(null);
    }
  }

  if (registryError) {
    return (
      <article className="card">
        <h3>Consent controls unavailable</h3>
        <p className="muted">{registryError}</p>
        <p className="muted">No consent change was attempted.</p>
      </article>
    );
  }

  if (!policyVersion || purposes.length === 0) {
    return (
      <article className="card">
        <h3>Loading consent policy</h3>
        <p className="muted">Controls remain disabled until the server policy is verified.</p>
      </article>
    );
  }

  return (
    <div className="grid">
      <article className="card">
        <h3>Active policy</h3>
        <p className="muted">Version: {policyVersion}</p>
        <p className="muted">Unregistered purposes are denied automatically.</p>
      </article>
      {purposes.map((item) => {
        const record = recordByPurpose.get(item.purpose);
        const activeStatus = typeof record?.status === "string" ? record.status : "not set";
        return (
          <article className="card" key={item.purpose}>
            <h3>{item.label}</h3>
            <p>{item.description}</p>
            <p><span className="status warn">{activeStatus}</span></p>
            <p className="muted">Tier: {item.consentTier}</p>
            <p className="muted">Maximum grant duration: {item.grantDurationDays} days</p>
            <p className="muted">Current expiry: {formatExpiry(record?.expiresAt)}</p>
            <button className="button" disabled={busyKey !== null} type="button" onClick={() => submit(item.purpose, item.consentTier, "granted")}>Grant</button>
            <button className="button" disabled={busyKey !== null} type="button" onClick={() => submit(item.purpose, item.consentTier, "denied")}>Deny</button>
            <button className="button" disabled={busyKey !== null} type="button" onClick={() => submit(item.purpose, item.consentTier, "revoked")}>Revoke</button>
          </article>
        );
      })}
      {message ? <article className="card"><h3>Latest update</h3><p className="muted">{message}</p></article> : null}
    </div>
  );
}
