'use client';

import { usePathname } from 'next/navigation';

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // key change causes React to unmount+remount the div, re-triggering the CSS animation.
  // CSS animations run on the compositor thread — cannot be blocked by JS main-thread work.
  return (
    <div key={pathname} className="lx-page-enter">
      {children}
    </div>
  );
}
