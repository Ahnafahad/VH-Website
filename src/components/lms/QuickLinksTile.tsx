'use client';

import { motion, Variants } from 'motion/react';
import Link from 'next/link';
import { BarChart3, ClipboardList, BookOpen, Calculator, CalendarPlus } from 'lucide-react';

const tileVariants: Variants = {
  rest: { scale: 1 },
  hover: { scale: 1.005, transition: { type: 'spring' as const, stiffness: 300, damping: 28 } },
};

const LINKS = [
  {
    href: '/results',
    label: 'Results',
    icon: BarChart3,
    bg: 'bg-violet-50 hover:bg-violet-100',
    iconColor: 'text-violet-600',
    border: 'border-violet-100',
  },
  {
    href: '/tests',
    label: 'Tests',
    icon: ClipboardList,
    bg: 'bg-[#F5EDE3] hover:bg-[#EEE0D0]',
    iconColor: 'text-[#760F13]',
    border: 'border-[#E8DDD5]',
  },
  {
    href: '/vocab/home',
    label: 'LexiCore',
    icon: BookOpen,
    bg: 'bg-sky-50 hover:bg-sky-100',
    iconColor: 'text-sky-600',
    border: 'border-sky-100',
  },
  {
    href: '/games/mental-math',
    label: 'Mental Math',
    icon: Calculator,
    bg: 'bg-amber-50 hover:bg-amber-100',
    iconColor: 'text-amber-600',
    border: 'border-amber-100',
  },
  {
    href: '/dashboard/book',
    label: 'Book Session',
    icon: CalendarPlus,
    bg: 'bg-emerald-50 hover:bg-emerald-100',
    iconColor: 'text-emerald-600',
    border: 'border-emerald-100',
  },
];

export default function QuickLinksTile() {
  return (
    <motion.div
      variants={tileVariants}
      initial="rest"
      whileHover="hover"
      className="rounded-2xl border border-[#E8DDD5] bg-white overflow-hidden"
      style={{ boxShadow: '0 1px 3px rgba(90,11,15,0.06), 0 4px 16px rgba(90,11,15,0.03)' }}
    >
      <div className="p-5 flex flex-col gap-3">
        <p className="text-[10px] font-sans uppercase tracking-widest text-[#A86E58]">Quick links</p>
        <div className="grid grid-cols-5 gap-2">
          {LINKS.map((link, i) => (
            <motion.div
              key={link.href}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.06, type: 'spring' as const, stiffness: 300, damping: 24 }}
              whileTap={{ scale: 0.94 }}
              whileHover={{ y: -2, transition: { type: 'spring' as const, stiffness: 400, damping: 24 } }}
            >
              <Link
                href={link.href}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-colors ${link.bg} ${link.border}`}
              >
                <link.icon className={`w-5 h-5 ${link.iconColor}`} strokeWidth={1.5} />
                <span className="text-[10px] font-sans font-medium text-[#5A0B0F] text-center leading-tight">
                  {link.label}
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
