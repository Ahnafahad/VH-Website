'use client';

import { useReducedMotion, motion, Variants } from 'motion/react';
import type { DashboardData } from '@/lib/lms/dashboard-data';
import NextClassTile from './NextClassTile';
import HomeworkTile from './HomeworkTile';
import UpcomingTestTile from './UpcomingTestTile';
import WeekStripTile from './WeekStripTile';
import AnnouncementsTile from './AnnouncementsTile';
import LockedBanner from './LockedBanner';
import MomentumMasthead from './MomentumMasthead';
import StatBand from './StatBand';
import ResultsHub from './ResultsHub';
import ClassHistoryTile from './ClassHistoryTile';
import GamesStrip from './GamesStrip';
import SubjectsStrip from './SubjectsStrip';

interface Props {
  data: DashboardData | { hasAccess: false };
  userName: string;
}

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06 },
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

  const iv = prefersReduced ? itemVariantsReduced : itemVariants;

  // Empty data shapes for locked users (so components render their empty states)
  const emptyResults: DashboardData['results'] = { latest: null, history: [] };
  const emptyClassPulse: DashboardData['classPulse'] = {
    attendanceRate: null,
    attendedCount: 0,
    completedCount: 0,
    recentClasses: [],
    resumeTarget: null,
  };
  const emptyGames: DashboardData['games'] = { vocab: null, math: null, accounting: null };
  const emptyMomentum: DashboardData['momentum'] = {
    streakDays: 0,
    homeworkDue: 0,
    testsOpenNow: 0,
    unwatchedRecordings: 0,
  };

  const results = d?.results ?? emptyResults;
  const classPulse = d?.classPulse ?? emptyClassPulse;
  const games = d?.games ?? emptyGames;
  const momentum = d?.momentum ?? emptyMomentum;

  return (
    <main className="min-h-screen" style={{ backgroundColor: '#1A0507' }}>
      <div
        className="max-w-6xl mx-auto px-4 sm:px-6 pb-24"
        style={{ paddingTop: 'max(6rem, calc(6rem + env(safe-area-inset-top)))' }}
      >
        {/* pt-24 sm:pt-28 — clears fixed floating nav */}
        <div className="pt-0 sm:pt-4" />

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* ── 1. Momentum Masthead ── */}
          <motion.div variants={iv}>
            <MomentumMasthead
              userName={userName}
              momentum={momentum}
              hasAccess={hasAccess}
            />
          </motion.div>

          {/* Locked banner */}
          {!hasAccess && (
            <motion.div variants={iv}>
              <LockedBanner />
            </motion.div>
          )}

          {/* ── Subjects strip ── */}
          {hasAccess && d && (
            <motion.div variants={iv} className="mb-10">
              <SubjectsStrip subjects={d.subjects} />
            </motion.div>
          )}

          {/* ── 2. Next Class + Week Strip band ── */}
          {hasAccess && (
            <motion.div variants={iv} className="grid grid-cols-1 lg:grid-cols-12 gap-x-12 gap-y-8 mb-10">
              {/* Next Class hero — lg:col-span-8 */}
              <div className="lg:col-span-8">
                {/* Section marker */}
                <div className="flex items-center gap-3 mb-5">
                  <span
                    className="font-heading italic text-sm flex-shrink-0"
                    style={{ color: '#D4B094' }}
                  >
                    next class
                  </span>
                  <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(212,176,148,0.16)' }} />
                </div>
                <NextClassTile
                  nextClass={d?.nextClass ?? null}
                  serverJoinOpen={d?.nextClass?.joinOpen ?? false}
                />
              </div>

              {/* Week strip — lg:col-span-4 */}
              <div className="lg:col-span-4">
                <WeekStripTile weekClasses={d?.weekClasses ?? []} />
              </div>
            </motion.div>
          )}

          {hasAccess && (
            <>
              {/* ── 3. Stat Band ── */}
              <motion.div variants={iv} className="mb-10">
                <StatBand classPulse={classPulse} results={results} games={games} />
              </motion.div>

              {/* ── 4. Results + Homework band — each side hidden when empty, sibling expands to fill the freed space ── */}
              {(() => {
                const hasResults = results.latest !== null;
                const hasHomework = (d?.assignments?.length ?? 0) > 0;
                if (!hasResults && !hasHomework) return null;
                return (
                  <motion.div variants={iv} className="grid grid-cols-1 lg:grid-cols-12 gap-x-12 gap-y-10 mb-10">
                    {hasResults && (
                      <div className={hasHomework ? 'lg:col-span-7' : 'lg:col-span-12'}>
                        <ResultsHub results={results} />
                      </div>
                    )}
                    {hasHomework && (
                      <div className={hasResults ? 'lg:col-span-5' : 'lg:col-span-12'}>
                        <HomeworkTile assignments={d?.assignments ?? []} />
                      </div>
                    )}
                  </motion.div>
                );
              })()}

              {/* ── 5. Class History + Upcoming Tests band — same dynamic hide/expand ── */}
              {(() => {
                const hasClassHistory = classPulse.recentClasses.length > 0 || classPulse.resumeTarget !== null;
                const hasUpcomingTests = (d?.upcomingTests?.length ?? 0) > 0;
                if (!hasClassHistory && !hasUpcomingTests) return null;
                return (
                  <motion.div variants={iv} className="grid grid-cols-1 lg:grid-cols-12 gap-x-12 gap-y-10 mb-10">
                    {hasClassHistory && (
                      <div className={hasUpcomingTests ? 'lg:col-span-7' : 'lg:col-span-12'}>
                        <ClassHistoryTile classPulse={classPulse} />
                      </div>
                    )}
                    {hasUpcomingTests && (
                      <div className={hasClassHistory ? 'lg:col-span-5' : 'lg:col-span-12'}>
                        <UpcomingTestTile upcomingTests={d?.upcomingTests ?? []} />
                      </div>
                    )}
                  </motion.div>
                );
              })()}

              {/* ── 6. Games Strip ── */}
              <motion.div variants={iv} className="mb-10">
                <GamesStrip games={games} />
              </motion.div>
            </>
          )}

          {/* ── 7. Announcements — only when present ── */}
          {(d?.announcements?.length ?? 0) > 0 && (
            <motion.div variants={iv}>
              <AnnouncementsTile announcements={d?.announcements ?? []} />
            </motion.div>
          )}
        </motion.div>
      </div>
    </main>
  );
}
