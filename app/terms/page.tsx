
import { NextPage } from 'next';

const TermsOfServicePage: NextPage = () => {
  const lastUpdated = '2024-08-02';

  return (
    <div className="prose prose-lg mx-auto p-8">
      <h1>Terms of Service</h1>
      <p className="text-gray-500">Last Updated: {lastUpdated}</p>
      <p className="lead">
        These Terms of Service (&quot;Terms&quot;) govern your access to and use of the URAI services. Please read them
        carefully. By using our services, you agree to be bound by these Terms.
      </p>

      <nav>
        <h2>On this page</h2>
        <ul>
          <li><a href="#acceptable-use">Acceptable Use</a></li>
          <li><a href="#user-content">Your Content</a></li>
          <li><a href="#disclaimers">Disclaimers and Limitations of Liability</a></li>
          <li><a href="#termination">Termination</a></li>
          <li><a href="#dispute-resolution">Dispute Resolution</a></li>
          <li><a href="#general-terms">General Terms</a></li>
        </ul>
      </nav>

      <section id="acceptable-use">
        <h2>Acceptable Use</h2>
        <p>
          You agree not to misuse the URAI services or help anyone else to do so. You must not, and must not
          attempt to, use our services to:
        </p>
        <ul>
          <li>Generate or disseminate content that is illegal, harmful, harassing, or violates our AI Safety policy.</li>
          <li>Probe, scan, or test the vulnerability of any system or network.</li>
          <li>Breach or otherwise circumvent any security or authentication measures.</li>
          <li>Interfere with or disrupt any user, host, or network, for example by sending a virus, overloading, flooding, or spamming.</li>
          <li>Violate the law in any way, or to violate the privacy of others.</li>
        </ul>
      </section>

      <section id="user-content">
        <h2>Your Content</h2>
        <p>
          When you use our services, you provide us with content like your audio queries and text prompts (&quot;User Content&quot;).
          You retain all ownership rights in your User Content. These Terms do not grant us any rights to your User Content
          except for the limited rights needed to operate the service.
        </p>
        <p>
            We need your permission to do things like process and transmit your User Content. You give us that permission
            through a worldwide, non-exclusive, royalty-free license to use, reproduce, and process your User Content solely
            for the purpose of providing and improving the URAI services. We will never sell your content to third parties.
        </p>
      </section>

      <section id="disclaimers">
        <h2>Disclaimers and Limitations of Liability</h2>
        <p>
            <strong>THE SERVICES ARE PROVIDED &quot;AS IS.&quot;</strong> To the fullest extent permitted by law, URAI makes no warranties,
            either express or implied, about the services. We disclaim any warranties of merchantability, fitness for a
            particular purpose, and non-infringement.
        </p>
        <p>
            <strong>The outputs of our AI are for informational purposes only and are not a substitute for professional advice.</strong>
            You should not rely on the service as a sole source of truth or for medical, legal, financial, or other professional advice.
        </p>
        <p>
            <strong>LIMITATION OF LIABILITY.</strong> IN NO EVENT WILL URAI BE LIABLE FOR ANY INDIRECT, SPECIAL, INCIDENTAL, PUNITIVE,
            EXEMPLARY, OR CONSEQUENTIAL DAMAGES, OR ANY LOSS OF USE, DATA, BUSINESS, OR PROFITS, REGARDLESS OF LEGAL THEORY,
            WHETHER OR NOT URAI HAS BEEN WARNED OF THE POSSIBILITY OF SUCH DAMAGES.
        </p>
      </section>

      <section id="termination">
        <h2>Termination</h2>
        <p>
          You’re free to stop using our services at any time. We reserve the right to suspend or terminate your access
          to the services with notice to you if you are in breach of these Terms, or if your use of the service could
          cause real harm to us or other users.
        </p>
      </section>

      <section id="dispute-resolution">
        <h2>Dispute Resolution</h2>
        <p>
            Let’s try to sort things out informally first. We encourage you to contact us, and we’ll do our best to resolve
            the issue. If that’s not possible, any dispute arising from these Terms will be subject to binding arbitration,
            unless you opt out or for certain types of disputes. The specific governing law and venue for any legal proceedings
            will be determined based on your primary location.
        </p>
      </section>

        <section id="general-terms">
        <h2>General Terms</h2>
        <p>
            These Terms constitute the entire agreement between you and URAI. If any provision of these Terms is found to be
            unenforceable, the remaining provisions will remain in full force and effect. We may revise these Terms from time
            to time, and will always post the most current version on our website.
        </p>
      </section>
    </div>
  );
};

export default TermsOfServicePage;
