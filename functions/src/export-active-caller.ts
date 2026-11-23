/** Reverify the callable's bearer with Firebase Admin checkRevoked=true. */
export async function verifyActiveExportCaller(
  callerUid: unknown,
  authorization: unknown,
  verifyIdToken: (token: string, checkRevoked: boolean) => Promise<{ uid?: unknown }>
): Promise<boolean> {
  if (typeof callerUid !== "string" || !callerUid || callerUid.length > 160 ||
      typeof authorization !== "string" || authorization.length > 8192 ||
      typeof verifyIdToken !== "function") return false;
  const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(authorization);
  if (!match) return false;
  try {
    const verified = await verifyIdToken(match[1], true);
    return !!verified && typeof verified === "object" &&
      !Array.isArray(verified) && Object.prototype.hasOwnProperty.call(verified, "uid") &&
      verified.uid === callerUid;
  } catch { return false; }
}
