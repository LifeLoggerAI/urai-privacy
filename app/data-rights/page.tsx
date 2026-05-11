
import { NextPage } from 'next';

const DataRightsPage: NextPage = () => {
  const lastUpdated = '2024-08-02';

  return (
    <div className="prose prose-lg mx-auto p-8">
      <h1>Your Data Rights</h1>
      <p className="text-gray-500">Last Updated: {lastUpdated}</p>
      <p className="lead">
        We believe you should have control over your personal information. This page outlines your data protection
        rights and explains how you can exercise them. We are committed to processing your requests in a timely
        and transparent manner.
      </p>

      <nav>
        <h2>On this page</h2>
        <ul>
          <li><a href="#summary-of-rights">Summary of Your Rights</a></li>
          <li><a href="#how-to-request">How to Submit a Request</a></li>
          <li><a href="#verification">Our Verification Process</a></li>
          <li><a href="#timeline">Timelines for Response</a></li>
        </ul>
      </nav>

      <section id="summary-of-rights">
        <h2>Summary of Your Rights</h2>
        <p>
          Depending on your location, you may have the following rights regarding your personal data:
        </p>
        <ul>
          <li><strong>The Right to Access:</strong> You can request a copy of the personal information we hold about you.</li>
          <li><strong>The Right to Rectification:</strong> You can request that we correct any inaccurate or incomplete personal information.</li>
          <li><strong>The Right to Erasure (&quot;Right to be Forgotten&quot;):</strong> You can request that we delete your personal information in certain circumstances.</li>
          <li><strong>The Right to Portability:</strong> You can request that we provide you with your data in a structured, commonly used, and machine-readable format.</li>
          <li><strong>The Right to Object or Opt-Out:</strong> You can object to our processing of your personal data for certain purposes, such as for model improvement.</li>
        </ul>
      </section>

      <section id="how-to-request">
        <h2>How to Submit a Request</h2>
        <p>
          The most efficient way to submit a data rights request is by using the form on our
          <a href="/contact"> Contact Page</a>. Please select the appropriate request type from the dropdown menu to
          ensure it is routed correctly.
        </p>
        <p>
          When you submit the form, you will be asked to provide:
        </p>
        <ul>
            <li>Your email address.</li>
            <li>The specific right you wish to exercise.</li>
            <li>Sufficient detail to allow us to understand and respond to your request.</li>
        </ul>
         <p>
          Alternatively, you can email our Data Protection Officer directly at <a href="mailto:privacy@urai.app">privacy@urai.app</a>
          with the subject line &quot;Data Rights Request.&quot;
        </p>
      </section>

      <section id="verification">
        <h2>Our Verification Process</h2>
        <p>
          To protect your privacy and security, we must verify your identity before processing a data rights request.
          This is a necessary and reasonable step to ensure that we do not disclose your data to an unauthorized person.
        </p>
        <p>
            The verification process will typically involve confirming your identity via the email address associated
            with your account. For certain sensitive requests, we may need to ask for additional information to
            confirm your identity with a reasonable degree of certainty.
        </p>
      </section>

      <section id="timeline">
        <h2>Timelines for Response</h2>
        <p>
          We will acknowledge receipt of your request promptly. We aim to respond to all legitimate requests within
          30 days. If the request is particularly complex or if you have made a number of requests, it may take us
          longer. In such cases, we will notify you and keep you updated.
        </p>
         <p className="p-4 border-l-4 border-blue-500 bg-blue-50">
            <strong>Please note:</strong> While we will make every effort to honor your request, certain legal obligations or technical
            limitations may prevent us from deleting or fully anonymizing some data (e.g., data required for security logs or
            financial records). We will always inform you if this is the case.
        </p>
      </section>
    </div>
  );
};

export default DataRightsPage;
