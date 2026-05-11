
import { NextPage } from 'next';

const SubprocessorsPage: NextPage = () => {
  const lastUpdated = '2024-08-02';

  const subprocessors = [
    {
      name: 'Google Cloud Platform (GCP)',
      purpose: 'Core infrastructure, database, storage, and computing services.',
      dataCategories: 'Account Information, User Content, Usage Information',
      region: 'Varies (Global)',
    },
    {
      name: 'Firebase (by Google)',
      purpose: 'Authentication, real-time databases, hosting, and backend functions.',
      dataCategories: 'Account Information, User Content, Usage Information',
      region: 'Varies (Global)',
    },
    {
      name: 'Stripe, Inc.',
      purpose: 'Payment processing for subscription services.',
      dataCategories: 'Billing Information, Account Information',
      region: 'USA',
    },
     {
      name: 'OpenAI, L.L.C.',
      purpose: 'Core AI model provider for processing user queries.',
      dataCategories: 'User Content (anonymized where possible)',
      region: 'Varies (Global)',
    },
     {
      name: 'Google Analytics',
      purpose: 'Aggregated website analytics to understand usage patterns.',
      dataCategories: 'Usage Information (Anonymized IP)',
      region: 'Varies (Global)',
    },
  ];

  return (
    <div className="prose prose-lg mx-auto p-8">
      <h1>Our Subprocessors</h1>
      <p className="text-gray-500">Last Updated: {lastUpdated}</p>
      <p className="lead">
        To provide our services, URAI engages a number of third-party service providers (or &quot;subprocessors&quot;).
        We have carefully vetted each of these providers to ensure they meet our high standards for security and
        data protection. We maintain a Data Processing Agreement (DPA) with each subprocessor.
      </p>

      <section id="subprocessor-list">
        <h2>List of Subprocessors</h2>
        <p>
          Below is a list of the subprocessors we currently use, the purpose of their engagement, and the types
          of data they may process.
        </p>
        <div className="not-prose overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subprocessor</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Purpose</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data Categories</th>
                 <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Region</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {subprocessors.map((sub) => (
                <tr key={sub.name}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{sub.name}</td>
                  <td className="px-6 py-4 whitespace-normal text-sm text-gray-500">{sub.purpose}</td>
                  <td className="px-6 py-4 whitespace-normal text-sm text-gray-500">{sub.dataCategories}</td>
                   <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sub.region}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="updates">
        <h2>Updates to this List</h2>
        <p>
          As our business needs change, we may engage new subprocessors. We will update this page to reflect any
          additions or removals. For significant changes, we will notify our users.
        </p>
      </section>
    </div>
  );
};

export default SubprocessorsPage;
