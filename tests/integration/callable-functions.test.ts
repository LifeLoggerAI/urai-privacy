import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { initializeApp, deleteApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInWithCustomToken, type Auth } from "firebase/auth";
import { connectFunctionsEmulator, getFunctions, httpsCallable, type Functions } from "firebase/functions";
import { initializeApp as initializeAdminApp, getApps as getAdminApps, deleteApp as deleteAdminApp, type App as AdminApp } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const PROJECT_ID = process.env.FIREBASE_TEST_PROJECT_ID ?? "urai-privacy-integration-test";
const AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099";
const FUNCTIONS_EMULATOR_HOST = process.env.FIREBASE_FUNCTIONS_EMULATOR_HOST ?? "127.0.0.1:5001";
const FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";

process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_EMULATOR_HOST;
process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_EMULATOR_HOST;

let userApp: FirebaseApp;
let adminApp: FirebaseApp;
let anonymousApp: FirebaseApp;
let adminSdkApp: AdminApp;
let userAuth: Auth;
let adminAuth: Auth;
let userFunctions: Functions;
let adminFunctions: Functions;
let anonymousFunctions: Functions;

function firebaseConfig(appName: string) {
  return {
    apiKey: "test-api-key",
    authDomain: `${PROJECT_ID}.firebaseapp.com`,
    projectId: PROJECT_ID,
    storageBucket: `${PROJECT_ID}.appspot.com`,
    messagingSenderId: "000000000000",
    appId: `1:000000000000:web:${appName}`
  };
}

async function signIn(auth: Auth, uid: string, claims: Record<string, unknown> = {}) {
  const token = await getAdminAuth(adminSdkApp).createCustomToken(uid, claims);
  await signInWithCustomToken(auth, token);
}

async function call<T = Record<string, unknown>>(functions: Functions, name: string, data?: Record<string, unknown>) {
  const callable = httpsCallable<Record<string, unknown> | undefined, T>(functions, name);
  const response = await callable(data);
  return response.data;
}

beforeAll(async () => {
  adminSdkApp = getAdminApps().length ? getAdminApps()[0] : initializeAdminApp({ projectId: PROJECT_ID });
  const adminDb = getFirestore(adminSdkApp);
  await adminDb.collection("users").doc("admin-a").set({ uid: "admin-a", role: "admin" });
  await adminDb.collection("users").doc("user-a").set({ uid: "user-a", role: "user" });

  userApp = initializeApp(firebaseConfig("user"), "integration-user");
  adminApp = initializeApp(firebaseConfig("admin"), "integration-admin");
  anonymousApp = initializeApp(firebaseConfig("anonymous"), "integration-anonymous");

  userAuth = getAuth(userApp);
  adminAuth = getAuth(adminApp);
  connectAuthEmulator(userAuth, `http://${AUTH_EMULATOR_HOST}`, { disableWarnings: true });
  connectAuthEmulator(adminAuth, `http://${AUTH_EMULATOR_HOST}`, { disableWarnings: true });

  userFunctions = getFunctions(userApp);
  adminFunctions = getFunctions(adminApp);
  anonymousFunctions = getFunctions(anonymousApp);
  const [functionsHost, functionsPort] = FUNCTIONS_EMULATOR_HOST.split(":");
  connectFunctionsEmulator(userFunctions, functionsHost, Number(functionsPort));
  connectFunctionsEmulator(adminFunctions, functionsHost, Number(functionsPort));
  connectFunctionsEmulator(anonymousFunctions, functionsHost, Number(functionsPort));

  await signIn(userAuth, "user-a");
  await signIn(adminAuth, "admin-a", { admin: true });
});

afterAll(async () => {
  await Promise.all([deleteApp(userApp), deleteApp(adminApp), deleteApp(anonymousApp)]);
  await deleteAdminApp(adminSdkApp);
});

describe("Firebase callable privacy functions", () => {
  it("requires authentication for user privacy calls", async () => {
    await expect(call(anonymousFunctions, "createExportRequest")).rejects.toThrow();
  });

  it("creates export request, export job, and audit event for authenticated users", async () => {
    const result = await call(userFunctions, "createExportRequest");
    expect(result).toMatchObject({ status: "pending" });
    expect(result).toHaveProperty("requestId");
    expect(result).toHaveProperty("exportJobId");
    expect(result).toHaveProperty("auditId");
  });

  it("updates consent for authenticated users and returns a receipt", async () => {
    const result = await call(userFunctions, "updateConsent", { purpose: "ai_insights", consentTier: "C4", status: "revoked" });
    expect(result).toMatchObject({ status: "revoked" });
    expect(result).toHaveProperty("consentId");
    expect(result).toHaveProperty("consentEventId");
    expect(result).toHaveProperty("receiptHash");
    expect(result).toHaveProperty("auditId");
  });

  it("creates deletion request for authenticated users", async () => {
    const result = await call(userFunctions, "createDeletionRequest", { reason: "Integration test deletion request" });
    expect(result).toMatchObject({ status: "pending" });
    expect(result).toHaveProperty("requestId");
    expect(result).toHaveProperty("auditId");
  });

  it("rejects admin-only calls from non-admin users", async () => {
    await expect(call(userFunctions, "getPrivacyHealthReport")).rejects.toThrow();
    await expect(call(userFunctions, "processDeletionRequest", { requestId: "missing", status: "processing" })).rejects.toThrow();
  });

  it("allows admins to read privacy health report", async () => {
    const result = await call(adminFunctions, "getPrivacyHealthReport");
    expect(result).toHaveProperty("openExportRequests");
    expect(result).toHaveProperty("openDeletionRequests");
    expect(result).toHaveProperty("verdict");
  });

  it("allows admins to process an existing export job and create manifest paths", async () => {
    const created = await call<Record<string, string>>(userFunctions, "createExportRequest");
    const processed = await call(adminFunctions, "processExportRequest", { jobId: created.exportJobId });
    expect(processed).toMatchObject({ jobId: created.exportJobId, status: "completed" });
    expect(processed).toHaveProperty("manifestPath");
    expect(processed).toHaveProperty("exportPath");
    expect(processed).toHaveProperty("recordCount");
  });

  it("allows admins to process an existing deletion request with a safe plan", async () => {
    const created = await call<Record<string, string>>(userFunctions, "createDeletionRequest", { reason: "Process me" });
    const processed = await call(adminFunctions, "processDeletionRequest", { requestId: created.requestId, status: "processing" });
    expect(processed).toMatchObject({ requestId: created.requestId, status: "processing" });
    expect(processed).toHaveProperty("plan");
  });
});
