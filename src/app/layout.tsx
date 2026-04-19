import type { Metadata } from "next";
import { Fraunces, Geist } from "next/font/google";
import "./globals.css";
import MainSiteShell from "@/components/MainSiteShell";
import AuthProvider from "@/components/AuthProvider";
import OnboardingGate from "@/components/onboarding/OnboardingGate";
import { Analytics } from "@vercel/analytics/react";

const fraunces = Fraunces({
  variable: "--font-heading",
  subsets: ["latin"],
  display: "swap",
  axes: ["SOFT", "opsz"],
});

const geist = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Beyond the Horizons — The Only EM-Specific Admission Program in Bangladesh",
  description: "The only university admission program in Bangladesh built specifically for English-medium students. Expert preparation for IBA DU, BUP, and DU FBS with a 46.7% success rate.",
  keywords: "IBA admission, BUP admission, DU FBS, English medium, university preparation, Bangladesh, business school, A-levels",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${fraunces.variable} ${geist.variable} antialiased`}
      >
        <AuthProvider>
          <MainSiteShell>
            {children}
          </MainSiteShell>
          <OnboardingGate />
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
