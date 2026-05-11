#!/bin/bash
set -euo pipefail
set +H

# ===============================================
# URAI-PRIVACY: v1.3 BACKEND WIRING (GOLDEN PATH)
# ===============================================

ROOT="${1:-/home/user/urai-privacy}"
cd "$ROOT"

echo "== ROOT: $(pwd) =="

# --- helpers ---
ensure_file_contains() {
  # usage: ensure_file_contains <file> <sentinel> <text>
  local file="$1"
  local sentinel="$2"
  local text="$3"
  if ! grep -q "$sentinel" "$file"; then
    echo "== patching $file with sentinel: $sentinel =="
    printf "\n%s\n" "$text" >> "$file"
  else
    echo "== $file already contains sentinel: $sentinel (skipping) =="
  fi
}

echo "== [v1.3] deps: firebase-admin for server, zod for validation =="
pnpm add firebase-admin zod >/dev/null 2>&1

echo "== [v1.3] ensure app router dirs for API =="
mkdir -p app/api/data-requests app/data-requests/submitted

# -------------------------
# 1) Secure Firestore collection (privacy_requests)
#    - Anyone can create (submit a request)
#    - Only admins can read/write (review requests)
# -------------------------
FIRESTORE_RULES_TEXT="
// [v1.3] URAI Privacy: Self-service data requests
// Anyone can submit a request (create).
// Only admins can see or modify submitted requests.
match /privacy_requests/{requestId} {
  allow create: if true;
  allow read, write: if request.auth != null && request.auth.token.isAdmin == true;
}"

ensure_file_contains "firestore.rules" "match /privacy_requests/{requestId}" "$FIRESTORE_RULES_TEXT"

# -------------------------
# 2) Lib helper for server-side Firebase instance
#    (avoids re-initializing in every function/route)
# -------------------------
cat > lib/firebase-admin.ts <<'TS'
import * as admin from 'firebase-admin';

// This is the global server-side Firebase Admin instance.
//
// Vercel / Next.js environments will cache this instance across function
// invocations, but in a serverless context, it might be re-initialized
// on cold starts. This is the recommended pattern.

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      // IMPORTANT: In a real production app, use environment variables
      // for credentials, not a hardcoded path.
      // Firebase Hosting / App Hosting injects this automatically.
      credential: admin.credential.applicationDefault(),
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    });
  } catch (e: any) {
    console.error('Firebase admin initialization error', e.stack);
  }
}

export const firestore = admin.firestore();
TS

# -------------------------
# 3) API route for data requests (/api/data-requests)
#    - Validates with Zod
#    - Writes to Firestore
# -------------------------
cat > app/api/data-requests/route.ts <<'TS'
import { z } from 'zod';
import { firestore } from '@/lib/firebase-admin';

// Define the schema for input validation
const RequestSchema = z.object({
  kind: z.enum(['EXPORT', 'DELETE', 'WITHDRAW_CONSENT']),
  email: z.string().email({ message: 'A valid email is required' }),
  details: z.string().max(5000, { message: 'Details must be under 5000 characters' }).optional(),
});

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 1. Validate input
    const validation = RequestSchema.safeParse(body);
    if (!validation.success) {
      return new Response(JSON.stringify({ error: validation.error.flatten() }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. Add server-side metadata and write to Firestore
    const { kind, email, details } = validation.data;
    const docRef = await firestore.collection('privacy_requests').add({
      kind,
      email,
      details: details || '',
      status: 'PENDING',
      createdAt: new Date(),
      ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
    });

    // 3. Return success
    return new Response(JSON.stringify({ id: docRef.id }), {
      status: 201, // 201 Created
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Data request submission failed:', error);
    return new Response(JSON.stringify({ error: { form: ['An unexpected error occurred.'] } }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
TS

# -------------------------
# 4) Submitted "receipt" page
# -------------------------
cat > app/data-requests/submitted/page.tsx <<'TSX'
import * as React from 'react';
import Link from 'next/link';
import { TrustFooter } from '../../components/TrustFooter';

export default function SubmittedPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-black to-zinc-950 text-white">
      <div className="mx-auto max-w-3xl px-6 py-12 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Request Submitted</h1>
        <p className="mt-3 text-sm leading-6 text-white/70">
          Thank you. Your request has been received and will be reviewed.
        </p>
        <p className="mt-2 text-sm text-white/70">
          If your request requires a confirmation or follow-up, we will contact you at the email address provided.
        </p>

        <div className="mt-8">
          <Link
            className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
            href="/"
          >
            Back to Home
          </Link>
        </div>
      </div>
      <TrustFooter />
    </main>
  );
}
TSX

# -------------------------
# 5) Update main Data Requests page to be live
#    - Submit to API, handle loading state, redirect on success
# -------------------------
cat > app/data-requests/page.tsx <<'TSX'
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { TrustFooter } from '../components/TrustFooter';

type Kind = 'EXPORT' | 'DELETE' | 'WITHDRAW_CONSENT';

// Helper to display Zod errors
function ErrorDisplay(props: { errors?: Record<string, string[] | undefined> }) {
  const { errors } = props;
  if (!errors || Object.keys(errors).length === 0) return null;

  // Flatten all error messages into a single array
  const allMessages = Object.values(errors).flat().filter(Boolean) as string[];

  return (
    <div className="mt-4 rounded-lg bg-red-900/50 p-3 text-sm text-red-200">
      <ul className="list-disc pl-5">
        {allMessages.map((msg, i) => (
          <li key={i}>{msg}</li>
        ))}
      </ul>
    </div>
  );
}

export default function DataRequestsPage() {
  const router = useRouter();
  const [kind, setKind] = React.useState<Kind>('EXPORT');
  const [email, setEmail] = React.useState('');
  const [details, setDetails] = React.useState('');
  
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errors, setErrors] = React.useState<any>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors(null);

    const res = await fetch('/api/data-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, email, details }),
    });

    if (res.ok) {
      // On success, redirect to the "submitted" page
      router.push('/data-requests/submitted');
    } else {
      // On failure, parse the error response from the API
      const body = await res.json();
      setErrors(body.error);
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-black to-zinc-950 text-white">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Data Requests</h1>
        <p className="mt-3 text-sm leading-6 text-white/70">
          Submit a request for data export, deletion, or consent withdrawal.
        </p>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="text-sm text-white/80" htmlFor="kind-select">Request type</label>
              <select
                id="kind-select"
                className="mt-2 block w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
                value={kind}
                onChange={(e) => setKind(e.target.value as Kind)}
                disabled={isSubmitting}
              >
                <option value="EXPORT">Export my data</option>
                <option value="DELETE">Delete my data</option>
                <option value="WITHDRAW_CONSENT">Withdraw consent</option>
              </select>
            </div>

            <div>
              <label className="text-sm text-white/80" htmlFor="email-input">Email</label>
              <input
                id="email-input"
                className="mt-2 block w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.com"
                required
                type="email"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="text-sm text-white/80" htmlFor="details-input">Details (optional)</label>
              <textarea
                id="details-input"
                className="mt-2 block w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={5}
                placeholder="Anything that helps us locate your data or confirm your request."
                disabled={isSubmitting}
              />
            </div>

            <ErrorDisplay errors={errors?.fieldErrors} />

            <button
              className="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit request'}
            </button>

            <ErrorDisplay errors={errors?.formErrors} />

          </form>
        </div>
      </div>
      <TrustFooter />
    </main>
  );
}
TSX

# -------------------------
# 6) Final build
# -------------------------
echo "== [v1.3] build sanity check =="
pnpm -s build

echo "== [v1.3] DONE: backend wired up =="
echo "Next: Deploy and test the live request flow."
