'use client';

import { usePathname } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function MainSiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isVocab = pathname.startsWith('/vocab') || pathname.startsWith('/admin') || pathname.startsWith('/workbook')
    || pathname.startsWith('/dashboard/materials');
  // Exam-taking screens (/tests/[bucket]/[slug]/take, /fbs-diagnosis/[slug]/take) own their
  // own focused header — the site nav would let students navigate away mid-exam.
  const isExamTaking = pathname.endsWith('/take');
  const hideChrome = isVocab || isExamTaking;

  return (
    <>
      {!hideChrome && <Header />}
      {children}
      {!hideChrome && <Footer />}
    </>
  );
}
