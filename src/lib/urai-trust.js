export const URAI_PUBLIC_FOOTER_LINKS = Object.freeze([
  { label: 'UrAi App', href: 'https://urai.app' },
  { label: 'URAI Studio', href: 'https://uraistudio.com' },
  { label: 'URAI Content', href: 'https://uraicontent.com' },
  { label: 'URAI Labs', href: 'https://urailabs.com' },
  { label: 'URAI Privacy', href: 'https://uraiprivacy.com' },
  { label: 'URAI Foundation', href: 'https://uraifoundation.org' }
]);
export const URAI_PRIVACY_NOTES = Object.freeze({
  general: 'By submitting, you agree to be contacted about this request. URAI handles requests according to its privacy and consent principles.',
  privacy_request: 'Privacy requests may require identity verification before URAI can export, delete, or correct data.',
  app_waitlist: 'By joining early access, you agree to be contacted about UrAi updates. Your request is handled according to URAI privacy and consent principles.'
});
export const URAI_TRUST_LINKS = Object.freeze({ privacy: 'https://uraiprivacy.com', consent: 'https://uraiprivacy.com/consent', passport: 'https://uraiprivacy.com/passport', responsibleAi: 'https://uraiprivacy.com/responsible-ai', safety: 'https://uraiprivacy.com/safety' });
export function getUraiPrivacyNote(kind = 'general') { return URAI_PRIVACY_NOTES[kind] || URAI_PRIVACY_NOTES.general; }
export function getUraiFooterLinks({ privateSurface = false } = {}) { return privateSurface ? [] : URAI_PUBLIC_FOOTER_LINKS; }
