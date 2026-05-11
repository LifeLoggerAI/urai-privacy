import PolicyHeader from '@/app/components/PolicyHeader';
import TrustFooter from '@/app/components/TrustFooter';

export default function AiInferencesPage() {
  return (
    <div className="bg-white text-gray-800">
      <div className="container mx-auto px-4 py-8">
        <PolicyHeader title="AI & Inferences" lastUpdated="2024-07-30" />
        <div className="prose max-w-none mt-8">
            <p>
            At URAI, we use artificial intelligence to provide you with a more
            personalized and efficient experience. This page explains what
            inferences we make, how they are used, and how you can opt out.
            </p>
            <h3>What Inferences Are Made</h3>
            <p>
            Our AI models may make inferences about your preferences, interests,
            and behavior based on your activity within the app. For example, if
            you frequently use a certain feature, we may infer that you find it
            valuable.
            </p>
            <h3>How They’re Used</h3>
            <p>
            These inferences are used to improve our services and tailor your
            experience. For example, we may use them to recommend content,
            features, or services that we believe you will find relevant.
            </p>
            <h3>How to Opt Out</h3>
            <p>
            You can opt out of AI-driven inferences at any time by visiting your
            privacy settings. Please note that opting out may affect the quality
            of your experience and the relevance of the content you see.
            </p>
            <h3>Not Medical Advice</h3>
            <p>
            The inferences and recommendations provided by our AI models are for
            informational purposes only and should not be considered medical
            advice. Always consult with a qualified professional for any health
            concerns.
            </p>
        </div>
      </div>
      <TrustFooter contactEmail="contact@urai.privacy" />
    </div>
  );
}
