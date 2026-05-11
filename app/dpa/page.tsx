'use client';

import SiteLayout from '../../components/SiteLayout';
import { PRIVACY_EMAIL } from '../../data/constants';

export default function DpaPage() {
  return (
    <SiteLayout>
      <div className="bg-white px-6 py-32 lg:px-8">
        <div className="mx-auto max-w-3xl text-base leading-7 text-gray-700">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Data Processing Addendum</h1>
          <p className="mt-6 text-xl leading-8">Last updated: 2024-05-21</p>
          <div className="mt-10 max-w-2xl">
            <p>
              This Data Processing Addendum (&quot;DPA&quot;) is incorporated into the URAI Terms of Service and applies to the extent that URAI processes personal data on your behalf. It outlines our commitment to protecting personal data and ensuring compliance with data protection laws.
            </p>
            <h2 className="mt-16 text-2xl font-bold tracking-tight text-gray-900">1. Definitions</h2>
            <p className="mt-6">
              Terms used in this DPA shall have the meanings set forth in this DPA. Capitalized terms not otherwise defined herein shall have the meaning given to them in the Agreement. 
            </p>
            <h2 className="mt-16 text-2xl font-bold tracking-tight text-gray-900">2. Processing of Personal Data</h2>
            <p className="mt-6">
              URAI will process personal data in accordance with your instructions and for the purpose of providing the services. We will not process personal data for any other purpose unless required by law.
            </p>
            <h2 className="mt-16 text-2xl font-bold tracking-tight text-gray-900">3. Data Subject Rights</h2>
            <p className="mt-6">
              URAI will assist you in responding to data subject requests to access, correct, or delete their personal data. We will notify you of any such requests we receive directly from data subjects.
            </p>
            <h2 className="mt-16 text-2xl font-bold tracking-tight text-gray-900">4. Security</h2>
            <p className="mt-6">
              URAI will implement and maintain appropriate technical and organizational measures to protect personal data against unauthorized or unlawful processing and against accidental loss, destruction, damage, theft, alteration or disclosure.
            </p>
            <h2 className="mt-16 text-2xl font-bold tracking-tight text-gray-900">5. Sub-processors</h2>
            <p className="mt-6">
              URAI may engage sub-processors to process personal data on your behalf. We will ensure that any sub-processors are bound by data protection obligations that are at least as protective as those in this DPA. A list of our current sub-processors is available on our Subprocessors page.
            </p>
            <h2 className="mt-16 text-2xl font-bold tracking-tight text-gray-900">6. How to Request a DPA</h2>
            <p className="mt-6">
              To request a signed copy of this DPA, please contact us at <a href={`mailto:${PRIVACY_EMAIL}`} className="text-indigo-600 hover:text-indigo-500">{PRIVACY_EMAIL}</a>.
            </p>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
