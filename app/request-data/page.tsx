
import PolicyHeader from '../components/PolicyHeader';
import TrustFooter from '../components/TrustFooter';

export default function RequestData() {
  return (
    <div className="bg-white px-6 py-32 lg:px-8">
      <div className="mx-auto max-w-3xl text-base leading-7 text-gray-700">
        <PolicyHeader
          title="Request Your Data"
          lastUpdated="January 27, 2026"
        />
        <div className="mt-10 max-w-2xl">
          <p className="mt-6">
            You have the right to request access to, export, or delete your
            personal data. We are committed to facilitating these rights in a
            timely manner.
          </p>
          <h2 className="mt-16 text-2xl font-bold tracking-tight text-gray-900">How to Make a Request</h2>
          <p className="mt-6">
            To submit a data request, please email our privacy team at{' '}
            <a href={`mailto:${process.env.PRIVACY_CONTACT_EMAIL || 'privacy@example.com'}`} className="font-medium text-indigo-600 hover:text-indigo-500">
              {process.env.PRIVACY_CONTACT_EMAIL || 'privacy@example.com'}
            </a>
            . Please include &quot;Data Subject Request&quot; in your subject line and
            specify the nature of your request (e.g., access, export, deletion).
          </p>
           <p className="mt-6">
            We will need to verify your identity before processing your request. This
            is a security measure to ensure that personal data is not disclosed
            to any person who has no right to receive it.
          </p>
        </div>
        <TrustFooter contactEmail={process.env.PRIVACY_CONTACT_EMAIL || 'privacy@example.com'} />
      </div>
    </div>
  );
}
