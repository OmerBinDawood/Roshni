import type { Metadata } from "next";
import { Archivo, Inter, JetBrains_Mono, Noto_Nastaliq_Urdu } from "next/font/google";
import "./globals.css";
import { LangProvider } from "@/lib/i18n";
import Header from "@/components/Header";
import Assistant from "@/components/Assistant";
import SiteFooter from "@/components/SiteFooter";
import { Suspense } from "react";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], weight: ["700", "800", "900"] });
const mono = JetBrains_Mono({ variable: "--font-jbmono", subsets: ["latin"], weight: ["500", "700"] });
const nastaliq = Noto_Nastaliq_Urdu({ variable: "--font-nastaliq", subsets: ["arabic"], weight: ["400", "700"] });

export const metadata: Metadata = {
  title: "Roshni — independent solar second opinion",
  description: "Before you pay, let Roshni check it. Independent solar quote audits for Pakistani homes.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${archivo.variable} ${mono.variable} ${nastaliq.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <LangProvider>
          <Header />
          <main className="flex-1 w-full">{children}</main>
          <SiteFooter />
          <Suspense fallback={null}><Assistant /></Suspense>
        </LangProvider>
      </body>
    </html>
  );
}
