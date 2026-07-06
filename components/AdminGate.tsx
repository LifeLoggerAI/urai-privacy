"use client";

import type { ReactNode } from "react";
import { AuthGate } from "./AuthGate";

export function AdminGate({ children }: { children: ReactNode }) {
  return <AuthGate adminOnly>{() => children}</AuthGate>;
}
