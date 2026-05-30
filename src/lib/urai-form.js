import { getUraiAttribution, buildUraiEventPayload } from './urai-attribution.js';
export const URAI_FORM_TYPES = Object.freeze({ PRIVACY_DELETE_EXPORT_REQUEST: 'privacy_delete_export_request' });
export function normalizeEmail(email) { return typeof email === 'string' ? email.trim().toLowerCase() : undefined; }
export function isEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim()); }
export function validateUraiForm(values = {}, schema = []) {
  const errors = {};
  schema.forEach((field) => {
    const value = values[field.name];
    if (field.required && (!value || !String(value).trim())) errors[field.name] = `${field.label || field.name} is required.`;
    if (field.type === 'email' && value && !isEmail(value)) errors[field.name] = 'Enter a valid email address.';
  });
  return { valid: Object.keys(errors).length === 0, errors };
}
export function buildUraiFormPayload({ formType, values = {}, requestType, extra = {} }) {
  const a = getUraiAttribution();
  return { ...values, ...extra, formType, destinationCollection: 'privacyRequests', requestType, emailNormalized: normalizeEmail(values.email), sourceDomain: a.sourceDomain, sourcePath: a.sourcePath, utmSource: a.utmSource, utmMedium: a.utmMedium, utmCampaign: a.utmCampaign, utmContent: a.utmContent, utmTerm: a.utmTerm, referrer: a.referrer, landingPage: a.landingPage, firstTouchAt: a.firstTouchAt, lastTouchAt: a.lastTouchAt, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}
export async function submitUraiForm({ endpoint = '/api/forms', formType, values, schema, requestType, extra }) {
  const validation = validateUraiForm(values, schema);
  if (!validation.valid) return { ok: false, status: 'error', message: 'Please check the highlighted fields.', errors: validation.errors, event: buildUraiEventPayload('form_error', { formType }) };
  const payload = buildUraiFormPayload({ formType, values, requestType, extra });
  const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!response.ok) return { ok: false, status: 'error', message: 'Something did not connect. Try again.', payload };
  return { ok: true, status: 'success', message: 'Request received.', payload, data: await response.json().catch(() => ({})), event: buildUraiEventPayload('form_submit', { formType }) };
}
