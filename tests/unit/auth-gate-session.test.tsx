import React from "react";
import type { User } from "firebase/auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  auth: { currentUser: null as User | null },
  hooks: [] as unknown[], cursor: 0, writes: 0, mounted: false,
  observe: null as ((user: User | null) => Promise<void>) | null,
  cleanup: null as (() => void) | null,
  unsubscribe: vi.fn(), signIn: vi.fn(), signOut: vi.fn()
}));
vi.mock("../../firebase/firebase", () => ({ auth: state.auth }));
vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: class {}, signInWithPopup: state.signIn, signOut: state.signOut,
  onAuthStateChanged: (_auth: unknown, next: typeof state.observe) => {
    state.observe = next; return state.unsubscribe;
  }
}));
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useCallback: (fn: unknown) => fn,
    useRef: (initial: unknown) => {
      const index = state.cursor++;
      if (!(index in state.hooks)) state.hooks[index] = { current: initial };
      return state.hooks[index];
    },
    useState: (initial: unknown) => {
      const index = state.cursor++;
      if (!(index in state.hooks)) state.hooks[index] = initial;
      return [state.hooks[index], (next: unknown) => { state.writes++; state.hooks[index] = next; }];
    },
    useEffect: (effect: () => () => void) => {
      if (!state.mounted) { state.mounted = true; state.cleanup = effect(); }
    }
  };
});
import { AuthGate } from "../../components/AuthGate";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
function user(uid: string, claim: Promise<{ claims: Record<string, unknown> }> = Promise.resolve({ claims: { admin: true } })) {
  return { uid, getIdTokenResult: vi.fn(() => claim) } as unknown as User;
}
const children = vi.fn((current: User) => `PRIVATE-${current.uid}`);
function render(adminOnly = true) {
  state.cursor = 0;
  return AuthGate({ children, adminOnly });
}
function observe(current: User | null) {
  state.auth.currentUser = current;
  return state.observe!(current);
}
function action(tree: React.ReactNode, label: string): () => Promise<void> {
  if (!React.isValidElement<{ children?: React.ReactNode; onClick?: () => Promise<void> }>(tree)) throw new Error("Action was not found: " + label);
  const children = React.Children.toArray(tree.props.children);
  if (tree.type === "button" && children.join("").includes(label) && tree.props.onClick) return tree.props.onClick;
  for (const child of children) {
    if (!React.isValidElement(child)) continue;
    try { return action(child, label); } catch { /* Search the remaining controls. */ }
  }
  throw new Error("Action was not found: " + label);
}
beforeEach(() => {
  vi.clearAllMocks(); state.hooks.length = 0; state.cursor = 0; state.writes = 0;
  state.mounted = false; state.observe = null; state.cleanup = null; state.auth.currentUser = null;
  state.signIn.mockResolvedValue(undefined); state.signOut.mockResolvedValue(undefined);
  vi.stubGlobal("React", React);
  render();
});

describe("actual AuthGate session transitions with deferred Firebase claims", () => {
  it("renders private content for the current trusted admin", async () => {
    const current = user("owner-a");
    await observe(current); render();
    expect(children).toHaveBeenCalledWith(current);
  });

  it("does not render private content for the current nonadmin", async () => {
    await observe(user("owner-b", Promise.resolve({ claims: {} }))); render();
    expect(children).not.toHaveBeenCalled();
  });

  it("does not resurrect the admin after sign-out while claims await", async () => {
    const claim = deferred<{ claims: Record<string, unknown> }>();
    const pending = observe(user("owner-a", claim.promise));
    await observe(null);
    claim.resolve({ claims: { admin: true } });
    await pending; render();
    expect(children).not.toHaveBeenCalled();
  });

  it("does not replace the new nonadmin with an older admin callback", async () => {
    const claim = deferred<{ claims: Record<string, unknown> }>();
    const pending = observe(user("owner-a", claim.promise));
    await observe(user("owner-b", Promise.resolve({ claims: {} })));
    claim.resolve({ claims: { admin: true } });
    await pending; render();
    expect(children).not.toHaveBeenCalled();
  });

  it("removes old private content while a replacement owner's claims load", async () => {
    await observe(user("owner-a")); render(); children.mockClear();
    const claim = deferred<{ claims: Record<string, unknown> }>();
    const pending = observe(user("owner-b", claim.promise));
    render();
    expect(children).not.toHaveBeenCalled();
    claim.resolve({ claims: { admin: true } }); await pending;
  });

  it("ignores an obsolete claim failure after a current admin is ready", async () => {
    const claim = deferred<{ claims: Record<string, unknown> }>();
    const pending = observe(user("owner-a", claim.promise));
    const current = user("owner-b"); await observe(current);
    claim.reject(new Error("synthetic-old-session-error")); await pending; render();
    expect(children).toHaveBeenCalledWith(current);
  });

  it("does not write component state after an awaited callback unmounts", async () => {
    const claim = deferred<{ claims: Record<string, unknown> }>();
    const pending = observe(user("owner-a", claim.promise));
    state.cleanup!(); const writesAtUnmount = state.writes;
    claim.resolve({ claims: { admin: true } }); await pending;
    expect(state.unsubscribe).toHaveBeenCalledTimes(1);
    expect(state.writes).toBe(writesAtUnmount);
  });

  it("withholds the previous owner's private content when current auth changes before its observer arrives", async () => {
    await observe(user("owner-a"));
    render(); children.mockClear();
    state.auth.currentUser = user("owner-b");
    render();
    expect(children).not.toHaveBeenCalled();
  });

  it("ignores a late popup failure after a newer owner is ready", async () => {
    await observe(null);
    const popup = deferred<void>(); state.signIn.mockReturnValue(popup.promise);
    const pending = action(render(), "Sign in securely")();
    const current = user("owner-b"); await observe(current);
    popup.reject(new Error("synthetic-old-popup-error")); await pending; render();
    expect(children).toHaveBeenCalledWith(current);
  });

  it("does not write state when a pending popup failure arrives after unmount", async () => {
    await observe(null);
    const popup = deferred<void>(); state.signIn.mockReturnValue(popup.promise);
    const pending = action(render(), "Sign in securely")();
    state.cleanup!(); const writesAtUnmount = state.writes;
    popup.reject(new Error("synthetic-old-popup-error")); await pending;
    expect(state.writes).toBe(writesAtUnmount);
  });

  it("does not hide a newer owner when an older sign-out completes", async () => {
    await observe(user("owner-a", Promise.resolve({ claims: {} })));
    const signOut = deferred<void>(); state.signOut.mockReturnValue(signOut.promise);
    const pending = action(render(), "Sign out")();
    const current = user("owner-b"); await observe(current);
    signOut.resolve(); await pending; render();
    expect(children).toHaveBeenCalledWith(current);
  });

  it("does not write state when pending sign-out completes after unmount", async () => {
    await observe(user("owner-a", Promise.resolve({ claims: {} })));
    const signOut = deferred<void>(); state.signOut.mockReturnValue(signOut.promise);
    const pending = action(render(), "Sign out")();
    state.cleanup!(); const writesAtUnmount = state.writes;
    signOut.resolve(); await pending;
    expect(state.writes).toBe(writesAtUnmount);
  });
});
