import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "University Admission Eligibility Checker (IBA, BUP, DU FBS, BUET, MIST, BRAC, NSU, JU & others)",
  description:
    "Check your eligibility for IBA DU, BUP, DU FBS, DU Science, DU Economics, BUET, MIST, BRAC, NSU, IBA-JU and other Bangladeshi universities in seconds. A free tool for English-medium (A-Level/O-Level) students from Beyond the Horizons.",
  keywords: [
    "IBA admission eligibility",
    "BUP admission eligibility",
    "DU FBS eligibility",
    "English medium university eligibility Bangladesh",
  ],
  alternates: { canonical: "/eligibility-checker" },
  openGraph: {
    title:
      "University Admission Eligibility Checker (IBA, BUP, DU FBS, BUET, MIST, BRAC, NSU, JU & others) | Beyond the Horizons",
    description:
      "Check your eligibility for IBA DU, BUP, DU FBS, BUET, MIST, BRAC, NSU, IBA-JU and other Bangladeshi universities in seconds — free tool for English-medium students.",
    url: "/eligibility-checker",
  },
};

export default function EligibilityCheckerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
