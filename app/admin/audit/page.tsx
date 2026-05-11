import AuditLogViewer from '@/components/AuditLogViewer';

export default function AdminAuditPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold">Audit Logs</h1>
      <AuditLogViewer />
    </main>
  );
}
