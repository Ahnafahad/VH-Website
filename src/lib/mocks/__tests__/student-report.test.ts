import { describe, expect, it } from 'vitest';
import { buildStudentReport, type ReportMockInput } from '../student-report';

const english = ['AABB ABB BBBB', 'AAAA AAA AAAA', 'AAAA AAA AAAA', 'AAAA AAA BBBB', 'AAAA AAB BBBB', 'AAAA ABB BBAA'];
const math = ['AAA A-- ---', 'AAA AAA AAA', 'AAA AAA AAA', 'AAA AAB BBB', 'AAA AAB BBB', 'AAA BBB BBB'];

function mock(id: number): ReportMockInput {
  const sections = [
    { title: 'Language', patterns: english, tags: ['Reading Comprehension', 'Vocabulary', null] },
    { title: 'Mathematics', patterns: math, tags: ['Percentage', 'Average', null] },
  ].map(({ title, patterns, tags }, order) => ({
    title, order, totalMarks: patterns[0].replaceAll(' ', '').length, marksPerCorrect: 1,
    penaltyPerWrong: 0.25, thresholdPercent: 50,
    groups: order === 0 ? [{ id: 1, kind: 'passage', title: 'The passage' }] : [],
    questions: [...patterns[0].replaceAll(' ', ''), '?'].map((key, i) => ({
      id: order * 100 + i, order: i, number: i + 1, correctKey: key === '?' ? null : 'A',
      groupId: order === 0 && i < 4 ? 1 : null,
      tag: tags[i < (order === 0 ? 4 : 3) ? 0 : i < (order === 0 ? 7 : 6) ? 1 : 2],
    })),
  }));
  const attempts = english.map((_, i) => ({
    id: i + 1, userId: i + 1, submittedAt: 10, omrStatus: null, resultSource: id === 1 ? 'omr' : 'self',
    answers: [english[i], math[i]].flatMap((pattern, section) =>
      [...pattern.replaceAll(' ', '')].flatMap((key, index) =>
        key === '-' ? [] : [{ questionId: section * 100 + index, selectedKey: key }],
      ),
    ).concat({ questionId: 11, selectedKey: 'B' }),
  }));
  return {
    id, title: `Mock ${id}`, examCode: null, isMock: true, sections,
    attempts: [...attempts, { ...attempts[0], id: 10, submittedAt: 9, answers: [] },
      { ...attempts[0], id: 11, submittedAt: 11, omrStatus: 'rejected', answers: [] },
      { ...attempts[0], id: 12, userId: 7, submittedAt: null, answers: [] }],
  };
}

const student = { id: 1, name: 'Student One', studentId: 'VH-1' };
const first = mock(1);
const second = mock(2);
const report = () => buildStudentReport({
  student,
  mocks: [second, { ...first, id: 3, sections: [...first.sections, { ...first.sections[0], title: 'Accounting' }] }, first],
});

describe('buildStudentReport', () => {
  it('scores only keyed questions on the latest eligible attempt and shares tied ranks', () => {
    const result = report();
    expect(result.mocks.map(({ id, mode, net, rank, percentile, cohortSize }) =>
      [id, mode, net, rank, percentile, cohortSize])).toEqual([
      [1, 'offline', 5, 6, 0, 6], [2, 'online', 5, 6, 0, 6],
    ]);
    expect(result.totalTrend).toMatchObject({ nets: [5, 5], mean: 5, standardDeviation: 0, slope: 0 });
    expect(result.sections.find(s => s.kind === 'math')?.mocks[0]).toMatchObject({
      stats: { questions: 9, attempted: 4, correct: 4, wrong: 0, blank: 5, net: 4 },
      passMark: 4.5, belowPassMark: true,
    });
    const tied = buildStudentReport({ student: { ...student, id: 3 }, mocks: [first] });
    expect(tied.mocks[0]).toMatchObject({ rank: 1, percentile: 100 });
  });

  it('uses the same five overall leaders and reconciles the gap against the formula baseline', () => {
    const mathReport = report().sections.find(s => s.kind === 'math')!.mocks[0];
    expect(mathReport.topFive).toMatchObject({ attempted: 9, correct: 6.2, wrong: 2.8, blank: 0, net: 5.5 });
    expect(mathReport.topFive.accuracy).toBeCloseTo(6.2 / 9);
    const { volumeMarks, precisionMarks, netGap, formulaTopNet } = mathReport.gap;
    expect(volumeMarks + precisionMarks).toBe(netGap);
    expect(netGap).toBeCloseTo(formulaTopNet - mathReport.stats.net, 12);
  });

  it('keeps the actual net average when leaders have different attempt counts', () => {
    const varied = {
      ...first,
      attempts: first.attempts.map(attempt => attempt.userId === 6 ? {
        ...attempt,
        answers: attempt.answers.map(answer => answer.questionId >= 103 ? { ...answer, selectedKey: null } : answer),
      } : attempt),
    };
    const mathReport = buildStudentReport({ student, mocks: [varied] }).sections[1].mocks[0];
    expect(mathReport.topFive).toMatchObject({ attempted: 7.8, net: 5.8 });
    expect(mathReport.topFive.accuracy).toBeCloseTo(37 / 45);
    expect(mathReport.gap.formulaTopNet).toBeCloseTo(6.0666666667);
    expect(mathReport.gap.netGap).toBe(mathReport.gap.volumeMarks + mathReport.gap.precisionMarks);
    expect(mathReport.gap.netGap).toBeCloseTo(mathReport.gap.formulaTopNet - mathReport.stats.net, 12);
  });

  it('computes band scores, diagnoses, passages, and trap review', () => {
    const [language, mathematics] = report().sections;
    expect(language.mocks[0].bands.map(b => [b.band, b.stats.questions, b.stats.correct])).toEqual([
      ['easy', 5, 3], ['medium', 4, 0], ['hard', 2, 0],
    ]);
    expect(language.mocks[0].diagnoses.map(d => d.label)).toEqual(expect.arrayContaining([
      'over_marking', 'misconception', 'missing_basics',
    ]));
    expect(mathematics.mocks[0].diagnoses.map(d => d.label)).toEqual(expect.arrayContaining([
      'under_marking', 'running_out_of_time',
    ]));
    expect(mathematics.mainProblem).toMatchObject({ label: 'under_marking', recurring: true, marksAtStake: 10 });
    expect(mathematics.mocks[0].thirds.map(t => t.stats.blank)).toEqual([0, 2, 3]);
    expect(language.mocks[0].passages).toEqual([{ title: 'The passage', correct: 2, total: 4 }]);
    expect(language.mocks[0].trapWrong).toContainEqual({ number: 8, option: 'B' });
  });

  it('pools tags, marks left, and recomputes rank against the other students', () => {
    const result = report();
    const language = result.sections[0];
    expect(language.tags.find(t => t.tag === 'Reading Comprehension')).toMatchObject({
      seen: 8, attempted: 8, correct: 4, wrong: 4, accuracy: 0.5, coverage: 0.5, marksLost: 5,
    });
    expect(language.tags.find(t => t.tag === 'Untagged')?.cohortCoverage).toBeCloseTo(10 / 24);
    expect(language.weakestTags).toContain('Vocabulary');
    expect(result.sections[1].mocks[0].easyMissMarks).toBe(0);
    expect(result.mocks[0]).toMatchObject({ easyMissMarks: 2.5, whatIfNet: 7.5, whatIfRank: 5 });
    expect(result.actionPlan.join(' ')).toContain('9 questions');
  });
});
