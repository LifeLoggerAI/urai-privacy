
import { NextPage } from 'next';

const AISafetyPage: NextPage = () => {
  const lastUpdated = '2024-08-02';

  return (
    <div className="prose prose-lg mx-auto p-8">
      <h1>AI Safety &amp; Responsibility</h1>
      <p className="text-gray-500">Last Updated: {lastUpdated}</p>
      <p className="lead">
        At URAI, our goal is to build powerful AI that is also safe and beneficial. We are deeply committed to
        developing our technology responsibly, mitigating potential harms, and being transparent about our approach.
        This page outlines our safety principles and the measures we take to enforce them.
      </p>

      <nav>
        <h2>On this page</h2>
        <ul>
          <li><a href="#safety-posture">Our Moderation &amp; Safety Posture</a></li>
          <li><a href="#limitations">Limitations of AI Models</a></li>
          <li><a href="#reporting-abuse">User Reporting &amp; Abuse Prevention</a></li>
          <li><a href="#our-commitment">Our Ongoing Commitment</a></li>
        </ul>
      </nav>

      <section id="safety-posture">
        <h2>Our Moderation &amp; Safety Posture</h2>
        <p>
          We prohibit the use of our services for generating harmful content, including but not limited to hate
          speech, harassment, incitement to violence, and the creation of sexually explicit material. Our safety
          systems are designed to prevent the generation of such content.
        </p>
        <p>
          We use a multi-layered approach to content moderation:
        </p>
        <ul>
          <li><strong>Input Filtering:</strong> We scan prompts to block those that violate our acceptable use policy.</li>
          <li><strong>Output Filtering:</strong> We monitor the output of our models to catch and filter policy-violating content that may be generated.</li>
          <li><strong>Human Review:</strong> In some cases, flagged content may be reviewed by trained human moderators to improve our systems and enforce our policies.
          This review is conducted on anonymized data whenever possible.</li>
        </ul>
      </section>

      <section id="limitations">
        <h2>Limitations of AI Models</h2>
        <p>
          While we strive for accuracy and safety, large language models are not infallible. They can sometimes
          generate incorrect, biased, or unintended outputs. URAI should not be used for high-stakes advice in
          medical, legal, or financial matters.
        </p>
          <p className="p-4 border-l-4 border-yellow-500 bg-yellow-50">
            <strong>Fact-check important information.</strong> AI models can "hallucinate" and produce information that sounds plausible but is factually incorrect. Always verify critical information from a reliable source.
        </p>
      </section>

      <section id="reporting-abuse">
        <h2>User Reporting &amp; Abuse Prevention</h2>
        <p>
          If you encounter content that you believe is harmful or violates our policies, we encourage you to report
          it. Your feedback is invaluable for improving the safety of our platform.
        </p>
        <p>
          You can report problematic content directly through the user interface or by contacting us at
          <a href="mailto:safety@urai.app">safety@urai.app</a>. Please provide as much detail as possible to help our team investigate.
        </p>
        <p>
            We have automated systems in place to detect and prevent abuse of our services, such as spamming or attempts to generate prohibited content. Accounts found to be in violation of our policies may be suspended.
        </p>
      </section>

      <section id="our-commitment">
        <h2>Our Ongoing Commitment</h2>
        <p>
          Building safe and responsible AI is a continuous effort. We are committed to ongoing research, collaboration
          with the AI community, and engagement with policymakers to ensure our technology is developed and deployed
          in a manner that benefits society while minimizing risks.
        </p>
      </section>
    </div>
  );
};

export default AISafetyPage;
