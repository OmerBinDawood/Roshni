import type { Metadata } from "next";
import { Inter, Noto_Nastaliq_Urdu } from "next/font/google";
import "./globals.css";
import { LangProvider } from "@/lib/i18n";
import Header from "@/components/Header";
import Assistant from "@/components/Assistant";
import { Suspense } from "react";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const nastaliq = Noto_Nastaliq_Urdu({ variable: "--font-nastaliq", subsets: ["arabic"], weight: ["400", "700"] });

export const metadata: Metadata = {
  title: "Roshni — independent solar second opinion",
  description: "Before you pay, let Roshni check it. Independent solar quote audits for Pakistani homes.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${nastaliq.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <LangProvider>
          <Header />
          <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-6">{children}</main>
          <footer className="no-print border-t border-line text-sm text-muted">
            <nav className="max-w-4xl mx-auto px-4 py-4 flex flex-wrap gap-x-4 gap-y-1 pb-20 sm:pb-4">
              <a href="/audit">Check a quote</a><a href="/audit?mode=parts">Parts check</a><a href="/bill">Bill decoder</a>
              <a href="/battery">Battery advisor</a><a href="/readiness">Readiness</a><a href="/learn">Learn</a>
              <a href="/compare">Compare quotes</a><a href="/health">System health check</a><a href="/financing">Loan vs savings</a>
              <a href="/guides">Guides</a><a href="/account">My reports</a><a href="/about">Independence &amp; privacy</a>
            </nav>
          </footer>
          <Suspense fallback={null}><Assistant /></Suspense>
        </LangProvider>
      </body>
    </html>
  );
}
