
import PolicyHeader from '../components/PolicyHeader';
import { Metadata } from 'next';
import { PRIVACY_EMAIL } from '../data/constants';

export const metadata: Metadata = {
  title: 'Data Deletion | URAI Privacy Center',
  description: 'Learn how to delete your data.',
};

export default function DeletePage() {
  const lastUpdated = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <>
        <PolicyHeader lastUpdated={lastUpdated} />
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Data Deletion</h1>
        <div className="mt-10">
          <p>You have the right to delete your personal data. You can delete your account by clicking the button below. This will delete all of your personal information from our systems.</p>

          <p className="mt-4">Please note that we may retain certain information as required by law or for legitimate business purposes.</p>

          <div className="mt-8">
            <button className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-500">Delete My Account</button>
          </div>

          <p className="mt-8">If you have any questions about our data deletion process, please contact us at <a href={`mailto:${PRIVACY_EMAIL}`} className="text-indigo-600 hover:text-indigo-500">{PRIVACY_EMAIL}</a>.</p>

        </div>
    </>
  );
}
