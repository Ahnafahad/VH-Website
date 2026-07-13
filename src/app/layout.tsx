import type { Metadata } from "next";
import { Cormorant_Garamond, Fraunces, Geist, JetBrains_Mono, Sora } from "next/font/google";
import "./globals.css";
import MainSiteShell from "@/components/MainSiteShell";
import AuthProvider from "@/components/AuthProvider";
import OnboardingGate from "@/components/onboarding/OnboardingGate";
import AnalyticsTracker from "@/components/AnalyticsTracker";
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

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-math-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "700"],
});

const lexiUi = Sora({
  variable: "--font-lexi-ui",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const lexiWord = Cormorant_Garamond({
  variable: "--font-lexi-word",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
});

const SITE_URL = "https://www.vh-beyondthehorizons.org";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default:
      "IBA Admission Coaching for English-Medium Students | Beyond the Horizons",
    template: "%s | Beyond the Horizons",
  },
  description:
    "Beyond the Horizons is Bangladesh's only IBA admission coaching built specifically for English-medium (A-Level/O-Level) students. Expert preparation for IBA DU, BUP, and DU FBS with a proven 46.7% success rate.",
  keywords: [
    "IBA coaching",
    "IBA admission coaching",
    "IBA coaching for English medium",
    "IBA DU admission",
    "BUP admission coaching",
    "DU FBS admission",
    "English medium university admission Bangladesh",
    "A-level admission coaching Bangladesh",
    "business school admission Bangladesh",
    "Beyond the Horizons",
  ],
  applicationName: "Beyond the Horizons",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "Beyond the Horizons",
    title:
      "IBA Admission Coaching for English-Medium Students | Beyond the Horizons",
    description:
      "Bangladesh's only IBA admission coaching built specifically for English-medium students. Expert preparation for IBA DU, BUP, and DU FBS.",
    images: [
      {
        url: "/bth_horizontal_lockup.png",
        width: 1200,
        height: 630,
        alt: "Beyond the Horizons — IBA admission coaching for English-medium students",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title:
      "IBA Admission Coaching for English-Medium Students | Beyond the Horizons",
    description:
      "Bangladesh's only IBA admission coaching built specifically for English-medium students. IBA DU, BUP, and DU FBS preparation.",
    images: ["/bth_horizontal_lockup.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  category: "education",
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "EducationalOrganization",
      "@id": `${SITE_URL}/#organization`,
      name: "Beyond the Horizons",
      alternateName: "Vertical Horizon — Beyond the Horizons",
      url: SITE_URL,
      logo: `${SITE_URL}/bth_primary_stacked.png`,
      image: `${SITE_URL}/bth_horizontal_lockup.png`,
      description:
        "Bangladesh's only IBA admission coaching built specifically for English-medium students, with expert preparation for IBA DU, BUP, and DU FBS.",
      areaServed: { "@type": "Country", name: "Bangladesh" },
      address: { "@type": "PostalAddress", addressCountry: "BD" },
      knowsAbout: [
        "IBA admission coaching",
        "IBA DU admission test",
        "BUP admission",
        "DU FBS admission",
        "English-medium university preparation",
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "Beyond the Horizons",
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: "en",
    },
    {
      "@type": "Course",
      name: "IBA DU Admission Program",
      description:
        "Five-month IBA Dhaka University admission coaching program for English-medium students covering English, math, and analytical writing.",
      provider: { "@id": `${SITE_URL}/#organization` },
      url: `${SITE_URL}/program`,
    },
    {
      "@type": "Course",
      name: "DU FBS Admission Program",
      description:
        "Four-month DU FBS (Faculty of Business Studies) admission coaching program for English-medium students.",
      provider: { "@id": `${SITE_URL}/#organization` },
      url: `${SITE_URL}/program`,
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body
        className={`${fraunces.variable} ${geist.variable} ${jetbrainsMono.variable} ${lexiUi.variable} ${lexiWord.variable} antialiased`}
      >
        <AuthProvider>
          <MainSiteShell>
            {children}
          </MainSiteShell>
          <OnboardingGate />
          <AnalyticsTracker />
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
