import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://uraiprivacy.com"),
  title: "URAI Privacy — Consent, Passport, Data Controls, and Responsible AI",
  description: "URAI Privacy is the trust center for Passport permissions, data controls, consent boundaries, delete/export paths, responsible AI, and safety boundaries across the URAI ecosystem.",
  robots: {
    index: true,
    follow: true
  },
  openGraph: {
    title: "URAI Privacy — Consent, Passport, Data Controls, and Responsible AI",
    description: "Trust center for Passport permissions, data controls, consent boundaries, delete/export paths, responsible AI, and safety boundaries across URAI.",
    url: "https://uraiprivacy.com",
    type: "website"
  }
};

const nav = [
  ["Home", "/"],
  ["Passport", "/passport"],
  ["Data Controls", "/data-controls"],
  ["Consent", "/consent"],
  ["Delete / Export", "/delete-export"],
  ["Responsible AI", "/responsible-ai"],
  ["Safety", "/safety"],
  ["Boundaries", "/what-urai-does-not-do"],
  ["Privacy Center", "/privacy-center"]
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">Skip to main content</a>
        <div className="shell">
          <nav className="nav" aria-label="Primary navigation">
            <a className="brand" href="/" aria-label="URAI Privacy home">URAI Privacy</a>
            <div className="links">
              {nav.map(([label, href]) => <a key={href} href={href}>{label}</a>)}
              <a href="/privacy">Policy</a>
            </div>
          </nav>
          <main id="main-content" tabIndex={-1}>{children}</main>
          <footer className="footer">
            URAI Privacy · Consent, Passport, data controls, responsible AI, and safety boundaries. Not medical care, therapy, emergency response, or crisis support. · <a href="https://urailabs.com">URAI Labs</a> · <a href="https://urai.app">UrAi App</a>
          </footer>
        </div>
      </body>
    </html>
  );
}
