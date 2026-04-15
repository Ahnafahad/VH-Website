/**
 * Full vocab seed — restores 26 broad units + 77 themes + all available words.
 *
 * Sources:
 *   Units 1–8   → D:/Downloads/wordsmart_unit01.tex
 *   Units 9–12  → embedded below (from add-units-9-12.js)
 *   Units 13–21 → no .tex files yet; themes created empty
 *   Units 22–77 → D:/Downloads/Task Manager/unit_NN_*.tex
 *
 * Safe: never DELETEs anything. Only inserts rows that don't exist yet.
 * Run: node --env-file=.env.local scripts/seed-vocab-full.js
 */

'use strict';

const { createClient } = require('@libsql/client');
const fs   = require('fs');
const path = require('path');

const WORDSMART_FILE = 'D:\\Downloads\\wordsmart_unit01.tex';
const TASK_MGR_DIR  = 'D:\\Downloads\\Task Manager';

// ─── Broad Units (26) ──────────────────────────────────────────────────────

const BROAD_UNITS = [
  { order: 1,  name: 'Power, Hierarchy & Legitimacy' },
  { order: 2,  name: 'Dissent, Ideology & Conspiracy' },
  { order: 3,  name: 'Public Judgment, Flattery & Governance' },
  { order: 4,  name: 'Wealth, Greed & Deprivation' },
  { order: 5,  name: 'Generosity & Restraint' },
  { order: 6,  name: 'Deception, Evasion & Honesty' },
  { order: 7,  name: 'Hypocrisy, Doubt & Mockery' },
  { order: 8,  name: 'Law, Justice & Intellectual Precision' },
  { order: 9,  name: 'Moral Failure, Guilt & Rebuke' },
  { order: 10, name: 'Virtue, Resolve & Arrogance' },
  { order: 11, name: 'Temperament, Withdrawal & Warmth' },
  { order: 12, name: 'Community, Intelligence & Pedantry' },
  { order: 13, name: 'Grief, Joy & Hostility' },
  { order: 14, name: 'Apathy, Stagnation & Inward Shame' },
  { order: 15, name: 'Individuality, Skepticism & Reasoning' },
  { order: 16, name: 'Flawed Logic, Guiding Ideas & Hidden Knowledge' },
  { order: 17, name: 'Investigation, Perception & Abstract Thought' },
  { order: 18, name: 'Belief, Secularism & Performative Language' },
  { order: 19, name: 'Persuasion, Figurative Language & Moral Instruction' },
  { order: 20, name: 'Argument, Calming & Reconciliation' },
  { order: 21, name: 'Culture, Praise & Rural Life' },
  { order: 22, name: 'Exclusion, Growth & Scale' },
  { order: 23, name: 'Ubiquity, Causation & Consequences' },
  { order: 24, name: 'Time, Struggle & Transcendence' },
  { order: 25, name: 'Illness, Action & Exceptional Figures' },
  { order: 26, name: 'Limits, Measurement & Conflict' },
];

// ─── Theme definitions (77) ────────────────────────────────────────────────
// source: 'wordsmart' | 'embedded' | 'taskman' | 'none'

const THEMES = [
  { order:  1, broadOrder: 1,  name: 'Authoritarian Rule & Coercion',               source: 'wordsmart' },
  { order:  2, broadOrder: 1,  name: 'Social Hierarchy & Class Distinction',         source: 'wordsmart' },
  { order:  3, broadOrder: 1,  name: 'Seizing & Legitimizing Power',                source: 'wordsmart' },
  { order:  4, broadOrder: 2,  name: 'Rebellion, Subversion & Sedition',            source: 'wordsmart' },
  { order:  5, broadOrder: 2,  name: 'Ideology & Political Doctrine',               source: 'wordsmart' },
  { order:  6, broadOrder: 2,  name: 'Secrecy, Conspiracy & Hidden Agendas',        source: 'wordsmart' },
  { order:  7, broadOrder: 3,  name: 'Stripped of Honors Before the Nation',        source: 'wordsmart' },
  { order:  8, broadOrder: 3,  name: 'Sycophancy, Flattery & Servility',            source: 'wordsmart' },
  { order:  9, broadOrder: 3,  name: 'Governance, Privilege & State Apparatus',     source: 'embedded' },
  { order: 10, broadOrder: 4,  name: 'Wealth, Opulence & Conspicuous Display',      source: 'embedded' },
  { order: 11, broadOrder: 4,  name: 'Greed, Poverty & Material Extremes',          source: 'embedded' },
  { order: 12, broadOrder: 4,  name: 'Flood Survivors Sleeping in Shelters',        source: 'embedded' },
  { order: 13, broadOrder: 5,  name: 'Generosity, Philanthropy & Magnanimity',      source: 'none' },
  { order: 14, broadOrder: 5,  name: 'Frugality, Austerity & Self-Denial',          source: 'none' },
  { order: 15, broadOrder: 6,  name: 'Deception, Guile & Fraud',                   source: 'none' },
  { order: 16, broadOrder: 6,  name: 'Evasion, Ambiguity & Misdirection',           source: 'none' },
  { order: 17, broadOrder: 6,  name: 'Honesty, Candor & Authentic Disclosure',      source: 'none' },
  { order: 18, broadOrder: 7,  name: 'Hypocrisy, Pretense & Performing Virtue',     source: 'none' },
  { order: 19, broadOrder: 7,  name: 'Doubtful Claims & Unverified Assertions',     source: 'none' },
  { order: 20, broadOrder: 7,  name: 'Satire, Mockery & Cutting Wit',               source: 'none' },
  { order: 21, broadOrder: 8,  name: 'Legal Contestation & Formal Accusation',      source: 'none' },
  { order: 22, broadOrder: 8,  name: 'Careful Judgment & Exacting Standards',       source: 'taskman' },
  { order: 23, broadOrder: 8,  name: 'Rigor, Precision & Intellectual Exactness',   source: 'taskman' },
  { order: 24, broadOrder: 9,  name: "A Once-Respected Official's Descent",         source: 'taskman' },
  { order: 25, broadOrder: 9,  name: 'Guilt, Remorse & Moral Reckoning',            source: 'taskman' },
  { order: 26, broadOrder: 9,  name: 'Reprimand, Censure & Formal Rebuke',          source: 'taskman' },
  { order: 27, broadOrder: 10, name: 'A Judge Who Never Compromised',               source: 'taskman' },
  { order: 28, broadOrder: 10, name: 'Stubbornness, Resolve & Refusal to Yield',    source: 'taskman' },
  { order: 29, broadOrder: 10, name: 'Arrogance, Contempt & Self-Importance',       source: 'taskman' },
  { order: 30, broadOrder: 11, name: 'Impulsiveness, Ardor & Volatile Temperament', source: 'taskman' },
  { order: 31, broadOrder: 11, name: 'Emotional Distance, Reserve & Withdrawal',    source: 'taskman' },
  { order: 32, broadOrder: 11, name: 'Dedication, Warmth & Social Grace',           source: 'taskman' },
  { order: 33, broadOrder: 12, name: 'Sociability, Community & Cultural Mobility',  source: 'taskman' },
  { order: 34, broadOrder: 12, name: 'Intellectual Sharpness & Mental Acuity',      source: 'taskman' },
  { order: 35, broadOrder: 12, name: 'Pedantry, Affectation & Superficiality',      source: 'taskman' },
  { order: 36, broadOrder: 13, name: 'Grief, Anxiety & Dark Emotional States',      source: 'taskman' },
  { order: 37, broadOrder: 13, name: 'Joy, Delight & High Spirits',                 source: 'taskman' },
  { order: 38, broadOrder: 13, name: 'Resentment, Hostility & Bitter Antagonism',   source: 'taskman' },
  { order: 39, broadOrder: 14, name: 'Apathy, Inertia & Drained Will',              source: 'taskman' },
  { order: 40, broadOrder: 14, name: 'A Region That Stopped Thinking and Drifted',  source: 'taskman' },
  { order: 41, broadOrder: 14, name: 'Nostalgia, Shame & Inward Emotion',           source: 'taskman' },
  { order: 42, broadOrder: 15, name: 'Eccentricity, Individuality & Nonconformity', source: 'taskman' },
  { order: 43, broadOrder: 15, name: 'Moral Skepticism, Cynicism & Desire',         source: 'taskman' },
  { order: 44, broadOrder: 15, name: 'Logical Reasoning & Evidence-Based Argument', source: 'taskman' },
  { order: 45, broadOrder: 16, name: 'Flawed Reasoning & Empty Argument',           source: 'taskman' },
  { order: 46, broadOrder: 16, name: 'Transformative Ideas & Guiding Principles',   source: 'taskman' },
  { order: 47, broadOrder: 16, name: 'Obscure, Esoteric & Hidden Knowledge',        source: 'taskman' },
  { order: 48, broadOrder: 17, name: 'Investigation, Analysis & Systematic Study',  source: 'taskman' },
  { order: 49, broadOrder: 17, name: 'Perception, Consciousness & Embodied Knowledge', source: 'taskman' },
  { order: 50, broadOrder: 17, name: 'Abstract Thought, Theory & Pure Concepts',    source: 'taskman' },
  { order: 51, broadOrder: 18, name: 'Religious Belief, Heresy & Sacred Boundaries', source: 'taskman' },
  { order: 52, broadOrder: 18, name: 'Secular Skepticism, Parochialism & Narrow Views', source: 'taskman' },
  { order: 53, broadOrder: 18, name: 'Ornate, Florid & Performative Language',      source: 'taskman' },
  { order: 54, broadOrder: 19, name: 'Brevity, Persuasion & Economy of Expression', source: 'taskman' },
  { order: 55, broadOrder: 19, name: 'Figurative, Indirect & Plain Language',       source: 'taskman' },
  { order: 56, broadOrder: 19, name: 'Moral Instruction & Stale Language',          source: 'taskman' },
  { order: 57, broadOrder: 20, name: 'Challenging, Refuting & Inciting',            source: 'taskman' },
  { order: 58, broadOrder: 20, name: 'Calming, Soothing & De-escalation',           source: 'taskman' },
  { order: 59, broadOrder: 20, name: 'Caution, Persistence, Conceding & Reconciliation', source: 'taskman' },
  { order: 60, broadOrder: 21, name: 'A Linguist Demonstrates How Language Varies', source: 'taskman' },
  { order: 61, broadOrder: 21, name: 'Praise, Honor & Public Commendation',         source: 'taskman' },
  { order: 62, broadOrder: 21, name: 'Rural Life, Nature & Cultural Aspiration',    source: 'taskman' },
  { order: 63, broadOrder: 22, name: 'Social Exclusion, Oppression & Marginalization', source: 'taskman' },
  { order: 64, broadOrder: 22, name: 'Growth, Abundance & Proliferation',           source: 'taskman' },
  { order: 65, broadOrder: 22, name: 'Scale, Pervasiveness & Overwhelming Extent',  source: 'taskman' },
  { order: 66, broadOrder: 23, name: 'Ubiquity, Proliferation & Excess',            source: 'taskman' },
  { order: 67, broadOrder: 23, name: 'Causes, Triggers & Preconditions',            source: 'taskman' },
  { order: 68, broadOrder: 23, name: 'Consequences, Ramifications & Cascading Effects', source: 'taskman' },
  { order: 69, broadOrder: 24, name: 'Time, Transience & Transformation',           source: 'taskman' },
  { order: 70, broadOrder: 24, name: 'Grinding Against Resistant Forces',           source: 'taskman' },
  { order: 71, broadOrder: 24, name: 'A Piece of Music That Exceeds Everything',    source: 'taskman' },
  { order: 72, broadOrder: 25, name: 'Bodies Failing Despite Treatment',            source: 'taskman' },
  { order: 73, broadOrder: 25, name: 'Practical Action, Utility & Reversal',        source: 'taskman' },
  { order: 74, broadOrder: 25, name: 'The Once-in-a-Generation Figure',             source: 'taskman' },
  { order: 75, broadOrder: 26, name: 'Structural Limits, Boundaries & Demarcation', source: 'taskman' },
  { order: 76, broadOrder: 26, name: 'Scale, Proportion, Measurement & Reduction',  source: 'taskman' },
  { order: 77, broadOrder: 26, name: 'When Every Door Slams Shut',                  source: 'taskman' },
];

// ─── Embedded data for units 9-12 (from add-units-9-12.js) ─────────────────

const EMBEDDED_WORDS = {
  9: [
    { word: 'Appropriate', partOfSpeech: 'verb', definition: 'To take something for one\'s own use, typically without the owner\'s permission; to officially allocate money or resources for a specific purpose.', synonyms: ['Commandeer','Seize','Allocate','Earmark'], antonyms: ['Relinquish','Surrender','Return'], exampleSentence: 'The government appropriated private land for the new highway project without offering fair compensation.', difficultyBase: 3 },
    { word: 'Autonomous', partOfSpeech: 'adjective', definition: 'Having the freedom to act independently; self-governing; not controlled by others.', synonyms: ['Independent','Self-governing','Sovereign'], antonyms: ['Dependent','Controlled','Subservient'], exampleSentence: 'The regional council was granted autonomous authority to manage its own budget without central oversight.', difficultyBase: 3 },
    { word: 'Bureaucracy', partOfSpeech: 'noun', definition: 'A system of government or management with complex rules and processes; excessive official paperwork and regulation.', synonyms: ['Administration','Officialdom','Red tape'], antonyms: ['Efficiency','Simplicity'], exampleSentence: 'The entrepreneur was frustrated by the layers of bureaucracy required to register a new business.', difficultyBase: 3 },
    { word: 'Curtail', partOfSpeech: 'verb', definition: 'To reduce or limit something; to impose a restriction that cuts something short.', synonyms: ['Restrict','Reduce','Limit'], antonyms: ['Expand','Extend','Increase'], exampleSentence: 'The government curtailed civil liberties during the period of national emergency.', difficultyBase: 3 },
    { word: 'Magnate', partOfSpeech: 'noun', definition: 'A wealthy and influential person, especially in business or industry; a powerful figure in a particular field.', synonyms: ['Tycoon','Mogul','Baron'], antonyms: ['Pauper','Commoner'], exampleSentence: 'The media magnate controlled a dozen television channels and three major newspapers across the country.', difficultyBase: 3 },
    { word: 'Nepotism', partOfSpeech: 'noun', definition: 'The practice of favoring relatives or close friends when giving jobs or other advantages, especially in a position of power.', synonyms: ['Favoritism','Cronyism','Partisanship'], antonyms: ['Meritocracy','Impartiality'], exampleSentence: 'The minister was accused of nepotism after appointing his brother-in-law as the head of a government department.', difficultyBase: 4 },
    { word: 'Paternal', partOfSpeech: 'adjective', definition: 'Of or relating to a father; showing fatherly protection, concern, or guidance; characteristic of a caring but controlling authority.', synonyms: ['Fatherly','Protective','Paternalistic'], antonyms: ['Maternal','Filial'], exampleSentence: 'The senator took a paternal interest in the welfare of his constituents, often personally attending to their grievances.', difficultyBase: 3 },
    { word: 'Patriarch', partOfSpeech: 'noun', definition: 'The male head of a family or tribe; a man who is the founder or dominant figure of a community or organization.', synonyms: ['Elder','Head','Chief'], antonyms: ['Matriarch','Subordinate'], exampleSentence: 'As the family patriarch, his decisions on matters of property and marriage were considered final.', difficultyBase: 3 },
    { word: 'Peremptory', partOfSpeech: 'adjective', definition: 'Insisting on immediate attention or obedience in a brusquely imperious way; not allowing contradiction or refusal.', synonyms: ['Imperious','Commanding','Dictatorial'], antonyms: ['Respectful','Humble','Tentative'], exampleSentence: 'Her peremptory tone when addressing the staff made it clear that she expected immediate and unquestioning compliance.', difficultyBase: 4 },
    { word: 'Perquisite', partOfSpeech: 'noun', definition: 'A benefit or privilege granted to an employee in addition to their salary; something regarded as a special right attached to a position.', synonyms: ['Perk','Privilege','Benefit'], antonyms: ['Penalty','Obligation'], exampleSentence: 'The company car and private club membership were considered perquisites of the senior executive position.', difficultyBase: 4 },
    { word: 'Prerogative', partOfSpeech: 'noun', definition: 'A right or privilege exclusive to a particular individual or class; a special power or authority.', synonyms: ['Right','Privilege','Entitlement'], antonyms: ['Obligation','Duty','Restriction'], exampleSentence: 'Setting the school examination schedule is the prerogative of the principal, not the teaching staff.', difficultyBase: 3 },
    { word: 'Surrogate', partOfSpeech: 'noun', definition: 'A person or thing that acts as a substitute for another; a deputy or replacement serving in place of the original.', synonyms: ['Substitute','Proxy','Stand-in'], antonyms: ['Original','Principal'], exampleSentence: 'The ambassador served as a surrogate for the head of state at the international summit on climate change.', difficultyBase: 3 },
  ],
  10: [
    { word: 'Affluent', partOfSpeech: 'adjective', definition: 'Having a great deal of money and material wealth; prosperous and comfortable in financial terms.', synonyms: ['Wealthy','Rich','Prosperous'], antonyms: ['Poor','Destitute','Impoverished'], exampleSentence: 'The affluent suburb was lined with luxury cars and perfectly manicured gardens behind high walls.', difficultyBase: 3 },
    { word: 'Amenity', partOfSpeech: 'noun', definition: 'A desirable or useful feature or facility that adds comfort or convenience to a place.', synonyms: ['Facility','Comfort','Convenience'], antonyms: ['Hardship','Discomfort'], exampleSentence: 'The luxury hotel boasted every possible amenity, from a rooftop pool to a personalised butler service.', difficultyBase: 3 },
    { word: 'Culinary', partOfSpeech: 'adjective', definition: 'Of or relating to cooking, food preparation, or the kitchen; pertaining to the art or practice of cookery.', synonyms: ['Gastronomic','Epicurean','Gourmet'], antonyms: [], exampleSentence: 'She enrolled in a prestigious culinary school in Paris to master the art of classical French cuisine.', difficultyBase: 3 },
    { word: 'Decadent', partOfSpeech: 'adjective', definition: 'Luxuriously self-indulgent; characterized by moral or cultural decline through excessive pleasure-seeking.', synonyms: ['Self-indulgent','Dissolute','Debauched'], antonyms: ['Austere','Ascetic','Modest'], exampleSentence: 'The decadent lifestyle of the elite stood in stark contrast to the grinding poverty outside their gated estates.', difficultyBase: 3 },
    { word: 'Flaunt', partOfSpeech: 'verb', definition: 'To display something ostentatiously, especially wealth or possessions, in order to attract attention or provoke envy.', synonyms: ['Show off','Display','Parade'], antonyms: ['Conceal','Hide','Downplay'], exampleSentence: 'He flaunted his newly acquired wealth by arriving at every social event in a different imported sports car.', difficultyBase: 3 },
    { word: 'Grandiose', partOfSpeech: 'adjective', definition: 'Extravagantly large, ambitious, or impressive; seemingly impressive but in a way that is excessive or absurd.', synonyms: ['Elaborate','Pompous','Ostentatious'], antonyms: ['Modest','Humble','Understated'], exampleSentence: 'The politician\'s grandiose promises of overnight economic transformation far exceeded what was realistically achievable.', difficultyBase: 3 },
    { word: 'Munificent', partOfSpeech: 'adjective', definition: 'Larger or more generous than is usual or necessary; characterised by lavish generosity.', synonyms: ['Generous','Lavish','Bountiful'], antonyms: ['Stingy','Miserly','Mean'], exampleSentence: 'The munificent philanthropist donated an entire wing to the children\'s hospital and funded twenty annual scholarships.', difficultyBase: 4 },
    { word: 'Opulent', partOfSpeech: 'adjective', definition: 'Ostentatiously rich and luxurious; demonstrating wealth through lavish display of resources.', synonyms: ['Luxurious','Lavish','Sumptuous'], antonyms: ['Austere','Spartan','Modest'], exampleSentence: 'The opulent ballroom was adorned with crystal chandeliers, gold-leaf ceilings, and imported marble floors.', difficultyBase: 3 },
    { word: 'Ostentatious', partOfSpeech: 'adjective', definition: 'Characterised by a vulgar or pretentious display of wealth and resources, primarily designed to impress or attract notice.', synonyms: ['Showy','Flamboyant','Pretentious'], antonyms: ['Modest','Humble','Understated'], exampleSentence: 'Her ostentatious display of jewels and designer clothing at the charity gala drew equal parts admiration and contempt.', difficultyBase: 4 },
    { word: 'Solvent', partOfSpeech: 'adjective', definition: 'Having assets in excess of liabilities; financially stable and able to meet all monetary obligations.', synonyms: ['Financially stable','Creditworthy','Debt-free'], antonyms: ['Insolvent','Bankrupt','Indebted'], exampleSentence: 'Despite the nationwide economic crisis, the company remained solvent by cutting costs and diversifying its revenue streams.', difficultyBase: 3 },
  ],
  11: [
    { word: 'Abject', partOfSpeech: 'adjective', definition: 'Experienced or present to the most extreme degree; utterly hopeless or degrading; completely without pride or dignity.', synonyms: ['Wretched','Miserable','Deplorable'], antonyms: ['Admirable','Dignified','Proud'], exampleSentence: 'The refugees lived in abject poverty, without clean water, adequate food, or any form of shelter.', difficultyBase: 3 },
    { word: 'Avarice', partOfSpeech: 'noun', definition: 'Extreme greed for wealth or material gain; an insatiable desire to accumulate riches.', synonyms: ['Greed','Covetousness','Cupidity'], antonyms: ['Generosity','Charity','Benevolence'], exampleSentence: 'His avarice eventually led him to embezzle funds from the very charity he had been entrusted to support.', difficultyBase: 4 },
    { word: 'Covet', partOfSpeech: 'verb', definition: 'To yearn intensely to possess or have something belonging to another person; to desire enviously.', synonyms: ['Desire','Envy','Crave'], antonyms: ['Scorn','Disdain','Renounce'], exampleSentence: 'She had long coveted her colleague\'s prestigious position and spent years quietly scheming to acquire it.', difficultyBase: 3 },
    { word: 'Dearth', partOfSpeech: 'noun', definition: 'A scarcity or insufficient quantity of something; a serious lack of a needed resource or supply.', synonyms: ['Scarcity','Shortage','Lack'], antonyms: ['Abundance','Plenty','Surplus'], exampleSentence: 'The remote districts suffered from a chronic dearth of qualified medical professionals and essential medicines.', difficultyBase: 3 },
    { word: 'Glut', partOfSpeech: 'noun', definition: 'An excessively abundant supply of something, typically more than the market or demand can absorb.', synonyms: ['Surplus','Excess','Oversupply'], antonyms: ['Shortage','Scarcity','Dearth'], exampleSentence: 'A glut of cheap imports flooded the domestic market, devastating local manufacturers who could not compete on price.', difficultyBase: 3 },
    { word: 'Insatiable', partOfSpeech: 'adjective', definition: 'Impossible to satisfy regardless of how much is given; having an unlimited or unquenchable desire.', synonyms: ['Unquenchable','Voracious','Greedy'], antonyms: ['Content','Moderate','Sated'], exampleSentence: 'Her insatiable appetite for knowledge drove her to earn three degrees and read obsessively throughout her life.', difficultyBase: 3 },
    { word: 'Mercenary', partOfSpeech: 'adjective', definition: 'Primarily concerned with making money at the expense of ethics; motivated by financial gain above all other considerations.', synonyms: ['Avaricious','Greedy','Venal'], antonyms: ['Altruistic','Selfless','Charitable'], exampleSentence: 'Critics accused the board of making mercenary decisions that prioritised short-term profit over employee welfare and safety.', difficultyBase: 3 },
    { word: 'Paucity', partOfSpeech: 'noun', definition: 'The presence of something only in small or insufficient quantities; a serious scarcity of what is needed.', synonyms: ['Scarcity','Shortage','Dearth'], antonyms: ['Abundance','Surplus','Plenty'], exampleSentence: 'The paucity of clean drinking water in the affected region made the drought crisis far more severe than anticipated.', difficultyBase: 4 },
    { word: 'Rapacious', partOfSpeech: 'adjective', definition: 'Aggressively greedy or grasping; plundering and seizing by force; voraciously acquisitive.', synonyms: ['Greedy','Avaricious','Plundering'], antonyms: ['Generous','Selfless','Content'], exampleSentence: 'The rapacious corporation stripped the region of its natural resources and departed without any environmental restoration.', difficultyBase: 4 },
    { word: 'Squander', partOfSpeech: 'verb', definition: 'To waste money, time, or resources in a reckless or foolish manner; to allow something valuable to be lost through neglect.', synonyms: ['Waste','Fritter away','Dissipate'], antonyms: ['Save','Conserve','Preserve'], exampleSentence: 'He squandered his entire inheritance on luxury goods and gambling within two years of receiving it.', difficultyBase: 3 },
  ],
  12: [
    { word: 'Abysmal', partOfSpeech: 'adjective', definition: 'Extremely bad or appalling; so deep or severe as to seem immeasurably hopeless or terrible.', synonyms: ['Terrible','Dreadful','Appalling'], antonyms: ['Excellent','Outstanding','Superb'], exampleSentence: 'The flood survivors were forced to endure abysmal conditions in the overcrowded and undersupplied relief shelter.', difficultyBase: 3 },
    { word: 'Destitute', partOfSpeech: 'adjective', definition: 'Without the basic necessities of life; in a state of extreme poverty with no financial resources whatsoever.', synonyms: ['Impoverished','Poverty-stricken','Penniless'], antonyms: ['Wealthy','Affluent','Prosperous'], exampleSentence: 'The floods left thousands of families destitute overnight, stripping them of their homes, livestock, and savings.', difficultyBase: 3 },
    { word: 'Indigent', partOfSpeech: 'adjective', definition: 'Poor and needy; lacking the basic necessities of life; in a condition of extreme financial want.', synonyms: ['Destitute','Impoverished','Needy'], antonyms: ['Wealthy','Affluent','Prosperous'], exampleSentence: 'Free medical care was provided specifically to the indigent residents of the disaster-affected villages.', difficultyBase: 4 },
    { word: 'Mendicant', partOfSpeech: 'noun', definition: 'A person who lives by begging; one who depends entirely on charity or alms for survival.', synonyms: ['Beggar','Pauper','Vagrant'], antonyms: ['Benefactor','Donor','Philanthropist'], exampleSentence: 'After the floods, former landowners were reduced to mendicants, extending their hands at relief camps for daily rations.', difficultyBase: 4 },
    { word: 'Paltry', partOfSpeech: 'adjective', definition: 'Contemptibly small or inadequate in amount; trivial and of little value or significance.', synonyms: ['Meager','Pitiful','Trifling'], antonyms: ['Substantial','Considerable','Generous'], exampleSentence: 'The government offered a paltry sum in compensation to the thousands of families displaced by the devastating floods.', difficultyBase: 3 },
    { word: 'Sordid', partOfSpeech: 'adjective', definition: 'Involving immoral or dishonest activities; dirty, filthy, or wretched in condition; ignoble in nature.', synonyms: ['Wretched','Squalid','Dirty'], antonyms: ['Noble','Clean','Reputable'], exampleSentence: 'The sordid conditions of the temporary flood shelters were a stain on the government\'s relief response.', difficultyBase: 3 },
    { word: 'Squalor', partOfSpeech: 'noun', definition: 'A state of being extremely dirty and unpleasant, especially as a result of poverty or neglect; filth and wretchedness.', synonyms: ['Filth','Wretchedness','Sordidness'], antonyms: ['Cleanliness','Luxury','Comfort'], exampleSentence: 'Displaced families lived in absolute squalor in makeshift tents along the flooded riverbank for weeks without aid.', difficultyBase: 3 },
    { word: 'Stagnation', partOfSpeech: 'noun', definition: 'A state of inactivity or lack of development; failure to flow, move, or progress.', synonyms: ['Stasis','Standstill','Inertia'], antonyms: ['Progress','Growth','Development'], exampleSentence: 'Economic stagnation gripped the flood-affected region for years as businesses failed to recover and investment dried up.', difficultyBase: 3 },
  ],
};

// ─── LaTeX Parser ──────────────────────────────────────────────────────────

function cleanLatex(s) {
  return s
    .replace(/\\textit\{([^}]*)\}/g, '$1')
    .replace(/\\textbf\{([^}]*)\}/g, '$1')
    .replace(/\\emph\{([^}]*)\}/g, '$1')
    .replace(/\\textnormal\{([^}]*)\}/g, '$1')
    .replace(/\\&/g, '&')
    .replace(/---/g, '—')
    .replace(/--/g, '–')
    .replace(/``/g, '\u201C')
    .replace(/''/g, '\u201D')
    .replace(/`/g, '\u2018')
    .replace(/\\ldots/g, '…')
    .replace(/~/, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractBraces(s, start) {
  let depth = 0, i = start, result = '';
  while (i < s.length) {
    if (s[i] === '{') { depth++; if (depth === 1) { i++; continue; } }
    if (s[i] === '}') { depth--; if (depth === 0) return result; }
    if (depth > 0) result += s[i];
    i++;
  }
  return result;
}

/**
 * Parse a .tex file and extract all words.
 * Returns: Map<wordLower, { word, partOfSpeech, definition, exampleSentence, synonyms, antonyms }>
 */
function parseTexFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const results = {};

  let i = 0;
  while (i < content.length) {
    const we = content.indexOf('\\wordentry{', i);
    if (we === -1) break;

    // Extract word name
    const wordStart = we + 11;
    const wordName  = extractBraces(content, wordStart - 1);
    // Extract part of speech (second brace group)
    const posStart  = content.indexOf('{', wordStart + wordName.length);
    const rawPos    = extractBraces(content, posStart);
    // Simplify pos: take first listed pos if multiple
    const pos = rawPos.split('/')[0].trim().toLowerCase();

    // Find end of this entry (next \wordentry or \end{document})
    const nextWe  = content.indexOf('\\wordentry{', we + 1);
    const endDoc  = content.indexOf('\\end{document}', we);
    const blockEnd = Math.min(
      nextWe  === -1 ? content.length : nextWe,
      endDoc  === -1 ? content.length : endDoc,
    );
    const block = content.slice(we, blockEnd);

    // Definition
    let definition = '';
    const defMatch = block.match(/\\definition\{([\s\S]*?)\}(?=\s*\\)/);
    if (defMatch) {
      definition = cleanLatex(defMatch[1]);
    } else {
      const defNum = block.match(/\\definitionnumbered\{1\}\{([\s\S]*?)\}(?=\s*\\)/);
      if (defNum) definition = cleanLatex(defNum[1]);
    }

    // Example sentence
    let exampleSentence = '';
    const exMatch = block.match(/\\examplesentence\{([\s\S]*?)\}(?=\s*\\|\s*$)/);
    if (exMatch) {
      exampleSentence = cleanLatex(exMatch[1]);
    } else {
      const exNum = block.match(/\\examplenumbered\{1\}\{([\s\S]*?)\}(?=\s*\\)/);
      if (exNum) exampleSentence = cleanLatex(exNum[1]);
    }

    // Synonyms / antonyms
    const synMatch = block.match(/\\synantline\{([^}]*)\}\{([^}]*)\}/);
    const synonyms = synMatch
      ? synMatch[1].split(',').map(s => {
          const t = s.trim();
          return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
        }).filter(s => s && s.toLowerCase() !== 'none')
      : [];
    const antonyms = synMatch
      ? synMatch[2].split(',').map(s => {
          const t = s.trim();
          return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
        }).filter(s => s && s.toLowerCase() !== 'none')
      : [];

    const wordKey = wordName.toLowerCase();
    results[wordKey] = {
      word:            wordName.charAt(0).toUpperCase() + wordName.slice(1).toLowerCase(),
      partOfSpeech:    pos,
      definition,
      exampleSentence,
      synonyms,
      antonyms,
      difficultyBase:  3,
    };

    i = we + 1;
  }
  return results;
}

/**
 * Parse wordsmart_unit01.tex (multi-unit file).
 * Returns: Map<unitOrder, Map<wordLower, wordData>>
 */
function parseWordsmartFile() {
  const content = fs.readFileSync(WORDSMART_FILE, 'utf8');

  // Split by \section*{Unit N ...}
  const sectionRe = /\\section\*\{Unit (\d+)[^}]*\}/g;
  const sections  = [];
  let match;
  while ((match = sectionRe.exec(content)) !== null) {
    sections.push({ unitOrder: parseInt(match[1], 10), start: match.index });
  }

  const byUnit = {};
  for (let s = 0; s < sections.length; s++) {
    const { unitOrder, start } = sections[s];
    const end    = s + 1 < sections.length ? sections[s + 1].start : content.length;
    const chunk  = content.slice(start, end);

    // Write chunk to temp file and reuse parseTexFile logic on it
    const tmpPath = path.join(__dirname, `_tmp_unit${unitOrder}.tex`);
    fs.writeFileSync(tmpPath, chunk, 'utf8');
    byUnit[unitOrder] = parseTexFile(tmpPath);
    fs.unlinkSync(tmpPath);
  }
  return byUnit;
}

/**
 * Parse a single Task Manager tex file for a given unit order.
 */
function parseTaskManFile(unitOrder) {
  const files = fs.readdirSync(TASK_MGR_DIR).filter(f =>
    f.startsWith(`unit_${unitOrder}_`) && f.endsWith('.tex')
  );
  if (!files.length) return {};
  return parseTexFile(path.join(TASK_MGR_DIR, files[0]));
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const client = createClient({
    url:       process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  console.log('Parsing wordsmart_unit01.tex (units 1-8)...');
  const wordsmartData = parseWordsmartFile();
  console.log(`  Parsed units: ${Object.keys(wordsmartData).join(', ')}`);

  // Insert broad units (skip if already exist)
  console.log('\nInserting broad units...');
  const unitIdByOrder = {};
  for (const bu of BROAD_UNITS) {
    const existing = await client.execute({
      sql: 'SELECT id FROM vocab_units WHERE "order" = ?',
      args: [bu.order],
    });
    if (existing.rows.length > 0) {
      unitIdByOrder[bu.order] = Number(existing.rows[0].id ?? existing.rows[0][0]);
      process.stdout.write(`  [skip] BU${bu.order}\n`);
    } else {
      const res = await client.execute({
        sql:  'INSERT INTO vocab_units (name, "order") VALUES (?, ?) RETURNING id',
        args: [bu.name, bu.order],
      });
      unitIdByOrder[bu.order] = Number(res.rows[0].id ?? res.rows[0][0]);
      process.stdout.write(`  [new]  BU${bu.order}: ${bu.name}\n`);
    }
  }

  // Insert themes + words
  let totalWords = 0;
  let skippedWords = 0;

  for (const theme of THEMES) {
    const unitId = unitIdByOrder[theme.broadOrder];

    // Insert theme if missing
    const existingTheme = await client.execute({
      sql:  'SELECT id FROM vocab_themes WHERE "order" = ?',
      args: [theme.order],
    });
    let themeId;
    if (existingTheme.rows.length > 0) {
      themeId = Number(existingTheme.rows[0].id ?? existingTheme.rows[0][0]);
    } else {
      const res = await client.execute({
        sql:  'INSERT INTO vocab_themes (unit_id, name, "order") VALUES (?, ?, ?) RETURNING id',
        args: [unitId, theme.name, theme.order],
      });
      themeId = Number(res.rows[0].id ?? res.rows[0][0]);
    }

    // Get word data for this theme
    let wordMap = {};
    if (theme.source === 'wordsmart') {
      wordMap = wordsmartData[theme.order] ?? {};
    } else if (theme.source === 'embedded') {
      // Convert embedded array to map
      const arr = EMBEDDED_WORDS[theme.order] ?? [];
      for (const w of arr) wordMap[w.word.toLowerCase()] = w;
    } else if (theme.source === 'taskman') {
      wordMap = parseTaskManFile(theme.order);
    }
    // source === 'none': no words yet

    const wordCount = Object.keys(wordMap).length;
    if (wordCount === 0 && theme.source !== 'none') {
      console.warn(`  WARNING: no words parsed for theme ${theme.order} (${theme.name})`);
    }

    let inserted = 0;
    for (const [, d] of Object.entries(wordMap)) {
      // Skip if word already exists in this theme
      const existingWord = await client.execute({
        sql:  'SELECT id FROM vocab_words WHERE theme_id = ? AND LOWER(word) = LOWER(?)',
        args: [themeId, d.word],
      });
      if (existingWord.rows.length > 0) {
        skippedWords++;
        continue;
      }

      await client.execute({
        sql: `INSERT INTO vocab_words
                (theme_id, unit_id, word, definition, synonyms, antonyms,
                 example_sentence, part_of_speech, difficulty_base)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          themeId,
          unitId,
          d.word,
          d.definition,
          JSON.stringify(d.synonyms ?? []),
          JSON.stringify(d.antonyms ?? []),
          d.exampleSentence,
          d.partOfSpeech,
          d.difficultyBase ?? 3,
        ],
      });
      inserted++;
      totalWords++;
    }

    const status = theme.source === 'none' ? '(no source yet)' : `${inserted} words`;
    console.log(`  Theme ${String(theme.order).padStart(2)}: ${theme.name} — ${status}`);
  }

  const finalCount = await client.execute('SELECT COUNT(*) as cnt FROM vocab_words');
  const finalUnits = await client.execute('SELECT COUNT(*) as cnt FROM vocab_units');
  const finalThemes = await client.execute('SELECT COUNT(*) as cnt FROM vocab_themes');

  console.log(`\nDone!`);
  console.log(`  Broad units: ${finalUnits.rows[0].cnt}`);
  console.log(`  Themes:      ${finalThemes.rows[0].cnt}`);
  console.log(`  Words:       ${finalCount.rows[0].cnt} (inserted ${totalWords}, skipped ${skippedWords} existing)`);

  client.close();
}

main().catch(err => { console.error(err); process.exit(1); });
