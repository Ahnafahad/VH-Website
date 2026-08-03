'use client';

import { MotionConfig } from 'framer-motion';

/**
 * One place to honour `prefers-reduced-motion` for every framer-motion
 * animation under /admin — the modal springs, the row stagger, the whileTap
 * scales. CSS can't reach those; they're inline styles written by JS each
 * frame, so the setting has to be handed to the library itself.
 *
 * `reducedMotion="user"` keeps opacity crossfades and drops transforms, which
 * is the behaviour the spec asks for: the state change still reads, it just
 * doesn't move. Exists as its own client component because the admin layout is
 * a server component and can't hold provider state.
 */
export default function AdminMotionConfig({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
