export const MOCK_PRICES = {
  'du-iba':  3000,
  'bup-iba': 2200,
  'du-fbs':  2500,
  'bup-fbs': 2000,
} as const;
export type MockProgram = keyof typeof MOCK_PRICES;
export const MOCK_PROGRAMS = Object.keys(MOCK_PRICES) as MockProgram[];

export const FULL_COURSES = ['iba-combined', 'du-fbs-full', 'bup-fbs-full'] as const;
export type FullCourse = typeof FULL_COURSES[number];

export function isMockProgram(v: unknown): v is MockProgram {
  return typeof v === 'string' && v in MOCK_PRICES;
}

export function isFullCourse(v: unknown): v is FullCourse {
  return typeof v === 'string' && (FULL_COURSES as readonly string[]).includes(v);
}

export interface PricingResult {
  subtotal:   number;
  discount:   number;
  finalPrice: number;
}

export function calculateMocksPricing(mocks: readonly MockProgram[]): PricingResult {
  const subtotal = mocks.reduce((s, p) => s + MOCK_PRICES[p], 0);
  const rate     = mocks.length >= 4 ? 0.25 : mocks.length === 3 ? 0.15 : mocks.length === 2 ? 0.05 : 0;
  const discount = Math.round(subtotal * rate);
  return { subtotal, discount, finalPrice: subtotal - discount };
}
