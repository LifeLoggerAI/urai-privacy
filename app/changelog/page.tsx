'use client';

import SiteLayout from '../../components/SiteLayout';

export default function ChangelogPage() {
  return (
    <SiteLayout>
      <div className="bg-white px-6 py-32 lg:px-8">
        <div className="mx-auto max-w-3xl text-base leading-7 text-gray-700">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Policy Changelog</h1>
          <p className="mt-6 text-xl leading-8">Last updated: 2024-05-21</p>
          <div className="mt-10 max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900">May 2024</h2>
            <p className="mt-6">
              - Initial publication of our privacy policy, terms of service, and other related documents.
            </p>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
