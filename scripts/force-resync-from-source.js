'use strict';
/**
 * force-resync-from-source.js
 *
 * Force-updates ALL words that have real source data (.tex files or embedded data)
 * with the correct definitions, overwriting any Gemini-generated content.
 *
 * Sources:
 *   Units  1–8 : D:/Downloads/wordsmart_unit01.tex
 *   Units  9–12: embedded (from add-units-9-12.js)
 *   Units 22–77: D:/Downloads/Task Manager/unit_NN_*.tex
 *   Units 13–21: no source, skipped
 */

const { createClient } = require('@libsql/client');
const fs   = require('fs');
const path = require('path');

// ─── Env loader ───────────────────────────────────────────────────────────────

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

// ─── LaTeX helpers ────────────────────────────────────────────────────────────

function cleanLatex(s) {
  return s
    .replace(/\\textit\{([^}]*)\}/g, '$1')
    .replace(/\\textbf\{([^}]*)\}/g, '$1')
    .replace(/\\emph\{([^}]*)\}/g,   '$1')
    .replace(/---/g, '—').replace(/--/g, '–')
    .replace(/\s+/g, ' ').trim();
}

function extractBraces(s, start) {
  let depth = 0, i = start, r = '';
  while (i < s.length) {
    if (s[i] === '{') { depth++; if (depth === 1) { i++; continue; } }
    if (s[i] === '}') { depth--; if (depth === 0) return r; }
    if (depth > 0) r += s[i];
    i++;
  }
  return r;
}

/**
 * Parse all \wordentry blocks from a raw .tex chunk.
 * Returns an array of word objects.
 */
function parseTexChunk(chunk) {
  const words = [];
  let i = 0;
  while (i < chunk.length) {
    const we = chunk.indexOf('\\wordentry{', i);
    if (we === -1) break;

    const wName  = extractBraces(chunk, we + 10);
    const posIdx = chunk.indexOf('{', we + 10 + wName.length + 1);
    const rawPos = extractBraces(chunk, posIdx);
    const pos    = rawPos.split('/')[0].trim().toLowerCase();

    const nextWe = chunk.indexOf('\\wordentry{', we + 1);
    const block  = chunk.slice(we, nextWe === -1 ? chunk.length : nextWe);

    let def = '';
    const dm = block.match(/\\definition\{([\s\S]*?)\}/);
    if (dm) { def = cleanLatex(dm[1]); }
    else {
      const d2 = block.match(/\\definitionnumbered\{1\}\{([\s\S]*?)\}/);
      if (d2) def = cleanLatex(d2[1]);
    }

    let ex = '';
    const em = block.match(/\\examplesentence\{([\s\S]*?)\}/);
    if (em) { ex = cleanLatex(em[1]); }
    else {
      const e2 = block.match(/\\examplenumbered\{1\}\{([\s\S]*?)\}/);
      if (e2) ex = cleanLatex(e2[1]);
    }

    const sm   = block.match(/\\synantline\{([^}]*)\}\{([^}]*)\}/);
    const syns = sm ? sm[1].split(',').map(s => s.trim()).filter(s => s && s.toLowerCase() !== 'none') : [];
    const ants = sm ? sm[2].split(',').map(s => s.trim()).filter(s => s && s.toLowerCase() !== 'none') : [];

    if (wName && def) {
      const word = wName.charAt(0).toUpperCase() + wName.slice(1).toLowerCase();
      words.push({ word, key: wName.toLowerCase(), def, ex, pos, syns, ants });
    }

    i = we + 1;
  }
  return words;
}

// ─── Source 1: Units 1–8 from wordsmart_unit01.tex ───────────────────────────

function parseWordsmart() {
  const content = fs.readFileSync('D:/Downloads/wordsmart_unit01.tex', 'utf8');
  // Find each unit section
  const sectionRe = /\\section\*\{Unit (\d+)/g;
  const sections = [];
  let m;
  while ((m = sectionRe.exec(content)) !== null) {
    sections.push({ unitNum: parseInt(m[1]), pos: m.index });
  }

  const words = [];
  for (let si = 0; si < sections.length; si++) {
    const start = sections[si].pos;
    const end   = si + 1 < sections.length ? sections[si + 1].pos : content.length;
    const chunk = content.slice(start, end);
    const parsed = parseTexChunk(chunk);
    words.push(...parsed);
  }

  return words;
}

// ─── Source 2: Units 9–12 embedded data ──────────────────────────────────────

const UNITS_9_12 = [
  // Unit 9
  { word: 'appropriate', pos: 'verb', def: "To take something for one's own use, typically without the owner's permission; to officially allocate money or resources for a specific purpose.", ex: 'The government appropriated private land for the new highway project without offering fair compensation.', syns: ['commandeer','seize','allocate','earmark'], ants: ['relinquish','surrender','return'] },
  { word: 'autonomous',  pos: 'adjective', def: 'Having the freedom to act independently; self-governing; not controlled by others.', ex: 'The regional council was granted autonomous authority to manage its own budget without central oversight.', syns: ['independent','self-governing','sovereign','self-sufficient'], ants: ['dependent','controlled','subservient'] },
  { word: 'bureaucracy', pos: 'noun', def: 'A system of government or management with complex rules and processes; excessive official paperwork and regulation.', ex: 'The entrepreneur was frustrated by the layers of bureaucracy required to register a new business.', syns: ['administration','officialdom','red tape','apparatus'], ants: ['efficiency','simplicity','directness'] },
  { word: 'curtail',     pos: 'verb', def: 'To reduce or limit something; to impose a restriction that cuts something short.', ex: 'The government curtailed civil liberties during the period of national emergency.', syns: ['restrict','reduce','limit','diminish','cut back'], ants: ['expand','extend','increase','amplify'] },
  { word: 'magnate',     pos: 'noun', def: 'A wealthy and influential person, especially in business or industry; a powerful figure in a particular field.', ex: 'The media magnate controlled a dozen television channels and three major newspapers across the country.', syns: ['tycoon','mogul','baron','industrialist','plutocrat'], ants: ['pauper','commoner','nobody'] },
  { word: 'nepotism',    pos: 'noun', def: 'The practice of favoring relatives or close friends when giving jobs or other advantages, especially in a position of power.', ex: 'The minister was accused of nepotism after appointing his brother-in-law as the head of a government department.', syns: ['favoritism','cronyism','partisanship','bias'], ants: ['meritocracy','impartiality','fairness'] },
  { word: 'paternal',    pos: 'adjective', def: 'Of or relating to a father; showing fatherly protection, concern, or guidance; characteristic of a caring but controlling authority.', ex: 'The senator took a paternal interest in the welfare of his constituents, often personally attending to their grievances.', syns: ['fatherly','protective','paternalistic','patriarchal'], ants: ['maternal','filial','indifferent'] },
  { word: 'patriarch',   pos: 'noun', def: 'The male head of a family or tribe; a man who is the founder or dominant figure of a community or organization.', ex: 'As the family patriarch, his decisions on matters of property and marriage were considered final.', syns: ['elder','head','chief','founder','father figure'], ants: ['matriarch','subordinate'] },
  { word: 'peremptory',  pos: 'adjective', def: 'Insisting on immediate attention or obedience in a brusquely imperious way; not allowing contradiction or refusal.', ex: 'Her peremptory tone when addressing the staff made it clear that she expected immediate and unquestioning compliance.', syns: ['imperious','commanding','dictatorial','high-handed','authoritative'], ants: ['respectful','humble','tentative','polite'] },
  { word: 'perquisite',  pos: 'noun', def: 'A benefit or privilege granted to an employee in addition to their salary; something regarded as a special right attached to a position.', ex: 'The company car and private club membership were considered perquisites of the senior executive position.', syns: ['perk','privilege','benefit','bonus','entitlement'], ants: ['penalty','obligation','liability'] },
  { word: 'prerogative', pos: 'noun', def: 'A right or privilege exclusive to a particular individual or class; a special power or authority.', ex: "Setting the school examination schedule is the prerogative of the principal, not the teaching staff.", syns: ['right','privilege','entitlement','authority','power'], ants: ['obligation','duty','restriction','prohibition'] },
  { word: 'surrogate',   pos: 'noun', def: 'A person or thing that acts as a substitute for another; a deputy or replacement serving in place of the original.', ex: 'The ambassador served as a surrogate for the head of state at the international summit on climate change.', syns: ['substitute','proxy','stand-in','replacement','deputy'], ants: ['original','principal','authentic'] },
  // Unit 10
  { word: 'affluent',    pos: 'adjective', def: 'Having a great deal of money and material wealth; prosperous and comfortable in financial terms.', ex: 'The affluent suburb was lined with luxury cars and perfectly manicured gardens behind high walls.', syns: ['wealthy','rich','prosperous','well-off','moneyed'], ants: ['poor','destitute','impoverished','indigent'] },
  { word: 'amenity',     pos: 'noun', def: 'A desirable or useful feature or facility that adds comfort or convenience to a place; a pleasant or agreeable aspect.', ex: 'The luxury hotel boasted every possible amenity, from a rooftop pool to a personalised butler service.', syns: ['facility','comfort','convenience','benefit','feature'], ants: ['hardship','discomfort','inconvenience'] },
  { word: 'culinary',    pos: 'adjective', def: 'Of or relating to cooking, food preparation, or the kitchen; pertaining to the art or practice of cookery.', ex: 'She enrolled in a prestigious culinary school in Paris to master the art of classical French cuisine.', syns: ['gastronomic','epicurean','gourmet','food-related'], ants: ['inedible','unrefined'] },
  { word: 'decadent',    pos: 'adjective', def: 'Luxuriously self-indulgent; characterized by moral or cultural decline through excessive pleasure-seeking.', ex: 'The decadent lifestyle of the elite stood in stark contrast to the grinding poverty outside their gated estates.', syns: ['self-indulgent','dissolute','debauched','corrupt','indulgent'], ants: ['austere','ascetic','modest','frugal','self-restrained'] },
  { word: 'flaunt',      pos: 'verb', def: 'To display something ostentatiously, especially wealth or possessions, in order to attract attention or provoke envy.', ex: 'He flaunted his newly acquired wealth by arriving at every social event in a different imported sports car.', syns: ['show off','display','parade','exhibit','boast'], ants: ['conceal','hide','downplay','suppress'] },
  { word: 'grandiose',   pos: 'adjective', def: 'Extravagantly large, ambitious, or impressive; seemingly impressive but in a way that is excessive or absurd.', ex: "The politician's grandiose promises of overnight economic transformation far exceeded what was realistically achievable.", syns: ['elaborate','pompous','ostentatious','magnificent','imposing'], ants: ['modest','humble','understated','plain'] },
  { word: 'munificent',  pos: 'adjective', def: 'Larger or more generous than is usual or necessary; characterised by lavish generosity.', ex: "The munificent philanthropist donated an entire wing to the children's hospital and funded twenty annual scholarships.", syns: ['generous','lavish','bountiful','charitable','beneficent'], ants: ['stingy','miserly','mean','niggardly','parsimonious'] },
  { word: 'opulent',     pos: 'adjective', def: 'Ostentatiously rich and luxurious; demonstrating wealth through lavish display of resources.', ex: 'The opulent ballroom was adorned with crystal chandeliers, gold-leaf ceilings, and imported marble floors.', syns: ['luxurious','lavish','sumptuous','palatial','magnificent'], ants: ['austere','spartan','modest','plain'] },
  { word: 'ostentatious',pos: 'adjective', def: 'Characterised by a vulgar or pretentious display of wealth and resources, primarily designed to impress or attract notice.', ex: 'Her ostentatious display of jewels and designer clothing at the charity gala drew equal parts admiration and contempt.', syns: ['showy','flamboyant','pretentious','extravagant','flashy'], ants: ['modest','humble','unpretentious','understated','restrained'] },
  { word: 'solvent',     pos: 'adjective', def: 'Having assets in excess of liabilities; financially stable and able to meet all monetary obligations.', ex: 'Despite the nationwide economic crisis, the company remained solvent by cutting costs and diversifying its revenue streams.', syns: ['financially stable','creditworthy','debt-free','prosperous'], ants: ['insolvent','bankrupt','indebted','broke'] },
  // Unit 11
  { word: 'abject',      pos: 'adjective', def: 'Experienced or present to the most extreme degree; utterly hopeless or degrading; completely without pride or dignity.', ex: 'The refugees lived in abject poverty, without clean water, adequate food, or any form of shelter.', syns: ['wretched','miserable','deplorable','degrading','pitiful'], ants: ['admirable','dignified','proud','exalted'] },
  { word: 'avarice',     pos: 'noun', def: 'Extreme greed for wealth or material gain; an insatiable desire to accumulate riches.', ex: 'His avarice eventually led him to embezzle funds from the very charity he had been entrusted to support.', syns: ['greed','covetousness','cupidity','rapacity','acquisitiveness'], ants: ['generosity','charity','benevolence','altruism'] },
  { word: 'covet',       pos: 'verb', def: "To yearn intensely to possess or have something belonging to another person; to desire enviously.", ex: "She had long coveted her colleague's prestigious position and spent years quietly scheming to acquire it.", syns: ['desire','envy','crave','long for','lust after'], ants: ['scorn','disdain','renounce','relinquish'] },
  { word: 'dearth',      pos: 'noun', def: 'A scarcity or insufficient quantity of something; a serious lack of a needed resource or supply.', ex: 'The remote districts suffered from a chronic dearth of qualified medical professionals and essential medicines.', syns: ['scarcity','shortage','lack','deficiency','paucity'], ants: ['abundance','plenty','surplus','excess'] },
  { word: 'glut',        pos: 'noun', def: 'An excessively abundant supply of something, typically more than the market or demand can absorb.', ex: 'A glut of cheap imports flooded the domestic market, devastating local manufacturers who could not compete on price.', syns: ['surplus','excess','oversupply','overabundance','surfeit'], ants: ['shortage','scarcity','dearth','deficit'] },
  { word: 'insatiable',  pos: 'adjective', def: 'Impossible to satisfy regardless of how much is given; having an unlimited or unquenchable desire.', ex: 'Her insatiable appetite for knowledge drove her to earn three degrees and read obsessively throughout her life.', syns: ['unquenchable','voracious','greedy','rapacious','relentless'], ants: ['satisfiable','content','moderate','sated'] },
  { word: 'mercenary',   pos: 'adjective', def: 'Primarily concerned with making money at the expense of ethics; motivated by financial gain above all other considerations.', ex: 'Critics accused the board of making mercenary decisions that prioritised short-term profit over employee welfare and safety.', syns: ['avaricious','greedy','venal','acquisitive','money-grubbing'], ants: ['altruistic','selfless','charitable','idealistic'] },
  { word: 'paucity',     pos: 'noun', def: 'The presence of something only in small or insufficient quantities; a serious scarcity of what is needed.', ex: 'The paucity of clean drinking water in the affected region made the drought crisis far more severe than anticipated.', syns: ['scarcity','shortage','dearth','lack','insufficiency'], ants: ['abundance','surplus','plenty','wealth'] },
  { word: 'rapacious',   pos: 'adjective', def: 'Aggressively greedy or grasping; plundering and seizing by force; voraciously acquisitive.', ex: 'The rapacious corporation stripped the region of its natural resources and departed without any environmental restoration.', syns: ['greedy','avaricious','plundering','predatory','voracious'], ants: ['generous','selfless','content','satisfied'] },
  { word: 'squander',    pos: 'verb', def: 'To waste money, time, or resources in a reckless or foolish manner; to allow something valuable to be lost through neglect.', ex: 'He squandered his entire inheritance on luxury goods and gambling within two years of receiving it.', syns: ['waste','fritter away','dissipate','lavish','throw away'], ants: ['save','conserve','preserve','accumulate'] },
  // Unit 12
  { word: 'abysmal',     pos: 'adjective', def: 'Extremely bad or appalling; so deep or severe as to seem immeasurably hopeless or terrible.', ex: 'The flood survivors were forced to endure abysmal conditions in the overcrowded and undersupplied relief shelter.', syns: ['terrible','dreadful','appalling','dire','atrocious'], ants: ['excellent','outstanding','superb','wonderful'] },
  { word: 'destitute',   pos: 'adjective', def: 'Without the basic necessities of life; in a state of extreme poverty with no financial resources whatsoever.', ex: 'The floods left thousands of families destitute overnight, stripping them of their homes, livestock, and savings.', syns: ['impoverished','poverty-stricken','penniless','indigent','bankrupt'], ants: ['wealthy','affluent','prosperous','comfortable'] },
  { word: 'indigent',    pos: 'adjective', def: 'Poor and needy; lacking the basic necessities of life; in a condition of extreme financial want.', ex: 'Free medical care was provided specifically to the indigent residents of the disaster-affected villages.', syns: ['destitute','impoverished','poverty-stricken','needy','penurious'], ants: ['wealthy','affluent','prosperous','comfortable'] },
  { word: 'mendicant',   pos: 'noun', def: 'A person who lives by begging; one who depends entirely on charity or alms for survival.', ex: 'After the floods, former landowners were reduced to mendicants, extending their hands at relief camps for daily rations.', syns: ['beggar','pauper','vagrant','supplicant','almsman'], ants: ['benefactor','donor','philanthropist','provider'] },
  { word: 'paltry',      pos: 'adjective', def: 'Contemptibly small or inadequate in amount; trivial and of little value or significance.', ex: 'The government offered a paltry sum in compensation to the thousands of families displaced by the devastating floods.', syns: ['meager','pitiful','trifling','negligible','inadequate'], ants: ['substantial','considerable','generous','ample'] },
  { word: 'sordid',      pos: 'adjective', def: 'Involving immoral or dishonest activities; dirty, filthy, or wretched in condition; ignoble in nature.', ex: "The sordid conditions of the temporary flood shelters were a stain on the government's relief response.", syns: ['wretched','squalid','dirty','filthy','vile'], ants: ['noble','clean','reputable','honourable','dignified'] },
  { word: 'squalor',     pos: 'noun', def: 'A state of being extremely dirty and unpleasant, especially as a result of poverty or neglect; filth and wretchedness.', ex: 'Displaced families lived in absolute squalor in makeshift tents along the flooded riverbank for weeks without aid.', syns: ['filth','wretchedness','sordidness','griminess','degradation'], ants: ['cleanliness','luxury','comfort','purity'] },
].map(w => ({ ...w, key: w.word.toLowerCase() }));

// ─── Source 3: Units 22–77 from Task Manager .tex files ──────────────────────

function parseTaskManagerUnits() {
  const dir = 'D:/Downloads/Task Manager';
  const words = [];
  const files = fs.readdirSync(dir).filter(f => /^unit_\d+_.*\.tex$/.test(f)).sort();
  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    const parsed  = parseTexChunk(content);
    words.push(...parsed);
  }
  return words;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🔍 Force-resyncing all words from source files...\n');

  // Build master source map: key (lowercase word) → source data
  // Later sources overwrite earlier ones if same word appears twice
  const sourceMap = new Map();

  const wordsmart = parseWordsmart();
  console.log(`  Parsed ${wordsmart.length} words from wordsmart_unit01.tex (units 1–8)`);
  for (const w of wordsmart) sourceMap.set(w.key, w);

  for (const w of UNITS_9_12) sourceMap.set(w.key, w);
  console.log(`  Loaded ${UNITS_9_12.length} words from embedded units 9–12`);

  const taskManager = parseTaskManagerUnits();
  console.log(`  Parsed ${taskManager.length} words from Task Manager .tex files (units 22–77)`);
  for (const w of taskManager) sourceMap.set(w.key, w);

  console.log(`\n  Total source words: ${sourceMap.size}\n`);

  // Fetch ALL words from DB
  const dbRows = await client.execute('SELECT id, word, definition FROM vocab_words');
  console.log(`  DB contains ${dbRows.rows.length} words total\n`);

  let updated = 0;
  let skipped = 0;
  let notInSource = 0;

  for (const row of dbRows.rows) {
    const id  = Number(row[0] ?? row.id);
    const dbWord = String(row[1] ?? row.word);
    const dbDef  = String(row[2] ?? row.definition);
    const key = dbWord.toLowerCase();

    const src = sourceMap.get(key);
    if (!src) {
      notInSource++;
      continue;
    }

    // Force update regardless of current definition
    await client.execute({
      sql:  'UPDATE vocab_words SET definition=?, example_sentence=?, part_of_speech=?, synonyms=?, antonyms=? WHERE id=?',
      args: [src.def, src.ex, src.pos, JSON.stringify(src.syns), JSON.stringify(src.ants), id],
    });

    const wasGemini = !dbDef.startsWith(src.def.slice(0, 30));
    console.log(`  ${wasGemini ? '🔄 FIXED' : '✓ sync'} ${dbWord}`);
    if (wasGemini) updated++;
    else skipped++;
  }

  console.log('\n─────────────────────────────────────────────────────');
  console.log(`  Updated (was different): ${updated}`);
  console.log(`  Already matched source:  ${skipped}`);
  console.log(`  Not in source (units 13–21 or extra): ${notInSource}`);
  console.log('─────────────────────────────────────────────────────\n');

  await client.close();
  console.log('Done.\n');
}

main().catch(err => { console.error(err); process.exit(1); });
