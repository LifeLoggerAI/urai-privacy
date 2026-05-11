
import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Data Deletion Request | URAI Privacy',
  description: 'Request the deletion of your personal data from URAI services. We are committed to processing your request promptly and securely.',
};

export default function DataDeletionPage() {
  return (
    <article>
      <h1>Data Deletion Request</h1>
      <p>You have the right to request the deletion of your personal data. To start this process, please use our standardized Data Subject Access Request (DSAR) form.</p>
      <p>This process ensures that we can verify your identity and securely handle your request in a compliant manner.</p>
      <div className="mt-8 text-center">
        <Link href="/dsar?requestType=delete" className="inline-block px-8 py-3 bg-accent text-accent-foreground rounded-md font-semibold hover:opacity-90 transition-opacity">
          Go to Deletion Request Form
        </Link>
      </div>
      <p className="mt-4 text-sm text-text-muted">You will be asked to verify your email address before the deletion process begins.</p>
    </article>
  );
}
