const FIRST = 'urai:firstTouchAttribution';
const LAST = 'urai:lastTouchAttribution';
const nowIso = () => new Date().toISOString();
function readStore(key) { try { return typeof window === 'undefined' ? null : JSON.parse(window.localStorage.getItem(key) || 'null'); } catch (_) { return null; } }
function writeStore(key, value) { try { if (typeof window !== 'undefined') window.localStorage.setItem(key, JSON.stringify(value)); } catch (_) {} }
function param(params, key) { const value = params.get(key); return value && value.trim() ? value.trim() : undefined; }
export function getUraiAttribution() {
  const params = typeof window === 'undefined' ? new URLSearchParams('') : new URLSearchParams(window.location.search || '');
  const current = {
    sourceDomain: typeof window === 'undefined' ? undefined : window.location.hostname,
    sourcePath: typeof window === 'undefined' ? undefined : window.location.pathname || '/',
    utmSource: param(params, 'utm_source'),
    utmMedium: param(params, 'utm_medium'),
    utmCampaign: param(params, 'utm_campaign'),
    utmContent: param(params, 'utm_content'),
    utmTerm: param(params, 'utm_term'),
    referrer: typeof document === 'undefined' ? undefined : document.referrer || undefined,
    sourceAccount: param(params, 'urai_source_account'),
    contentBrand: param(params, 'urai_content_brand'),
    destinationSystem: param(params, 'urai_destination_system'),
    landingPage: typeof window === 'undefined' ? undefined : `${window.location.origin}${window.location.pathname}`,
    lastTouchAt: nowIso()
  };
  const first = readStore(FIRST) || { ...current, firstTouchAt: nowIso() };
  if (!readStore(FIRST)) writeStore(FIRST, first);
  writeStore(LAST, current);
  return { ...current, firstTouchAt: first.firstTouchAt, firstTouch: first, lastTouch: current };
}
export function buildUraiEventPayload(eventType, metadata = {}) {
  const a = getUraiAttribution();
  return { eventType, domain: a.sourceDomain, path: a.sourcePath, timestamp: nowIso(), utmSource: a.utmSource, utmMedium: a.utmMedium, utmCampaign: a.utmCampaign, utmContent: a.utmContent, utmTerm: a.utmTerm, sourceAccount: a.sourceAccount, contentBrand: a.contentBrand, destinationSystem: a.destinationSystem, referrer: a.referrer, metadata };
}
