
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "System Status | URAI Privacy",
};

export default function Status() {
  return (
    <main className="container mx-auto px-4 py-12">
      <article className="prose prose-invert mx-auto">
        <h1>System Status</h1>
        <p className="text-text-muted">Last updated: {new Date().toLocaleDateString()}</p>

        <h2>Security & Reliability Status</h2>
        <p>
          All systems are currently operational. We are not aware of any security or reliability issues at this time. We are committed to providing a secure and reliable service, and we will update this page with any new information.
        </p>

        <h3>Service Level Agreement (SLA)</h3>
        <p>
          We strive for 99.9% uptime for all of our services. We are constantly monitoring our systems to ensure they are available and performing as expected.
        </p>

        <h3>Scheduled Maintenance</h3>
        <p>
          There is no scheduled maintenance at this time. We will notify you of any scheduled maintenance at least 24 hours in advance.
        </p>

        <h3>Recent Incidents</h3>
        <p>
          There have been no recent incidents.
        </p>

        <p>
          If you are experiencing any issues with our services, please contact us at <a href="mailto:support@urai.com">support@urai.com</a>.
        </p>

      </article>
    </main>
  );
}
