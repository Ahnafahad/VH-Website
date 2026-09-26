import raw from './taxonomy.json';

export interface SkillDef { id: string; label: string }
export interface FamilyDef { id: string; label: string; skill: string }
export interface TrapDef { id: string; label: string }

export const SKILLS: SkillDef[] = raw.skills.map(s => ({ id: s.id, label: s.label }));
export const FAMILIES: FamilyDef[] = raw.families.map(f => ({ id: f.id, label: f.label, skill: f.skill }));
export const TRAPS: TrapDef[] = raw.traps.map(t => ({ id: t.id, label: t.label }));

const skillLabels = new Map(SKILLS.map(s => [s.id, s.label]));
const familyLabels = new Map(FAMILIES.map(f => [f.id, f.label]));
const trapLabels = new Map(TRAPS.map(t => [t.id, t.label]));

export const TRAP_BASE = raw.trapBase as Record<string, number>;
export const FAMILY_BASE = raw.familyBase as Record<string, number>;

export const skillLabel = (id: string) => skillLabels.get(id) ?? id;
export const familyLabel = (id: string) => familyLabels.get(id) ?? id;
export const trapLabel = (id: string) => trapLabels.get(id) ?? id;
