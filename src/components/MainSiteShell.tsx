'use client';

import { usePathname } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function MainSiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isVocab = pathname.startsWith('/vocab') || pathname.startsWith('/admin');

  return (
    <>
      {!isVocab && <Header />}
      {children}
      {!isVocab && <Footer />}
    </>
  );
}
