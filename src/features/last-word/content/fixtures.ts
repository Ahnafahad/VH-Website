import assureEnsure from '../../../../content/last-word/sets/assure-ensure.json';
import confidentArrogant from '../../../../content/last-word/sets/confident-arrogant.json';
import frugalThriftyMiserly from '../../../../content/last-word/sets/frugal-thrifty-miserly.json';
import persistentObstinate from '../../../../content/last-word/sets/persistent-obstinate.json';
import { lastWordSetSchema, type LastWordSet } from './schema';

export const fixtureSets: LastWordSet[] = [confidentArrogant, persistentObstinate, assureEnsure, frugalThriftyMiserly]
  .map(set => lastWordSetSchema.parse(set));

export function getFixtureSet(setId: string): LastWordSet {
  const set = fixtureSets.find(item => item.set_id === setId);
  if (!set) throw new Error(`Unknown Last Word set: ${setId}`);
  return set;
}
