import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "URAI Privacy",
  description: "Standalone privacy, consent, audit, export, deletion, and governance console for AI-native products.",
  openGraph: {
    title: "URAI Privacy",
    description: "Privacy operations layer for URAI and AI-native products.",
    url: "https://uraiprivacy.com",
    type: "website"
  }
};

const nav = [
  ["Home", "/"],
  ["Privacy", "/privacy"],
  ["Privacy Center", "/privacy-center"],
  ["Admin", "/admin"]
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <nav className="nav" aria-label="Primary navigation">
            <a className="brand" href="/">URAI Privacy</a>
            <div className="links">
              {nav.map(([label, href]) => <a key={href} href={href}>{label}</a>)}
              <a href="/status.html">Legacy status</a>
            </div>
          </nav>
          <main>{children}</main>
          <footer className="footer">URAI Privacy · Firebase/Next.js product scaffold · governance package preserved</footer>
        </div>
      </body>
    </html>
  );
}
