
import { PRIVACY_EMAIL } from "./constants";

export const dataControls = {
    title: "Data Controls",
    lastUpdated: "2024-07-29",
    content: `
    <p>You have the right to control your personal data. This page provides you with the tools to manage your data and exercise your rights.</p>

    <h2>1. Your Rights</h2>
    <p>You have the following rights regarding your personal data:</p>
    <ul>
        <li><strong>Right to Access:</strong> You can request a copy of the personal data we hold about you.</li>
        <li><strong>Right to Rectification:</strong> You can request that we correct any inaccurate or incomplete data.</li>
        <li><strong>Right to Erasure:</strong> You can request that we delete your personal data.</li>
        <li><strong>Right to Restrict Processing:</strong> You can request that we restrict the processing of your personal data.</li>
        <li><strong>Right to Data Portability:</strong> You can request that we provide you with your data in a structured, commonly used, and machine-readable format.</li>
        <li><strong>Right to Object:</strong> You can object to the processing of your personal data.</li>
    </ul>

    <h2>2. How to Exercise Your Rights</h2>
    <p>You can exercise your rights through our <a href="/portal">Privacy Portal</a>. The portal allows you to:</p>
    <ul>
        <li><strong>Export Your Data:</strong> Request a copy of your personal data.</li>
        <li><strong>Delete Your Data:</strong> Request the deletion of your account and personal data.</li>
        <li><strong>Manage Your Consents:</strong> Update your consent preferences for data processing.</li>
    </ul>

    <h2>3. Data Export</h2>
    <p>You can request an export of your data at any time from the <a href="/portal/export">Data Export</a> page in the Privacy Portal. We will provide your data in a JSON format. The export will include:</p>
    <ul>
        <li>Your account information.</li>
        <li>Your consent settings.</li>
        <li>Any other data we have collected about you.</li>
    </ul>

    <h2>4. Data Deletion</h2>
    <p>You can request the deletion of your account and data from the <a href="/portal/delete">Data Deletion</a> page in the Privacy Portal. When you request to delete your data, we will:</p>
    <ol>
        <li><strong>Soft-delete your account:</strong> Your account will be immediately deactivated and your data will no longer be accessible.</li>
        <li><strong>Scheduled hard-delete:</strong> Your data will be permanently deleted from our systems after a 30-day grace period. During this period, you can contact us to restore your account.</li>
    </ol>

    <h2>5. Contact Us</h2>
    <p>If you have any questions about your data rights or need assistance with the Privacy Portal, please contact us at <a href="mailto:${PRIVACY_EMAIL}">${PRIVACY_EMAIL}</a>.</p>
    `
}
