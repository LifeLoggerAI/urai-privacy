import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  auth: { currentUser: null as { uid: string; getIdToken: (refresh: boolean) => Promise<string> } | null },
  callable: vi.fn(),
  listeners: [] as Array<(snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => void>,
  unsubscribe: vi.fn(),
  clicks: vi.fn(),
  append: vi.fn(),
  createObjectURL: vi.fn(),
  fetch: vi.fn()
}));
vi.mock("../../firebase/firebase", () => ({
  auth: state.auth, db: {}, firebaseApp: { options: { projectId: "synthetic-project" } }, functions: {}
}));
vi.mock("firebase/functions", () => ({ httpsCallable: () => state.callable }));
vi.mock("firebase/firestore", () => ({
  collection: (_db: unknown, name: string) => name,
  where: (...args: unknown[]) => args, limit: (value: number) => value, orderBy: (...args: unknown[]) => args,
  query: (...args: unknown[]) => args,
  onSnapshot: (_query: unknown, listener: typeof state.listeners[number]) => {
    state.listeners.push(listener); return state.unsubscribe;
  }
}));
import { callPrivacyFunction, downloadExportPackage, subscribeUserCollection } from "../../src/lib/firebase-privacy-client";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
const endpoint = "https://us-central1-synthetic-project.cloudfunctions.net/downloadExportPackage?jobId=synthetic";
const descriptor = { url: endpoint, requiresAuthorization: true };
const owner = () => ({ uid: "owner-a", getIdToken: vi.fn(async () => "synthetic-owner-token") });

beforeEach(() => {
  vi.clearAllMocks(); state.listeners.length = 0;
  state.auth.currentUser = owner();
  state.callable.mockResolvedValue({ data: descriptor });
  state.fetch.mockResolvedValue(new Response('{"private":"synthetic"}', { headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", state.fetch);
  state.createObjectURL.mockReturnValue("blob:synthetic-private");
  vi.stubGlobal("URL", class extends URL {
    static createObjectURL = state.createObjectURL;
    static revokeObjectURL = vi.fn();
  });
  vi.stubGlobal("document", {
    createElement: () => ({ href: "", download: "", rel: "", click: state.clicks, remove: vi.fn() }),
    body: { append: state.append }
  });
});

describe("actual privacy client current-session lifecycle", () => {
  it("downloads private bytes for the unchanged authenticated session", async () => {
    await downloadExportPackage({ jobId: "synthetic" });
    expect(state.fetch).toHaveBeenCalledTimes(1);
    expect(state.clicks).toHaveBeenCalledTimes(1);
  });

  it("rejects a callable result after sign-out", async () => {
    const reply = deferred<{ data: Record<string, unknown> }>();
    state.callable.mockReturnValue(reply.promise);
    const operation = callPrivacyFunction("createExportRequest");
    state.auth.currentUser = null;
    reply.resolve({ data: { requestId: "synthetic-private" } });
    await expect(operation).rejects.toThrow(/authentication|session/i);
  });

  it("does not fetch or save an old descriptor after an owner switch", async () => {
    const reply = deferred<{ data: typeof descriptor }>();
    state.callable.mockReturnValue(reply.promise);
    const operation = downloadExportPackage({ jobId: "synthetic" });
    state.auth.currentUser = { ...owner(), uid: "owner-b" };
    reply.resolve({ data: descriptor });
    await expect(operation).rejects.toThrow(/authentication|session/i);
    expect(state.fetch).not.toHaveBeenCalled();
    expect(state.clicks).not.toHaveBeenCalled();
  });

  it("does not transmit the old token when sign-out races token refresh", async () => {
    const token = deferred<string>();
    state.auth.currentUser!.getIdToken = vi.fn(() => token.promise);
    const operation = downloadExportPackage({ jobId: "synthetic" });
    await vi.waitFor(() => expect(state.auth.currentUser!.getIdToken).toHaveBeenCalled());
    state.auth.currentUser = null;
    token.resolve("synthetic-old-token");
    await expect(operation).rejects.toThrow(/authentication|session/i);
    expect(state.fetch).not.toHaveBeenCalled();
    expect(state.clicks).not.toHaveBeenCalled();
  });

  it("does not save private bytes when another owner signs in during body delivery", async () => {
    const body = deferred<Blob>();
    const response = new Response(null, { headers: { "Content-Type": "application/json" } });
    response.blob = vi.fn(() => body.promise);
    state.fetch.mockResolvedValue(response);
    const operation = downloadExportPackage({ jobId: "synthetic" });
    await vi.waitFor(() => expect(response.blob).toHaveBeenCalled());
    state.auth.currentUser = { ...owner(), uid: "owner-b" };
    body.resolve(new Blob(['{"private":"synthetic-old-owner"}']));
    await expect(operation).rejects.toThrow(/authentication|session/i);
    expect(state.createObjectURL).not.toHaveBeenCalled();
    expect(state.clicks).not.toHaveBeenCalled();
  });

  it("treats a replacement session with the same UID as a new authority", async () => {
    const reply = deferred<{ data: typeof descriptor }>();
    state.callable.mockReturnValue(reply.promise);
    const operation = downloadExportPackage({ jobId: "synthetic" });
    state.auth.currentUser = owner();
    reply.resolve({ data: descriptor });
    await expect(operation).rejects.toThrow(/authentication|session/i);
    expect(state.fetch).not.toHaveBeenCalled();
    expect(state.clicks).not.toHaveBeenCalled();
  });

  it("does not deliver a late private snapshot after unsubscribe", () => {
    const rows = vi.fn();
    const unsubscribe = subscribeUserCollection("exportJobs", "owner-a", rows);
    unsubscribe();
    state.listeners[0]({ docs: [{ id: "old-job", data: () => ({ uid: "owner-a" }) }] });
    expect(rows).not.toHaveBeenCalled();
  });

  it("does not deliver the old owner's snapshot after an account switch", () => {
    const rows = vi.fn();
    subscribeUserCollection("exportJobs", "owner-a", rows);
    state.auth.currentUser = { ...owner(), uid: "owner-b" };
    state.listeners[0]({ docs: [{ id: "old-job", data: () => ({ uid: "owner-a" }) }] });
    expect(rows).not.toHaveBeenCalled();
  });

  it("rejects a foreign user subscription before registering a listener", () => {
    expect(() => subscribeUserCollection("exportJobs", "owner-b", vi.fn())).toThrow(/authentication|session|owner/i);
    expect(state.listeners).toHaveLength(0);
  });
});
