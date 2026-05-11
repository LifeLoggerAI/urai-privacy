import { ReactNode } from 'react';

export const TrustSection = ({ title, children }: { title: string; children: ReactNode }) => {
  return (
    <section className="bg-white rounded-lg shadow-md p-8 mb-8">
      <h2 className="text-3xl font-semibold text-gray-900 border-b pb-4 mb-6">{title}</h2>
      <div className="prose prose-lg max-w-none">
        {children}
      </div>
    </section>
  );
};
