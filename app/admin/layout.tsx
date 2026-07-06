import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminGate } from "@/components/AdminGate";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true
  }
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminGate>{children}</AdminGate>;
}
