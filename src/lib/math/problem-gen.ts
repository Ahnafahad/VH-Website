import type { MathOperation } from '@/lib/db/schema';
import { OP_SYMBOL, bucketDifficulty, type Tier } from './constants';

export interface Question {
  num1:       number;
  num2:       number;
  answer:     number;
  symbol:     string;
  operation:  MathOperation;
  difficulty: number;
}

type Rng = () => number;
const defaultRng: Rng = Math.random;

function randInt(min: number, max: number, rng: Rng): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function genByTier(op: MathOperation, tier: Tier, rng: Rng): Omit<Question, 'difficulty'> {
  switch (op) {
    case 'addition': {
      let n1: number, n2: number;
      if      (tier === 'easy')    { n1 = randInt(1, 9, rng);    n2 = randInt(1, 9, rng); }
      else if (tier === 'medium')  { n1 = randInt(10, 99, rng);  n2 = randInt(1, 9, rng); }
      else if (tier === 'hard')    { n1 = randInt(10, 99, rng);  n2 = randInt(10, 99, rng); }
      else                         { n1 = randInt(50, 199, rng); n2 = randInt(50, 199, rng); if (n1 + n2 > 200) n2 = 200 - n1; }
      return { num1: n1, num2: n2, answer: n1 + n2, symbol: OP_SYMBOL.addition, operation: op };
    }
    case 'subtraction': {
      let n1: number, n2: number;
      if      (tier === 'easy')    { n2 = randInt(1, 9, rng);    n1 = n2 + randInt(1, 9, rng); }
      else if (tier === 'medium')  { n2 = randInt(1, 9, rng);    n1 = randInt(10, 99, rng); if (n1 <= n2) n1 = n2 + randInt(1, 10, rng); }
      else if (tier === 'hard')    { n2 = randInt(10, 99, rng);  n1 = n2 + randInt(10, 99, rng); }
      else {
        n2 = randInt(50, 149, rng); n1 = randInt(100, 199, rng);
        if (n1 <= n2) n1 = n2 + randInt(10, 59, rng);
        if (n1 > 200) n1 = 200;
      }
      return { num1: n1, num2: n2, answer: n1 - n2, symbol: OP_SYMBOL.subtraction, operation: op };
    }
    case 'multiplication': {
      let n1: number, n2: number;
      if      (tier === 'easy')    { n1 = randInt(1, 9, rng);    n2 = randInt(1, 9, rng); }
      else if (tier === 'medium')  { n1 = randInt(1, 9, rng);    n2 = randInt(10, 25, rng); }
      else if (tier === 'hard')    { n1 = randInt(10, 25, rng);  n2 = randInt(10, 25, rng); }
      else                         { n1 = randInt(10, 30, rng);  n2 = randInt(10, 30, rng); }
      return { num1: n1, num2: n2, answer: n1 * n2, symbol: OP_SYMBOL.multiplication, operation: op };
    }
    case 'division': {
      let n2: number, q: number;
      if      (tier === 'easy')    { n2 = randInt(1, 9, rng);    q = randInt(1, 9, rng); }
      else if (tier === 'medium')  { n2 = randInt(1, 9, rng);    q = randInt(10, 25, rng); }
      else if (tier === 'hard')    { n2 = randInt(10, 25, rng);  q = randInt(10, 25, rng); }
      else                         { n2 = randInt(10, 30, rng);  q = randInt(10, 30, rng); }
      const n1 = n2 * q;
      return { num1: n1, num2: n2, answer: q, symbol: OP_SYMBOL.division, operation: op };
    }
  }
}

export function generateQuestion(
  op: MathOperation,
  difficulty: number,
  prev: Question[] = [],
  rng: Rng = defaultRng,
): Question {
  const tier = bucketDifficulty(difficulty);
  const isUnique = (q: Question) => !prev.some(
    (p) => p.num1 === q.num1 && p.num2 === q.num2 && p.operation === q.operation,
  );

  let q: Question | null = null;
  for (let attempt = 0; attempt < 50; attempt++) {
    const core = genByTier(op, tier, rng);
    const candidate: Question = { ...core, difficulty };
    if (isUnique(candidate)) { q = candidate; break; }
    q = candidate; // keep last candidate in case we exceed attempts
  }
  return q as Question;
}

export function pickNextOperation(
  selectedOps: MathOperation[],
  rng: Rng = defaultRng,
): MathOperation {
  return selectedOps[Math.floor(rng() * selectedOps.length)];
}
