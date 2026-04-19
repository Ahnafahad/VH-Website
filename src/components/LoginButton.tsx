'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import { LogOut, LogIn } from 'lucide-react';
import { motion } from 'motion/react';

export default function LoginButton() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return (
      <div className="flex items-center gap-2 px-3 py-2">
        <motion.span
          animate={{ opacity: [0.3, 0.9, 0.3] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          className="w-1.5 h-1.5 rounded-full bg-[#5A0B0F]"
        />
        <span className="font-sans text-xs tracking-[0.2em] uppercase text-[#5A0B0F]/50">
          Signing in
        </span>
      </div>
    );
  }

  if (session) {
    const name = session.user?.name?.split(' ')[0] || 'Reader';
    return (
      <div className="flex items-center gap-3">
        <span className="hidden md:inline font-sans text-xs tracking-[0.15em] uppercase text-[#5A0B0F]/60">
          <span className="text-[#A86E58]">{'\u2014'}</span> {name}
        </span>
        <button
          onClick={() => signOut()}
          className="group flex items-center gap-2 px-4 py-2 rounded-full bg-[#5A0B0F] text-[#FAF5EF] text-xs sm:text-sm font-medium tracking-wide transition-all duration-300 hover:bg-[#760F13] hover:gap-3"
        >
          <span>Sign out</span>
          <LogOut
            className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5"
            strokeWidth={1.75}
          />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => signIn('google')}
      className="group flex items-center gap-2 px-4 py-2 rounded-full bg-[#5A0B0F] text-[#FAF5EF] text-xs sm:text-sm font-medium tracking-wide transition-all duration-300 hover:bg-[#760F13] hover:gap-3"
    >
      <LogIn
        className="w-3.5 h-3.5 transition-transform duration-300 group-hover:-translate-x-0.5"
        strokeWidth={1.75}
      />
      <span>Sign in</span>
    </button>
  );
}
