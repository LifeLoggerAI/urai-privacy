// Compatibility-only surface. The canonical consent authority is consent-api.ts,
// backed by the single registry and evaluator in consent-decision.ts.
// Do not add storage, policy, authorization, or audit behavior here.
export {
  setCanonicalConsent,
  evaluateCanonicalConsent
} from "./consent-api";

export {
  CONSENT_DECISION_POLICY_VERSION,
  consentPurposeRegistry,
  evaluateConsentDecision
} from "./consent-decision";
