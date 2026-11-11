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
          <Suspense fallback={null}><Assistant /></Suspense>
        </LangProvider>
      </body>
    </html>
  );
}
