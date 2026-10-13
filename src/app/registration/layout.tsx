import type { Metadata } from "next";
import { getFlag } from "@/lib/super/flags";

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

export default async function RegistrationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await getFlag("registration_open", true))) {
    return (
      <main style={{ minHeight: "70vh", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
        <div>
          <h1 style={{ fontSize: 28, margin: "0 0 8px" }}>Registration is closed</h1>
          <p style={{ margin: 0, opacity: 0.7 }}>We are not taking new registrations right now. Please check back soon.</p>
        </div>
      </main>
    );
  }
  return children;
}
