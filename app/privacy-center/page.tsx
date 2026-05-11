import * as React from 'react';
import { TrustFooter } from '../components/TrustFooter';
import Link from 'next/link';

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

          <ClickableCard title="Your Data, Your Rights" href="/data-requests">
            <p>
              Exercise your rights. Use the self-service request page to submit an export or deletion request.
            </p>
          </ClickableCard>
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

function ClickableCard(props: { title: string; children: React.ReactNode, href: string }) {
    return (
        <Link href={props.href} className="block rounded-2xl border border-white/10 bg-white/5 p-6 hover:bg-white/15 transition-colors md:col-span-2">
            <div className="text-sm font-semibold text-white/90">{props.title}</div>
            <div className="mt-3 text-sm leading-6 text-white/70">{props.children}</div>
        </Link>
    );
}
