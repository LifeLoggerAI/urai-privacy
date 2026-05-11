import { ReactNode } from 'react';

export const LegalTextBlock = ({ children }: { children: ReactNode }) => {
  return <div className="prose prose-lg max-w-none text-gray-700 mt-4 mb-8">{children}</div>;
};
