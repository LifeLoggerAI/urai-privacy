import { getAuth } from "firebase-admin/auth";
import { HttpsError } from "firebase-functions/v2/https";

type ActorRequest = {
  auth?: { uid?: string; token?: Record<string, unknown> };
  rawRequest?: { aborted?: boolean; get(name: string): string | undefined };
};

// Callable request.auth contains the claims from the originally signed token.
// Removing current custom claims does not rewrite that token. Every privileged
// effect therefore checks the current Auth account as well as token revocation.
export async function createPrivacyActorGuard(request: ActorRequest, adminOnly = false) {
  const uid = request.auth?.uid;
  const bearer = request.rawRequest?.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!uid || !bearer) throw new HttpsError("unauthenticated", "Current authentication is required.");
  let originalCreationTime: string | undefined;
  const requireCurrent = async (ownerUid?: string) => {
    if (request.rawRequest?.aborted) throw new HttpsError("unauthenticated", "The authenticated connection changed.");
    const auth = getAuth();
    try {
      const token = await auth.verifyIdToken(bearer, true);
      if (token.uid !== uid) throw new HttpsError("permission-denied", "The authenticated actor changed.");
      const account = await auth.getUser(uid);
      if (account.uid !== uid || account.disabled || !Number.isFinite(Date.parse(account.metadata.creationTime))) {
        throw new HttpsError("unauthenticated", "Current account authority is unavailable.");
      }
      if (originalCreationTime !== undefined && account.metadata.creationTime !== originalCreationTime) {
        throw new HttpsError("unauthenticated", "The authenticated account incarnation changed.");
      }
      originalCreationTime ??= account.metadata.creationTime;
      // Revocation or disablement can occur while the account RPC awaits.
      const afterAccount = await auth.verifyIdToken(bearer, true);
      if (afterAccount.uid !== uid || request.rawRequest?.aborted) {
        throw new HttpsError("unauthenticated", "Current authentication changed.");
      }
      const claims = account.customClaims ?? {};
      const signedAdmin = afterAccount.admin === true || afterAccount.role === "admin";
      const admin = signedAdmin && (claims.admin === true || claims.role === "admin");
      if ((adminOnly || (ownerUid !== undefined && ownerUid !== uid)) && !admin) {
        throw new HttpsError("permission-denied", "Current administrative access is required.");
      }
      return { uid, token: { ...claims, admin, role: admin ? claims.role : undefined } };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("unauthenticated", "Current authentication is required.");
    }
  };
  await requireCurrent();
  return { uid, requireCurrent };
}
