/**
 * Analytics aggregation queries for the admin dashboard.
 * All functions handle empty/missing data gracefully — never throw.
 * Timestamps in Drizzle mode:'timestamp' come back as JS Date objects.
 */

import { db } from '@/lib/db';
import {
  analyticsEvents,
  analyticsSessions,
  users,
  vocabUserWordRecords,
  vocabWords,
  vocabConfusionPairs,
  vocabQuizSessions,
  vocabQuizAnswers,
  vocabFlashcardSessions,
  vocabUserProgress,
  mathQuestionAttempts,
  mathSessions,
  mathUserProgress,
  registrations,
  freeSignups,
  vocabUpgradeRequests,
  vocabAccessRequests,
  materials,
  classSessions,
  assignmentSubmissions,
  recordingWatchProgress,
} from '@/lib/db';
import { sql, eq, and, gte, desc, count } from 'drizzle-orm';

// ─── Range helpers ────────────────────────────────────────────────────────────

export type Range = '7d' | '30d' | '90d' | 'all';

function cutoffDate(range: Range): Date | null {
  if (range === 'all') return null;
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ─── Overview ─────────────────────────────────────────────────────────────────

export async function getOverview(range: Range) {
  try {
    const cutoff = cutoffDate(range);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // --- Totals from analyticsSessions ---
    const sessionQuery = db.select({
      total:     sql<number>`count(*)`,
      anon:      sql<number>`sum(case when ${analyticsSessions.isAuthenticated} = 0 then 1 else 0 end)`,
      auth:      sql<number>`sum(case when ${analyticsSessions.isAuthenticated} = 1 then 1 else 0 end)`,
      avgDur:    sql<number>`avg(${analyticsSessions.durationMs})`,
      pageviews: sql<number>`sum(${analyticsSessions.pageCount})`,
    }).from(analyticsSessions);

    const sessionsInRange = cutoff
      ? sessionQuery.where(gte(analyticsSessions.startedAt, cutoff))
      : sessionQuery;

    const [sessionRow] = await sessionsInRange.catch(() => [null]);

    // Active users in last 7d (auth sessions)
    const [activeRow] = await db.select({ c: sql<number>`count(distinct ${analyticsSessions.userId})` })
      .from(analyticsSessions)
      .where(and(
        eq(analyticsSessions.isAuthenticated, true),
        gte(analyticsSessions.startedAt, sevenDaysAgo),
      ))
      .catch(() => [{ c: 0 }]);

    // Total users
    const [userRow] = await db.select({ c: count() }).from(users).catch(() => [{ c: 0 }]);

    // Total registrations
    const regQuery = db.select({ c: count() }).from(registrations);
    const [regRow] = await (cutoff
      ? regQuery.where(gte(registrations.createdAt, cutoff))
      : regQuery
    ).catch(() => [{ c: 0 }]);

    // Free signups
    const fsQuery = db.select({ c: count() }).from(freeSignups);
    const [fsRow] = await (cutoff
      ? fsQuery.where(gte(freeSignups.createdAt, cutoff))
      : fsQuery
    ).catch(() => [{ c: 0 }]);

    // --- DAU/WAU: daily unique authenticated users from analyticsSessions ---
    const dauQuery = db.select({
      startedAt: analyticsSessions.startedAt,
      userId:    analyticsSessions.userId,
    })
      .from(analyticsSessions)
      .where(
        cutoff
          ? and(eq(analyticsSessions.isAuthenticated, true), gte(analyticsSessions.startedAt, cutoff))
          : eq(analyticsSessions.isAuthenticated, true),
      );

    const dauRows = await dauQuery.catch(() => []);

    // Bucket by day in JS
    const dauMap = new Map<string, Set<number>>();
    for (const r of dauRows) {
      if (!r.startedAt || !r.userId) continue;
      const day = toIsoDate(r.startedAt);
      if (!dauMap.has(day)) dauMap.set(day, new Set());
      dauMap.get(day)!.add(r.userId);
    }

    // Fallback: if no analytics sessions, derive from vocab/math activity
    let dauWau: Array<{ date: string; dau: number }> = [];
    if (dauMap.size > 0) {
      dauWau = Array.from(dauMap.entries())
        .map(([date, userSet]) => ({ date, dau: userSet.size }))
        .sort((a, b) => a.date.localeCompare(b.date));
    } else {
      // Fallback: use vocabUserWordRecords.updatedAt
      const fallbackRows = await db.select({
        updatedAt: vocabUserWordRecords.updatedAt,
        userId:    vocabUserWordRecords.userId,
      })
        .from(vocabUserWordRecords)
        .where(cutoff ? gte(vocabUserWordRecords.updatedAt, cutoff) : undefined)
        .catch(() => []);

      const fbMap = new Map<string, Set<number>>();
      for (const r of fallbackRows) {
        if (!r.updatedAt || !r.userId) continue;
        const day = toIsoDate(r.updatedAt);
        if (!fbMap.has(day)) fbMap.set(day, new Set());
        fbMap.get(day)!.add(r.userId);
      }
      dauWau = Array.from(fbMap.entries())
        .map(([date, s]) => ({ date, dau: s.size }))
        .sort((a, b) => a.date.localeCompare(b.date));
    }

    // --- Top modules from analyticsEvents ---
    const modQuery = db.select({
      module:    analyticsEvents.module,
      events:    sql<number>`count(*)`,
      avgTimeMs: sql<number>`avg(${analyticsEvents.durationMs})`,
    })
      .from(analyticsEvents)
      .groupBy(analyticsEvents.module)
      .orderBy(desc(sql`count(*)`));

    const modRows = await (cutoff
      ? modQuery.where(gte(analyticsEvents.createdAt, cutoff))
      : modQuery
    ).catch(() => []);

    const topModules = modRows
      .filter(r => r.module)
      .map(r => ({
        module:    r.module as string,
        events:    Number(r.events ?? 0),
        avgTimeMs: Math.round(Number(r.avgTimeMs ?? 0)),
      }));

    return {
      totals: {
        totalUsers:           Number(userRow?.c ?? 0),
        activeUsers7d:        Number(activeRow?.c ?? 0),
        totalSessions:        Number(sessionRow?.total ?? 0),
        anonSessions:         Number(sessionRow?.anon ?? 0),
        authSessions:         Number(sessionRow?.auth ?? 0),
        avgSessionDurationMs: Math.round(Number(sessionRow?.avgDur ?? 0)),
        totalPageviews:       Number(sessionRow?.pageviews ?? 0),
        totalRegistrations:   Number(regRow?.c ?? 0),
        freeSignups:          Number(fsRow?.c ?? 0),
      },
      dauWau,
      topModules,
    };
  } catch {
    return {
      totals: {
        totalUsers: 0, activeUsers7d: 0, totalSessions: 0,
        anonSessions: 0, authSessions: 0, avgSessionDurationMs: 0,
        totalPageviews: 0, totalRegistrations: 0, freeSignups: 0,
      },
      dauWau: [],
      topModules: [],
    };
  }
}

// ─── Behavior ─────────────────────────────────────────────────────────────────

export async function getBehavior(range: Range) {
  try {
    const cutoff = cutoffDate(range);

    const eventsBase = db.select({
      path:      analyticsEvents.path,
      type:      analyticsEvents.type,
      durationMs: analyticsEvents.durationMs,
      anonId:    analyticsEvents.anonId,
      createdAt: analyticsEvents.createdAt,
    }).from(analyticsEvents);

    const eventRows = await (cutoff
      ? eventsBase.where(gte(analyticsEvents.createdAt, cutoff))
      : eventsBase
    ).catch(() => []);

    // Top pages (pageview events)
    const pageviewRows = eventRows.filter(r => r.type === 'pageview' && r.path);
    const pageMap = new Map<string, { views: number; times: number[]; visitors: Set<string> }>();
    for (const r of pageviewRows) {
      const p = r.path!;
      if (!pageMap.has(p)) pageMap.set(p, { views: 0, times: [], visitors: new Set() });
      const e = pageMap.get(p)!;
      e.views++;
      if (r.durationMs != null) e.times.push(r.durationMs);
      if (r.anonId) e.visitors.add(r.anonId);
    }
    const topPages = Array.from(pageMap.entries())
      .map(([path, v]) => ({
        path,
        views:          v.views,
        avgTimeMs:      v.times.length ? Math.round(v.times.reduce((a, b) => a + b, 0) / v.times.length) : 0,
        uniqueVisitors: v.visitors.size,
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 20);

    // Sessions for entry/exit/device/auth/referrer
    const sessBase = db.select({
      entryPath:       analyticsSessions.entryPath,
      exitPath:        analyticsSessions.exitPath,
      referrer:        analyticsSessions.referrer,
      device:          analyticsSessions.device,
      isAuthenticated: analyticsSessions.isAuthenticated,
    }).from(analyticsSessions);

    const sessRows = await (cutoff
      ? sessBase.where(gte(analyticsSessions.startedAt, cutoff))
      : sessBase
    ).catch(() => []);

    // Entry pages
    const entryMap = new Map<string, number>();
    const exitMap  = new Map<string, number>();
    const devMap   = new Map<string, number>();
    const refMap   = new Map<string, number>();
    let authCount = 0;
    let anonCount = 0;

    for (const s of sessRows) {
      if (s.entryPath) entryMap.set(s.entryPath, (entryMap.get(s.entryPath) ?? 0) + 1);
      if (s.exitPath)  exitMap.set(s.exitPath,   (exitMap.get(s.exitPath)   ?? 0) + 1);
      if (s.device)    devMap.set(s.device,       (devMap.get(s.device)     ?? 0) + 1);
      if (s.referrer)  refMap.set(s.referrer,     (refMap.get(s.referrer)   ?? 0) + 1);
      if (s.isAuthenticated) authCount++; else anonCount++;
    }

    const entryPages = Array.from(entryMap.entries())
      .map(([path, c]) => ({ path, count: c }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    const exitPages = Array.from(exitMap.entries())
      .map(([path, c]) => ({ path, count: c }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    const deviceSplit = Array.from(devMap.entries())
      .map(([device, c]) => ({ device, count: c }))
      .sort((a, b) => b.count - a.count);

    const referrers = Array.from(refMap.entries())
      .map(([referrer, c]) => ({ referrer, count: c }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Time by path (from page_exit events)
    const exitEventRows = eventRows.filter(r => r.type === 'page_exit' && r.path && r.durationMs != null);
    const timeByPathMap = new Map<string, number[]>();
    for (const r of exitEventRows) {
      const p = r.path!;
      if (!timeByPathMap.has(p)) timeByPathMap.set(p, []);
      timeByPathMap.get(p)!.push(r.durationMs!);
    }
    const timeByPath = Array.from(timeByPathMap.entries())
      .map(([path, times]) => ({
        path,
        avgTimeMs: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
      }))
      .sort((a, b) => b.avgTimeMs - a.avgTimeMs)
      .slice(0, 20);

    return {
      topPages,
      entryPages,
      exitPages,
      deviceSplit,
      authVsAnon: { auth: authCount, anon: anonCount },
      referrers,
      timeByPath,
    };
  } catch {
    return {
      topPages: [], entryPages: [], exitPages: [],
      deviceSplit: [], authVsAnon: { auth: 0, anon: 0 },
      referrers: [], timeByPath: [],
    };
  }
}

// ─── Vocab ────────────────────────────────────────────────────────────────────

export async function getVocab(range: Range) {
  try {
    const cutoff = cutoffDate(range);
    const MIN_ATTEMPTS = 3;

    // Hardest words: join vocabUserWordRecords + vocabWords
    const wordRecordRows = await db.select({
      word:        vocabWords.word,
      definition:  vocabWords.definition,
      totalAttempts:      vocabUserWordRecords.totalAttempts,
      accuracyRate:       vocabUserWordRecords.accuracyRate,
      flashcardMissedCount: vocabUserWordRecords.flashcardMissedCount,
      updatedAt:   vocabUserWordRecords.updatedAt,
    })
      .from(vocabUserWordRecords)
      .innerJoin(vocabWords, eq(vocabUserWordRecords.wordId, vocabWords.id))
      .catch(() => []);

    // Filter by range if needed (by updatedAt)
    const filteredWordRecords = cutoff
      ? wordRecordRows.filter(r => r.updatedAt && r.updatedAt >= cutoff)
      : wordRecordRows;

    // Aggregate per word
    const wordAgg = new Map<string, {
      word: string; definition: string;
      attempts: number; totalAccuracy: number; rows: number; missedCount: number;
    }>();
    for (const r of filteredWordRecords) {
      const key = r.word;
      if (!wordAgg.has(key)) {
        wordAgg.set(key, { word: r.word, definition: r.definition, attempts: 0, totalAccuracy: 0, rows: 0, missedCount: 0 });
      }
      const e = wordAgg.get(key)!;
      e.attempts    += r.totalAttempts;
      e.totalAccuracy += r.accuracyRate * 100; // accuracyRate is 0–1
      e.rows++;
      e.missedCount += r.flashcardMissedCount;
    }

    const hardestWords = Array.from(wordAgg.values())
      .filter(w => w.attempts >= MIN_ATTEMPTS)
      .map(w => ({
        word:        w.word,
        definition:  w.definition,
        attempts:    w.attempts,
        accuracy:    Math.round((w.totalAccuracy / w.rows) * 10) / 10,
        missedCount: w.missedCount,
      }))
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 20);

    // Confusion pairs
    const confRows = await db.select({
      wordAId: vocabConfusionPairs.wordAId,
      wordBId: vocabConfusionPairs.wordBId,
      count:   vocabConfusionPairs.count,
    })
      .from(vocabConfusionPairs)
      .orderBy(desc(vocabConfusionPairs.count))
      .limit(15)
      .catch(() => []);

    // Get word names for the IDs
    const pairWordIds = Array.from(new Set([
      ...confRows.map(r => r.wordAId),
      ...confRows.map(r => r.wordBId),
    ]));

    const pairWordRows = pairWordIds.length
      ? await db.select({ id: vocabWords.id, word: vocabWords.word })
          .from(vocabWords)
          .catch(() => [])
      : [];

    const wordById = new Map(pairWordRows.map(w => [w.id, w.word]));

    const confusionPairs = confRows
      .map(r => ({
        wordA: wordById.get(r.wordAId) ?? String(r.wordAId),
        wordB: wordById.get(r.wordBId) ?? String(r.wordBId),
        count: r.count,
      }));

    // Mastery distribution
    const masteryRows = await db.select({
      masteryLevel: vocabUserWordRecords.masteryLevel,
      c:            sql<number>`count(*)`,
    })
      .from(vocabUserWordRecords)
      .groupBy(vocabUserWordRecords.masteryLevel)
      .catch(() => []);

    const masteryDistribution = masteryRows.map(r => ({
      level: r.masteryLevel,
      count: Number(r.c ?? 0),
    }));

    // Feature usage from analyticsEvents where type='feature' and module='vocab'
    const featQuery = db.select({
      name:  analyticsEvents.name,
      count: sql<number>`count(*)`,
    })
      .from(analyticsEvents)
      .where(
        cutoff
          ? and(
              eq(analyticsEvents.type, 'feature'),
              eq(analyticsEvents.module, 'vocab'),
              gte(analyticsEvents.createdAt, cutoff),
            )
          : and(
              eq(analyticsEvents.type, 'feature'),
              eq(analyticsEvents.module, 'vocab'),
            ),
      )
      .groupBy(analyticsEvents.name)
      .orderBy(desc(sql`count(*)`));

    const featRows = await featQuery.catch(() => []);

    let featureUsage: Array<{ feature: string; count: number }> = featRows
      .filter(r => r.name)
      .map(r => ({ feature: r.name as string, count: Number(r.count ?? 0) }));

    // Fallback: derive from session tables if no feature events
    if (featureUsage.length === 0) {
      const fcQuery = db.select({ c: count() }).from(vocabFlashcardSessions);
      const qsQuery = db.select({ c: count() }).from(vocabQuizSessions);
      const [fcRow] = await fcQuery.catch(() => [{ c: 0 }]);
      const [qsRow] = await qsQuery.catch(() => [{ c: 0 }]);
      featureUsage = [
        { feature: 'flashcard', count: Number(fcRow?.c ?? 0) },
        { feature: 'quiz',      count: Number(qsRow?.c ?? 0) },
      ];
    }

    // Funnel: studied / quizzed / passed
    const [studiedRow] = await db.select({ c: sql<number>`count(distinct ${vocabUserWordRecords.userId})` })
      .from(vocabUserWordRecords)
      .catch(() => [{ c: 0 }]);

    const [quizzedRow] = await db.select({ c: sql<number>`count(distinct ${vocabQuizSessions.userId})` })
      .from(vocabQuizSessions)
      .catch(() => [{ c: 0 }]);

    const [passedRow] = await db.select({ c: sql<number>`count(distinct ${vocabQuizSessions.userId})` })
      .from(vocabQuizSessions)
      .where(eq(vocabQuizSessions.passed, true))
      .catch(() => [{ c: 0 }]);

    // Question type accuracy
    const qtRows = await db.select({
      questionType: vocabQuizAnswers.questionType,
      total:        sql<number>`count(*)`,
      correct:      sql<number>`sum(case when ${vocabQuizAnswers.isCorrect} = 1 then 1 else 0 end)`,
    })
      .from(vocabQuizAnswers)
      .groupBy(vocabQuizAnswers.questionType)
      .catch(() => []);

    const questionTypeAccuracy = qtRows.map(r => {
      const total = Number(r.total ?? 0);
      const correct = Number(r.correct ?? 0);
      return {
        type:     r.questionType,
        accuracy: total > 0 ? Math.round((correct / total) * 1000) / 10 : 0,
        count:    total,
      };
    });

    // Top studied words by attempts
    const topStudiedWords = Array.from(wordAgg.values())
      .sort((a, b) => b.attempts - a.attempts)
      .slice(0, 20)
      .map(w => ({ word: w.word, attempts: w.attempts }));

    return {
      hardestWords,
      confusionPairs,
      masteryDistribution,
      featureUsage,
      funnel: {
        studied: Number(studiedRow?.c ?? 0),
        quizzed: Number(quizzedRow?.c ?? 0),
        passed:  Number(passedRow?.c ?? 0),
      },
      questionTypeAccuracy,
      topStudiedWords,
    };
  } catch {
    return {
      hardestWords: [], confusionPairs: [], masteryDistribution: [],
      featureUsage: [],
      funnel: { studied: 0, quizzed: 0, passed: 0 },
      questionTypeAccuracy: [], topStudiedWords: [],
    };
  }
}

// ─── LMS ────────────────────────────────────────────────────────────────────

export async function getLms(range: Range) {
  try {
    const cutoff = cutoffDate(range);
    const eventQuery = db.select({
      anonId: analyticsEvents.anonId,
      userId: analyticsEvents.userId,
      type: analyticsEvents.type,
      path: analyticsEvents.path,
      name: analyticsEvents.name,
      durationMs: analyticsEvents.durationMs,
      createdAt: analyticsEvents.createdAt,
    }).from(analyticsEvents);

    const eventRows = await (cutoff
      ? eventQuery.where(and(eq(analyticsEvents.module, 'lms'), gte(analyticsEvents.createdAt, cutoff)))
      : eventQuery.where(eq(analyticsEvents.module, 'lms'))
    ).catch(() => []);

    const identities = new Set<string>();
    const featureCounts = new Map<string, number>();
    const pathCounts = new Map<string, number>();
    const dailyUsers = new Map<string, Set<string>>();
    let pageviews = 0;
    let reliableVisibleMs = 0;
    let excludedDurationEvents = 0;

    for (const event of eventRows) {
      const identity = event.userId != null ? `user:${event.userId}` : `browser:${event.anonId}`;
      identities.add(identity);
      const date = toIsoDate(event.createdAt);
      if (!dailyUsers.has(date)) dailyUsers.set(date, new Set());
      dailyUsers.get(date)!.add(identity);

      if (event.type === 'pageview') {
        pageviews++;
        const path = event.path ?? '/dashboard';
        pathCounts.set(path, (pathCounts.get(path) ?? 0) + 1);
      }
      if (event.type === 'feature' && event.name) {
        featureCounts.set(event.name, (featureCounts.get(event.name) ?? 0) + 1);
      }
      if (event.type === 'page_exit' && event.durationMs != null) {
        // A backgrounded tab used to report multi-hour sessions as active time.
        // Exclude implausible single-page durations rather than presenting them
        // as trustworthy engagement.
        if (event.durationMs <= 4 * 60 * 60 * 1000) reliableVisibleMs += event.durationMs;
        else excludedDurationEvents++;
      }
    }

    const [materialRows, classRows, submissionRows, watchRows] = await Promise.all([
      db.select({ c: count() }).from(materials).catch(() => [{ c: 0 }]),
      db.select({ c: count() }).from(classSessions).catch(() => [{ c: 0 }]),
      db.select({ c: count() }).from(assignmentSubmissions).catch(() => [{ c: 0 }]),
      db.select({ c: count() }).from(recordingWatchProgress).catch(() => [{ c: 0 }]),
    ]);

    const feature = (name: string) => featureCounts.get(name) ?? 0;
    const pdfOpens = feature('material_opened');
    const pdfFailures = feature('material_load_failed');

    return {
      activeLearners: identities.size,
      pageviews,
      reliableVisibleMs,
      excludedDurationEvents,
      pdfOpens,
      pdfFailures,
      pdfFailureRate: pdfOpens > 0 ? Math.round((pdfFailures / pdfOpens) * 1000) / 10 : 0,
      pdfDownloads: feature('material_downloaded'),
      pdfRetries: feature('material_retry'),
      materialUploads: feature('material_uploaded'),
      classesCreated: feature('class_created'),
      classesJoined: feature('class_joined'),
      joinFailures: feature('class_join_failed'),
      assignmentsSubmitted: feature('assignment_submitted') + feature('assignment_resubmitted'),
      inventory: {
        materials: Number(materialRows[0]?.c ?? 0),
        classes: Number(classRows[0]?.c ?? 0),
        submissions: Number(submissionRows[0]?.c ?? 0),
        recordingProgress: Number(watchRows[0]?.c ?? 0),
      },
      topPaths: Array.from(pathCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([path, views]) => ({ path, views })),
      dailyActive: Array.from(dailyUsers.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, users]) => ({ date, users: users.size })),
    };
  } catch {
    return {
      activeLearners: 0, pageviews: 0, reliableVisibleMs: 0, excludedDurationEvents: 0,
      pdfOpens: 0, pdfFailures: 0, pdfFailureRate: 0, pdfDownloads: 0, pdfRetries: 0,
      materialUploads: 0, classesCreated: 0, classesJoined: 0, joinFailures: 0, assignmentsSubmitted: 0,
      inventory: { materials: 0, classes: 0, submissions: 0, recordingProgress: 0 },
      topPaths: [], dailyActive: [],
    };
  }
}

export async function getRetention(range: Range) {
  const cutoff = cutoffDate(range);
  try {
    const events = await db.select({ userId: analyticsEvents.userId, name: analyticsEvents.name, createdAt: analyticsEvents.createdAt })
      .from(analyticsEvents)
      .where(cutoff
        ? and(eq(analyticsEvents.module, 'vocab'), gte(analyticsEvents.createdAt, cutoff))
        : eq(analyticsEvents.module, 'vocab'));

    const starts = events.filter(event => event.name === 'onboarding_started');
    const activations = events.filter(event => event.name === 'activation_achieved');
    const completed = events.filter(event => event.name === 'learning_session_completed');
    const restored = events.filter(event => event.name === 'session_restored');
    const startByUser = new Map<number, Date>();
    for (const event of starts) if (event.userId && !startByUser.has(event.userId)) startByUser.set(event.userId, event.createdAt);
    const timeToValue = activations.flatMap(event => {
      const start = event.userId ? startByUser.get(event.userId) : null;
      return start ? [Math.max(0, event.createdAt.getTime() - start.getTime())] : [];
    }).sort((a, b) => a - b);
    const middle = Math.floor(timeToValue.length / 2);
    const medianTimeToValueMs = timeToValue.length
      ? (timeToValue.length % 2 ? timeToValue[middle] : Math.round((timeToValue[middle - 1] + timeToValue[middle]) / 2))
      : 0;

    const activatedUsers = await db.select({ userId: vocabUserProgress.userId, activatedAt: vocabUserProgress.activatedAt })
      .from(vocabUserProgress).where(sql`${vocabUserProgress.activatedAt} is not null`);
    const answers = await db.select({ userId: vocabQuizAnswers.userId, answeredAt: vocabQuizAnswers.answeredAt })
      .from(vocabQuizAnswers).where(eq(vocabQuizAnswers.isCorrect, true));
    const retainedAt = (days: number) => {
      const eligible = activatedUsers.filter(row => row.activatedAt && Date.now() - row.activatedAt.getTime() >= days * 86_400_000);
      const retained = eligible.filter(row => answers.some(answer => answer.userId === row.userId
        && row.activatedAt && answer.answeredAt.getTime() >= row.activatedAt.getTime() + days * 86_400_000
        && answer.answeredAt.getTime() < row.activatedAt.getTime() + (days + 1) * 86_400_000));
      return { eligible: eligible.length, retained: retained.length, rate: eligible.length ? Math.round(retained.length / eligible.length * 100) : 0 };
    };

    return {
      activation: { started: starts.length, achieved: activations.length, rate: starts.length ? Math.round(activations.length / starts.length * 100) : 0, medianTimeToValueMs },
      sessions: { completed: completed.length, restored: restored.length },
      testedRecallRetention: { d1: retainedAt(1), d7: retainedAt(7), d30: retainedAt(30) },
    };
  } catch {
    const empty = { eligible: 0, retained: 0, rate: 0 };
    return { activation: { started: 0, achieved: 0, rate: 0, medianTimeToValueMs: 0 }, sessions: { completed: 0, restored: 0 }, testedRecallRetention: { d1: empty, d7: empty, d30: empty } };
  }
}

// ─── Math ─────────────────────────────────────────────────────────────────────

export async function getMath(range: Range) {
  try {
    const cutoff = cutoffDate(range);

    // Operation stats from mathQuestionAttempts
    const attemptsBase = db.select({
      operation:      mathQuestionAttempts.operation,
      isCorrect:      mathQuestionAttempts.isCorrect,
      wasSkipped:     mathQuestionAttempts.wasSkipped,
      responseTimeMs: mathQuestionAttempts.responseTimeMs,
      difficulty:     mathQuestionAttempts.difficulty,
      answeredAt:     mathQuestionAttempts.answeredAt,
    }).from(mathQuestionAttempts);

    const attemptRows = await (cutoff
      ? attemptsBase.where(gte(mathQuestionAttempts.answeredAt, cutoff))
      : attemptsBase
    ).catch(() => []);

    // Aggregate by operation
    const opMap = new Map<string, {
      attempts: number; correct: number; skipped: number; totalMs: number;
    }>();
    for (const r of attemptRows) {
      if (!opMap.has(r.operation)) opMap.set(r.operation, { attempts: 0, correct: 0, skipped: 0, totalMs: 0 });
      const e = opMap.get(r.operation)!;
      e.attempts++;
      if (r.isCorrect) e.correct++;
      if (r.wasSkipped) e.skipped++;
      e.totalMs += r.responseTimeMs;
    }

    const operationStats = Array.from(opMap.entries()).map(([operation, v]) => ({
      operation,
      attempts:      v.attempts,
      accuracy:      v.attempts > 0 ? Math.round((v.correct / v.attempts) * 1000) / 10 : 0,
      avgResponseMs: v.attempts > 0 ? Math.round(v.totalMs / v.attempts) : 0,
      skipRate:      v.attempts > 0 ? Math.round((v.skipped / v.attempts) * 1000) / 10 : 0,
    }));

    // Difficulty distribution (round difficulty to nearest int for bucket)
    const diffMap = new Map<number, number>();
    for (const r of attemptRows) {
      const bucket = Math.round(r.difficulty);
      diffMap.set(bucket, (diffMap.get(bucket) ?? 0) + 1);
    }
    const difficultyDistribution = Array.from(diffMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([bucket, c]) => ({ bucket: String(bucket), count: c }));

    // Sessions over time
    const sessBase = db.select({
      startedAt: mathSessions.startedAt,
      status:    mathSessions.status,
    }).from(mathSessions);

    const sessRows = await (cutoff
      ? sessBase.where(gte(mathSessions.startedAt, cutoff))
      : sessBase
    ).catch(() => []);

    const sessDateMap = new Map<string, number>();
    let abandoned = 0;
    let totalSess = 0;
    for (const r of sessRows) {
      if (r.startedAt) {
        const day = toIsoDate(r.startedAt);
        sessDateMap.set(day, (sessDateMap.get(day) ?? 0) + 1);
      }
      totalSess++;
      if (r.status === 'abandoned') abandoned++;
    }

    const sessionsOverTime = Array.from(sessDateMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, sessions]) => ({ date, sessions }));

    // Avg skill from mathUserProgress
    const skillRows = await db.select({
      skillAddition:       mathUserProgress.skillAddition,
      skillSubtraction:    mathUserProgress.skillSubtraction,
      skillMultiplication: mathUserProgress.skillMultiplication,
      skillDivision:       mathUserProgress.skillDivision,
    }).from(mathUserProgress).catch(() => []);

    const avgSkill = skillRows.length
      ? {
          addition:       Math.round((skillRows.reduce((s, r) => s + r.skillAddition,       0) / skillRows.length) * 10) / 10,
          subtraction:    Math.round((skillRows.reduce((s, r) => s + r.skillSubtraction,    0) / skillRows.length) * 10) / 10,
          multiplication: Math.round((skillRows.reduce((s, r) => s + r.skillMultiplication, 0) / skillRows.length) * 10) / 10,
          division:       Math.round((skillRows.reduce((s, r) => s + r.skillDivision,       0) / skillRows.length) * 10) / 10,
        }
      : { addition: 0, subtraction: 0, multiplication: 0, division: 0 };

    const abandonmentRate = totalSess > 0
      ? Math.round((abandoned / totalSess) * 1000) / 10
      : 0;

    return {
      operationStats,
      difficultyDistribution,
      sessionsOverTime,
      avgSkill,
      abandonmentRate,
    };
  } catch {
    return {
      operationStats: [], difficultyDistribution: [],
      sessionsOverTime: [],
      avgSkill: { addition: 0, subtraction: 0, multiplication: 0, division: 0 },
      abandonmentRate: 0,
    };
  }
}

// ─── Funnel ───────────────────────────────────────────────────────────────────

export async function getFunnel(range: Range) {
  try {
    const cutoff = cutoffDate(range);

    // Visitors (distinct anonId in analyticsSessions)
    const visQuery = db.select({ c: sql<number>`count(distinct ${analyticsSessions.anonId})` })
      .from(analyticsSessions);
    const [visRow] = await (cutoff
      ? visQuery.where(gte(analyticsSessions.startedAt, cutoff))
      : visQuery
    ).catch(() => [{ c: 0 }]);

    // Sign-ups (total users)
    const [usersRow] = await db.select({ c: count() }).from(users)
      .catch(() => [{ c: 0 }]);

    // Onboarded
    const [onboardedRow] = await db.select({ c: sql<number>`count(*)` })
      .from(vocabUserProgress)
      .where(eq(vocabUserProgress.onboardingComplete, true))
      .catch(() => [{ c: 0 }]);

    // Active in last 7d (has a vocabUserWordRecord updated in 7d)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const [active7dRow] = await db.select({ c: sql<number>`count(distinct ${vocabUserWordRecords.userId})` })
      .from(vocabUserWordRecords)
      .where(gte(vocabUserWordRecords.updatedAt, sevenDaysAgo))
      .catch(() => [{ c: 0 }]);

    // Took a quiz
    const [quizRow] = await db.select({ c: sql<number>`count(distinct ${vocabQuizSessions.userId})` })
      .from(vocabQuizSessions)
      .catch(() => [{ c: 0 }]);

    // Passed a quiz
    const [passRow] = await db.select({ c: sql<number>`count(distinct ${vocabQuizSessions.userId})` })
      .from(vocabQuizSessions)
      .where(eq(vocabQuizSessions.passed, true))
      .catch(() => [{ c: 0 }]);

    const acquisition = [
      { stage: 'Visitors',     count: Number(visRow?.c ?? 0) },
      { stage: 'Sign-ups',     count: Number(usersRow?.c ?? 0) },
      { stage: 'Onboarded',    count: Number(onboardedRow?.c ?? 0) },
      { stage: 'Active (7d)',  count: Number(active7dRow?.c ?? 0) },
      { stage: 'Took a quiz',  count: Number(quizRow?.c ?? 0) },
      { stage: 'Passed a quiz', count: Number(passRow?.c ?? 0) },
    ];

    // Registrations by status
    const regStatusRows = await db.select({
      status: registrations.status,
      c:      sql<number>`count(*)`,
    })
      .from(registrations)
      .groupBy(registrations.status)
      .catch(() => []);

    const registrationsByStatus = regStatusRows.map(r => ({
      status: r.status,
      count:  Number(r.c ?? 0),
    }));

    // Registrations by programMode
    const regModeRows = await db.select({
      mode: registrations.programMode,
      c:    sql<number>`count(*)`,
    })
      .from(registrations)
      .groupBy(registrations.programMode)
      .catch(() => []);

    const registrationsByMode = regModeRows
      .filter(r => r.mode)
      .map(r => ({ mode: r.mode as string, count: Number(r.c ?? 0) }));

    // Upgrade interest
    const upgradeRows = await db.select({
      option: vocabUpgradeRequests.selectedOption,
      c:      sql<number>`count(*)`,
    })
      .from(vocabUpgradeRequests)
      .groupBy(vocabUpgradeRequests.selectedOption)
      .catch(() => []);

    const upgradeInterest = upgradeRows.map(r => ({
      option: r.option,
      count:  Number(r.c ?? 0),
    }));

    // Access requests by status
    const accessRows = await db.select({
      status: vocabAccessRequests.status,
      c:      sql<number>`count(*)`,
    })
      .from(vocabAccessRequests)
      .groupBy(vocabAccessRequests.status)
      .catch(() => []);

    const accessRequests = accessRows.map(r => ({
      status: r.status,
      count:  Number(r.c ?? 0),
    }));

    // Signups over time (users.createdAt by day)
    const signupRows = await db.select({
      createdAt: users.createdAt,
    })
      .from(users)
      .where(cutoff ? gte(users.createdAt, cutoff) : undefined)
      .catch(() => []);

    const signupMap = new Map<string, number>();
    for (const r of signupRows) {
      if (!r.createdAt) continue;
      const day = toIsoDate(r.createdAt);
      signupMap.set(day, (signupMap.get(day) ?? 0) + 1);
    }

    const signupsOverTime = Array.from(signupMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }));

    return {
      acquisition,
      registrationsByStatus,
      registrationsByMode,
      upgradeInterest,
      accessRequests,
      signupsOverTime,
    };
  } catch {
    return {
      acquisition: [],
      registrationsByStatus: [],
      registrationsByMode: [],
      upgradeInterest: [],
      accessRequests: [],
      signupsOverTime: [],
    };
  }
}
