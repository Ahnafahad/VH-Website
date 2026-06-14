import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Register — IBA, BUP & DU FBS Admission Coaching",
  description:
    "Register your interest for Beyond the Horizons' IBA DU, BUP, and DU FBS admission coaching. Secure a seat in the upcoming cohort and lock in early-bird rates.",
  keywords: [
    "IBA coaching registration",
    "IBA admission course enrollment",
    "BUP admission coaching registration",
    "English medium admission course Bangladesh",
  ],
  alternates: { canonical: "/registration" },
  openGraph: {
    title:
      "Register — IBA, BUP & DU FBS Admission Coaching | Beyond the Horizons",
    description:
      "Register your interest for IBA DU, BUP, and DU FBS admission coaching. Secure a seat and lock in early-bird rates.",
    url: "/registration",
  },
};

export default function RegistrationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
