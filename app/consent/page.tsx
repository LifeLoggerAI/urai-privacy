import ConsentManager from '@/components/ConsentManager';

export default function ConsentPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold">Consent Settings</h1>
      <ConsentManager />
    </main>
  );
}
