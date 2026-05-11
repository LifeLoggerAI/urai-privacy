
import { LegalTextBlock } from './LegalTextBlock';
import { SectionHeader } from './SectionHeader';

export const PrivacyPolicyContent = () => {
  return (
    <div className="mt-8">
      <LegalTextBlock>
        <p>Effective Date: [Insert Date]</p>
        <p>Company: URAI Labs LLC</p>
        <p>Platform: URAI Application & Services</p>
      </LegalTextBlock>

      <SectionHeader title="1. Introduction" />
      <LegalTextBlock>
        <p>
          URAI is a personal intelligence system designed to help individuals reflect on emotional, behavioral, and life patterns over time. We are committed to protecting your privacy, autonomy, and data ownership. This Privacy Policy explains what data we collect, how we use it, how it is stored, your rights and controls, and how we secure your information.
        </p>
      </LegalTextBlock>

      <SectionHeader title="2. Information We Collect" />
      <LegalTextBlock>
        <p><strong>A. Account Information</strong></p>
        <ul>
          <li>Name</li>
          <li>Email address</li>
          <li>Authentication identifiers</li>
          <li>Device session metadata</li>
        </ul>
        <p><strong>B. Behavioral & Emotional Signals (User-Authorized)</strong></p>
        <p>Depending on your consent tier:</p>
        <ul>
          <li>Mood state logs</li>
          <li>Emotional scoring metadata</li>
          <li>Interaction frequency patterns</li>
          <li>Habit signals</li>
          <li>Device usage metadata</li>
          <li>Time-of-day engagement</li>
          <li>Optional audio transcription (if enabled)</li>
          <li>Optional facial inference metadata (if enabled)</li>
          <li>Optional GPS context (if enabled)</li>
        </ul>
        <p>We do not sell raw personal data.</p>
        <p><strong>C. Derived Insight Data</strong></p>
        <p>URAI may generate:</p>
        <ul>
          <li>Pattern summaries</li>
          <li>Emotional trend analysis</li>
          <li>Cognitive state forecasts</li>
          <li>Social interaction clustering</li>
          <li>Narrative summaries</li>
        </ul>
        <p>These are algorithmically derived from user-authorized inputs.</p>
      </LegalTextBlock>

      <SectionHeader title="3. Consent Tiers" />
      <LegalTextBlock>
        <p>Users may select one of the following privacy tiers:</p>
        <ul>
          <li><strong>Essential Only</strong> – Core functionality only</li>
          <li><strong>Enhanced Insights</strong> – Behavioral modeling enabled</li>
          <li><strong>Anonymous Research Contribution</strong> – De-identified pattern sharing</li>
          <li><strong>Full Personalization Mode</strong> – All adaptive modeling enabled</li>
        </ul>
        <p>Consent may be withdrawn at any time.</p>
      </LegalTextBlock>

      <SectionHeader title="4. How We Use Information" />
      <LegalTextBlock>
        <p>We use data to:</p>
        <ul>
          <li>Provide reflection and emotional insights</li>
          <li>Generate forecasts</li>
          <li>Improve system accuracy</li>
          <li>Maintain system integrity</li>
          <li>Prevent abuse and fraud</li>
        </ul>
        <p>We do not use user data for advertising.</p>
      </LegalTextBlock>

      <SectionHeader title="5. Data Sharing" />
      <LegalTextBlock>
        <p>We may share:</p>
        <ul>
          <li>With service providers (hosting, infrastructure)</li>
          <li>If required by law</li>
          <li>With user-approved research partners (de-identified only)</li>
        </ul>
        <p>We do not sell personal data.</p>
      </LegalTextBlock>

      <SectionHeader title="6. Data Retention" />
      <LegalTextBlock>
        <p>Data is retained only as long as necessary to provide services.</p>
        <p>Users may:</p>
        <ul>
          <li>Delete specific memory clusters</li>
          <li>Delete account entirely</li>
          <li>Export all personal data</li>
        </ul>
        <p>Deletion removes identifiable data from production systems.</p>
      </LegalTextBlock>

      <SectionHeader title="7. Security" />
      <LegalTextBlock>
        <p>We use:</p>
        <ul>
          <li>Encryption in transit (TLS)</li>
          <li>Encryption at rest</li>
          <li>Role-based access control</li>
          <li>Access audit logs</li>
          <li>Secure cloud infrastructure</li>
        </ul>
      </LegalTextBlock>

      <SectionHeader title="8. User Rights (GDPR/CCPA)" />
      <LegalTextBlock>
        <p>Users may:</p>
        <ul>
          <li>Access their data</li>
          <li>Correct inaccurate data</li>
          <li>Delete data</li>
          <li>Restrict processing</li>
          <li>Object to processing</li>
          <li>Request export (data portability)</li>
          <li>Withdraw consent</li>
        </ul>
        <p>Requests can be submitted via in-app privacy dashboard.</p>
      </LegalTextBlock>

      <SectionHeader title="9. Children’s Privacy" />
      <LegalTextBlock>
        <p>URAI is not intended for users under 16 without parental consent.</p>
      </LegalTextBlock>

      <SectionHeader title="10. Changes to Policy" />
      <LegalTextBlock>
        <p>We may update this policy periodically. Significant changes will be communicated in-app.</p>
      </LegalTextBlock>

      <SectionHeader title="11. Contact" />
      <LegalTextBlock>
        <p>privacy@urai.app</p>
        <p>URAI Labs LLC</p>
        <p>[Company Address]</p>
      </LegalTextBlock>
    </div>
  );
};
