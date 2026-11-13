/**
 * Pure consumer/administrator claim check for canonical cross-user consent
 * decisions. Firebase onCall must have verified the caller's identity first;
 * this function does NOT authenticate signatures, provide consent, or grant
 * access to movie-scoped rendering. It rejects inherited privileged claims.
 */
const hasOwn = (value: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

export function crossUserAuthority(token?: Record<string, unknown> | null):
  | Readonly<{ role: 'admin'; consumerId: null }>
  | Readonly<{ role: 'system'; consumerId: string }>
  | null {
  if (!token || typeof token !== 'object' || Array.isArray(token)) return null;

  const admin = (hasOwn(token, 'admin') && token.admin === true) ||
    (hasOwn(token, 'role') && token.role === 'admin');
  if (admin) return { role: 'admin', consumerId: null };

  const system = (hasOwn(token, 'system') && token.system === true) ||
    (hasOwn(token, 'role') && token.role === 'system');
  const consumerId = hasOwn(token, 'consumerId') && typeof token.consumerId === 'string'
    ? token.consumerId.trim() : '';
  if (system && /^[a-zA-Z0-9._-]{2,120}$/.test(consumerId)) {
    return { role: 'system', consumerId };
  }
  return null;
}
