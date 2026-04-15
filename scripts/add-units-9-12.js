#!/usr/bin/env node
/**
 * Add Units 9–12 vocabulary words to Turso.
 * Units: Governance & Privilege, Wealth & Opulence, Greed & Poverty, Destitution
 * Total: 39 words across 4 units
 * Safe to re-run: checks existence before inserting.
 */
const { createClient } = require('@libsql/client');
const fs   = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...rest] = trimmed.split('=');
        if (key && rest.length > 0)
          process.env[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
      }
    });
  }
}

loadEnv();

// ─── Word Data ────────────────────────────────────────────────────────────────

const UNITS = [
  {
    order: 9,
    name: 'Governance, Privilege & State Apparatus',
    description: 'Words relating to power structures, authority, and privilege in governance',
    themes: [
      {
        name: 'Governance, Privilege & State Apparatus',
        order: 1,
        words: [
          {
            word: 'appropriate',
            partOfSpeech: 'verb',
            definition: 'To take something for one\'s own use, typically without the owner\'s permission; to officially allocate money or resources for a specific purpose.',
            synonyms: ['commandeer', 'seize', 'allocate', 'earmark'],
            antonyms: ['relinquish', 'surrender', 'return'],
            exampleSentence: 'The government appropriated private land for the new highway project without offering fair compensation.',
            difficultyBase: 3,
          },
          {
            word: 'autonomous',
            partOfSpeech: 'adjective',
            definition: 'Having the freedom to act independently; self-governing; not controlled by others.',
            synonyms: ['independent', 'self-governing', 'sovereign', 'self-sufficient'],
            antonyms: ['dependent', 'controlled', 'subservient'],
            exampleSentence: 'The regional council was granted autonomous authority to manage its own budget without central oversight.',
            difficultyBase: 3,
          },
          {
            word: 'bureaucracy',
            partOfSpeech: 'noun',
            definition: 'A system of government or management with complex rules and processes; excessive official paperwork and regulation.',
            synonyms: ['administration', 'officialdom', 'red tape', 'apparatus'],
            antonyms: ['efficiency', 'simplicity', 'directness'],
            exampleSentence: 'The entrepreneur was frustrated by the layers of bureaucracy required to register a new business.',
            difficultyBase: 3,
          },
          {
            word: 'curtail',
            partOfSpeech: 'verb',
            definition: 'To reduce or limit something; to impose a restriction that cuts something short.',
            synonyms: ['restrict', 'reduce', 'limit', 'diminish', 'cut back'],
            antonyms: ['expand', 'extend', 'increase', 'amplify'],
            exampleSentence: 'The government curtailed civil liberties during the period of national emergency.',
            difficultyBase: 3,
          },
          {
            word: 'magnate',
            partOfSpeech: 'noun',
            definition: 'A wealthy and influential person, especially in business or industry; a powerful figure in a particular field.',
            synonyms: ['tycoon', 'mogul', 'baron', 'industrialist', 'plutocrat'],
            antonyms: ['pauper', 'commoner', 'nobody'],
            exampleSentence: 'The media magnate controlled a dozen television channels and three major newspapers across the country.',
            difficultyBase: 3,
          },
          {
            word: 'nepotism',
            partOfSpeech: 'noun',
            definition: 'The practice of favoring relatives or close friends when giving jobs or other advantages, especially in a position of power.',
            synonyms: ['favoritism', 'cronyism', 'partisanship', 'bias'],
            antonyms: ['meritocracy', 'impartiality', 'fairness'],
            exampleSentence: 'The minister was accused of nepotism after appointing his brother-in-law as the head of a government department.',
            difficultyBase: 4,
          },
          {
            word: 'paternal',
            partOfSpeech: 'adjective',
            definition: 'Of or relating to a father; showing fatherly protection, concern, or guidance; characteristic of a caring but controlling authority.',
            synonyms: ['fatherly', 'protective', 'paternalistic', 'patriarchal'],
            antonyms: ['maternal', 'filial', 'indifferent'],
            exampleSentence: 'The senator took a paternal interest in the welfare of his constituents, often personally attending to their grievances.',
            difficultyBase: 3,
          },
          {
            word: 'patriarch',
            partOfSpeech: 'noun',
            definition: 'The male head of a family or tribe; a man who is the founder or dominant figure of a community or organization.',
            synonyms: ['elder', 'head', 'chief', 'founder', 'father figure'],
            antonyms: ['matriarch', 'subordinate'],
            exampleSentence: 'As the family patriarch, his decisions on matters of property and marriage were considered final.',
            difficultyBase: 3,
          },
          {
            word: 'peremptory',
            partOfSpeech: 'adjective',
            definition: 'Insisting on immediate attention or obedience in a brusquely imperious way; not allowing contradiction or refusal.',
            synonyms: ['imperious', 'commanding', 'dictatorial', 'high-handed', 'authoritative'],
            antonyms: ['respectful', 'humble', 'tentative', 'polite'],
            exampleSentence: 'Her peremptory tone when addressing the staff made it clear that she expected immediate and unquestioning compliance.',
            difficultyBase: 4,
          },
          {
            word: 'perquisite',
            partOfSpeech: 'noun',
            definition: 'A benefit or privilege granted to an employee in addition to their salary; something regarded as a special right attached to a position.',
            synonyms: ['perk', 'privilege', 'benefit', 'bonus', 'entitlement'],
            antonyms: ['penalty', 'obligation', 'liability'],
            exampleSentence: 'The company car and private club membership were considered perquisites of the senior executive position.',
            difficultyBase: 4,
          },
          {
            word: 'prerogative',
            partOfSpeech: 'noun',
            definition: 'A right or privilege exclusive to a particular individual or class; a special power or authority.',
            synonyms: ['right', 'privilege', 'entitlement', 'authority', 'power'],
            antonyms: ['obligation', 'duty', 'restriction', 'prohibition'],
            exampleSentence: 'Setting the school examination schedule is the prerogative of the principal, not the teaching staff.',
            difficultyBase: 3,
          },
          {
            word: 'surrogate',
            partOfSpeech: 'noun',
            definition: 'A person or thing that acts as a substitute for another; a deputy or replacement serving in place of the original.',
            synonyms: ['substitute', 'proxy', 'stand-in', 'replacement', 'deputy'],
            antonyms: ['original', 'principal', 'authentic'],
            exampleSentence: 'The ambassador served as a surrogate for the head of state at the international summit on climate change.',
            difficultyBase: 3,
          },
        ],
      },
    ],
  },

  {
    order: 10,
    name: 'Wealth, Opulence & Conspicuous Display',
    description: 'Words relating to wealth, luxury, and the ostentatious display of material abundance',
    themes: [
      {
        name: 'Wealth, Opulence & Conspicuous Display',
        order: 1,
        words: [
          {
            word: 'affluent',
            partOfSpeech: 'adjective',
            definition: 'Having a great deal of money and material wealth; prosperous and comfortable in financial terms.',
            synonyms: ['wealthy', 'rich', 'prosperous', 'well-off', 'moneyed'],
            antonyms: ['poor', 'destitute', 'impoverished', 'indigent'],
            exampleSentence: 'The affluent suburb was lined with luxury cars and perfectly manicured gardens behind high walls.',
            difficultyBase: 3,
          },
          {
            word: 'amenity',
            partOfSpeech: 'noun',
            definition: 'A desirable or useful feature or facility that adds comfort or convenience to a place; a pleasant or agreeable aspect.',
            synonyms: ['facility', 'comfort', 'convenience', 'benefit', 'feature'],
            antonyms: ['hardship', 'discomfort', 'inconvenience'],
            exampleSentence: 'The luxury hotel boasted every possible amenity, from a rooftop pool to a personalised butler service.',
            difficultyBase: 3,
          },
          {
            word: 'culinary',
            partOfSpeech: 'adjective',
            definition: 'Of or relating to cooking, food preparation, or the kitchen; pertaining to the art or practice of cookery.',
            synonyms: ['gastronomic', 'epicurean', 'gourmet', 'food-related'],
            antonyms: ['inedible', 'unrefined'],
            exampleSentence: 'She enrolled in a prestigious culinary school in Paris to master the art of classical French cuisine.',
            difficultyBase: 3,
          },
          {
            word: 'decadent',
            partOfSpeech: 'adjective',
            definition: 'Luxuriously self-indulgent; characterized by moral or cultural decline through excessive pleasure-seeking.',
            synonyms: ['self-indulgent', 'dissolute', 'debauched', 'corrupt', 'indulgent'],
            antonyms: ['austere', 'ascetic', 'modest', 'frugal', 'self-restrained'],
            exampleSentence: 'The decadent lifestyle of the elite stood in stark contrast to the grinding poverty outside their gated estates.',
            difficultyBase: 3,
          },
          {
            word: 'flaunt',
            partOfSpeech: 'verb',
            definition: 'To display something ostentatiously, especially wealth or possessions, in order to attract attention or provoke envy.',
            synonyms: ['show off', 'display', 'parade', 'exhibit', 'boast'],
            antonyms: ['conceal', 'hide', 'downplay', 'suppress'],
            exampleSentence: 'He flaunted his newly acquired wealth by arriving at every social event in a different imported sports car.',
            difficultyBase: 3,
          },
          {
            word: 'grandiose',
            partOfSpeech: 'adjective',
            definition: 'Extravagantly large, ambitious, or impressive; seemingly impressive but in a way that is excessive or absurd.',
            synonyms: ['elaborate', 'pompous', 'ostentatious', 'magnificent', 'imposing'],
            antonyms: ['modest', 'humble', 'understated', 'plain'],
            exampleSentence: 'The politician\'s grandiose promises of overnight economic transformation far exceeded what was realistically achievable.',
            difficultyBase: 3,
          },
          {
            word: 'munificent',
            partOfSpeech: 'adjective',
            definition: 'Larger or more generous than is usual or necessary; characterised by lavish generosity.',
            synonyms: ['generous', 'lavish', 'bountiful', 'charitable', 'beneficent'],
            antonyms: ['stingy', 'miserly', 'mean', 'niggardly', 'parsimonious'],
            exampleSentence: 'The munificent philanthropist donated an entire wing to the children\'s hospital and funded twenty annual scholarships.',
            difficultyBase: 4,
          },
          {
            word: 'opulent',
            partOfSpeech: 'adjective',
            definition: 'Ostentatiously rich and luxurious; demonstrating wealth through lavish display of resources.',
            synonyms: ['luxurious', 'lavish', 'sumptuous', 'palatial', 'magnificent'],
            antonyms: ['austere', 'spartan', 'modest', 'plain'],
            exampleSentence: 'The opulent ballroom was adorned with crystal chandeliers, gold-leaf ceilings, and imported marble floors.',
            difficultyBase: 3,
          },
          {
            word: 'ostentatious',
            partOfSpeech: 'adjective',
            definition: 'Characterised by a vulgar or pretentious display of wealth and resources, primarily designed to impress or attract notice.',
            synonyms: ['showy', 'flamboyant', 'pretentious', 'extravagant', 'flashy'],
            antonyms: ['modest', 'humble', 'unpretentious', 'understated', 'restrained'],
            exampleSentence: 'Her ostentatious display of jewels and designer clothing at the charity gala drew equal parts admiration and contempt.',
            difficultyBase: 4,
          },
          {
            word: 'solvent',
            partOfSpeech: 'adjective',
            definition: 'Having assets in excess of liabilities; financially stable and able to meet all monetary obligations.',
            synonyms: ['financially stable', 'creditworthy', 'debt-free', 'prosperous'],
            antonyms: ['insolvent', 'bankrupt', 'indebted', 'broke'],
            exampleSentence: 'Despite the nationwide economic crisis, the company remained solvent by cutting costs and diversifying its revenue streams.',
            difficultyBase: 3,
          },
        ],
      },
    ],
  },

  {
    order: 11,
    name: 'Greed, Poverty & Material Extremes',
    description: 'Words exploring greed, deprivation, scarcity, and the extremes of material circumstance',
    themes: [
      {
        name: 'Greed, Poverty & Material Extremes',
        order: 1,
        words: [
          {
            word: 'abject',
            partOfSpeech: 'adjective',
            definition: 'Experienced or present to the most extreme degree; utterly hopeless or degrading; completely without pride or dignity.',
            synonyms: ['wretched', 'miserable', 'deplorable', 'degrading', 'pitiful'],
            antonyms: ['admirable', 'dignified', 'proud', 'exalted'],
            exampleSentence: 'The refugees lived in abject poverty, without clean water, adequate food, or any form of shelter.',
            difficultyBase: 3,
          },
          {
            word: 'avarice',
            partOfSpeech: 'noun',
            definition: 'Extreme greed for wealth or material gain; an insatiable desire to accumulate riches.',
            synonyms: ['greed', 'covetousness', 'cupidity', 'rapacity', 'acquisitiveness'],
            antonyms: ['generosity', 'charity', 'benevolence', 'altruism'],
            exampleSentence: 'His avarice eventually led him to embezzle funds from the very charity he had been entrusted to support.',
            difficultyBase: 4,
          },
          {
            word: 'covet',
            partOfSpeech: 'verb',
            definition: 'To yearn intensely to possess or have something belonging to another person; to desire enviously.',
            synonyms: ['desire', 'envy', 'crave', 'long for', 'lust after'],
            antonyms: ['scorn', 'disdain', 'renounce', 'relinquish'],
            exampleSentence: 'She had long coveted her colleague\'s prestigious position and spent years quietly scheming to acquire it.',
            difficultyBase: 3,
          },
          {
            word: 'dearth',
            partOfSpeech: 'noun',
            definition: 'A scarcity or insufficient quantity of something; a serious lack of a needed resource or supply.',
            synonyms: ['scarcity', 'shortage', 'lack', 'deficiency', 'paucity'],
            antonyms: ['abundance', 'plenty', 'surplus', 'excess'],
            exampleSentence: 'The remote districts suffered from a chronic dearth of qualified medical professionals and essential medicines.',
            difficultyBase: 3,
          },
          {
            word: 'glut',
            partOfSpeech: 'noun',
            definition: 'An excessively abundant supply of something, typically more than the market or demand can absorb.',
            synonyms: ['surplus', 'excess', 'oversupply', 'overabundance', 'surfeit'],
            antonyms: ['shortage', 'scarcity', 'dearth', 'deficit'],
            exampleSentence: 'A glut of cheap imports flooded the domestic market, devastating local manufacturers who could not compete on price.',
            difficultyBase: 3,
          },
          {
            word: 'insatiable',
            partOfSpeech: 'adjective',
            definition: 'Impossible to satisfy regardless of how much is given; having an unlimited or unquenchable desire.',
            synonyms: ['unquenchable', 'voracious', 'greedy', 'rapacious', 'relentless'],
            antonyms: ['satisfiable', 'content', 'moderate', 'sated'],
            exampleSentence: 'Her insatiable appetite for knowledge drove her to earn three degrees and read obsessively throughout her life.',
            difficultyBase: 3,
          },
          {
            word: 'mercenary',
            partOfSpeech: 'adjective',
            definition: 'Primarily concerned with making money at the expense of ethics; motivated by financial gain above all other considerations.',
            synonyms: ['avaricious', 'greedy', 'venal', 'acquisitive', 'money-grubbing'],
            antonyms: ['altruistic', 'selfless', 'charitable', 'idealistic'],
            exampleSentence: 'Critics accused the board of making mercenary decisions that prioritised short-term profit over employee welfare and safety.',
            difficultyBase: 3,
          },
          {
            word: 'paucity',
            partOfSpeech: 'noun',
            definition: 'The presence of something only in small or insufficient quantities; a serious scarcity of what is needed.',
            synonyms: ['scarcity', 'shortage', 'dearth', 'lack', 'insufficiency'],
            antonyms: ['abundance', 'surplus', 'plenty', 'wealth'],
            exampleSentence: 'The paucity of clean drinking water in the affected region made the drought crisis far more severe than anticipated.',
            difficultyBase: 4,
          },
          {
            word: 'rapacious',
            partOfSpeech: 'adjective',
            definition: 'Aggressively greedy or grasping; plundering and seizing by force; voraciously acquisitive.',
            synonyms: ['greedy', 'avaricious', 'plundering', 'predatory', 'voracious'],
            antonyms: ['generous', 'selfless', 'content', 'satisfied'],
            exampleSentence: 'The rapacious corporation stripped the region of its natural resources and departed without any environmental restoration.',
            difficultyBase: 4,
          },
          {
            word: 'squander',
            partOfSpeech: 'verb',
            definition: 'To waste money, time, or resources in a reckless or foolish manner; to allow something valuable to be lost through neglect.',
            synonyms: ['waste', 'fritter away', 'dissipate', 'lavish', 'throw away'],
            antonyms: ['save', 'conserve', 'preserve', 'accumulate'],
            exampleSentence: 'He squandered his entire inheritance on luxury goods and gambling within two years of receiving it.',
            difficultyBase: 3,
          },
        ],
      },
    ],
  },

  {
    order: 12,
    name: 'Flood Survivors Sleeping in Shelters With Nothing Left',
    description: 'Words describing extreme destitution, squalor, and the lowest depths of human material deprivation',
    themes: [
      {
        name: 'Flood Survivors Sleeping in Shelters With Nothing Left',
        order: 1,
        words: [
          {
            word: 'abysmal',
            partOfSpeech: 'adjective',
            definition: 'Extremely bad or appalling; so deep or severe as to seem immeasurably hopeless or terrible.',
            synonyms: ['terrible', 'dreadful', 'appalling', 'dire', 'atrocious'],
            antonyms: ['excellent', 'outstanding', 'superb', 'wonderful'],
            exampleSentence: 'The flood survivors were forced to endure abysmal conditions in the overcrowded and undersupplied relief shelter.',
            difficultyBase: 3,
          },
          {
            word: 'destitute',
            partOfSpeech: 'adjective',
            definition: 'Without the basic necessities of life; in a state of extreme poverty with no financial resources whatsoever.',
            synonyms: ['impoverished', 'poverty-stricken', 'penniless', 'indigent', 'bankrupt'],
            antonyms: ['wealthy', 'affluent', 'prosperous', 'comfortable'],
            exampleSentence: 'The floods left thousands of families destitute overnight, stripping them of their homes, livestock, and savings.',
            difficultyBase: 3,
          },
          {
            word: 'indigent',
            partOfSpeech: 'adjective',
            definition: 'Poor and needy; lacking the basic necessities of life; in a condition of extreme financial want.',
            synonyms: ['destitute', 'impoverished', 'poverty-stricken', 'needy', 'penurious'],
            antonyms: ['wealthy', 'affluent', 'prosperous', 'comfortable'],
            exampleSentence: 'Free medical care was provided specifically to the indigent residents of the disaster-affected villages.',
            difficultyBase: 4,
          },
          {
            word: 'mendicant',
            partOfSpeech: 'noun',
            definition: 'A person who lives by begging; one who depends entirely on charity or alms for survival.',
            synonyms: ['beggar', 'pauper', 'vagrant', 'supplicant', 'almsman'],
            antonyms: ['benefactor', 'donor', 'philanthropist', 'provider'],
            exampleSentence: 'After the floods, former landowners were reduced to mendicants, extending their hands at relief camps for daily rations.',
            difficultyBase: 4,
          },
          {
            word: 'paltry',
            partOfSpeech: 'adjective',
            definition: 'Contemptibly small or inadequate in amount; trivial and of little value or significance.',
            synonyms: ['meager', 'pitiful', 'trifling', 'negligible', 'inadequate'],
            antonyms: ['substantial', 'considerable', 'generous', 'ample'],
            exampleSentence: 'The government offered a paltry sum in compensation to the thousands of families displaced by the devastating floods.',
            difficultyBase: 3,
          },
          {
            word: 'sordid',
            partOfSpeech: 'adjective',
            definition: 'Involving immoral or dishonest activities; dirty, filthy, or wretched in condition; ignoble in nature.',
            synonyms: ['wretched', 'squalid', 'dirty', 'filthy', 'vile'],
            antonyms: ['noble', 'clean', 'reputable', 'honourable', 'dignified'],
            exampleSentence: 'The sordid conditions of the temporary flood shelters were a stain on the government\'s relief response.',
            difficultyBase: 3,
          },
          {
            word: 'squalor',
            partOfSpeech: 'noun',
            definition: 'A state of being extremely dirty and unpleasant, especially as a result of poverty or neglect; filth and wretchedness.',
            synonyms: ['filth', 'wretchedness', 'sordidness', 'griminess', 'degradation'],
            antonyms: ['cleanliness', 'luxury', 'comfort', 'purity'],
            exampleSentence: 'Displaced families lived in absolute squalor in makeshift tents along the flooded riverbank for weeks without aid.',
            difficultyBase: 3,
          },
        ],
      },
    ],
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const client = createClient({
    url:       process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  console.log('\n📚 Adding Units 9–12 to LexiCore...\n');

  let totalAdded = 0;
  let totalSkipped = 0;

  for (const unitData of UNITS) {
    console.log(`\n── Unit ${unitData.order}: ${unitData.name} ──`);

    // Check if unit exists
    const existingUnit = await client.execute({
      sql:  'SELECT id FROM vocab_units WHERE "order" = ?',
      args: [unitData.order],
    });

    let unitId;
    if (existingUnit.rows.length > 0) {
      unitId = Number(existingUnit.rows[0][0]);
      console.log(`  ✓ Unit already exists (id=${unitId})`);
    } else {
      const res = await client.execute({
        sql:  'INSERT INTO vocab_units (name, description, "order") VALUES (?, ?, ?) RETURNING id',
        args: [unitData.name, unitData.description, unitData.order],
      });
      unitId = Number(res.rows[0][0]);
      console.log(`  ✅ Created unit (id=${unitId})`);
    }

    for (const themeData of unitData.themes) {
      // Check if theme exists
      const existingTheme = await client.execute({
        sql:  'SELECT id FROM vocab_themes WHERE unit_id = ? AND name = ?',
        args: [unitId, themeData.name],
      });

      let themeId;
      if (existingTheme.rows.length > 0) {
        themeId = Number(existingTheme.rows[0][0]);
        console.log(`  ✓ Theme already exists (id=${themeId})`);
      } else {
        const res = await client.execute({
          sql:  'INSERT INTO vocab_themes (unit_id, name, "order") VALUES (?, ?, ?) RETURNING id',
          args: [unitId, themeData.name, themeData.order],
        });
        themeId = Number(res.rows[0][0]);
        console.log(`  ✅ Created theme: "${themeData.name}" (id=${themeId})`);
      }

      for (const word of themeData.words) {
        // Check if word exists
        const existingWord = await client.execute({
          sql:  'SELECT id FROM vocab_words WHERE theme_id = ? AND word = ?',
          args: [themeId, word.word],
        });

        if (existingWord.rows.length > 0) {
          console.log(`     ✓ ${word.word}`);
          totalSkipped++;
        } else {
          await client.execute({
            sql: `INSERT INTO vocab_words
                    (theme_id, unit_id, word, definition, synonyms, antonyms,
                     example_sentence, part_of_speech, difficulty_base)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
              themeId,
              unitId,
              word.word,
              word.definition,
              JSON.stringify(word.synonyms),
              JSON.stringify(word.antonyms),
              word.exampleSentence,
              word.partOfSpeech,
              word.difficultyBase,
            ],
          });
          console.log(`     ✅ ${word.word}`);
          totalAdded++;
        }
      }
    }
  }

  // Summary
  console.log('\n─────────────────────────────────');
  console.log(`✨ Done! Added: ${totalAdded} words, Skipped: ${totalSkipped} (already existed)`);
  console.log('─────────────────────────────────\n');

  // Final count
  const count = await client.execute('SELECT COUNT(*) FROM vocab_words');
  console.log(`📊 Total words in DB: ${count.rows[0][0]}\n`);

  await client.close();
}

main().catch(err => { console.error(err); process.exit(1); });
