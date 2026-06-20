// ─── Canonical O-Level & A-Level subject catalogue ─────────────────────────────
//
// Source of truth: D:\Downloads\BA ki\admission\AUDIT-RESULT\subject-lists.md
// (Cambridge IGCSE / O Level + Edexcel International GCSE for O-Level;
//  Cambridge International AS/A Level + Edexcel IAL for A-Level.)
//
// Each subject carries explicit `tags` used by the eligibility calculators.
// Calculators match on TAGS, never on fuzzy string matching of the label —
// this is what guarantees "Mathematics is Mathematics" and is never confused
// with another subject that merely shares letters.
//
// Tag conventions (the wiring contract — read before editing):
//   'math'        — counts as the generic "Mathematics" requirement.
//                   Per subject-lists.md note #1, Additional / Further Pure Math
//                   ALSO carry 'math' (they satisfy a generic O-Level Math prereq).
//   'gen-math'    — ONLY the plain/general Mathematics syllabus. Used where a
//                   requirement says "General Mathematics" specifically
//                   (e.g. DU Economics) and Additional Math must NOT substitute.
//   'add-math'    — Additional / Further Pure Mathematics (a.k.a. "Higher Math").
//   'further-math'— A-Level Further Mathematics.
//   'physics' 'chemistry' 'biology' — the three sciences.
//   'english'     — any English Language / First Language / Second Language / ESL.
//   'english-lit' — English Literature (distinct from English Language).
//   'economics' 'accounting' 'business' 'commerce' 'statistics'
//   'computer-science' 'ict' 'it' 'geography' 'history' 'sociology' 'psychology'
//   'law' 'art'   — self-explanatory.
//   'bangla' 'bangladesh-studies' — NOT accepted as subject prerequisites
//                   (per agent-spec.md note); tagged only so they can be listed.
//
// `popular: true` marks the subjects flagged `*` in subject-lists.md as common
// in Bangladesh — these float to the top of the dropdown.

export interface SubjectOption {
  label: string;
  tags: string[];
  popular?: boolean;
}

// ─── O-Level (IGCSE / O Level / Edexcel International GCSE) ──────────────────────

export const O_LEVEL_SUBJECTS: SubjectOption[] = [
  // ── Popular core ──
  { label: 'Mathematics',                       tags: ['math', 'gen-math'], popular: true },
  { label: 'Additional Mathematics',            tags: ['math', 'add-math'], popular: true },
  { label: 'Physics',                           tags: ['physics'],          popular: true },
  { label: 'Chemistry',                         tags: ['chemistry'],        popular: true },
  { label: 'Biology',                           tags: ['biology'],          popular: true },
  { label: 'English Language',                  tags: ['english'],          popular: true },
  { label: 'English as a Second Language (ESL)', tags: ['english'],         popular: true },
  { label: 'English Literature',                tags: ['english-lit'],      popular: true },
  { label: 'Economics',                         tags: ['economics'],        popular: true },
  { label: 'Accounting',                        tags: ['accounting'],       popular: true },
  { label: 'Business Studies',                  tags: ['business'],         popular: true },
  { label: 'Computer Science',                  tags: ['computer-science'], popular: true },
  { label: 'Information & Communication Technology (ICT)', tags: ['ict'],   popular: true },
  { label: 'Geography',                         tags: ['geography'],        popular: true },
  { label: 'History',                           tags: ['history'],          popular: true },

  // ── Further maths variants ──
  { label: 'Further Pure Mathematics',          tags: ['math', 'add-math'] },

  // ── Other commerce / social science ──
  { label: 'Business',                          tags: ['business'] },
  { label: 'Commerce',                          tags: ['commerce'] },
  { label: 'Statistics',                        tags: ['statistics'] },
  { label: 'Sociology',                         tags: ['sociology'] },
  { label: 'Global Perspectives',               tags: [] },
  { label: 'Enterprise',                        tags: [] },
  { label: 'Travel & Tourism',                  tags: [] },

  // ── Other sciences ──
  { label: 'Human Biology',                     tags: [] },
  { label: 'Combined Science',                  tags: [] },
  { label: 'Co-ordinated Sciences (Double)',    tags: [] },
  { label: 'Environmental Management',          tags: [] },
  { label: 'Marine Science',                    tags: [] },
  { label: 'Agriculture',                       tags: [] },
  { label: 'Food & Nutrition',                  tags: [] },
  { label: 'Design & Technology',               tags: [] },

  // ── Humanities / arts ──
  { label: 'Art & Design',                      tags: ['art'] },
  { label: 'Drama',                             tags: [] },
  { label: 'Music',                             tags: [] },
  { label: 'Physical Education',                tags: [] },
  { label: 'Religious Studies',                 tags: [] },
  { label: 'Islamic Studies / Islamiyat',       tags: [] },
  { label: 'Biblical Studies',                  tags: [] },
  { label: 'Hinduism',                          tags: [] },
  { label: 'Latin',                             tags: [] },

  // ── Bangladesh-specific (NOT accepted as prerequisites) ──
  { label: 'Bangladesh Studies',                tags: ['bangladesh-studies'] },
  { label: 'Bengali / Bangla',                  tags: ['bangla'] },

  // ── Languages ──
  { label: 'French',                            tags: [] },
  { label: 'German',                            tags: [] },
  { label: 'Spanish',                           tags: [] },
  { label: 'Arabic',                            tags: [] },
  { label: 'Chinese (Mandarin)',                tags: [] },
  { label: 'Hindi',                             tags: [] },
  { label: 'Urdu',                              tags: [] },
  { label: 'Portuguese',                        tags: [] },
  { label: 'Pakistan Studies',                  tags: [] },
];

// ─── A-Level (Cambridge International AS/A Level / Edexcel IAL) ──────────────────

export const A_LEVEL_SUBJECTS: SubjectOption[] = [
  // ── Popular core ──
  { label: 'Mathematics',               tags: ['math'],                    popular: true },
  { label: 'Further Mathematics',       tags: ['math', 'further-math'],    popular: true },
  { label: 'Physics',                   tags: ['physics'],                 popular: true },
  { label: 'Chemistry',                 tags: ['chemistry'],               popular: true },
  { label: 'Biology',                   tags: ['biology'],                 popular: true },
  { label: 'Economics',                 tags: ['economics'],               popular: true },
  { label: 'Accounting',                tags: ['accounting'],              popular: true },
  { label: 'Business',                  tags: ['business'],                popular: true },
  { label: 'English Literature',        tags: ['english-lit'],             popular: true },
  { label: 'English Language',          tags: ['english'],                 popular: true },
  { label: 'Psychology',                tags: ['psychology'],              popular: true },
  { label: 'Computer Science',          tags: ['computer-science'],        popular: true },
  { label: 'Information Technology',    tags: ['ict', 'it'],               popular: true },
  { label: 'Geography',                 tags: ['geography'],               popular: true },
  { label: 'History',                   tags: ['history'],                 popular: true },

  // ── Maths variants ──
  { label: 'Pure Mathematics',          tags: ['math'] },

  // ── Social science / humanities ──
  { label: 'Sociology',                 tags: ['sociology'] },
  { label: 'Law',                       tags: ['law'] },
  { label: 'Global Perspectives & Research', tags: [] },
  { label: 'Media Studies',             tags: [] },
  { label: 'Classical Studies',         tags: [] },
  { label: 'Thinking Skills',           tags: [] },
  { label: 'Travel & Tourism',          tags: [] },
  { label: 'Religious Studies',         tags: [] },
  { label: 'Islamic Studies',           tags: [] },

  // ── Other sciences ──
  { label: 'Marine Science',            tags: [] },

  // ── Arts ──
  { label: 'Art & Design',              tags: ['art'] },
  { label: 'Design & Technology',       tags: [] },
  { label: 'Digital Media & Design',    tags: [] },
  { label: 'Drama',                     tags: [] },
  { label: 'Music',                     tags: [] },

  // ── Languages ──
  { label: 'French',                    tags: [] },
  { label: 'German',                    tags: [] },
  { label: 'Spanish',                   tags: [] },
  { label: 'Arabic',                    tags: [] },
  { label: 'Chinese',                   tags: [] },
  { label: 'Urdu',                      tags: [] },
];
