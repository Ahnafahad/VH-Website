'use strict';
/**
 * add-units-13-18.js
 * Imports vocabulary for units 13–18 (originally empty themes in broad units 5–7).
 * Safe to re-run: checks existence before inserting.
 *
 * Theme IDs (from DB):
 *   110 = Generosity, Philanthropy & Magnanimity   (broad unit 5, id=51)
 *   111 = Frugality, Austerity & Self-Denial       (broad unit 5, id=51)
 *   112 = Deception, Guile & Fraud                 (broad unit 6, id=52)
 *   113 = Evasion, Ambiguity & Misdirection        (broad unit 6, id=52)
 *   114 = Honesty, Candor & Authentic Disclosure   (broad unit 6, id=52)
 *   115 = Hypocrisy, Pretense & Performing Virtue  (broad unit 7, id=53)
 *        (unctuous skipped — example cut off; add separately when tex is complete)
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

// ─── Word data ─────────────────────────────────────────────────────────────────

const UNITS = [

  // ── Unit 13 — Generosity, Philanthropy & Magnanimity ──────────────────────
  {
    themeId: 110,
    unitId:  51,
    words: [
      {
        word: 'altruism', pos: 'noun',
        def: 'The habit of caring about others and acting to help them, with no expectation of getting anything back. A truly altruistic act costs the giver something and benefits someone else entirely.',
        ex:  'She turned down a high-paying city job to run a literacy program in a poor rural town — not for recognition or reward, but because helping others was simply enough.',
        syns: ['selflessness', 'generosity'], ants: ['selfishness'],
      },
      {
        word: 'benefactor', pos: 'noun',
        def: 'A person who gives money, support, or other practical help to another person, a school, a charity, or any organization in need.',
        ex:  'An anonymous benefactor donated enough money to keep the children\'s hospital open for another five years, asking for nothing in return — not even their name on the building.',
        syns: ['patron', 'donor'], ants: ['adversary'],
      },
      {
        word: 'benevolent', pos: 'adjective',
        def: 'Kind and genuinely generous — wanting to do good for others and acting on that wish, often in a position of power or influence.',
        ex:  'The benevolent landlord reduced rent for tenants who had lost their jobs during the crisis, asking only that they pay what they honestly could.',
        syns: ['charitable', 'kind-hearted'], ants: ['malevolent'],
      },
      {
        word: 'bequest', pos: 'noun',
        def: 'Money, property, or possessions left to a specific person or organization in a will — a gift that only takes effect after the giver has died.',
        ex:  'The university received a bequest of two million dollars from a retired professor who had spent forty years teaching there and wanted to fund scholarships for future students.',
        syns: ['legacy', 'inheritance'], ants: [],
      },
      {
        word: 'largess', pos: 'noun',
        def: 'The generous giving of money or gifts, especially by someone wealthy or powerful; a spirit of open-handed generosity toward those below or around you.',
        ex:  "The factory owner's largess extended to the whole town — he funded the new school, restored the park, and built a community hall without being asked.",
        syns: ['generosity', 'munificence'], ants: ['stinginess'],
      },
      {
        word: 'philanthropy', pos: 'noun',
        def: 'The organized and ongoing practice of giving money, time, or resources to help people or benefit society — usually on a large or structured scale, not just a single act.',
        ex:  'After selling his company, he devoted the rest of his life to philanthropy — funding hospitals, schools, and clean water projects across three countries.',
        syns: ['charity', 'benevolence'], ants: ['misanthropy'],
      },
      {
        word: 'prodigal', pos: 'adjective',
        def: 'Spending money or using resources in a very free and wasteful way, far beyond what is sensible or sustainable.',
        ex:  'His prodigal lifestyle — designer clothes, five-star hotels, custom cars — burned through his entire inheritance in less than two years.',
        syns: ['lavish', 'extravagant'], ants: ['frugal'],
      },
      {
        word: 'provident', pos: 'adjective',
        def: 'Careful to think ahead and prepare for future needs; wise about setting aside resources so that you and those who depend on you are taken care of later.',
        ex:  'A provident family, they set aside a portion of every paycheck and kept enough saved to survive six months without any income.',
        syns: ['prudent', 'far-sighted'], ants: ['improvident'],
      },
      {
        word: 'solicitous', pos: 'adjective',
        def: "Showing close, warm attention to someone's comfort or well-being; actively concerned with what another person needs and quick to provide it.",
        ex:  'The nurse was solicitous throughout the long recovery — checking in every hour, adjusting the temperature, and making sure the patient had everything she needed before she could even ask.',
        syns: ['attentive', 'caring'], ants: ['indifferent'],
      },
    ],
  },

  // ── Unit 14 — Frugality, Austerity & Self-Denial ──────────────────────────
  {
    themeId: 111,
    unitId:  51,
    words: [
      {
        word: 'abnegate', pos: 'verb',
        def: 'To give up or deny yourself something you want or have a right to, usually as a matter of principle, religious devotion, or personal discipline.',
        ex:  'The monk abnegated every personal comfort — no soft bed, no warm food, no private possessions — believing that stripping life down was the only path to genuine understanding.',
        syns: ['renounce', 'relinquish'], ants: ['indulge'],
      },
      {
        word: 'abstinent', pos: 'adjective',
        def: 'Choosing to go without something, especially alcohol, certain foods, or other physical pleasures, as a matter of personal discipline, health, or belief.',
        ex:  'He had been abstinent for three years — not a single drink since the night he decided to change his life completely.',
        syns: ['abstemious', 'self-denying'], ants: ['indulgent'],
      },
      {
        word: 'ascetic', pos: 'adjective',
        def: 'Marked by deliberate rejection of physical comfort and pleasure, usually for spiritual or religious reasons; extremely simple and self-denying in how one lives.',
        ex:  'The monastery followed an ascetic tradition — plain food, shared sleeping quarters, no music, no decoration, and silence kept for most of the day.',
        syns: ['austere', 'spartan', 'hermit', 'monk'], ants: ['hedonistic'],
      },
      {
        word: 'austere', pos: 'adjective',
        def: 'Very plain and bare, with nothing extra, comfortable, or decorative — stripped down to the minimum.',
        ex:  'The office was austere: a bare wooden desk, white walls, a single overhead light, and nothing else.',
        syns: ['stark', 'severe'], ants: ['lavish'],
      },
      {
        word: 'celibacy', pos: 'noun',
        def: 'The deliberate choice to remain unmarried and to abstain from sexual relations, most often made as part of a religious commitment or vow.',
        ex:  'The priesthood required a vow of celibacy, and he accepted that condition without hesitation on the day of his ordination.',
        syns: ['abstinence', 'chastity'], ants: [],
      },
      {
        word: 'forbear', pos: 'verb',
        def: 'To stop yourself from doing something you are tempted or provoked to do; to hold back through patient self-control rather than react.',
        ex:  'Though she wanted to argue back, she forbore — she knew that staying quiet was the stronger and wiser choice in that moment.',
        syns: ['restrain', 'refrain'], ants: ['indulge'],
      },
      {
        word: 'forego', pos: 'verb',
        def: 'To choose not to have or do something you could have; to willingly give something up or go without it.',
        ex:  'She decided to forego dessert every evening and put the small amount she saved toward a trip she had been planning for years.',
        syns: ['forgo', 'relinquish'], ants: ['indulge'],
      },
      {
        word: 'forsake', pos: 'verb',
        def: 'To give up something you once valued or held to; to leave it behind completely and for good.',
        ex:  'He forsook his career in finance to become a primary school teacher, never once regretting the drop in income.',
        syns: ['abandon', 'renounce'], ants: ['uphold'],
      },
      {
        word: 'frugal', pos: 'adjective',
        def: 'Careful and sensible about spending money and using resources; avoiding waste and spending only what is truly needed.',
        ex:  'They lived a frugal life — cooking at home every night, buying second-hand, and saving whatever was left at the end of each month without fail.',
        syns: ['thrifty', 'economical'], ants: ['extravagant'],
      },
      {
        word: 'parsimonious', pos: 'adjective',
        def: 'Extremely and unreasonably unwilling to spend money; so reluctant to part with anything that it becomes mean and unjust toward others.',
        ex:  'The parsimonious manager refused to replace the broken office chairs even after months of staff complaints, insisting the budget could not support it.',
        syns: ['miserly', 'tight-fisted'], ants: ['generous'],
      },
      {
        word: 'sobriety', pos: 'noun',
        def: 'The state of not being under the influence of alcohol or drugs; being clear-headed and in full control of your faculties.',
        ex:  'After years of addiction, she celebrated five years of sobriety surrounded by her family at a quiet dinner at home.',
        syns: ['abstinence', 'temperance'], ants: ['intoxication'],
      },
      {
        word: 'temperate', pos: 'adjective',
        def: 'Behaving with self-control and moderation; not going to extremes in appetite, emotion, or personal habits.',
        ex:  'A temperate man by nature, he ate simply, drank rarely, and never raised his voice even in a heated argument.',
        syns: ['moderate', 'restrained'], ants: ['extreme'],
      },
    ],
  },

  // ── Unit 15 — Deception, Guile & Fraud ────────────────────────────────────
  {
    themeId: 112,
    unitId:  52,
    words: [
      {
        word: 'adulterate', pos: 'verb',
        def: 'To make something impure or weaker by secretly mixing in an inferior or harmful substance.',
        ex:  'The factory was shut down after inspectors found that the olive oil had been adulterated with cheap vegetable oil — none of the bottles contained what the label claimed.',
        syns: ['contaminate', 'corrupt'], ants: ['purify'],
      },
      {
        word: 'artful', pos: 'adjective',
        def: 'Clever at getting what you want through indirect or deceptive means; cunning without appearing so.',
        ex:  'The artful salesman guided customers toward the most expensive items without them ever feeling pushed.',
        syns: ['cunning', 'crafty'], ants: ['guileless'],
      },
      {
        word: 'charlatan', pos: 'noun',
        def: 'A person who falsely claims to have expert knowledge or skills in order to cheat or impress others.',
        ex:  'The man sold "miracle cures" at the market for years — he was exposed as a charlatan when doctors confirmed his products contained nothing but sugar and water.',
        syns: ['fraud', 'impostor'], ants: ['expert'],
      },
      {
        word: 'chicanery', pos: 'noun',
        def: 'The use of clever tricks and dishonest arguments to confuse or manipulate people, especially in legal or political situations.',
        ex:  'The defence lawyer accused the prosecution of chicanery — hiding key evidence and misdirecting the jury with questions designed to confuse rather than clarify.',
        syns: ['trickery', 'deception'], ants: ['honesty'],
      },
      {
        word: 'delude', pos: 'verb',
        def: 'To cause someone — or yourself — to believe something that is not true; to keep a false belief alive in someone\'s mind.',
        ex:  'She had been deluding herself for months, telling herself the business was fine while her savings quietly ran out.',
        syns: ['deceive', 'mislead'], ants: ['enlighten'],
      },
      {
        word: 'duplicity', pos: 'noun',
        def: 'The practice of saying one thing while secretly meaning or doing another; deliberate two-faced dishonesty in your dealings with others.',
        ex:  'His duplicity was only revealed at the end — he had been meeting the rival company for months while promising his own team that no deal was being considered.',
        syns: ['deceit', 'double-dealing'], ants: ['sincerity'],
      },
      {
        word: 'fabrication', pos: 'noun',
        def: 'A story, claim, or piece of evidence that has been completely made up; a lie presented as fact.',
        ex:  'The witness admitted her entire account had been a fabrication — she had not been anywhere near the scene that night.',
        syns: ['invention', 'lie'], ants: ['truth'],
      },
      {
        word: 'finesse', pos: 'noun',
        def: 'Skill and subtle cleverness in handling a difficult or delicate situation.',
        ex:  'The negotiator handled the crisis with remarkable finesse — calm, patient, and always a step ahead of what the other side would do next.',
        syns: ['skill', 'delicacy', 'manoeuvre', 'navigate'], ants: ['clumsiness'],
      },
      {
        word: 'guile', pos: 'noun',
        def: 'Clever, subtle cunning used to trick or deceive others; the ability to get what you want through indirect and deceptive means rather than honest effort.',
        ex:  'She had no technical skills to speak of, but her guile was extraordinary — she could talk her way into any room and out of any corner.',
        syns: ['cunning', 'craftiness'], ants: ['naivety'],
      },
      {
        word: 'specious', pos: 'adjective',
        def: 'Seeming correct or reasonable on the surface but actually wrong or misleading when examined closely.',
        ex:  'The lawyer\'s argument sounded compelling at first — but the judge quickly identified it as specious, built on assumptions that had no basis in fact.',
        syns: ['misleading', 'plausible'], ants: ['sound'],
      },
    ],
  },

  // ── Unit 16 — Evasion, Ambiguity & Misdirection ───────────────────────────
  {
    themeId: 113,
    unitId:  52,
    words: [
      {
        word: 'ambiguous', pos: 'adjective',
        def: 'Open to more than one meaning or interpretation; unclear in a way that causes confusion or misunderstanding.',
        ex:  "The contract's wording was so ambiguous that both sides claimed it supported their position — the judge had to decide what it actually meant.",
        syns: ['unclear', 'vague'], ants: ['clear'],
      },
      {
        word: 'circuitous', pos: 'adjective',
        def: 'Taking a longer, more roundabout path than necessary — used both for physical routes and for the way someone speaks at length without getting to the point.',
        ex:  'He gave a circuitous answer that covered everything except what was actually asked, leaving the reporter more confused than before.',
        syns: ['roundabout', 'indirect'], ants: ['direct'],
      },
      {
        word: 'circumlocution', pos: 'noun',
        def: 'The use of far more words than needed to say something simple; talking around a subject rather than addressing it directly.',
        ex:  'After ten minutes of circumlocution about "organisational restructuring" and "resource reallocation," it became clear that what she actually meant was that people would be fired.',
        syns: ['verbosity', 'wordiness'], ants: ['brevity'],
      },
      {
        word: 'elliptical', pos: 'adjective',
        def: 'Using fewer words than are needed, leaving out information so the meaning becomes unclear or hard to follow.',
        ex:  'His reply was so elliptical that no one in the room could agree on whether he had said yes or no.',
        syns: ['indirect', 'cryptic'], ants: ['explicit'],
      },
      {
        word: 'equivocal', pos: 'adjective',
        def: 'Deliberately unclear or capable of being read in more than one way, usually to avoid making a firm commitment or taking a clear position.',
        ex:  "The minister's statement was carefully equivocal — it neither confirmed nor denied the rumour, giving him room to claim he had said nothing either way.",
        syns: ['ambiguous', 'noncommittal'], ants: ['unequivocal'],
      },
      {
        word: 'euphemism', pos: 'noun',
        def: 'A mild or indirect word or phrase used in place of one that might seem too harsh, blunt, or upsetting.',
        ex:  '"Passed away" is a common euphemism for "died" — softer in a painful moment, but meaning exactly the same thing.',
        syns: ['softener', 'substitute'], ants: [],
      },
      {
        word: 'insinuate', pos: 'verb',
        def: 'To suggest something unpleasant, critical, or offensive in an indirect way, without stating it openly.',
        ex:  'She never accused him directly, but her questions insinuated that he had been involved in the fraud from the very beginning.',
        syns: ['imply', 'hint'], ants: ['state'],
      },
      {
        word: 'mendacious', pos: 'adjective',
        def: 'Habitually dishonest; given to telling lies, especially in a smooth or convincing way.',
        ex:  'The report described the official as mendacious, noting that he had made at least fourteen statements to the press that were directly contradicted by the documents released.',
        syns: ['dishonest', 'lying'], ants: ['truthful'],
      },
      {
        word: 'obfuscate', pos: 'verb',
        def: 'To make something deliberately confusing or hard to understand; to cloud the meaning of something in order to hide the truth.',
        ex:  "The company's reports were designed to obfuscate rather than inform — layers of technical jargon buried the fact that the firm was losing money every quarter.",
        syns: ['obscure', 'confuse'], ants: ['clarify'],
      },
      {
        word: 'oblique', pos: 'adjective',
        def: 'Not direct or straightforward — an oblique remark hints at something without stating it; an oblique angle is neither a right angle nor parallel to a surface.',
        ex:  'She made an oblique reference to his past failures without ever naming them — enough to land the point without appearing openly hostile.',
        syns: ['indirect', 'slanting'], ants: ['direct'],
      },
      {
        word: 'ostensible', pos: 'adjective',
        def: 'Appearing to be the real reason or situation on the surface, but possibly concealing the true motive underneath.',
        ex:  'The ostensible reason for the visit was a courtesy call — but everyone in the room knew the real purpose was to pressure the mayor into dropping the investigation.',
        syns: ['apparent', 'supposed'], ants: ['actual'],
      },
    ],
  },

  // ── Unit 17 — Honesty, Candor & Authentic Disclosure ──────────────────────
  {
    themeId: 114,
    unitId:  52,
    words: [
      {
        word: 'avow', pos: 'verb',
        def: 'To state or admit something openly and without embarrassment; to declare something clearly and in public.',
        ex:  'He avowed before the entire board that he had made the decision alone and that no one else should be held responsible.',
        syns: ['declare', 'affirm'], ants: ['deny'],
      },
      {
        word: 'candor', pos: 'noun',
        def: 'The quality of being completely honest and open in what you say, even when the truth is uncomfortable or unwelcome.',
        ex:  'She appreciated his candor — he told her exactly what was wrong with the proposal without softening it, which meant she could fix it before the meeting.',
        syns: ['frankness', 'honesty'], ants: ['evasiveness'],
      },
      {
        word: 'credulous', pos: 'adjective',
        def: 'Too ready or willing to believe things without questioning them or asking for evidence; easily fooled.',
        ex:  'He was so credulous that he handed over his bank details after a single phone call, never stopping to ask whether the story made any sense.',
        syns: ['gullible', 'naive'], ants: ['skeptical'],
      },
      {
        word: 'disinterested', pos: 'adjective',
        def: 'Having no personal stake in the outcome and therefore able to be fair; not influenced by self-interest or personal gain.',
        ex:  'The panel needed a disinterested reviewer — someone with no connection to either company and nothing to gain from the decision going either way.',
        syns: ['impartial', 'neutral'], ants: ['biased'],
      },
      {
        word: 'explicit', pos: 'adjective',
        def: 'Stated in a way that is fully clear and detailed, with nothing left to guess or interpret.',
        ex:  'The contract was explicit on this point: no changes could be made to the design after the deposit was paid, for any reason.',
        syns: ['clear', 'direct'], ants: ['implicit'],
      },
      {
        word: 'fidelity', pos: 'noun',
        def: "Faithfulness and loyalty, especially in a personal relationship; not betraying someone's trust.",
        ex:  "The couple had built thirty years of marriage on mutual fidelity and the understanding that honesty came before everything else.",
        syns: ['loyalty', 'faithfulness'], ants: ['betrayal'],
      },
      {
        word: 'impartial', pos: 'adjective',
        def: 'Treating all sides or all people fairly and equally; not favouring anyone because of personal feelings or connections.',
        ex:  'The referee tried to remain impartial, but every close call was met with accusations of bias from the home crowd.',
        syns: ['fair', 'unbiased'], ants: ['biased'],
      },
      {
        word: 'ingenuous', pos: 'adjective',
        def: 'Honest and open in a way that shows no attempt to deceive; sometimes so straightforward as to seem naive or innocent.',
        ex:  'Her ingenuous response surprised the interviewers — instead of a polished answer, she admitted she had no experience in the area and explained exactly how she planned to learn.',
        syns: ['sincere', 'open'], ants: ['disingenuous'],
      },
      {
        word: 'manifest', pos: 'adjective',
        def: 'Clear and obvious to anyone who looks; easily seen or understood without needing to be explained.',
        ex:  "His discomfort was manifest — he kept checking the door, giving one-word answers, and refusing to meet anyone's eyes.",
        syns: ['obvious', 'evident'], ants: ['hidden'],
      },
      {
        word: 'unwitting', pos: 'adjective',
        def: 'Not aware of what you are involved in or what you have done; unintentional and done without knowledge.',
        ex:  'She was an unwitting participant in the scheme — she had delivered the documents believing they were routine files, with no idea what they actually contained.',
        syns: ['unknowing', 'unintentional'], ants: ['deliberate'],
      },
    ],
  },

  // ── Unit 18 — Hypocrisy, Pretense & Performing Virtue (partial) ───────────
  // NOTE: unctuous skipped — example sentence cut off in source. Add separately.
  {
    themeId: 115,
    unitId:  53,
    words: [
      {
        word: 'affectation', pos: 'noun',
        def: 'A way of speaking or behaving that is put on to impress others rather than being natural; a manner someone adopts that does not feel genuine.',
        ex:  'His English accent was a pure affectation — he had grown up in the Midwest and only started speaking that way after a summer abroad.',
        syns: ['pretense', 'pose'], ants: ['naturalness'],
      },
      {
        word: 'belie', pos: 'verb',
        def: 'To give a false impression of something; to show that something is not what it appears to be, or to directly contradict what is claimed.',
        ex:  'Her calm expression belied the panic she was feeling inside — she looked completely composed while her hands shook under the table.',
        syns: ['contradict', 'misrepresent'], ants: ['reflect'],
      },
      {
        word: 'contrived', pos: 'adjective',
        def: 'Deliberately arranged or forced in a way that feels unnatural and artificial; lacking the quality of something said or done sincerely.',
        ex:  'The apology felt contrived — the words were technically correct, but there was nothing behind them, and everyone in the room could tell.',
        syns: ['artificial', 'forced'], ants: ['genuine'],
      },
      {
        word: 'countenance', pos: 'noun',
        def: "A person's face or the expression on it.",
        ex:  'Her countenance gave nothing away — even when the verdict was read aloud, her face remained perfectly still.',
        syns: ['face', 'expression', 'tolerate', 'permit'], ants: ['forbid'],
      },
      {
        word: 'derogatory', pos: 'adjective',
        def: 'Showing disrespect or a low opinion of someone or something; expressing the idea that a person or group is inferior or not worth respect.',
        ex:  'The employee was dismissed after sending derogatory comments about a colleague in a company-wide email — the words were insulting and left no room for misinterpretation.',
        syns: ['insulting', 'demeaning'], ants: ['complimentary'],
      },
      {
        word: 'pejorative', pos: 'adjective',
        def: 'Having a negative or disapproving tone built into it — said of words or phrases that carry a judgment without explicitly stating one.',
        ex:  'The term was widely considered pejorative — even when used without hostile intent, it carried enough negative history to cause real offence.',
        syns: ['derogatory', 'disparaging'], ants: ['complimentary'],
      },
      {
        word: 'pious', pos: 'adjective',
        def: 'Deeply religious and devout; genuinely devoted to religious practice and belief.',
        ex:  'She was a pious woman who began and ended every day with prayer and gave generously to those in need.',
        syns: ['devout', 'sanctimonious'], ants: ['irreverent'],
      },
      {
        word: 'sanctimonious', pos: 'adjective',
        def: 'Acting as though you are morally better than other people; making a public show of your own virtue or righteousness in a way that is irritating and insincere.',
        ex:  'His sanctimonious lecture about punctuality landed badly with the team — he was notorious for showing up late to his own meetings.',
        syns: ['self-righteous', 'preachy'], ants: ['humble'],
      },
    ],
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n📚 Adding units 13–18 to LexiCore...\n');

  let added = 0, skipped = 0;

  for (const unit of UNITS) {
    console.log(`\n  Theme ${unit.themeId}:`);
    for (const w of unit.words) {
      const existing = await client.execute({
        sql:  'SELECT id FROM vocab_words WHERE theme_id = ? AND LOWER(word) = ?',
        args: [unit.themeId, w.word.toLowerCase()],
      });
      if (existing.rows.length > 0) {
        console.log(`    ✓ ${w.word} (already exists)`);
        skipped++;
        continue;
      }
      const wordFormatted = w.word.charAt(0).toUpperCase() + w.word.slice(1).toLowerCase();
      await client.execute({
        sql: `INSERT INTO vocab_words
                (theme_id, unit_id, word, definition, example_sentence,
                 part_of_speech, synonyms, antonyms, difficulty_base)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          unit.themeId,
          unit.unitId,
          wordFormatted,
          w.def,
          w.ex,
          w.pos,
          JSON.stringify(w.syns),
          JSON.stringify(w.ants),
          3,
        ],
      });
      console.log(`    ✅ ${wordFormatted}`);
      added++;
    }
  }

  console.log('\n─────────────────────────────────');
  console.log(`  Added:   ${added}`);
  console.log(`  Skipped: ${skipped} (already existed)`);
  console.log('─────────────────────────────────');

  const total = await client.execute('SELECT COUNT(*) FROM vocab_words');
  console.log(`  Total words in DB: ${total.rows[0][0]}\n`);

  await client.close();
}

main().catch(err => { console.error(err); process.exit(1); });
