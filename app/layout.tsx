import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import { NavLinks } from "@/components/NavLinks";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
  variable: "--font-archivo",
});

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "OnePlus Community";

export const metadata: Metadata = {
  title: {
    default: `${siteName} analytics`,
    template: `%s \u2013 ${siteName} analytics`,
  },
  description: `Activity, growth and engagement for the ${siteName} Discord server.`,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F4F5F7" },
    { media: "(prefers-color-scheme: dark)", color: "#16191E" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={archivo.variable}>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <header className="site-header">
          <div className="shell site-header-inner">
            <p className="site-name">{siteName}</p>
            <NavLinks />
          </div>
        </header>
        <main id="main" className="shell">
          {children}
        </main>
        <footer className="shell site-footer">
          <p>Data from Statbot, refreshed every 3 hours. Times shown in IST.</p>
        </footer>
      </body>
    </html>
  );
}
