// Unsigned Auth emulator tokens are accepted only by the explicitly local Admin verifier.
export function exportBearerToken(authorization: unknown, localEmulator = false) {
  if (typeof authorization !== "string" || authorization.length > 8192) return null;
  const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.([A-Za-z0-9_-]*))$/.exec(authorization);
  return match && (match[2] || localEmulator) ? match[1] : null;
}

/** Reverify the callable's bearer with Firebase Admin checkRevoked=true. */
export async function verifyActiveExportCaller(
  callerUid: unknown,
  authorization: unknown,
  verifyIdToken: (token: string, checkRevoked: boolean) => Promise<{ uid?: unknown }>,
  localEmulator = false
): Promise<boolean> {
  if (typeof callerUid !== "string" || !callerUid || callerUid.length > 160 ||
      typeof verifyIdToken !== "function") return false;
  const bearer = exportBearerToken(authorization, localEmulator);
  if (!bearer) return false;
  try {
    const verified = await verifyIdToken(bearer, true);
    return !!verified && typeof verified === "object" &&
      !Array.isArray(verified) && Object.prototype.hasOwnProperty.call(verified, "uid") &&
      verified.uid === callerUid;
  } catch { return false; }
}
