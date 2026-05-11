
import { NextPage } from 'next';

const SecurityPage: NextPage = () => {
  const lastUpdated = '2024-08-02';

  return (
    <div className="prose prose-lg mx-auto p-8">
      <h1>Security Overview</h1>
      <p className="text-gray-500">Last Updated: {lastUpdated}</p>
      <p className="lead">
        Protecting your data is a top priority at URAI. We have implemented a comprehensive security program
        designed to safeguard our systems and your information. This page provides a high-level overview of our
        security posture.
      </p>

      <nav>
        <h2>On this page</h2>
        <ul>
          <li><a href="#security-controls">Our Security Controls</a></li>
          <li><a href="#encryption">Encryption</a></li>
          <li><a href="#platform-security">Platform Security</a></li>
          <li><a href="#incident-response">Incident Response</a></li>
          <li><a href="#contact-security">Reporting a Vulnerability</a></li>
        </ul>
      </nav>

      <section id="security-controls">
        <h2>Our Security Controls</h2>
        <p>
          We employ a defense-in-depth strategy, incorporating a variety of technical and organizational controls to protect data.
        </p>
        <ul>
          <li>
            <strong>Principle of Least Privilege:</strong> Access to sensitive data and production systems is strictly
            limited to personnel who require it for their job responsibilities.
          </li>
          <li>
            <strong>Audit Logs:</strong> We maintain detailed audit logs of actions taken in our production
            environment. These logs are monitored for suspicious activity.
          </li>
          <li>
            <strong>Secure Development:</strong> Our engineering team follows secure coding practices, and code changes
            are peer-reviewed and tested before deployment.
          </li>
        </ul>
      </section>

      <section id="encryption">
        <h2>Encryption</h2>
        <p>
          We use strong encryption to protect your data both when it is being transmitted and when it is stored on our servers.
        </p>
        <ul>
          <li>
            <strong>Encryption in Transit:</strong> All data transmitted between you and our services is encrypted
            using industry-standard TLS (Transport Layer Security).
          </li>
          <li>
            <strong>Encryption at Rest:</strong> Your data, including database contents and file storage, is encrypted
            at rest using modern, robust encryption standards.
          </li>
        </ul>
      </section>

      <section id="platform-security">
        <h2>Platform Security</h2>
        <p>We leverage modern platform security features to protect our application from common threats.</p>
        <ul>
            <li>
                <strong>App Check:</strong> Where available, we use Firebase App Check to ensure that requests to our
                backend services originate from our legitimate application, helping to prevent abuse and unauthorized access.
            </li>
            <li>
                <strong>Rate Limiting:</strong> We implement rate limiting on our APIs to protect against denial-of-service
                attacks and other forms of automated abuse.
            </li>
        </ul>
      </section>


      <section id="incident-response">
        <h2>Incident Response</h2>
        <p>
          In the event of a security incident, we have a formal incident response plan. Our plan outlines the
          steps we will take to contain, investigate, and remediate the incident, as well as our process for
          notifying affected users and regulatory authorities as required by law.
        </p>
      </section>

      <section id="contact-security">
        <h2>Reporting a Vulnerability</h2>
        <p>
          We are committed to working with the security community to resolve vulnerabilities. If you believe you have
          discovered a security vulnerability in our services, please report it to us at
          <a href="mailto:security@urai.app">security@urai.app</a>. We appreciate your efforts to disclose your
          findings responsibly.
        </p>
      </section>
    </div>
  );
};

export default SecurityPage;
