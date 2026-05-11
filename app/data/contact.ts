import { PRIVACY_EMAIL } from './constants';

export const contact = {
    title: "Contact Us",
    lastUpdated: "2024-07-29",
    content: `
    <p>If you have any questions or concerns about your privacy, please don't hesitate to contact us. We are here to help.</p>

    <h2>Privacy Inquiries</h2>
    <p>For questions about our privacy practices, to exercise your data rights, or for any other privacy-related matters, please contact our Privacy Team:</p>
    <p><strong>Email:</strong> <a href="mailto:${PRIVACY_EMAIL}">${PRIVACY_EMAIL}</a></p>

    <h2>Abuse Reporting</h2>
    <p>If you need to report abuse, spam, or other violations of our policies, please contact our Abuse Team:</p>
    <p><strong>Email:</strong> <a href="mailto:abuse@urai.com">abuse@urai.com</a></p>
    <p>When reporting abuse, please include as much information as possible, including:</p>
    <ul>
        <li>A description of the issue.</li>
        <li>The date and time of the incident.</li>
        <li>Any relevant URLs or screenshots.</li>
    </ul>

    <h2>Mailing Address</h2>
    <p>If you prefer to contact us by mail, you can reach us at:</p>
    <p>
        URAI Privacy Team<br>
        123 Privacy Lane<br>
        Data City, DC 54321<br>
        United States
    </p>

    <h2>Response Time</h2>
    <p>We are committed to responding to all inquiries in a timely manner. We will do our best to get back to you within 5-7 business days.</p>
    `
}
