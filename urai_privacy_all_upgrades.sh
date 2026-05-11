#!/bin/bash
set -euo pipefail
set +H

# =========================
# URAI-PRIVACY: ALL-UPGRADES (CORE)
# =========================

ROOT="${1:-/home/user/urai-privacy}"
cd "$ROOT"

echo "== ROOT: $(pwd) =="

command -v corepack >/dev/null 2>&1 || true
corepack enable >/dev/null 2>&1 || true

# --- helpers ---
node_patch() {
  # usage: node_patch <file> <js>
  local f="$1"; shift
  local js="$1"; shift || true
  echo "[node_patch] patching $f"
  node -e "
    const fs=require('fs');
    const path='$f';
    let s=fs.existsSync(path)?fs.readFileSync(path,'utf8'):'';
    console.log('[node_patch] read:', s.slice(0, 100));
    const out=(function(input){
      try {
        $js
      } catch (e) {
        console.error('ERROR in node_patch for $f:', e.message);
        return input; // return original on error
      }
    })(s);
    fs.mkdirSync(require('path').dirname(path), { recursive:true });
    console.log('[node_patch] writing:', out.slice(0, 100));
    fs.writeFileSync(path, out, 'utf8');
  "
}

echo "== deps (safe) =="
if [ -f package.json ]; then
  # framer-motion is optional but nice for subtle reveals
  pnpm add framer-motion lucide-react >/dev/null 2>&1 || pnpm add framer-motion lucide-react
fi

echo "== ensure app router dirs =="
mkdir -p app/components app/privacy-center app/data-requests app/.well-known/privacy.json

# -------------------------
# 1) Global Trust Footer component
# -------------------------
cat > app/components/TrustFooter.tsx <<'TSX'
'use client';

import * as React from 'react';

export function TrustFooter() {
  return (
    <footer className="mt-16 border-t border-white/10 bg-black/30">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="grid gap-6 md:grid-cols-3">
          <div>
            <div className="text-sm font-semibold tracking-wide text-white/90">
              URAI Privacy Promise
            </div>
            <p className="mt-2 text-sm leading-6 text-white/70">
              We design for clarity, consent, and dignity. No dark patterns.
            </p>
          </div>

          <div>
            <div className="text-sm font-semibold tracking-wide text-white/90">
              Compliance posture
            </div>
            <ul className="mt-2 space-y-1 text-sm text-white/70">
              <li>GDPR-aligned (rights-first)</li>
              <li>CCPA-ready (opt-out & access flows)</li>
              <li>Security-minded defaults</li>
            </ul>
          </div>

          <div>
            <div className="text-sm font-semibold tracking-wide text-white/90">
              Contact
            </div>
            <p className="mt-2 text-sm leading-6 text-white/70">
              For privacy questions or requests, use the Data Requests page.
            </p>
            <a
              className="mt-3 inline-flex text-sm text-white underline decoration-white/40 underline-offset-4 hover:decoration-white"
              href="/data-requests"
            >
              Go to Data Requests
            </a>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-2 text-xs text-white/60">
          <span className="rounded-full border border-white/15 px-3 py-1">GDPR-aligned</span>
          <span className="rounded-full border border-white/15 px-3 py-1">CCPA-ready</span>
          <span className="rounded-full border border-white/15 px-3 py-1">No sale of personal data</span>
          <span className="rounded-full border border-white/15 px-3 py-1">No dark patterns</span>
          <span className="rounded-full border border-white/15 px-3 py-1">Audit-friendly</span>
        </div>

        <div className="mt-8 text-xs text-white/45">
          © {new Date().getFullYear()} URAI. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
TSX

# -------------------------
# 2) Policy Header component (TL;DR + Last Updated)
# -------------------------
cat > app/components/PolicyHeader.tsx <<'TSX'
'use client';

import * as React from 'react';

export function PolicyHeader(props: {
  title: string;
  updatedISO: string;
  tldr: string[];
}) {
  const updated = new Date(props.updatedISO);
  const updatedLabel = isNaN(updated.getTime())
    ? props.updatedISO
    : updated.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <header className="mx-auto max-w-3xl px-6 pt-10">
      <h1 className="text-3xl font-semibold tracking-tight text-white">
        {props.title}
      </h1>
      <div className="mt-2 text-sm text-white/60">
        Last updated: <span className="text-white/80">{updatedLabel}</span>
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="text-sm font-semibold text-white/90">TL;DR</div>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-white/70">
          {props.tldr.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      </div>
    </header>
  );
}
TSX

# -------------------------
# 3) Privacy Center (authority hub)
# -------------------------
cat > app/privacy-center/page.tsx <<'TSX'
import * as React from 'react';
import { TrustFooter } from '../components/TrustFooter';

export default function PrivacyCenterPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-black to-zinc-950 text-white">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Privacy Center</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
          This is the plain-English hub for how URAI handles data, your rights, and how to make requests.
        </p>

        <section className="mt-10 grid gap-6 md:grid-cols-2">
          <Card title="What we collect (high level)">
            <ul className="list-disc space-y-2 pl-5">
              <li>Account & contact info (if you provide it)</li>
              <li>Product usage events (to improve the experience)</li>
              <li>Device / technical logs (security and reliability)</li>
              <li>Optional user content only when you explicitly submit it</li>
            </ul>
          </Card>

          <Card title="Why we collect it">
            <ul className="list-disc space-y-2 pl-5">
              <li>Provide and secure the service</li>
              <li>Diagnose outages, prevent abuse</li>
              <li>Improve features and performance</li>
              <li>Honor consent settings and user requests</li>
            </ul>
          </Card>

          <Card title="Retention (default posture)">
            <ul className="list-disc space-y-2 pl-5">
              <li>We keep data only as long as needed for the purpose collected</li>
              <li>Security logs may be retained longer for abuse prevention</li>
              <li>You can request export or deletion via Data Requests</li>
            </ul>
          </Card>

          <Card title="Your rights">
            <ul className="list-disc space-y-2 pl-5">
              <li>Access / export your data</li>
              <li>Request deletion</li>
              <li>Correct inaccurate info</li>
              <li>Withdraw consent where applicable</li>
            </ul>
          </Card>
        </section>

        <section className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold">Make a request</h2>
          <p className="mt-2 text-sm text-white/70">
            Use the self-service request page to submit an export or deletion request.
          </p>
          <a
            className="mt-4 inline-flex rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15"
            href="/data-requests"
          >
            Open Data Requests
          </a>
        </section>
      </div>

      <TrustFooter />
    </main>
  );
}

function Card(props: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <div className="text-sm font-semibold text-white/90">{props.title}</div>
      <div className="mt-3 text-sm leading-6 text-white/70">{props.children}</div>
    </div>
  );
}
TSX

# -------------------------
# 4) /.well-known/privacy.json (machine-readable)
# -------------------------
cat > app/.well-known/privacy.json/route.ts <<'TS'
export const runtime = 'nodejs';

export async function GET() {
  const body = {
    name: "URAI Privacy Center",
    url: "https://YOUR_DOMAIN_HERE/privacy-center",
    jurisdiction: ["US", "EU", "UK"],
    commitments: [
      "No dark patterns",
      "No sale of personal data",
      "Rights-first posture",
      "Audit-friendly logging"
    ],
    requests: {
      dataExport: "/data-requests",
      deletion: "/data-requests",
      contact: "/data-requests"
    },
    lastUpdatedISO: new Date().toISOString()
  };

  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300"
    }
  });
}
TS

# -------------------------
# 5) Data Requests page (self-service)
# (Front-end only; wire to Firestore next if desired)
# -------------------------
cat > app/data-requests/page.tsx <<'TSX'
'use client';

import * as React from 'react';
import { TrustFooter } from '../components/TrustFooter';

type Kind = 'EXPORT' | 'DELETE' | 'WITHDRAW_CONSENT';

export default function DataRequestsPage() {
  const [kind, setKind] = React.useState<Kind>('EXPORT');
  const [email, setEmail] = React.useState('');
  const [details, setDetails] = React.useState('');
  const [submitted, setSubmitted] = React.useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    // v1: UI + guidance only
    // v1.3: wire this to Firestore (privacy_requests) with validation + rate-limits.
    setSubmitted(true);
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-black to-zinc-950 text-white">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Data Requests</h1>
        <p className="mt-3 text-sm leading-6 text-white/70">
          Submit a request for data export, deletion, or consent withdrawal.
        </p>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
          {submitted ? (
            <div>
              <div className="text-sm font-semibold text-white/90">Request received</div>
              <p className="mt-2 text-sm text-white/70">
                Your request was captured locally (UI v1). Next step: wire to Firestore + confirmation receipt.
              </p>
              <button
                className="mt-4 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
                onClick={() => setSubmitted(false)}
              >
                Submit another
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              <div>
                <label className="text-sm text-white/80">Request type</label>
                <select
                  className="mt-2 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none"
                  value={kind}
                  onChange={(e) => setKind(e.target.value as Kind)}
                >
                  <option value="EXPORT">Export my data</option>
                  <option value="DELETE">Delete my data</option>
                  <option value="WITHDRAW_CONSENT">Withdraw consent</option>
                </select>
              </div>

              <div>
                <label className="text-sm text-white/80">Email</label>
                <input
                  className="mt-2 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@domain.com"
                  required
                />
              </div>

              <div>
                <label className="text-sm text-white/80">Details (optional)</label>
                <textarea
                  className="mt-2 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  rows={5}
                  placeholder="Anything that helps us locate your data or confirm your request."
                />
              </div>

              <button
                className="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
                type="submit"
              >
                Submit request
              </button>

              <p className="text-xs text-white/50">
                v1 note: this UI is live-ready; wiring to Firestore + confirmation receipts is the next step (v1.3).
              </p>
            </form>
          )}
        </div>
      </div>

      <TrustFooter />
    </main>
  );
}
TSX

# -------------------------
# 6) Patch global layout to include TrustFooter (best effort)
# If app/layout.tsx exists, inject footer before </body>.
# -------------------------
if [ -f app/layout.tsx ]; then
  echo "== patch app/layout.tsx to include TrustFooter import + render (best-effort) =="

  node_patch "app/layout.tsx" "
    let s = input;

    // ensure import
    if (!s.includes(\"from './components/TrustFooter'\") && !s.includes(\"TrustFooter\")) {
      // naive: add near top after first imports
      s = s.replace(/(^\\s*import[^;]+;\\s*\\n)+/m, (m) => m + \"import { TrustFooter } from './components/TrustFooter';\\n\");
      if (!s.includes(\"import { TrustFooter }\")) {
        // if no imports matched, just prepend
        s = \"import { TrustFooter } from './components/TrustFooter';\\n\" + s;
      }
    }

    // inject component before closing body/html
    if (!s.includes('<TrustFooter />')) {
      s = s.replace(/(\\s*<\\/body>)/, '      <TrustFooter />\\n' + '$1');
    }

    return s;
  "
fi

echo "== build sanity =="
pnpm -s install
pnpm -s build

echo "== DONE: core upgrades installed =="
echo "Next: wire /data-requests to Firestore + rate-limit + receipts (v1.3)."
