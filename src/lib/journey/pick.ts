/**
 * "Exorcise the Past" picker. Pure (no DB): fed the questions a student missed in the last mocks.
 * Priority per section: (1) missed questions most of the class got right, easiest first;
 * (2) missed questions the mock's top 5 mostly got right; (3) the rest that a fair share of the class got.
 * A short pool just gives a shorter section.
 */

export const JOURNEY_MS = 60 * 60 * 1000;
export const TARGETS = { english: 20, math: 30, analytical: 10 } as const;
export type JourneySection = keyof typeof TARGETS;
const SECTIONS = Object.keys(TARGETS) as JourneySection[];
const CLASS_MAJORITY_PCT = 50;
const FLOOR_PCT = 30; // below this, only the top-5 rule keeps a question (same floor as lib/mocks/missed-chances)

export interface Candidate {
  id: number;
  section: JourneySection;
  mock: number;      // test id, orders the final list
  order: number;     // position inside the mock's section
  pct: number;       // % of the mock's cohort that got it right
  topRight: boolean; // most of that mock's top 5 got it right
}

export function sectionOf(title: string): JourneySection | null {
  if (/language|english/i.test(title)) return 'english';
  if (/math/i.test(title)) return 'math';
  if (/analytic/i.test(title)) return 'analytical';
  return null;
}

const tier = (c: Candidate) => (c.pct >= CLASS_MAJORITY_PCT ? 0 : c.topRight ? 1 : 2);

/** `missed` = only questions the student got wrong or skipped. Returns ids in display order. */
export function pickJourney(missed: Candidate[]): number[] {
  return SECTIONS.flatMap(section =>
    missed
      .filter(c => c.section === section && (c.pct >= FLOOR_PCT || c.topRight))
      .sort((a, b) => tier(a) - tier(b) || b.pct - a.pct || a.id - b.id)
      .slice(0, TARGETS[section])
      .sort((a, b) => a.mock - b.mock || a.order - b.order)
      .map(c => c.id),
  );
}
