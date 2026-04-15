'use strict';
/**
 * add-units-19-21.js
 * Imports vocabulary for units 19–21 + adds missing unctuous to unit 18.
 * Safe to re-run: checks existence before inserting.
 *
 * Theme IDs:
 *   115 = Hypocrisy, Pretense & Performing Virtue   (unit 18 — unctuous only)
 *   116 = Doubtful Claims & Unverified Assertions   (unit 19, broad unit 7 id=53)
 *   117 = Satire, Mockery & Cutting Wit             (unit 20, broad unit 7 id=53)
 *   118 = Legal Contestation & Formal Accusation    (unit 21, broad unit 8 id=54)
 */

const { createClient } = require('@libsql/client');
const fs   = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
      const t = line.trim();
      if (t && !t.startsWith('#')) {
        const [key, ...rest] = t.split('=');
        if (key && rest.length > 0)
          process.env[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
      }
    });
  }
}
loadEnv();

const client = createClient({
  url:       process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const UNITS = [

  // ── Unit 18 supplement — unctuous ─────────────────────────────────────────
  {
    themeId: 115, unitId: 53,
    words: [
      {
        word: 'unctuous', pos: 'adjective',
        def: 'Excessively eager to please, agree, and flatter in a way that feels slick and insincere; so smooth in manner that people feel uncomfortable rather than reassured.',
        ex:  'The hotel manager was exhausting to deal with — he smiled at everything, agreed with every complaint, praised every choice as inspired, and left guests feeling more unsettled than welcomed.',
        syns: ['obsequious', 'sycophantic'], ants: ['sincere'],
      },
    ],
  },

  // ── Unit 19 — Doubtful Claims & Unverified Assertions ────────────────────
  {
    themeId: 116, unitId: 53,
    words: [
      {
        word: 'allege', pos: 'verb',
        def: 'To state that someone has done something wrong, or that something is true, without yet being able to prove it.',
        ex:  'The lawsuit alleged that the factory had been releasing toxic waste into the river for years, though the company denied any wrongdoing and called the claims baseless.',
        syns: ['claim', 'assert'], ants: ['prove'],
      },
      {
        word: 'apocryphal', pos: 'adjective',
        def: 'Widely repeated and believed but almost certainly not true; a story or claim that sounds convincing but has never actually been verified.',
        ex:  "The tale of the founder walking twenty miles through snow to make his first delivery is almost certainly apocryphal — no record of it appears anywhere in the company's own history.",
        syns: ['fictitious', 'dubious'], ants: ['verified'],
      },
      {
        word: 'conjecture', pos: 'noun',
        def: 'An opinion or conclusion reached without solid supporting evidence; an informed guess rather than an established fact.',
        ex:  'At this early stage, any claim about who was responsible remains pure conjecture — the investigation has barely begun and no evidence has been made public.',
        syns: ['speculation', 'supposition'], ants: ['fact'],
      },
      {
        word: 'dubious', pos: 'adjective',
        def: 'Not clearly reliable or trustworthy; giving enough reason for serious doubt.',
        ex:  "The supplement's claimed health benefits are dubious — not one of the studies cited on the packaging has been repeated by independent researchers.",
        syns: ['questionable', 'suspect'], ants: ['trustworthy'],
      },
      {
        word: 'provisional', pos: 'adjective',
        def: 'Formally put in place for now but expected to change once more information becomes available; arranged but not yet final.',
        ex:  'The election results are provisional — they will not be confirmed until all overseas votes have been counted over the following three days.',
        syns: ['temporary', 'interim'], ants: ['final'],
      },
      {
        word: 'purported', pos: 'adjective',
        def: 'Said or claimed to be something, but not yet confirmed as true; supposedly the case, without firm proof behind it.',
        ex:  'The purported eyewitness turned out to have been thirty miles from the scene when the incident occurred — her account fell apart immediately.',
        syns: ['alleged', 'supposed'], ants: ['confirmed'],
      },
      {
        word: 'purportedly', pos: 'adverb',
        def: 'According to what has been claimed but without proof to back it up; reportedly, though not verified by anyone independent.',
        ex:  'The letter was purportedly written by the general himself, but no handwriting expert who examined it was willing to confirm that conclusion.',
        syns: ['allegedly', 'supposedly'], ants: ['demonstrably'],
      },
      {
        word: 'putative', pos: 'adjective',
        def: 'Widely assumed or generally believed to be the case, even without formal proof or official confirmation.',
        ex:  'The putative leader of the movement had never publicly claimed the role, yet every journalist covering the story treated him as the one in charge.',
        syns: ['presumed', 'supposed'], ants: ['confirmed'],
      },
      {
        word: 'spurious', pos: 'adjective',
        def: 'False or not genuine; or based on reasoning that appears correct on the surface but falls apart under careful examination.',
        ex:  'The researcher dismissed the apparent link between the two variables as spurious — it disappeared entirely once the data were properly adjusted for age and income.',
        syns: ['false', 'bogus'], ants: ['genuine'],
      },
      {
        word: 'tentative', pos: 'adjective',
        def: 'Not yet decided or confirmed; done or arranged with hesitation because the outcome is still uncertain and subject to change.',
        ex:  'We have a tentative plan to meet on Friday, but nothing is booked — everything depends on whether she can get the afternoon free.',
        syns: ['uncertain', 'hesitant'], ants: ['definite'],
      },
      {
        word: 'tenuous', pos: 'adjective',
        def: 'Very weak, thin, or slight; barely held together by evidence, and likely to collapse under any serious examination.',
        ex:  'The connection between the two suspects was tenuous at best — they had met once at a trade fair three years before the crime, and nothing else linked them.',
        syns: ['weak', 'fragile'], ants: ['strong'],
      },
    ],
  },

  // ── Unit 20 — Satire, Mockery & Cutting Wit ──────────────────────────────
  {
    themeId: 117, unitId: 53,
    words: [
      {
        word: 'acerbic', pos: 'adjective',
        def: 'Sharp and harshly critical in tone; the kind of language or humor that stings because it is both clever and merciless.',
        ex:  "Her acerbic review of the exhibition left the gallery's director in silence — she described the main piece as \"an expensive accident displayed in a gold frame.\"",
        syns: ['caustic', 'sharp'], ants: ['gentle'],
      },
      {
        word: 'burlesque', pos: 'noun',
        def: 'A comic work — a performance, sketch, or piece of writing — that mocks something serious by treating it in a wildly exaggerated, ridiculous way.',
        ex:  "The students staged a burlesque of the school's formal awards ceremony, with one student playing the head teacher in an oversized gown and delivering the speech in a pompous accent.",
        syns: ['parody', 'satire'], ants: ['tribute'],
      },
      {
        word: 'caricature', pos: 'noun',
        def: "A drawing or description of a person that exaggerates their most noticeable features until they look absurd; a distorted, mocking likeness.",
        ex:  "The cartoon was a caricature of the finance minister — his already large forehead stretched to the top of the frame, giving him the look of a walking billboard.",
        syns: ['cartoon', 'parody'], ants: [],
      },
      {
        word: 'caustic', pos: 'adjective',
        def: 'So sharply critical in speech or writing that the words seem to burn; biting and scornful in a way that leaves a mark.',
        ex:  "The editor's caustic notes filled the margins of every page — by the time she reached the end of the manuscript, the young writer was questioning whether to continue at all.",
        syns: ['acerbic', 'scathing'], ants: ['gentle'],
      },
      {
        word: 'facetious', pos: 'adjective',
        def: 'Making jokes or treating something lightly at a moment when the situation clearly calls for seriousness; humorously inappropriate.',
        ex:  'When the judge asked whether he understood the gravity of the charges, his facetious reply that he found the whole matter "rather entertaining" did not help his case.',
        syns: ['flippant', 'frivolous'], ants: ['sincere'],
      },
      {
        word: 'farcical', pos: 'adjective',
        def: 'So disorganized, chaotic, or absurd that it is impossible to take seriously; resembling a bad comedy rather than a real, competently run event.',
        ex:  "The summit intended to resolve the trade dispute turned farcical when neither side's team could agree on what language to use for the opening statement.",
        syns: ['absurd', 'ridiculous'], ants: ['serious'],
      },
      {
        word: 'invective', pos: 'noun',
        def: 'Harsh, violently angry language used to attack a person or group; a stream of bitter, abusive words directed at a specific target.',
        ex:  "Instead of answering the journalist's question, the minister launched into a long invective against the newspaper — calling it dishonest, corrupt, and an enemy of the public.",
        syns: ['abuse', 'tirade'], ants: ['praise'],
      },
      {
        word: 'ironic', pos: 'adjective',
        def: 'Saying or expressing the opposite of what the words literally mean, usually to make a point or to be funny.',
        ex:  '"What a wonderful morning," she said, watching the rain pour down the windows — her tone making clear she meant exactly the opposite.',
        syns: ['sardonic', 'wry'], ants: ['sincere'],
      },
      {
        word: 'lampoon', pos: 'verb',
        def: 'To publicly attack or mock a person or institution through sharp, exaggerated ridicule, usually in print or on stage.',
        ex:  'The satirical magazine has lampooned every sitting government for forty years — no administration, however popular, has escaped its pages unscathed.',
        syns: ['satirize', 'mock'], ants: ['tribute'],
      },
      {
        word: 'parody', pos: 'noun',
        def: 'A work that closely imitates the style of a well-known piece or genre in an exaggerated way, in order to make fun of it.',
        ex:  'The novel is a parody of Victorian detective fiction — it follows every convention of the genre so faithfully that the joke only lands if you already know the originals.',
        syns: ['spoof', 'satire'], ants: ['tribute'],
      },
    ],
  },

  // ── Unit 21 — Legal Contestation & Formal Accusation ─────────────────────
  {
    themeId: 118, unitId: 54,
    words: [
      {
        word: 'arbiter', pos: 'noun',
        def: 'A person given the authority or recognized standing to settle a dispute and reach a judgment that both sides agree in advance to accept.',
        ex:  'After weeks of deadlock, both companies agreed to bring in a retired judge as arbiter — whatever she decided, neither side would appeal or refuse to comply.',
        syns: ['judge', 'referee'], ants: ['disputant'],
      },
      {
        word: 'defame', pos: 'verb',
        def: "To damage someone's reputation by making false, harmful statements about them in public, whether spoken or in writing.",
        ex:  'The article defamed the surgeon by falsely implying she had been removed from the medical register — a claim the publication was unable to support with a single piece of evidence.',
        syns: ['slander', 'libel'], ants: ['praise'],
      },
      {
        word: 'indignant', pos: 'adjective',
        def: 'Feeling or showing strong anger because something seems deeply unfair or wrong; righteously angry at a perceived injustice done to oneself or others.',
        ex:  'The employees were indignant when they discovered that the bonus promised at the start of the year had been quietly removed from their new contracts without any explanation.',
        syns: ['outraged', 'offended'], ants: ['indifferent'],
      },
      {
        word: 'libel', pos: 'noun',
        def: "A false and damaging statement about a person that is written, printed, or published in a way that harms their reputation.",
        ex:  "She brought a libel case against the magazine after it printed a story falsely claiming she had defrauded her own business partners over several years.",
        syns: ['defamation', 'slander'], ants: ['vindicate'],
      },
      {
        word: 'litigate', pos: 'verb',
        def: 'To take a legal dispute to court and argue it through the full formal legal process, rather than resolving it privately outside court.',
        ex:  "The company chose to litigate rather than settle — a decision that dragged the case through the courts for four years and cost both sides far more than the original claim was worth.",
        syns: ['sue', 'contest'], ants: ['settle'],
      },
      {
        word: 'perjury', pos: 'noun',
        def: 'The crime of deliberately telling a lie while under oath in a court of law or in another official legal proceeding.',
        ex:  'The witness was charged with perjury after security footage showed she could not have been where she had sworn under oath that she was during the time in question.',
        syns: ['false testimony', 'false swearing'], ants: [],
      },
      {
        word: 'precedent', pos: 'noun',
        def: 'An earlier decision or action that serves as a guide or rule for handling similar cases in the future, especially in a legal context.',
        ex:  'The ruling set a significant precedent: for the first time, a technology company was held legally responsible for harmful content posted on its platform by users.',
        syns: ['model', 'standard'], ants: [],
      },
      {
        word: 'rebut', pos: 'verb',
        def: "To prove or argue that a claim, accusation, or piece of evidence is wrong; to counter an opposing argument directly with facts or reasoning of your own.",
        ex:  "The defense spent the entire second day of the trial rebutting the prosecution's forensic evidence, presenting three independent experts who reached completely different conclusions from the same data.",
        syns: ['refute', 'counter'], ants: ['confirm'],
      },
      {
        word: 'recrimination', pos: 'noun',
        def: 'An accusation made in response to being accused; the mutual blaming that occurs when two sides attack each other instead of working toward any solution.',
        ex:  'The meeting collapsed into recrimination — each department blamed the other for the failed product launch, and by the end not a single constructive suggestion had been made.',
        syns: ['countercharge', 'reproach'], ants: ['reconciliation'],
      },
      {
        word: 'slander', pos: 'noun',
        def: "A false and damaging spoken statement about a person that harms their reputation.",
        ex:  "When her neighbor told people at the village meeting that she had stolen from her previous employer — something she had never done — she consulted a lawyer and sued him for slander.",
        syns: ['defamation', 'libel'], ants: ['vindicate'],
      },
      {
        word: 'stipulate', pos: 'verb',
        def: 'To state clearly that something is a required condition, especially as part of a contract, agreement, or formal legal document.',
        ex:  'The contract stipulated that all invoices must be paid within thirty days of delivery, with a fixed penalty fee applied automatically to any late payment.',
        syns: ['specify', 'require'], ants: [],
      },
    ],
  },
];

async function main() {
  console.log('\n📚 Adding units 19–21 + unctuous (unit 18)...\n');

  let added = 0, skipped = 0;

  for (const unit of UNITS) {
    console.log(`  Theme ${unit.themeId}:`);
    for (const w of unit.words) {
      const existing = await client.execute({
        sql:  'SELECT id FROM vocab_words WHERE theme_id = ? AND LOWER(word) = ?',
        args: [unit.themeId, w.word.toLowerCase()],
      });
      if (existing.rows.length > 0) {
        console.log(`    ✓ ${w.word} (exists)`);
        skipped++;
        continue;
      }
      const formatted = w.word.charAt(0).toUpperCase() + w.word.slice(1).toLowerCase();
      await client.execute({
        sql: `INSERT INTO vocab_words
                (theme_id, unit_id, word, definition, example_sentence,
                 part_of_speech, synonyms, antonyms, difficulty_base)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [unit.themeId, unit.unitId, formatted, w.def, w.ex, w.pos,
               JSON.stringify(w.syns), JSON.stringify(w.ants), 3],
      });
      console.log(`    ✅ ${formatted}`);
      added++;
    }
  }

  console.log('\n─────────────────────────────────');
  console.log(`  Added:   ${added}`);
  console.log(`  Skipped: ${skipped}`);
  const total = await client.execute('SELECT COUNT(*) FROM vocab_words');
  console.log(`  Total words in DB: ${total.rows[0][0]}`);
  console.log('─────────────────────────────────\n');

  await client.close();
}

main().catch(err => { console.error(err); process.exit(1); });
