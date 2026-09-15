'use client';

import { usePathname } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function MainSiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isVocab = pathname.startsWith('/vocab') || pathname.startsWith('/lexicore') || pathname.startsWith('/admin') || pathname.startsWith('/workbook')
    || pathname.startsWith('/dashboard/materials') || pathname.startsWith('/fbsorientation') || pathname.startsWith('/reading-speed-test');
  // Exam-taking screens (/tests/[bucket]/[slug]/take, /fbs-diagnosis/[slug]/take) own their
  // own focused header — the site nav would let students navigate away mid-exam.
  const isExamTaking = pathname.endsWith('/take');
  // Sprint's instructor presenter mode is projected full-screen — no room for the site nav.
  const isSprintPresent = pathname.startsWith('/sprint/') && pathname.endsWith('/present');
  const hideChrome = isVocab || isExamTaking || isSprintPresent;

  return (
    <>
      {!hideChrome && <Header />}
      {children}
      {!hideChrome && <Footer />}
    </>
  );
}
