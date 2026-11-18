import 'server-only';

import { and, asc, countDistinct, eq, inArray, isNotNull, isNull, ne, or, sql } from 'drizzle-orm';
import { db, testAnswers, testAttempts, testQuestionGroups, testQuestions, testSections, tests, users } from '@/lib/db';
import { buildStudentReport, isReportMock, type ReportStudent } from './student-report';

export interface ReportStudentOption extends ReportStudent {
  mocksSat: number;
}

async function getReportMocks() {
  const mocks = await db.select({
    id: tests.id, title: tests.title, examCode: tests.examCode, isMock: tests.isMock,
  }).from(tests).where(eq(tests.isMock, true)).orderBy(asc(tests.id));
  if (!mocks.length) return [];

  const sections = await db.select().from(testSections)
    .where(inArray(testSections.testId, mocks.map(mock => mock.id))).orderBy(asc(testSections.order));
  return mocks.map(mock => ({
    ...mock, sections: sections.filter(section => section.testId === mock.id),
  })).filter(isReportMock);
}

function eligibleAttempts(mockIds: number[]) {
  return and(
    inArray(testAttempts.testId, mockIds),
    isNotNull(testAttempts.submittedAt),
    or(isNull(testAttempts.omrStatus), ne(testAttempts.omrStatus, 'rejected')),
  );
}

const studentFields = { id: users.id, name: users.name, studentId: users.studentId };

export async function listReportStudents(): Promise<ReportStudentOption[]> {
  const mocks = await getReportMocks();
  if (!mocks.length) return [];

  return db.select({ ...studentFields, mocksSat: countDistinct(testAttempts.testId) })
    .from(testAttempts).innerJoin(users, eq(testAttempts.userId, users.id))
    .where(eligibleAttempts(mocks.map(mock => mock.id)))
    .groupBy(users.id, users.name, users.studentId)
    .orderBy(asc(sql`lower(${users.name})`), asc(users.name), asc(users.id));
}

export async function getStudentReport(userId: number) {
  const [mocks, [student]] = await Promise.all([
    getReportMocks(), db.select(studentFields).from(users).where(eq(users.id, userId)),
  ]);
  if (!student || !mocks.length) return null;

  const sat = await db.selectDistinct({ testId: testAttempts.testId }).from(testAttempts)
    .where(and(eligibleAttempts(mocks.map(mock => mock.id)), eq(testAttempts.userId, userId)));
  if (!sat.length) return null;

  const mockIds = sat.map(attempt => attempt.testId);
  const satMocks = mocks.filter(mock => mockIds.includes(mock.id));
  const sectionIds = satMocks.flatMap(mock => mock.sections.map(section => section.id));
  const [questions, groups, attempts, answers] = await Promise.all([
    sectionIds.length ? db.select({
      id: testQuestions.id, sectionId: testQuestions.sectionId, number: testQuestions.number,
      order: testQuestions.order, correctKey: testQuestions.correctKey, tag: testQuestions.tag, groupId: testQuestions.groupId,
    }).from(testQuestions).where(inArray(testQuestions.sectionId, sectionIds)) : [],
    sectionIds.length ? db.select({
      id: testQuestionGroups.id, sectionId: testQuestionGroups.sectionId, kind: testQuestionGroups.kind, title: testQuestionGroups.title,
    }).from(testQuestionGroups).where(inArray(testQuestionGroups.sectionId, sectionIds)).orderBy(asc(testQuestionGroups.order)) : [],
    db.select({
      id: testAttempts.id, testId: testAttempts.testId, userId: testAttempts.userId,
      submittedAt: testAttempts.submittedAt, resultSource: testAttempts.resultSource, omrStatus: testAttempts.omrStatus,
    }).from(testAttempts).where(eligibleAttempts(mockIds)),
    db.select({
      attemptId: testAnswers.attemptId, questionId: testAnswers.questionId, selectedKey: testAnswers.selectedKey,
    }).from(testAnswers).innerJoin(testAttempts, eq(testAnswers.attemptId, testAttempts.id)).where(eligibleAttempts(mockIds)),
  ]);

  const answersByAttempt = new Map<number, typeof answers>();
  for (const answer of answers) {
    const entries = answersByAttempt.get(answer.attemptId);
    if (entries) entries.push(answer);
    else answersByAttempt.set(answer.attemptId, [answer]);
  }

  const report = buildStudentReport({
    student,
    mocks: satMocks.map(mock => ({
      ...mock,
      sections: mock.sections.map(section => ({
        ...section,
        questions: questions.filter(question => question.sectionId === section.id),
        groups: groups.filter(group => group.sectionId === section.id),
      })),
      attempts: attempts.filter(attempt => attempt.testId === mock.id).map(attempt => ({
        ...attempt, submittedAt: attempt.submittedAt?.getTime() ?? null, answers: answersByAttempt.get(attempt.id) ?? [],
      })),
    })),
  });
  return report.mocks.length ? report : null;
}
