
import TrustFooter from "../components/TrustFooter";

export default function DataControls() {
  return (
    <div className="bg-white px-6 py-12 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-3xl text-base leading-7 text-gray-700">
        <p className="text-base font-semibold leading-7 text-indigo-600">Data Controls</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Your Data, Your Rights</h1>
        <p className="mt-6 text-xl leading-8">Last updated: October 26, 2023</p>
        <div className="mt-10 max-w-2xl">
          <p>We believe you should have control over your data. This page outlines the tools and processes we provide to help you manage your personal information.</p>
          
          <h2 className="mt-16 text-2xl font-bold tracking-tight text-gray-900">Data Export</h2>
          <p className="mt-6">
            You can request an export of your personal data at any time. This will include your account information, consent history, and other data we have collected. To initiate a data export, please visit the <a href="/portal/export" className="text-indigo-600">Data Export section of our privacy portal</a>.
          </p>
          
          <h2 className="mt-16 text-2xl font-bold tracking-tight text-gray-900">Data Deletion</h2>
          <p className="mt-6">
            You have the right to request the deletion of your personal data. When you submit a deletion request, we will remove your account and all associated data from our systems within 30 days. To request data deletion, please visit the <a href="/portal/delete" className="text-indigo-600">Data Deletion section of our privacy portal</a>.
          </p>

          <h2 className="mt-16 text-2xl font-bold tracking-tight text-gray-900">Consent Management</h2>
          <p className="mt-6">
You can manage your consent preferences for different types of data processing in our <a href="/portal/consents" className="text-indigo-600">privacy portal</a>. This allows you to control how we use your data for things like analytics and marketing.</p>

        </div>
      </div>
      <TrustFooter />
    </div>
  );
}
