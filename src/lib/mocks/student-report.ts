import { sectionKind, type SectionKind } from './question-tags';

export interface ReportStudent {
  id: number;
  name: string;
  studentId: string | null;
}

export interface ReportQuestionInput {
  id: number;
  order: number;
  number: number;
  correctKey: string | null;
  tag: string | null;
  groupId: number | null;
}

export interface ReportSectionInput {
  title: string;
  order: number;
  totalMarks: number;
  marksPerCorrect: number;
  penaltyPerWrong: number;
  thresholdPercent: number | null;
  questions: ReportQuestionInput[];
  groups: { id: number; kind: string; title: string | null }[];
}

export interface ReportAttemptInput {
  id: number;
  userId: number;
  submittedAt: number | null;
  resultSource: string;
  omrStatus: string | null;
  answers: { questionId: number; selectedKey: string | null }[];
}

export interface ReportMockInput {
  id: number;
  title: string;
  examCode: string | null;
  isMock: boolean;
  sections: ReportSectionInput[];
  attempts: ReportAttemptInput[];
}

export interface StudentReportInput {
  student: ReportStudent;
  mocks: ReportMockInput[];
}

export const DIAGNOSIS_LABELS = {
  under_marking: 'Marking too little',
  over_marking: 'Marking too much',
  missing_basics: 'Missing basics',
  silly_mistakes: 'Silly mistakes',
  comprehension: 'Not understanding the passage',
  misconception: 'Falling for traps',
  running_out_of_time: 'Running out of time',
} as const;

type DiagnosisLabel = keyof typeof DIAGNOSIS_LABELS;
type Difficulty = 'easy' | 'medium' | 'hard';
const difficulties: Difficulty[] = ['easy', 'medium', 'hard'];

interface Diagnosis {
  label: DiagnosisLabel;
  marksAtStake: number;
  explanation: string;
}

interface PooledDiagnosis {
  label: DiagnosisLabel;
  marksAtStake: number;
  mocksFired: number;
  recurring: boolean;
}

interface Stats {
  questions: number;
  attempted: number;
  correct: number;
  wrong: number;
  blank: number;
  accuracy: number | null;
  attemptRate: number;
  net: number;
}

interface Trend {
  nets: number[];
  mean: number | null;
  standardDeviation: number | null;
  slope: number | null;
}

interface MockResult {
  id: number;
  title: string;
  examCode: string | null;
  mode: 'online' | 'offline';
  net: number;
  rank: number;
  percentile: number;
  cohortSize: number;
  easyMissMarks: number;
  whatIfNet: number;
  whatIfRank: number;
}

interface SectionResult {
  mockId: number;
  title: string;
  stats: Stats;
  topFive: Stats;
  gap: { volumeMarks: number; precisionMarks: number; formulaTopNet: number; netGap: number };
  passMark: number | null;
  belowPassMark: boolean;
  bands: { band: Difficulty; stats: Stats; topFive: Stats }[];
  thirds: { third: number; stats: Stats }[];
  diagnoses: Diagnosis[];
  passages: { title: string | null; correct: number; total: number }[];
  easyMissMarks: number;
  hardGuessPenalty: number;
  hardGuessNet: number;
  easyMissed: { number: number; p: number }[];
  trapWrong: { number: number; option: string }[];
}

interface TagResult {
  tag: string;
  seen: number;
  attempted: number;
  correct: number;
  wrong: number;
  accuracy: number | null;
  coverage: number;
  cohortCoverage: number;
  topFiveCoverage: number;
  marksLost: number;
}

interface PooledSection {
  kind: SectionKind;
  mocks: SectionResult[];
  trend: Trend;
  diagnoses: PooledDiagnosis[];
  mainProblem: PooledDiagnosis | null;
  tags: TagResult[];
  weakestTags: string[];
  strongestTags: string[];
}

export interface StudentReport {
  student: ReportStudent;
  mocks: MockResult[];
  totalTrend: Trend;
  sections: PooledSection[];
  actionPlan: string[];
}

export function isReportMock(mock: { isMock: boolean; sections: readonly { title: string }[] }): boolean {
  return mock.isMock && mock.sections.every(section => sectionKind(section.title) !== null);
}

type KeyedQuestion = ReportQuestionInput & { correctKey: string };
type Answers = Map<number, string | null>;

function score(questions: KeyedQuestion[], answers: Answers, m: number, p: number): Stats {
  let correct = 0;
  let wrong = 0;
  for (const question of questions) {
    const selected = answers.get(question.id);
    if (selected === question.correctKey) correct++;
    else if (selected != null) wrong++;
  }
  const attempted = correct + wrong;
  return {
    questions: questions.length, attempted, correct, wrong, blank: questions.length - attempted,
    accuracy: attempted ? correct / attempted : null,
    attemptRate: questions.length ? attempted / questions.length : 0,
    net: correct * m - wrong * p,
  };
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const mean = (values: number[]) => sum(values) / values.length;
const pct = (value: number) => `${Math.round(value * 100)}%`;
const marks = (value: number) => Number(value.toFixed(2)).toString();
const listTags = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' });

function averageStats(stats: Stats[]): Stats {
  const accuracies = stats.flatMap(s => s.accuracy === null ? [] : [s.accuracy]);
  return {
    questions: mean(stats.map(s => s.questions)),
    attempted: mean(stats.map(s => s.attempted)),
    correct: mean(stats.map(s => s.correct)),
    wrong: mean(stats.map(s => s.wrong)),
    blank: mean(stats.map(s => s.blank)),
    accuracy: accuracies.length ? mean(accuracies) : null,
    attemptRate: mean(stats.map(s => s.attemptRate)),
    net: mean(stats.map(s => s.net)),
  };
}

function trend(nets: number[], indices = nets.map((_, i) => i)): Trend {
  if (!nets.length) return { nets, mean: null, standardDeviation: null, slope: null };
  const average = mean(nets);
  const center = mean(indices);
  const spread = sum(indices.map(i => (i - center) ** 2));
  return {
    nets,
    mean: average,
    standardDeviation: Math.sqrt(mean(nets.map(net => (net - average) ** 2))),
    slope: spread ? sum(nets.map((net, i) => (indices[i] - center) * (net - average))) / spread : 0,
  };
}

function cohortFor(attempts: ReportAttemptInput[]): ReportAttemptInput[] {
  const latest = new Map<number, ReportAttemptInput>();
  for (const attempt of attempts) {
    if (attempt.submittedAt === null || attempt.omrStatus === 'rejected') continue;
    const previous = latest.get(attempt.userId);
    const previousTime = previous?.submittedAt ?? -Infinity;
    if (!previous || attempt.submittedAt > previousTime || (attempt.submittedAt === previousTime && attempt.id > previous.id)) {
      latest.set(attempt.userId, attempt);
    }
  }
  return [...latest.values()];
}

function questionResults(question: KeyedQuestion, answers: Answers[], mine: Answers, top: Answers[]) {
  let correct = 0;
  const wrongOptions = new Map<string, number>();
  for (const entry of answers) {
    const selected = entry.get(question.id);
    if (selected === question.correctKey) correct++;
    else if (selected != null) wrongOptions.set(selected, (wrongOptions.get(selected) ?? 0) + 1);
  }
  const [trap] = [...wrongOptions].sort(([a, countA], [b, countB]) => countB - countA || a.localeCompare(b));
  const selected = mine.get(question.id);
  const p = correct / answers.length;
  const band: Difficulty = p >= 0.70 ? 'easy' : p >= 0.40 ? 'medium' : 'hard';
  return {
    question, p, band, selected,
    topCoverage: top.filter(entry => entry.get(question.id) === question.correctKey).length / top.length,
    trap: trap && trap[1] / answers.length >= 0.25 && selected === trap[0] ? trap[0] : null,
  };
}

interface DiagnosisContext {
  stats: Stats;
  topFive: Stats;
  easy: Stats;
  medium: Stats;
  upperBands: Stats;
  lastThird: Stats;
  trapCount: number;
  volumeMarks: number;
  rc: Stats | null;
  nonRc: Stats | null;
  m: number;
  p: number;
}

function diagnose({ stats, topFive, easy, medium, upperBands, lastThird, trapCount, volumeMarks, rc, nonRc, m, p }: DiagnosisContext): Diagnosis[] {
  const diagnoses: Diagnosis[] = [];
  const accuracy = stats.accuracy ?? 0;
  const attemptGap = topFive.attemptRate - stats.attemptRate;
  const upperAccuracy = upperBands.accuracy;
  const add = (label: DiagnosisLabel, marksAtStake: number, explanation: string) => {
    diagnoses.push({ label, marksAtStake: Math.max(0, marksAtStake), explanation });
  };
  if (attemptGap - 0.15 > Number.EPSILON && accuracy >= 0.75) {
    add('under_marking', volumeMarks, `You tried ${pct(stats.attemptRate)} of the questions versus ${pct(topFive.attemptRate)} for the top five, with ${pct(accuracy)} accuracy.`);
  }
  if (stats.accuracy !== null && accuracy < 0.60 && attemptGap - 0.05 <= Number.EPSILON) {
    add('over_marking', stats.wrong * p, `You tried ${pct(stats.attemptRate)} versus ${pct(topFive.attemptRate)} for the top five, but ${pct(accuracy)} accuracy cost you ${marks(stats.wrong * p)} marks in penalties.`);
  }
  if (easy.questions >= 3 && easy.correct / easy.questions < 0.70 && medium.questions && medium.correct / medium.questions < 0.40) {
    add('missing_basics', (easy.questions - easy.correct) * m, `You got ${easy.correct} of ${easy.questions} easy questions and ${medium.correct} of ${medium.questions} medium questions right.`);
  }
  if (easy.wrong >= 2 && upperAccuracy !== null && upperAccuracy >= 0.60) {
    add('silly_mistakes', easy.wrong * (m + p), `You got ${easy.wrong} easy questions wrong despite ${pct(upperAccuracy)} accuracy on the medium and hard questions you tried.`);
  }
  if (rc && rc.attempted >= 4 && rc.accuracy !== null && nonRc?.accuracy != null
    && nonRc.accuracy - rc.accuracy >= 0.20 - Number.EPSILON) {
    add('comprehension', rc.attempted * (nonRc.accuracy - rc.accuracy) * (m + p),
      `You tried ${rc.attempted} reading questions and got ${pct(rc.accuracy)} right versus ${pct(nonRc.accuracy)} on the other English questions you tried.`);
  }
  if (stats.wrong >= 3 && trapCount / stats.wrong >= 0.50) {
    add('misconception', trapCount * (m + p), `${trapCount} of your ${stats.wrong} wrong answers matched a common wrong option picked by at least 25% of the cohort.`);
  }
  if (stats.blank >= 3 && lastThird.blank / stats.blank >= 0.60) {
    add('running_out_of_time', lastThird.blank * Math.max(0, accuracy * (m + p) - p),
      `You left ${lastThird.blank} of your ${stats.blank} blanks in the final third (${pct(lastThird.blank / stats.blank)}).`);
  }
  return diagnoses;
}

function analyzeSection(
  mockId: number, section: ReportSectionInput, kind: SectionKind, questions: KeyedQuestion[],
  mine: Answers, cohort: Answers[], leaders: Answers[],
): { result: SectionResult; tags: TagResult[] } {
  const { marksPerCorrect: m, penaltyPerWrong: p } = section;
  const scoreMine = (subset: KeyedQuestion[]) => score(subset, mine, m, p);
  const scoreLeaders = (subset: KeyedQuestion[]) => averageStats(leaders.map(answers => score(subset, answers, m, p)));
  const stats = scoreMine(questions);
  const topFive = scoreLeaders(questions);
  const a = stats.accuracy ?? 0;
  const topAccuracy = topFive.accuracy ?? 0;
  const volumeMarks = (topFive.attempted - stats.attempted) * (a * (m + p) - p);
  const precisionMarks = topFive.attempted * (topAccuracy - a) * (m + p);
  const formulaTopNet = topFive.attempted * (topAccuracy * (m + p) - p);
  // Keep the decomposition exact even when equivalent floating-point expressions round differently.
  const gap = { formulaTopNet, volumeMarks, precisionMarks, netGap: volumeMarks + precisionMarks };
  const passMark = section.thresholdPercent === null ? null : section.thresholdPercent / 100 * section.totalMarks;

  const details = questions.map(question => questionResults(question, cohort, mine, leaders));
  const bands = difficulties.map(band => {
    const subset = details.filter(item => item.band === band).map(item => item.question);
    return { band, stats: scoreMine(subset), topFive: scoreLeaders(subset) };
  });
  const [easy, medium, hard] = bands.map(band => band.stats);
  const thirds = [0, 1, 2].map(i => ({
    third: i + 1, stats: scoreMine(questions.filter((_, index) => Math.floor(index * 3 / questions.length) === i)),
  }));
  const trapWrong = details.flatMap(item => item.trap === null ? [] : [{ number: item.question.number, option: item.trap }]);
  const isRc = (question: KeyedQuestion) => question.tag === 'Reading Comprehension';
  const diagnoses = diagnose({
    stats, topFive, easy, medium, upperBands: scoreMine(details.filter(item => item.band !== 'easy').map(item => item.question)),
    lastThird: thirds[2].stats, trapCount: trapWrong.length, volumeMarks,
    rc: kind === 'english' ? scoreMine(questions.filter(isRc)) : null,
    nonRc: kind === 'english' ? scoreMine(questions.filter(q => !isRc(q))) : null, m, p,
  });
  const passages = kind === 'english' ? section.groups.filter(group => group.kind === 'passage').map(group => {
    const passage = scoreMine(questions.filter(question => question.groupId === group.id));
    return { title: group.title, correct: passage.correct, total: passage.questions };
  }) : [];

  const tags = details.map(({ question, p: cohortCoverage, topCoverage, selected }): TagResult => {
    const correct = Number(selected === question.correctKey);
    const wrong = Number(selected != null && !correct);
    const attempted = correct + wrong;
    return {
      tag: question.tag ?? 'Untagged', seen: 1, attempted, correct, wrong, accuracy: attempted ? correct : null,
      coverage: correct, cohortCoverage, topFiveCoverage: topCoverage, marksLost: m - (correct * m - wrong * p),
    };
  });
  return {
    tags,
    result: {
      mockId, title: section.title, stats, topFive, gap, passMark, belowPassMark: passMark !== null && stats.net < passMark,
      bands, thirds, diagnoses, passages,
      easyMissMarks: easy.blank * m + easy.wrong * (m + p), hardGuessPenalty: hard.wrong * p, hardGuessNet: hard.net,
      easyMissed: details.flatMap(item => item.band === 'easy' && item.selected !== item.question.correctKey
        ? [{ number: item.question.number, p: item.p }] : []),
      trapWrong,
    },
  };
}

function poolTags(rows: TagResult[]): TagResult[] {
  const pooled = new Map<string, TagResult>();
  for (const row of rows) {
    const current = pooled.get(row.tag);
    if (!current) {
      pooled.set(row.tag, { ...row });
      continue;
    }
    current.seen += row.seen;
    current.attempted += row.attempted;
    current.correct += row.correct;
    current.wrong += row.wrong;
    current.cohortCoverage += row.cohortCoverage;
    current.topFiveCoverage += row.topFiveCoverage;
    current.marksLost += row.marksLost;
  }
  return [...pooled.values()].map(tag => ({
    ...tag, accuracy: tag.attempted ? tag.correct / tag.attempted : null, coverage: tag.correct / tag.seen,
    cohortCoverage: tag.cohortCoverage / tag.seen, topFiveCoverage: tag.topFiveCoverage / tag.seen,
  })).sort((a, b) => a.tag.localeCompare(b.tag));
}

function poolSection(
  kind: SectionKind, entries: ReturnType<typeof analyzeSection>[], mocks: MockResult[],
): PooledSection {
  const results = entries.map(entry => entry.result);
  const diagnoses = (Object.keys(DIAGNOSIS_LABELS) as DiagnosisLabel[]).flatMap(label => {
    const fired = results.filter(result => result.diagnoses.some(d => d.label === label));
    const mocksFired = new Set(fired.map(result => result.mockId)).size;
    if (!mocksFired) return [];
    const marksAtStake = sum(fired.flatMap(result => result.diagnoses.filter(d => d.label === label).map(d => d.marksAtStake)));
    return [{ label, marksAtStake, mocksFired, recurring: mocksFired >= 2 && mocksFired * 2 >= mocks.length }];
  }).sort((a, b) => b.marksAtStake - a.marksAtStake);

  const tags = poolTags(entries.flatMap(entry => entry.tags));
  const eligible = tags.filter(tag => tag.seen >= 3);
  const difference = (tag: TagResult) => tag.coverage - tag.cohortCoverage;
  const tagRanks = (direction: number) => [...eligible].sort((a, b) =>
    direction * (difference(a) - difference(b)) || a.tag.localeCompare(b.tag)).slice(0, 3).map(tag => tag.tag);

  const nets: number[] = [];
  const indices: number[] = [];
  mocks.forEach((mock, index) => {
    const sections = results.filter(result => result.mockId === mock.id);
    if (sections.length) {
      nets.push(sum(sections.map(result => result.stats.net)));
      indices.push(index);
    }
  });
  return {
    kind, mocks: results, trend: trend(nets, indices), diagnoses, mainProblem: diagnoses[0] ?? null,
    tags, weakestTags: tagRanks(1), strongestTags: tagRanks(-1),
  };
}

function makeActionPlan(sections: PooledSection[], mocks: MockResult[]): string[] {
  const sentences: string[] = [];
  const latest = mocks[mocks.length - 1];
  let best: { title: string; meanGap: number } | null = null;
  for (const section of sections) {
    const title = section.mocks[0].title;
    for (const entry of section.mocks.filter(mock => mock.mockId === latest?.id)) {
      if (entry.diagnoses.some(d => d.label === 'under_marking')) {
        sentences.push(`In ${entry.title}, aim to answer ${Math.round(entry.topFive.attempted)} questions. At your current accuracy, the extra attempts are worth about ${marks(entry.gap.volumeMarks)} marks.`);
      }
    }
    if (section.weakestTags.length) {
      sentences.push(`In ${title}, drill ${listTags.format(section.weakestTags)} first.`);
    }
    const mockCount = new Set(section.mocks.map(mock => mock.mockId)).size;
    const meanGap = sum(section.mocks.map(mock => mock.topFive.net - mock.stats.net)) / mockCount;
    if (!best || meanGap > best.meanGap) best = { title, meanGap };
  }
  if (best) sentences.push(`Prioritize ${best.title}. Its average gap to the top five is ${marks(best.meanGap)} marks, the largest of your sections.`);
  return sentences;
}

export function buildStudentReport({ student, mocks }: StudentReportInput): StudentReport {
  const results: MockResult[] = [];
  const sections = new Map<SectionKind, ReturnType<typeof analyzeSection>[]>();
  for (const mock of mocks.filter(isReportMock).sort((a, b) => a.id - b.id)) {
    const attempts = cohortFor(mock.attempts);
    const studentAttempt = attempts.find(attempt => attempt.userId === student.id);
    if (!studentAttempt) continue;

    const papers = [...mock.sections].sort((a, b) => a.order - b.order).map(section => ({
      section, kind: sectionKind(section.title)!,
      questions: section.questions.filter((q): q is KeyedQuestion => q.correctKey !== null)
        .sort((a, b) => a.order - b.order || a.id - b.id),
    }));
    const ranked = attempts.map(attempt => {
      const answers = new Map(attempt.answers.map(answer => [answer.questionId, answer.selectedKey]));
      const total = sum(papers.map(({ section, questions }) =>
        score(questions, answers, section.marksPerCorrect, section.penaltyPerWrong).net));
      return { attempt, answers, total };
    }).sort((a, b) => b.total - a.total || a.attempt.userId - b.attempt.userId);
    const mine = ranked.find(item => item.attempt === studentAttempt)!;
    const others = ranked.filter(item => item !== mine);
    const rankAt = (total: number) => 1 + others.filter(item => item.total > total).length;
    const rank = rankAt(mine.total);
    const cohort = ranked.map(item => item.answers);
    const leaders = cohort.slice(0, 5);
    let easyMissMarks = 0;
    for (const { section, kind, questions } of papers) {
      const entry = analyzeSection(mock.id, section, kind, questions, mine.answers, cohort, leaders);
      easyMissMarks += entry.result.easyMissMarks;
      const group = sections.get(kind);
      if (group) group.push(entry);
      else sections.set(kind, [entry]);
    }
    const whatIfNet = mine.total + easyMissMarks;
    results.push({
      id: mock.id, title: mock.title, examCode: mock.examCode,
      mode: studentAttempt.resultSource === 'omr' ? 'offline' : 'online',
      net: mine.total, rank, cohortSize: ranked.length,
      percentile: ranked.length === 1 ? 100 : 100 * (ranked.length - rank) / (ranked.length - 1),
      easyMissMarks, whatIfNet, whatIfRank: rankAt(whatIfNet),
    });
  }
  const pooled = [...sections].map(([kind, entries]) => poolSection(kind, entries, results));
  return {
    student, mocks: results, totalTrend: trend(results.map(mock => mock.net)),
    sections: pooled, actionPlan: makeActionPlan(pooled, results),
  };
}
