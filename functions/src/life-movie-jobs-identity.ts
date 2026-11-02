/** Dedicated Jobs-to-Privacy Firebase Authentication identity check.
 * Used ONLY after Firebase onCall has verified the ID token's issuer, audience
 * and signature. This is not a substitute for workload IAM, service credential
 * provisioning, scoped grant issuance, or source-rights approval.
 * Missing verified service UID must fail closed.
 */
export type JobsCallerIdentity = Readonly<{
  uid?: unknown;
  token?: Record<string, unknown>;
}>;

const UID = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/;
const hasOwn = (value: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

export function isTrustedJobsConsentCaller(
  identity: JobsCallerIdentity | null | undefined,
  pinnedUid: string | undefined,
): boolean {
  if (typeof pinnedUid !== 'string' || !UID.test(pinnedUid) ||
      !identity || typeof identity !== 'object' || Array.isArray(identity) ||
      !hasOwn(identity, 'uid') || identity.uid !== pinnedUid ||
      !hasOwn(identity, 'token') || !identity.token ||
      typeof identity.token !== 'object' || Array.isArray(identity.token)) return false;
  const claims = identity.token;
  // Never inherit privileged identity claims from a modified object prototype.
  // This is defense in depth after Firebase has cryptographically verified the ID token.
  if (!['system', 'role', 'consumerId', 'firebase'].every((key) => hasOwn(claims, key))) return false;
  const firebase = claims.firebase;
  if (!firebase || typeof firebase !== 'object' || Array.isArray(firebase) ||
      !hasOwn(firebase, 'sign_in_provider')) return false;
  const authMetadata = firebase as Record<string, unknown>;
  return claims.system === true && claims.role === 'system' &&
    claims.consumerId === 'urai-jobs' &&
    authMetadata.sign_in_provider === 'custom';
}

/** Reverify the already-authenticated callable bearer with Firebase Admin
 * checkRevoked=true. This rejects disabled users and revoked/expired tokens;
 * the function's Firebase project remains the token's authoritative issuer.
 * Never accept an inbound Studio token or a caller supplied token as Jobs.
 */
export async function isTrustedActiveJobsConsentCaller(
  identity: JobsCallerIdentity | null | undefined,
  pinnedUid: string | undefined,
  bearerHeader: unknown,
  verifyIdToken: (idToken: string, checkRevoked: boolean) => Promise<Record<string, unknown>>,
): Promise<boolean> {
  if (!isTrustedJobsConsentCaller(identity, pinnedUid) || typeof verifyIdToken !== 'function' ||
      typeof bearerHeader !== 'string' || bearerHeader.length > 8192) return false;
  const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(bearerHeader);
  if (!match) return false;
  try {
    const verified = await verifyIdToken(match[1], true);
    if (!verified || typeof verified !== 'object' || Array.isArray(verified) ||
        !hasOwn(verified, 'uid')) return false;
    return isTrustedJobsConsentCaller({ uid: verified.uid, token: verified }, pinnedUid) &&
      verified.uid === identity?.uid;
  } catch {
    return false;
  }
}
