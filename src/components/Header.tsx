'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Menu,
  X,
  ChevronDown,
  BarChart3,
  Calculator,
  ClipboardList,
  Users,
  Target,
  Gamepad2,
  BookOpen,
  ArrowUpRight,
} from 'lucide-react';
import {
  motion,
  AnimatePresence,
  useScroll,
  useMotionValueEvent,
} from 'motion/react';
import LoginButton from './LoginButton';
import { useSession } from 'next-auth/react';

const mainLinks = [
  { label: 'Home', href: '/' },
  { label: 'Programs', href: '/program' },
  { label: 'About', href: '/#about' },
  { label: 'Register', href: '/registration' },
];

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const { data: session } = useSession();
  const [isAdmin, setIsAdmin] = useState(false);
  const { scrollY } = useScroll();
  const pathname = usePathname();

  useMotionValueEvent(scrollY, 'change', (latest) => {
    setScrolled(latest > 60);
  });

  // Admin check
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!session?.user?.email) {
        setIsAdmin(false);
        return;
      }
      try {
        const response = await fetch('/api/auth/check-admin');
        const data = await response.json();
        setIsAdmin(data.isAdmin);
      } catch {
        setIsAdmin(false);
      }
    };
    checkAdminStatus();
  }, [session]);

  // Outside click dismiss
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setIsMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Lock scroll when mobile menu open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMenuOpen]);

  const moreLinks = [
    { label: 'Eligibility Checker', href: '/eligibility-checker', icon: Target },
    { label: 'Mock Exams', href: '/mock-exams', icon: ClipboardList },
    ...(session
      ? [{ label: 'Results', href: '/results', icon: BarChart3 }]
      : []),
    { label: 'Mental Math', href: '/games/mental-math', icon: Gamepad2 },
    { label: 'FBS Accounting', href: '/games/fbs-accounting', icon: Calculator },
    { label: 'Vocab', href: '/games/vocab-quiz', icon: BookOpen },
    ...(isAdmin
      ? [
          { label: 'Registrations', href: '/admin/registrations', icon: Users },
          { label: 'Manage Users', href: '/admin/users', icon: Users },
          { label: 'FBS Accounting', href: '/games/fbs-accounting', icon: Calculator },
        ]
      : []),
  ];

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    if (href.startsWith('/#')) return false;
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Main floating nav */}
      <motion.header
        className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 pt-6 lg:pt-10"
        initial={false}
        animate={{ paddingTop: scrolled ? 14 : 40 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <motion.nav
          className="relative flex items-center gap-1 rounded-full pl-3 pr-3 py-2.5 transition-shadow"
          animate={{
            backgroundColor: scrolled
              ? 'rgba(250, 245, 239, 0.88)'
              : 'rgba(250, 245, 239, 0.0)',
            backdropFilter: scrolled ? 'blur(24px)' : 'blur(0px)',
            boxShadow: scrolled
              ? '0 8px 40px rgba(26,5,7,0.12), inset 0 0 0 1px rgba(212,176,148,0.25)'
              : 'inset 0 0 0 1px rgba(212,176,148,0)',
          }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Logo */}
          <Link
            href="/"
            className="flex-shrink-0 mr-3 flex items-center gap-2 group"
          >
            <Image
              src="/vh-logo-transparent.png"
              alt="VH Beyond the Horizons"
              width={120}
              height={40}
              className="h-9 w-auto transition-transform duration-500 group-hover:scale-[1.03]"
              priority
            />
          </Link>

          {/* Desktop nav — magnetic layoutId hover indicator */}
          <div
            className="hidden lg:flex items-center gap-0.5 relative"
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {mainLinks.map((link, i) => {
              const active = isActive(link.href);
              const baseColor = scrolled
                ? active
                  ? '#5A0B0F'
                  : 'rgba(90,11,15,0.7)'
                : active
                  ? '#FAF5EF'
                  : 'rgba(250,245,239,0.75)';
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  onMouseEnter={() => setHoveredIndex(i)}
                  className="relative px-4 py-2 text-sm font-medium rounded-full transition-colors duration-300"
                  style={{ color: baseColor }}
                >
                  {hoveredIndex === i && (
                    <motion.span
                      layoutId="nav-indicator"
                      className="absolute inset-0 rounded-full bg-[#D4B094]/25"
                      transition={{
                        type: 'spring',
                        stiffness: 380,
                        damping: 32,
                      }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    {link.label}
                    {active && (
                      <span
                        className="w-1 h-1 rounded-full"
                        style={{ background: scrolled ? '#760F13' : '#D4B094' }}
                      />
                    )}
                  </span>
                </Link>
              );
            })}

            {/* More dropdown */}
            <div ref={moreRef} className="relative">
              <button
                onMouseEnter={() => setHoveredIndex(mainLinks.length)}
                onClick={() => setIsMoreOpen((v) => !v)}
                className="relative flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full transition-colors duration-300 cursor-pointer"
                style={{
                  color: scrolled ? 'rgba(90,11,15,0.7)' : 'rgba(250,245,239,0.75)',
                }}
              >
                {hoveredIndex === mainLinks.length && (
                  <motion.span
                    layoutId="nav-indicator"
                    className="absolute inset-0 rounded-full bg-[#D4B094]/25"
                    transition={{
                      type: 'spring',
                      stiffness: 380,
                      damping: 32,
                    }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1">
                  More
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-300 ${
                      isMoreOpen ? 'rotate-180' : ''
                    }`}
                    strokeWidth={1.75}
                  />
                </span>
              </button>

              <AnimatePresence>
                {isMoreOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 12, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{
                      type: 'spring',
                      stiffness: 380,
                      damping: 30,
                    }}
                    className="absolute top-full right-0 mt-3 w-64 bg-[#FAF5EF]/95 backdrop-blur-xl border border-[#D4B094]/25 rounded-2xl shadow-[0_20px_60px_rgba(26,5,7,0.15)] p-2 overflow-hidden"
                  >
                    {/* Corner bracket accent */}
                    <span className="absolute top-3 left-3 w-3 h-px bg-[#D4B094]/60" />
                    <span className="absolute top-3 left-3 w-px h-3 bg-[#D4B094]/60" />

                    <div className="px-3 pt-2 pb-2 font-sans text-[9px] tracking-[0.3em] uppercase text-[#A86E58]">
                      Archive
                    </div>
                    {moreLinks.map((link, i) => (
                      <motion.div
                        key={link.label}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.05 + i * 0.03 }}
                      >
                        <Link
                          href={link.href}
                          onClick={() => setIsMoreOpen(false)}
                          className="group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#5A0B0F]/80 hover:text-[#5A0B0F] hover:bg-[#D4B094]/15 transition-colors duration-200"
                        >
                          <link.icon
                            className="w-4 h-4 text-[#A86E58]"
                            strokeWidth={1.5}
                          />
                          <span className="flex-1">{link.label}</span>
                          <ArrowUpRight
                            className="w-3.5 h-3.5 opacity-0 -translate-x-1 group-hover:opacity-60 group-hover:translate-x-0 transition-all duration-300"
                            strokeWidth={1.5}
                          />
                        </Link>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Login (desktop) */}
          <div
            className="hidden lg:block ml-3 pl-3 border-l transition-colors duration-300"
            style={{
              borderColor: scrolled
                ? 'rgba(90,11,15,0.1)'
                : 'rgba(212,176,148,0.25)',
            }}
          >
            <LoginButton />
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="lg:hidden ml-2 p-2 rounded-full hover:bg-[#D4B094]/15 transition-colors cursor-pointer"
            style={{
              color: scrolled ? 'rgba(90,11,15,0.8)' : 'rgba(250,245,239,0.85)',
            }}
            aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
          >
            <AnimatePresence mode="wait" initial={false}>
              {isMenuOpen ? (
                <motion.span
                  key="x"
                  initial={{ opacity: 0, rotate: -90 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0, rotate: 90 }}
                  transition={{ duration: 0.2 }}
                  className="block"
                >
                  <X className="w-5 h-5" strokeWidth={1.5} />
                </motion.span>
              ) : (
                <motion.span
                  key="m"
                  initial={{ opacity: 0, rotate: 90 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0, rotate: -90 }}
                  transition={{ duration: 0.2 }}
                  className="block"
                >
                  <Menu className="w-5 h-5" strokeWidth={1.5} />
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </motion.nav>
      </motion.header>

      {/* Mobile overlay — editorial fullscreen */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-40 bg-[#1A0507] lg:hidden overflow-y-auto"
          >
            {/* Grain */}
            <div
              className="absolute inset-0 opacity-[0.08] mix-blend-overlay pointer-events-none"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence baseFrequency='0.9'/></filter><rect width='300' height='300' filter='url(%23n)'/></svg>\")",
              }}
            />

            {/* Radial warm glow */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'radial-gradient(ellipse 80% 60% at 50% 110%, rgba(212,176,148,0.2), transparent 60%)',
              }}
            />

            <div className="relative min-h-dvh flex flex-col pt-24 pb-12 px-8">
              {/* Folio */}
              <div className="flex items-center justify-between font-sans text-[10px] tracking-[0.3em] uppercase text-[#D4B094]/50 mb-16">
                <span>№ 01</span>
                <span>Menu</span>
              </div>

              {/* Main links */}
              <nav className="flex-1 flex flex-col gap-1">
                {mainLinks.map((link, i) => (
                  <motion.div
                    key={link.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{
                      delay: 0.05 + i * 0.05,
                      type: 'spring',
                      stiffness: 260,
                      damping: 26,
                    }}
                    className="border-b border-[#D4B094]/10"
                  >
                    <Link
                      href={link.href}
                      onClick={() => setIsMenuOpen(false)}
                      className="group flex items-baseline justify-between py-5"
                    >
                      <span className="font-heading text-[#FAF5EF] text-3xl font-light tracking-[-0.01em]">
                        {link.label}
                      </span>
                      <span className="font-sans text-[10px] tracking-[0.3em] uppercase text-[#D4B094]/40 group-hover:text-[#D4B094] transition-colors">
                        0{i + 1}
                      </span>
                    </Link>
                  </motion.div>
                ))}
              </nav>

              {/* Archive */}
              <div className="mt-10">
                <div className="font-sans text-[10px] tracking-[0.3em] uppercase text-[#D4B094]/50 mb-4 flex items-center gap-3">
                  <span className="w-6 h-px bg-[#D4B094]/40" />
                  Archive
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {moreLinks.map((link, i) => (
                    <motion.div
                      key={link.label}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{
                        delay: 0.3 + i * 0.04,
                        type: 'spring',
                        stiffness: 260,
                        damping: 26,
                      }}
                    >
                      <Link
                        href={link.href}
                        onClick={() => setIsMenuOpen(false)}
                        className="group flex items-center gap-2 py-2 text-sm text-[#FAF5EF]/70 hover:text-[#FAF5EF] transition-colors"
                      >
                        <link.icon
                          className="w-3.5 h-3.5 text-[#D4B094]/60"
                          strokeWidth={1.5}
                        />
                        <span>{link.label}</span>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Login */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: 0.5, duration: 0.5 }}
                className="mt-12 pt-8 border-t border-[#D4B094]/20"
              >
                <LoginButton />
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Header;
