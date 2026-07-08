'use client';

import { useReducedMotion, motion, Variants } from 'motion/react';
import type { DashboardData } from '@/lib/lms/dashboard-data';
import NextClassTile from './NextClassTile';
import LastClassTile from './LastClassTile';
import HomeworkTile from './HomeworkTile';
import UpcomingTestTile from './UpcomingTestTile';
import WeekStripTile from './WeekStripTile';
import AnnouncementsTile from './AnnouncementsTile';
import QuickLinksTile from './QuickLinksTile';
import LockedBanner from './LockedBanner';

interface Props {
  data: DashboardData | { hasAccess: false };
  userName: string;
}

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 300, damping: 28 },
  },
};

// Instant variant for reduced-motion: content always visible, no y shift
const itemVariantsReduced: Variants = {
  hidden: { opacity: 1, y: 0 },
  visible: { opacity: 1, y: 0 },
};

export default function DashboardScreen({ data, userName }: Props) {
  const hasAccess = data.hasAccess === true;
  const d = hasAccess ? (data as DashboardData) : null;
  const prefersReduced = useReducedMotion();

  const firstName = userName.split(' ')[0] ?? userName;

  return (
    <main className="min-h-screen bg-[#FAF5EF]">
      {/* Masthead — pt-24 sm:pt-28 clears the fixed floating nav (~80px mobile / ~96px desktop + breathing room) */}
      <div className="border-b border-[#E8DDD5] bg-white pt-24 sm:pt-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-8 sm:pb-10">
          <p className="text-[10px] font-sans uppercase tracking-widest text-[#A86E58] mb-2">
            Student Dashboard
          </p>
          <h1 className="font-heading text-2xl sm:text-3xl font-semibold text-[#1A0507]">
            Welcome back, {firstName}
          </h1>
          <p className="text-sm text-[#7A4A35] mt-1">
            {hasAccess
              ? 'Your classes, homework, and tests — all in one place.'
              : 'Your account is active. LMS access will be enabled after registration.'}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Locked banner when no LMS access */}
        {!hasAccess && <LockedBanner />}

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-12 gap-4"
        >
          {/* === NEXT CLASS — spans full width on mobile, 7/12 on md+ === */}
          <motion.div variants={prefersReduced ? itemVariantsReduced : itemVariants} className="md:col-span-7">
            <NextClassTile
              nextClass={d?.nextClass ?? null}
              serverJoinOpen={d?.nextClass?.joinOpen ?? false}
            />
          </motion.div>

          {/* === LAST CLASS — 5/12 on md+ === */}
          <motion.div variants={prefersReduced ? itemVariantsReduced : itemVariants} className="md:col-span-5">
            <LastClassTile lastClass={d?.lastClass ?? null} />
          </motion.div>

          {/* === WEEK STRIP — full width === */}
          <motion.div variants={prefersReduced ? itemVariantsReduced : itemVariants} className="md:col-span-12">
            <WeekStripTile weekClasses={d?.weekClasses ?? []} />
          </motion.div>

          {/* === HOMEWORK — 5/12 on md+ === */}
          <motion.div variants={prefersReduced ? itemVariantsReduced : itemVariants} className="md:col-span-5">
            <HomeworkTile assignments={d?.assignments ?? []} />
          </motion.div>

          {/* === UPCOMING TESTS — 7/12 on md+ === */}
          <motion.div variants={prefersReduced ? itemVariantsReduced : itemVariants} className="md:col-span-7">
            <UpcomingTestTile upcomingTests={d?.upcomingTests ?? []} />
          </motion.div>

          {/* === QUICK LINKS — full width === */}
          <motion.div variants={prefersReduced ? itemVariantsReduced : itemVariants} className="md:col-span-12">
            <QuickLinksTile />
          </motion.div>

          {/* === ANNOUNCEMENTS — full width === */}
          {((d?.announcements?.length ?? 0) > 0 || !hasAccess) && (
            <motion.div variants={prefersReduced ? itemVariantsReduced : itemVariants} className="md:col-span-12">
              <AnnouncementsTile announcements={d?.announcements ?? []} />
            </motion.div>
          )}
        </motion.div>
      </div>
    </main>
  );
}
