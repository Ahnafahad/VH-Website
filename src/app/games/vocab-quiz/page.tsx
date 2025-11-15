'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Clock, BookOpen, Target, Award, RefreshCw, Trophy, RotateCcw } from 'lucide-react';
import { motion, useScroll, useTransform, useInView, AnimatePresence } from 'framer-motion';
import ProtectedRoute from '@/components/ProtectedRoute';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';

interface Question {
  sentence: string;
  wordBank: string[];
  correctAnswer: string;
  difficulty: string;
}

interface QuizResult {
  score: number;
  correctAnswers: number;
  wrongAnswers: number;
  totalQuestions: number;
  results: Array<Question & {
    userAnswer: string;
    isCorrect: boolean;
  }>;
}

interface LeaderboardEntry {
  playerName: string;
  totalQuestionsAnswered: number;
  totalQuestionsCorrect: number;
  gamesPlayed: number;
  averageAccuracy: number;
  lastPlayed: Date;
  uniqueSectionsCount: number;
}

interface Explanation {
  word: string;
  definition: string;
  explanation: string;
}

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
  }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] }
  }
};

const slideInLeft = {
  hidden: { opacity: 0, x: -60 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] }
  }
};

const VocabularyQuizApp = () => {
  const { scrollY } = useScroll();
  // Vocabulary sections from the provided list
  const vocabularySections: { [key: number]: string[] } = {
    1: ["abash", "abate", "abdicate", "aberration", "abhor", "abject", "abnegate", "abortive", "abridge", "absolute", "absolve", "abstinent", "abstract", "abstruse", "abysmal", "accolade", "accost", "acerbic", "acquiesce", "acrid", "acrimonious", "acumen", "acute", "adamant", "address", "adherent", "admonish", "adroit", "adulation", "adulterate", "adverse", "aesthetic", "affable", "affectation", "affinity", "affluent", "agenda", "aggregate", "agnostic", "agrarian", "alacrity", "allege", "alleviate", "allocate", "alloy", "allusion", "aloof", "altruism", "ambience", "ambiguous", "ambivalent", "ameliorate", "amenable", "amenity", "amiable", "amnesty", "amoral", "amoralism", "amorous", "amorphous", "anachronism", "analogy", "anarchy", "anecdote", "anguish", "animosity", "anomaly", "antecedent", "antipathy", "antithesis", "apartheid"],
    2: ["apathy", "aphorism", "apocalypse", "apocryphal", "apotheosis", "appease", "appreciate", "apprehensive", "approbation", "appropriate", "aptitude", "arbiter", "arbitrary", "arcane", "archaic", "archetype", "ardent", "arduous", "aristocratic", "artful", "artifice", "ascendancy", "ascetic", "assiduous", "assimilate", "assuage", "astute", "atheist", "attrition", "audacity", "augment", "auspicious", "austere", "autocratic", "autonomous", "avarice", "avow", "avuncular", "awry", "axiom", "banal", "bane", "bastion", "beget", "belabor", "beleaguer", "belie", "belittle", "belligerent", "bemused", "benefactor", "benevolent", "benign", "bequest", "bereaved", "beset", "blasphemy", "blatant"],
    3: ["blight", "blithe", "bourgeois", "bovine", "brevity", "broach", "bucolic", "bureaucracy", "burgeon", "burlesque", "cacophony", "cadence", "cajole", "callow", "candor", "capitalism", "capitulate", "capricious", "caricature", "castigate", "catalyst", "categorical", "catharsis", "catholic", "caustic", "celibacy", "censure", "cerebral", "chagrin", "charisma", "charlatan", "chasm", "chastise", "chicanery", "chimera", "choleric", "chronic", "chronicle", "circuitous", "circumlocution", "circumscribe", "circumspect", "circumvent", "civil", "clemency", "cliche", "clique", "coalesce", "coerce", "cogent", "cognitive", "cognizant", "coherent", "colloquial", "collusion", "commensurate", "compelling", "compendium", "complacent", "complement", "complicity", "comprehensive", "comprise", "conciliatory", "concise", "concord", "concurrent", "condescend", "condone", "conducive", "confluence", "congenial", "congenital"],
    4: ["congregate", "conjecture", "conjure", "connoisseur", "consecrate", "consensus", "consonant", "construe", "consummate", "contentious", "contiguous", "contingent", "contrite", "contrived", "conventional", "convivial", "copious", "corollary", "corroborate", "cosmopolitan", "countenance", "coup", "covenant", "covert", "covet", "credulous", "criterion", "cryptic", "culinary", "culminate", "culpable", "cursory", "curtail", "cynic", "daunt", "dearth", "debacle", "debauchery", "debilitate", "decadent", "decimate", "decorous", "deduce", "defame", "deference", "definitive", "degenerate", "deleterious", "delineate", "delude", "deluge", "demagogue", "denizen", "depravity", "deprecate", "deride", "derogatory", "desiccate", "despondent", "despot", "destitute", "desultory", "dexterous", "dialectical", "dictum", "didactic", "diffident", "digress", "dilettante"],
    5: ["discern", "discreet", "discrete", "discriminate", "disdain", "disinterested", "disparage", "disparate", "disseminate", "dissipate", "dissolution", "distend", "distinguish", "docile", "doctrinaire", "dogmatic", "domestic", "dormant", "dubious", "duplicity", "ebullient", "eccentric", "eclectic", "edify", "efface", "effusion", "egalitarian", "egocentric", "egregious", "elicit", "emulate", "elliptical", "emigrate", "eminent", "empirical", "encroach", "endemic", "enervate", "enfranchise", "engender", "enigma", "enormity", "ephemeral", "epigram", "epitome", "equanimity", "equitable", "equivocal", "erudite", "esoteric", "espouse", "ethereal", "euphemism", "evanescent", "exacerbate", "exacting", "exalt", "exasperate", "exemplify", "exhaustive", "exhort", "exigency", "existential", "exonerate", "expatriate", "expedient", "expedite", "explicit", "extol", "extraneous", "extrapolate", "extricate", "extrovert", "exult"],
    6: ["fabrication", "facetious", "facile", "faction", "farcical", "fastidious", "fatalist", "fatuous", "fauna", "fecund", "felicity", "fervor", "fetter", "fidelity", "figurative", "finesse", "flagrant", "flaunt", "flout", "foible", "foment", "forbear", "forego", "forsake", "fortuitous", "founder", "fraternal", "frenetic", "frugal", "furtive", "futile", "garrulous", "gauche", "genre", "genteel", "gesticulate", "glut", "grandiloquent", "grandiose", "gratuitous", "gravity", "gregarious", "guile", "hackneyed", "hapless", "harbinger", "hedonism", "hegemony", "heresy", "hermetic", "heyday", "hiatus", "hierarchy", "histrionic", "homily", "homogeneous", "husbandry", "hyperbole", "hypothetical", "iconoclast", "ideology", "idiosyncrasy", "idyllic", "ignominy", "illicit", "immigrate", "imminent", "immutable", "impartial", "impeccable", "imperial", "impervious", "impetuous", "implement", "impotency", "impotent", "impugn", "inane", "inaugurate", "incandescent", "incantation", "incense", "incessant", "incipient", "incisive", "incongruous", "incorrigible", "increment", "indifferent", "indigenous", "indigent", "indignant", "indolent", "indulgent", "ineffable", "inept", "inert", "inexorable", "infamous", "infatuated"],
    7: ["infer", "infinitesimal", "ingenuous", "inherent", "injunction", "innate", "innocuous", "inordinate", "insatiable", "insidious", "insinuate", "insipid", "insolent", "instigate", "insular", "insurgent", "integral", "integrate", "intractable", "intransigent", "intrinsic", "introspective", "inundate", "invective", "inveterate", "irascible", "ironic", "irrevocable", "itinerant", "judicious", "juxtapose", "kinetic", "labyrinth", "laconic", "lament", "lampoon", "languish", "largess", "latent", "laud", "legacy", "lethargic", "lethargy", "levity", "libel", "litigate", "loquacious", "lucid", "lugubrious", "luminous", "machination", "magnanimous", "magnate", "malaise", "malfeasance", "malignant", "malinger", "malleable", "mandate", "manifest", "manifesto", "marshal", "martial", "martyr", "matriculate", "maudlin", "maverick", "maxim", "mediate", "mellifluous", "mendacious", "mendicant", "mentor", "mercenary", "mercurial", "metamorphosis", "microcosm", "milieu", "minuscule", "misanthropic", "mitigate", "mollify", "monolithic", "moribund", "morose", "mortify", "mundane", "munificent", "myopia", "myriad", "narcissism", "nebulous", "nefarious", "neologism", "nepotism", "nihilism", "nominal", "nostalgia", "notorious", "novel", "noxious", "nuance"],
    8: ["obdurate", "obfuscate", "oblivion", "oblique", "obscure", "obsequious", "obtuse", "officious", "onerous", "opaque", "opulent", "orthodox", "ostensible", "ostentatious", "pacify", "painstaking", "palliate", "palpable", "paltry", "panacea", "paradigm", "paradox", "parochial", "parody", "parsimonious", "partisan", "patent", "paternal", "patriarch", "patrician", "patronize", "pathology", "paucity", "peccadillo", "pedantic", "pedestrian", "pejorative", "penchant", "penitent", "pensive", "peremptory", "perennial", "perfidy", "perfunctory", "peripatetic", "periphery", "perjury", "permeate", "pernicious", "perquisite", "pertinent", "perturb", "peruse", "pervade", "petulant", "philanthropy", "philistine", "pious", "pivotal", "placate", "plaintive", "platitude", "plebeian", "plethora", "poignant", "polarize", "polemic", "ponderous", "portent", "postulate", "pragmatic", "precedent", "precept", "precipitate", "precipitous", "preclude", "precursor", "predilection", "preeminent", "preempt", "premise", "prepossess", "prerogative", "prevail", "pristine", "prodigal", "prodigious", "prodigy", "profane", "profess", "proficient", "profligate", "profound", "profuse", "proletariat", "proliferate", "prolific", "promulgate", "propensity", "propitious", "proponent", "proprietary", "prosaic", "proscribe", "proselytize", "protagonist", "protract", "provident"],
    9: ["provincial", "provisional", "proximity", "prudent", "purported", "purportedly", "putative", "qualify", "qualitative", "querulous", "quixotic", "ramification", "rancor", "rapacious", "rebuke", "rebut", "recalcitrant", "recant", "reciprocal", "reclusive", "recondite", "recrimination", "redolent", "redundant", "refute", "reiterate", "relegate", "relentless", "relinquish", "remonstrate", "Renaissance", "renounce", "reparation", "repercussion", "replenish", "replete", "reprehensible", "reprisal", "reproach", "reprove", "repudiate", "requisite", "resolute", "respite", "reticent", "revere", "rhetoric", "rigorous", "robust", "rogue", "rudimentary", "ruminate", "rustic", "saccharine", "sacrilege", "sacrosanct", "sagacious", "salient", "salutary", "sanctimonious", "sanguine", "sardonic", "scintillate", "scrupulous", "scrutinize", "secular", "sedition", "segregate", "sensory", "sentient", "sequester", "serendipity", "servile", "singular", "sinister", "slander", "sloth", "sobriety", "solicitous", "solvent", "soporific"],
    10: ["sordid", "spawn", "specious", "sporadic", "spurious", "squalor", "squander", "stagnation", "static", "staunch", "steadfast", "stigmatize", "stipulate", "stoic", "stratum", "stricture", "strife", "stringent", "stymie", "subjugate", "sublime", "subordinate", "substantive", "subtle", "subversive", "succinct", "succumb", "supercilious", "superficial", "superfluous", "surfeit", "surreptitious", "surrogate", "sycophant", "synthesis", "tacit", "taciturn", "tangential", "tangible", "tantamount", "tautological", "temerity", "temperate", "tenable", "tenacious", "tenet", "tentative", "tenuous", "terse", "theology", "tirade", "torpor", "touchstone", "tout", "transcend", "transgress", "transient", "trepidation", "turpitude", "ubiquitous", "unconscionable", "unctuous", "uniform", "unremitting", "unwitting", "urbane", "usurp", "utilitarian", "utopia"]
  };

  // App state
  const [currentScreen, setCurrentScreen] = useState('setup'); // setup, quiz, results
  const [selectedSections, setSelectedSections] = useState<number[]>([]);
  const [quizConfig, setQuizConfig] = useState({
    questionCount: 10,
    timePerQuestion: 30
  });
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [timeRemaining, setTimeRemaining] = useState(30);
  const [isLoading, setIsLoading] = useState(false);
  const [quizResults, setQuizResults] = useState<QuizResult | null>(null);
  const [explanations, setExplanations] = useState<Explanation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);


  // Helper function to clean response
  const cleanResponse = (response: string) => {
    let cleaned = response.trim();
    
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7);
    }
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3);
    }
    
    return cleaned.trim();
  };

  // Generate questions using OpenRouter API with DeepSeek
  const generateQuestions = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('Starting question generation with OpenRouter + DeepSeek...');
      
      const allWords = selectedSections.flatMap(section => vocabularySections[section]);
      const shuffledWords = [...allWords].sort(() => Math.random() - 0.5);
      
      const hardCount = Math.floor(quizConfig.questionCount * 0.33);
      const mediumCount = Math.floor(quizConfig.questionCount * 0.5);
      const easyCount = quizConfig.questionCount - hardCount - mediumCount;
      
      const prompt = `Generate ${quizConfig.questionCount} fill-in-the-blank vocabulary questions using words from this list: ${shuffledWords.slice(0, 50).join(', ')}.

Create ${hardCount} hard questions, ${mediumCount} medium questions, and ${easyCount} easy questions.

CRITICAL REQUIREMENTS:
1. Each sentence must have EXACTLY ONE correct answer that is unambiguous
2. Create sentences where ONLY the correct word makes logical and grammatical sense
3. NO duplicate words in word banks - each word must be unique
4. RANDOMIZE the position of correct answers - do NOT always put correct answer first
5. Use strong contextual clues that clearly indicate one specific word
6. Ensure distractors are plausible but clearly incorrect in context

Format rules:
1. Each sentence should have ONE blank marked with _______
2. Word bank should have exactly 8 unique words (include correct answer + 7 distractors)
3. Mix correct answer position randomly throughout the word bank
4. Questions should test precise contextual understanding
5. Use formal, academic language
6. Verify each question has only ONE defensible correct answer

Quality checks before responding:
- Is the correct answer unambiguous?
- Are all 8 words in the word bank unique?
- Is the correct answer NOT always in the first position?
- Would only one word make complete sense in context?

Respond with JSON in this exact format:
{
  "questions": [
    {
      "sentence": "Complete sentence with _______",
      "wordBank": ["word1", "word2", "correctword", "word4", "word5", "word6", "word7", "word8"],
      "correctAnswer": "correctword",
      "difficulty": "easy|medium|hard"
    }
  ]
}

DO NOT OUTPUT ANYTHING OTHER THAN VALID JSON.`;

      // Call secure backend API route instead of Gemini directly
      const response = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: prompt,
          type: 'questions'
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `API request failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0]) {
        throw new Error('Invalid response structure from Google Gemini API');
      }

      const rawResponse = data.candidates[0].content.parts[0].text;
      const cleanedResponse = cleanResponse(rawResponse);
      
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(cleanedResponse);
      } catch {
        console.error('Failed to parse JSON:', cleanedResponse);
        throw new Error('Failed to parse AI response as JSON');
      }
      
      if (!parsedResponse.questions || !Array.isArray(parsedResponse.questions)) {
        throw new Error('No valid questions found in AI response');
      }
      
      const validQuestions = parsedResponse.questions.filter((q: Question) => {
        // Basic structure check
        if (!(q.sentence && q.wordBank && q.correctAnswer && q.difficulty && Array.isArray(q.wordBank))) {
          return false;
        }

        // Check for minimum word bank size
        if (q.wordBank.length < 6) {
          return false;
        }

        // Check for duplicate words in word bank
        const uniqueWords = new Set(q.wordBank.map(word => word.toLowerCase()));
        if (uniqueWords.size !== q.wordBank.length) {
          console.warn('Question filtered: Duplicate words found in word bank', q.wordBank);
          return false;
        }

        // Check if correct answer is in word bank
        if (!q.wordBank.includes(q.correctAnswer)) {
          console.warn('Question filtered: Correct answer not in word bank', q.correctAnswer, q.wordBank);
          return false;
        }

        return true;
      });
      
      if (validQuestions.length === 0) {
        throw new Error('No valid questions generated');
      }

      // Ensure we have exactly the requested number of questions
      let finalQuestions = validQuestions;
      if (validQuestions.length < quizConfig.questionCount) {
        console.warn(`AI generated ${validQuestions.length} questions but ${quizConfig.questionCount} were requested. Using all available.`);
      } else if (validQuestions.length > quizConfig.questionCount) {
        finalQuestions = validQuestions.slice(0, quizConfig.questionCount);
      }

      // Randomize word bank positions to prevent answer bias
      const randomizedQuestions = finalQuestions.map((q: Question) => {
        const shuffledWordBank = [...q.wordBank].sort(() => Math.random() - 0.5);
        return {
          ...q,
          wordBank: shuffledWordBank
        };
      });

      setQuestions(randomizedQuestions);
      setCurrentScreen('quiz');
      setTimeRemaining(quizConfig.timePerQuestion);
      
    } catch (error) {
      console.error('Question generation failed:', error);
      setError(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    setIsLoading(false);
  };

  // Generate explanations using OpenRouter
  const generateExplanations = useCallback(async (questionsWithAnswers: (Question & { userAnswer: string })[]) => {
    try {
      const prompt = `For each question below, provide explanations:

${questionsWithAnswers.map((q: Question & { userAnswer: string }, i: number) => 
  `${i + 1}. ${q.sentence.replace('_______', q.correctAnswer)}
  Correct answer: ${q.correctAnswer}`
).join('\n\n')}

Respond with JSON:
{
  "explanations": [
    {
      "word": "correctword",
      "definition": "Clear definition",
      "explanation": "Why this word fits the context"
    }
  ]
}`;

      // Call secure backend API route for explanations
      const response = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: prompt,
          type: 'explanations'
        })
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (content) {
          const cleaned = cleanResponse(content);
          const parsed = JSON.parse(cleaned);
          if (parsed.explanations) {
            setExplanations(parsed.explanations);
          }
        }
      }
    } catch (error) {
      console.error('Explanation generation failed:', error);
    }
  }, []);

  // Handle answer selection
  const handleAnswerSelect = (selectedWord: string) => {
    const newAnswers = [...userAnswers];
    newAnswers[currentQuestionIndex] = selectedWord;
    setUserAnswers(newAnswers);

    // Check if this is the last question
    if (currentQuestionIndex === questions.length - 1) {
      // For the last question, finish quiz immediately with the updated answers
      setTimeout(() => {
        finishQuizWithAnswers(newAnswers);
      }, 500);
    } else {
      // For other questions, proceed normally
      setTimeout(() => {
        handleNextQuestion();
      }, 500);
    }
  };

  // Save quiz result to database
  const saveQuizResult = useCallback(async (result: QuizResult) => {
    try {
      const response = await fetch('/api/vocab-quiz/scores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          questionsAnswered: result.totalQuestions,
          questionsCorrect: result.correctAnswers,
          totalSections: selectedSections.length,
          selectedSections: selectedSections,
          difficulty: 'mixed'
        }),
      });

      if (response.ok) {
        const responseData = await response.json();
        console.log('Vocab score saved successfully:', responseData);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Failed to save vocab score:', errorData);
      }
    } catch (error) {
      console.error('Error saving quiz result:', error);
    }
  }, [selectedSections]);

  // Finish quiz with specific answers array (used for last question handling)
  const finishQuizWithAnswers = useCallback((answersArray: string[]) => {
    const results = questions.map((q, index) => ({
      ...q,
      userAnswer: answersArray[index],
      isCorrect: answersArray[index] === q.correctAnswer
    }));

    const correctCount = results.filter(r => r.isCorrect).length;
    const wrongCount = results.length - correctCount;
    const score = correctCount * 1 + wrongCount * (-0.25);

    const quizResult = {
      totalQuestions: results.length,
      correctAnswers: correctCount,
      wrongAnswers: wrongCount,
      score: Math.max(0, score),
      results: results
    };

    setQuizResults(quizResult);
    saveQuizResult(quizResult);
    generateExplanations(results);
    setCurrentScreen('results');
  }, [questions, generateExplanations, saveQuizResult]);

  // Finish quiz and calculate results (fallback for timeout scenarios)
  const finishQuiz = useCallback(() => {
    finishQuizWithAnswers(userAnswers);
  }, [userAnswers, finishQuizWithAnswers]);

  // Handle next question
  const handleNextQuestion = useCallback(() => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setTimeRemaining(quizConfig.timePerQuestion);
    } else {
      finishQuiz();
    }
  }, [currentQuestionIndex, questions.length, quizConfig.timePerQuestion, finishQuiz]);

  // Timer logic
  useEffect(() => {
    if (currentScreen === 'quiz' && timeRemaining > 0) {
      const timer = setTimeout(() => {
        setTimeRemaining(timeRemaining - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (currentScreen === 'quiz' && timeRemaining === 0) {
      handleNextQuestion();
    }
  }, [timeRemaining, currentScreen, handleNextQuestion]);


  // Fetch leaderboard data
  const fetchLeaderboard = async () => {
    setIsLoadingLeaderboard(true);
    try {
      const response = await fetch('/api/vocab-quiz/leaderboard');
      if (response.ok) {
        const data = await response.json();
        setLeaderboard(data.leaderboard || []);
      } else {
        console.error('Failed to fetch leaderboard:', response.status, response.statusText);
        setLeaderboard([]); // Set empty array on error
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      setLeaderboard([]); // Set empty array on error
    } finally {
      setIsLoadingLeaderboard(false);
    }
  };


  // Reset quiz
  const resetQuiz = () => {
    setCurrentScreen('setup');
    setSelectedSections([]);
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setUserAnswers([]);
    setQuizResults(null);
    setExplanations([]);
    setError(null);
    setShowLeaderboard(false);
  };

  // Leaderboard Screen
  if (showLeaderboard) {
    const headerRef = useRef(null);
    const leaderboardRef = useRef(null);
    const headerInView = useInView(headerRef, { once: true });
    const leaderboardInView = useInView(leaderboardRef, { once: true, margin: "-100px" });

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0">
          <motion.div
            className="absolute top-20 right-20 w-72 h-72 bg-vh-red/5 rounded-full blur-3xl"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          <motion.div
            className="absolute bottom-20 left-20 w-96 h-96 bg-vh-beige/10 rounded-full blur-3xl"
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.2, 0.4, 0.2],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1
            }}
          />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative z-10">
          <motion.div
            ref={headerRef}
            className="text-center mb-12 sm:mb-16"
            variants={fadeInUp}
            initial="hidden"
            animate={headerInView ? "visible" : "hidden"}
          >
            <motion.div
              className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-vh-red-600 to-vh-red-800 rounded-3xl mb-6 sm:mb-8 shadow-2xl"
              whileHover={{ scale: 1.05, rotate: 5 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <Trophy className="text-white" size={32} />
            </motion.div>
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black text-gray-900 mb-4 sm:mb-6 px-4">
              Vocabulary <span className="bg-gradient-to-r from-vh-red-600 to-vh-red-800 bg-clip-text text-transparent">Champions</span>
            </h1>
            <p className="text-lg sm:text-xl lg:text-2xl text-gray-600 max-w-4xl mx-auto leading-relaxed px-4">Top performers based on lifetime questions answered</p>
          </motion.div>

          <motion.div
            ref={leaderboardRef}
            className="group relative mb-16"
            variants={scaleIn}
            initial="hidden"
            animate={leaderboardInView ? "visible" : "hidden"}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-vh-red-600/20 to-transparent rounded-3xl blur-2xl group-hover:blur-3xl opacity-0 group-hover:opacity-100 transition-all duration-700"></div>
            <Card variant="elevated" padding="xl" className="relative group-hover:shadow-4xl transition-all duration-700">
              <div className="flex items-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-br from-vh-red to-vh-dark-red rounded-2xl flex items-center justify-center mr-6 shadow-xl">
                  <BookOpen className="text-white" size={32} />
                </div>
                <h2 className="text-3xl font-black text-gray-900">Lifetime Questions Leaderboard</h2>
              </div>
              
              {isLoadingLeaderboard ? (
                <div className="text-center py-12">
                  <RefreshCw className="animate-spin mx-auto mb-4 text-vh-red" size={48} />
                  <p className="text-gray-600 text-lg">Loading leaderboard...</p>
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-vh-red/20 to-vh-beige/20 rounded-full flex items-center justify-center">
                    <Trophy className="w-12 h-12 text-vh-red/60" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">No Champions Yet!</h3>
                  <p className="text-gray-600 text-lg mb-6">
                    Be the first to take a vocabulary quiz and claim your spot on the leaderboard!
                  </p>
                  <button
                    onClick={() => setCurrentScreen('setup')}
                    className="bg-gradient-to-r from-vh-red to-vh-dark-red text-white px-8 py-3 rounded-2xl font-bold hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1"
                  >
                    Take the First Quiz
                  </button>
                </div>
              ) : (
                <motion.div
                  className="space-y-4"
                  variants={staggerContainer}
                  initial="hidden"
                  animate="visible"
                >
                  {leaderboard.slice(0, 20).map((entry, index) => (
                    <motion.div
                      key={index}
                      variants={scaleIn}
                      whileHover={{ x: 8, scale: 1.02 }}
                      className="group/item flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-white rounded-2xl border border-gray-100 hover:border-vh-red-600/30 hover:shadow-lg transition-all duration-300"
                    >
                      <div className="flex items-center gap-4">
                        <motion.span
                          className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg ${
                            index === 0 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' :
                            index === 1 ? 'bg-gradient-to-r from-gray-400 to-gray-600' :
                            index === 2 ? 'bg-gradient-to-r from-amber-600 to-amber-800' :
                            'bg-gradient-to-r from-vh-red-600 to-vh-red-800'
                          }`}
                          whileHover={{ rotate: 360 }}
                          transition={{ duration: 0.6 }}
                        >
                          {index + 1}
                        </motion.span>
                        <div>
                          <div className="font-black text-gray-900 text-lg">{entry.playerName || 'Anonymous'}</div>
                          <div className="text-sm text-gray-600">
                            {entry.gamesPlayed} games • {entry.averageAccuracy.toFixed(1)}% accuracy • {entry.uniqueSectionsCount} sections
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-vh-red-600 text-2xl">{entry.totalQuestionsAnswered}</div>
                        <div className="text-xs text-gray-500 font-medium">Questions Answered</div>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </Card>
          </motion.div>

          <motion.div
            className="text-center"
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
          >
            <Button
              variant="primary"
              size="lg"
              onClick={() => setShowLeaderboard(false)}
              className="group"
            >
              <Target className="inline mr-3" size={20} />
              Back to Quiz
            </Button>
          </motion.div>
        </div>
      </div>
    );
  }

  // Section Selection Screen
  if (currentScreen === 'setup') {
    const setupHeaderRef = useRef(null);
    const sectionsRef = useRef(null);
    const configRef = useRef(null);
    const setupHeaderInView = useInView(setupHeaderRef, { once: true });
    const sectionsInView = useInView(sectionsRef, { once: true, margin: "-100px" });
    const configInView = useInView(configRef, { once: true, margin: "-100px" });

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0">
          <motion.div
            className="absolute top-20 right-20 w-72 h-72 bg-vh-red/5 rounded-full blur-3xl"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          <motion.div
            className="absolute bottom-20 left-20 w-96 h-96 bg-vh-beige/10 rounded-full blur-3xl"
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.2, 0.4, 0.2],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1
            }}
          />
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative z-10">
          <motion.div
            ref={setupHeaderRef}
            className="text-center mb-16"
            variants={fadeInUp}
            initial="hidden"
            animate={setupHeaderInView ? "visible" : "hidden"}
          >
            <motion.div
              className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-vh-red-600 to-vh-red-800 rounded-3xl mb-8 shadow-2xl"
              whileHover={{ scale: 1.05, rotate: 5 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <BookOpen className="text-white" size={40} />
            </motion.div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-gray-900 mb-6">
              Vocabulary <span className="bg-gradient-to-r from-vh-red-600 to-vh-red-800 bg-clip-text text-transparent">Quiz</span>
            </h1>
            <p className="text-lg sm:text-xl md:text-2xl text-gray-600 max-w-4xl mx-auto leading-relaxed px-4">Master academic vocabulary with AI-powered adaptive questions</p>
            
            <motion.div
              className="mt-8 group relative max-w-2xl mx-auto"
              whileHover={{ scale: 1.02 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-vh-red-600/10 to-vh-beige-500/10 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
              <Card variant="elevated" padding="lg" className="relative">
                <p className="text-lg font-bold text-vh-red-600 mb-2 flex items-center justify-center gap-2">
                  <span className="text-2xl">🚀</span>
                  Powered by Advanced AI
                </p>
                <p className="text-gray-700">
                  Custom questions generated in real-time, tailored to your selected vocabulary sections
                </p>
              </Card>
            </motion.div>
          </motion.div>

          <motion.div
            ref={sectionsRef}
            className="group relative mb-12"
            variants={scaleIn}
            initial="hidden"
            animate={sectionsInView ? "visible" : "hidden"}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-vh-red-600/10 to-transparent rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
            <Card variant="elevated" padding="xl" className="relative group-hover:shadow-4xl transition-all duration-500">
              <h2 className="text-3xl font-black text-gray-900 mb-8">Select Vocabulary Sections</h2>
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-5 gap-2 sm:gap-3 mb-6">
              {Object.keys(vocabularySections).map(section => (
                <button
                  key={section}
                  onClick={() => {
                    setSelectedSections(prev =>
                      prev.includes(parseInt(section))
                        ? prev.filter(s => s !== parseInt(section))
                        : [...prev, parseInt(section)]
                    );
                  }}
                  className={`p-3 sm:p-4 rounded-lg border-2 transition-all min-h-[48px] sm:min-h-[52px] flex items-center justify-center font-medium text-sm sm:text-base ${
                    selectedSections.includes(parseInt(section))
                      ? 'bg-vh-red text-white border-vh-red shadow-lg transform scale-105'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-vh-red/50 hover:bg-vh-beige/20'
                  }`}
                >
                  Section {section}
                </button>
              ))}
            </div>
            
            {selectedSections.length > 0 && (
              <div className="text-sm text-gray-600 mb-4 bg-vh-beige/20 p-3 rounded-lg border border-vh-beige">
                Selected sections: {selectedSections.join(', ')} 
                ({selectedSections.reduce((acc, s) => acc + vocabularySections[s].length, 0)} words total)
              </div>
            )}
            </Card>
          </motion.div>

          <motion.div
            ref={configRef}
            className="group relative mb-12"
            variants={scaleIn}
            initial="hidden"
            animate={configInView ? "visible" : "hidden"}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-vh-beige-500/10 to-transparent rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
            <Card variant="elevated" padding="xl" className="relative group-hover:shadow-4xl transition-all duration-500">
              <h2 className="text-3xl font-black text-gray-900 mb-8">Quiz Configuration</h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Number of Questions</label>
                <select
                  value={quizConfig.questionCount}
                  onChange={(e) => setQuizConfig(prev => ({...prev, questionCount: parseInt(e.target.value)}))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-vh-red focus:border-vh-red outline-none transition-all"
                >
                  <option value={10}>10 Questions</option>
                  <option value={20}>20 Questions</option>
                  <option value={30}>30 Questions</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Time per Question</label>
                <select
                  value={quizConfig.timePerQuestion}
                  onChange={(e) => setQuizConfig(prev => ({...prev, timePerQuestion: parseInt(e.target.value)}))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-vh-red focus:border-vh-red outline-none transition-all"
                >
                  <option value={20}>20 seconds</option>
                  <option value={30}>30 seconds</option>
                  <option value={45}>45 seconds</option>
                </select>
              </div>
            </div>
            </Card>
          </motion.div>

          {/* Question */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestionIndex}
              className="group relative mb-8"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-vh-red-600/30 to-vh-red-800/30 rounded-3xl blur-2xl group-hover:blur-3xl transition-all duration-500"></div>
              <Card variant="elevated" padding="xl" className="relative bg-white/95 backdrop-blur-xl shadow-2xl border border-white/20">
                <motion.h2
                  className="text-lg sm:text-xl md:text-2xl lg:text-4xl font-bold text-gray-900 leading-relaxed mb-6 sm:mb-8 lg:mb-10 text-center px-2"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  {currentQuestion.sentence}
                </motion.h2>

                <motion.div
                  className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4"
                  variants={staggerContainer}
                  initial="hidden"
                  animate="visible"
                >
                  {currentQuestion.wordBank.map((word, index) => (
                    <motion.button
                      key={index}
                      variants={scaleIn}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleAnswerSelect(word)}
                      className="group/word relative bg-gradient-to-r from-gray-50 to-white p-3 sm:p-4 border-2 border-gray-200 rounded-xl sm:rounded-2xl hover:border-vh-red-600 hover:shadow-xl transition-all duration-300 text-left font-bold hover:bg-gradient-to-r hover:from-vh-beige-300/20 hover:to-white min-h-[52px] sm:min-h-[56px] flex items-center justify-center text-center"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-vh-red-600/10 to-vh-beige-500/10 rounded-xl sm:rounded-2xl opacity-0 group-hover/word:opacity-100 transition-opacity duration-300"></div>
                      <span className="relative text-base sm:text-lg text-gray-800 group-hover/word:text-vh-red-600 transition-colors duration-300">{word}</span>
                    </motion.button>
                  ))}
                </motion.div>
              </Card>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // Results Screen
  if (currentScreen === 'results' && quizResults) {
    const resultsHeaderRef = useRef(null);
    const resultsStatsRef = useRef(null);
    const resultsHeaderInView = useInView(resultsHeaderRef, { once: true });
    const resultsStatsInView = useInView(resultsStatsRef, { once: true, margin: "-100px" });

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white relative overflow-hidden">
        {/* Animated Celebration Background */}
        <div className="absolute inset-0">
          <motion.div
            className="absolute top-20 right-20 w-72 h-72 bg-gradient-to-r from-success-400/10 to-vh-red-600/10 rounded-full blur-3xl"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          <motion.div
            className="absolute bottom-20 left-20 w-96 h-96 bg-gradient-to-l from-vh-beige-500/20 to-success-400/10 rounded-full blur-3xl"
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.2, 0.4, 0.2],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1
            }}
          />
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-20 relative z-10">
          <motion.div
            ref={resultsHeaderRef}
            className="group relative mb-8 sm:mb-12 lg:mb-16"
            variants={scaleIn}
            initial="hidden"
            animate={resultsHeaderInView ? "visible" : "hidden"}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-vh-red-600/20 to-success-400/20 rounded-3xl blur-2xl group-hover:blur-3xl transition-all duration-700"></div>
            <Card variant="elevated" padding="xl" className="relative group-hover:shadow-4xl transition-all duration-700">
              <div className="text-center mb-8 sm:mb-10 lg:mb-12">
                <motion.div
                  className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 bg-gradient-to-br from-success-400 to-vh-red-600 rounded-full mb-6 sm:mb-8 shadow-2xl"
                  whileHover={{ scale: 1.1, rotate: 360 }}
                  transition={{ duration: 0.6 }}
                >
                  <Award className="text-white" size={32} />
                </motion.div>
                <h1 className="text-3xl sm:text-4xl lg:text-6xl font-black text-gray-900 mb-4 sm:mb-6">
                  Quiz <span className="bg-gradient-to-r from-success-400 to-vh-red-600 bg-clip-text text-transparent">Complete!</span>
                </h1>
                <motion.div
                  className="text-4xl sm:text-5xl lg:text-7xl font-black mb-3 sm:mb-4"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, delay: 0.3 }}
                >
                  <span className="bg-gradient-to-r from-vh-red-600 to-success-400 bg-clip-text text-transparent">{quizResults.score.toFixed(1)}</span>
                </motion.div>
                <p className="text-lg sm:text-xl text-gray-600 mb-6 sm:mb-8">Final Score</p>

                <motion.div
                  ref={resultsStatsRef}
                  className="grid md:grid-cols-3 gap-6"
                  variants={staggerContainer}
                  initial="hidden"
                  animate={resultsStatsInView ? "visible" : "hidden"}
                >
                  <motion.div variants={scaleIn} className="group/stat relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-success-400/20 to-transparent rounded-2xl blur-xl group-hover/stat:blur-2xl transition-all duration-500"></div>
                    <Card variant="elevated" padding="lg" className="relative bg-gradient-to-br from-success-50 to-success-100 border-success-200 text-center">
                      <div className="text-4xl font-black text-success-600 mb-2">{quizResults.correctAnswers}</div>
                      <div className="text-success-700 font-bold">Correct</div>
                    </Card>
                  </motion.div>
                  <motion.div variants={scaleIn} className="group/stat relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-error-400/20 to-transparent rounded-2xl blur-xl group-hover/stat:blur-2xl transition-all duration-500"></div>
                    <Card variant="elevated" padding="lg" className="relative bg-gradient-to-br from-error-50 to-error-100 border-error-200 text-center">
                      <div className="text-4xl font-black text-error-600 mb-2">{quizResults.wrongAnswers}</div>
                      <div className="text-error-700 font-bold">Wrong</div>
                    </Card>
                  </motion.div>
                  <motion.div variants={scaleIn} className="group/stat relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-gray-400/20 to-transparent rounded-2xl blur-xl group-hover/stat:blur-2xl transition-all duration-500"></div>
                    <Card variant="elevated" padding="lg" className="relative bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200 text-center">
                      <div className="text-4xl font-black text-gray-600 mb-2">{quizResults.totalQuestions}</div>
                      <div className="text-gray-700 font-bold">Total</div>
                    </Card>
                  </motion.div>
                </motion.div>
              </div>
            </Card>
          </motion.div>

          <Card variant="elevated" padding="lg" className="mb-6 border-t-4 border-vh-red-600">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 shadow-md">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-red-100 rounded-full flex items-center justify-center mt-0.5">
                    <span className="text-red-600 text-sm font-bold">!</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-red-800 mb-2">
                      <span className="font-semibold">Error Occurred</span>
                    </div>
                    <div className="text-red-700 mb-3">
                      <p className="mb-2">{error}</p>
                      <details className="text-sm">
                        <summary className="cursor-pointer hover:text-red-800 font-medium">
                          Troubleshooting Tips
                        </summary>
                        <div className="mt-2 pl-2 border-l-2 border-red-200">
                          <ul className="space-y-1">
                            <li>• Make sure you have selected at least one vocabulary section</li>
                            <li>• Check your internet connection for API access</li>
                            <li>• Try refreshing the page if the problem persists</li>
                            <li>• Reduce the number of questions if you're getting timeout errors</li>
                          </ul>
                        </div>
                      </details>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setError(null)}
                        className="text-red-600 hover:text-red-800 text-sm underline"
                      >
                        Dismiss
                      </button>
                      <button
                        onClick={() => {
                          setError(null);
                          setIsLoading(false);
                        }}
                        className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors"
                      >
                        Try Again
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <Button
                variant="primary"
                size="lg"
                onClick={generateQuestions}
                disabled={selectedSections.length === 0 || isLoading}
                className="group flex items-center justify-center gap-3"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="animate-spin" size={24} />
                    Generating Questions...
                  </>
                ) : (
                  <>
                    <Target size={24} />
                    Start Quiz
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  fetchLeaderboard();
                  setShowLeaderboard(true);
                }}
                className="group flex items-center justify-center gap-3"
              >
                <Trophy size={24} />
                View Champions
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Quiz Screen
  if (currentScreen === 'quiz' && questions.length > 0) {
    const currentQuestion = questions[currentQuestionIndex];

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-vh-red-900 relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0">
          <motion.div
            className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-r from-vh-red-600/20 to-transparent rounded-full blur-3xl"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{
              duration: 6,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          <motion.div
            className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-to-l from-vh-beige-500/10 to-transparent rounded-full blur-3xl"
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.2, 0.4, 0.2],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1
            }}
          />
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
          {/* Header with stats */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Card variant="elevated" padding="lg" className="bg-white/95 backdrop-blur-xl shadow-2xl mb-8 border border-white/20">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-6 mb-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6 w-full sm:w-auto">
                <span className="text-lg sm:text-xl lg:text-2xl font-black text-gray-900">
                  Question {currentQuestionIndex + 1} of {questions.length}
                </span>
                <Badge
                  variant="primary"
                  className="uppercase tracking-wide shadow-lg"
                >
                  {currentQuestion.difficulty}
                </Badge>
              </div>

              <div className="flex items-center gap-2 sm:gap-3 text-xl sm:text-2xl font-black self-end sm:self-auto">
                <Clock className={timeRemaining <= 10 ? 'text-error-600' : 'text-vh-red-600'} size={24} />
                <span className={`${timeRemaining <= 10 ? 'text-error-600 animate-pulse' : 'text-vh-red-600'} font-mono`}>
                  {timeRemaining}s
                </span>
              </div>
            </div>

            <div className="bg-gray-200 rounded-full h-3 overflow-hidden">
              <motion.div
                className="bg-gradient-to-r from-vh-red-600 to-vh-red-800 h-3 rounded-full shadow-lg"
                initial={{ width: 0 }}
                animate={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
          </div>

          {/* Question */}
          <div className="group relative mb-8">
            <div className="absolute inset-0 bg-gradient-to-br from-vh-red/30 to-vh-dark-red/30 rounded-3xl blur-2xl group-hover:blur-3xl transition-all duration-500"></div>
            <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-4 sm:p-6 lg:p-12 border border-white/20">
              <h2 className="text-lg sm:text-xl md:text-2xl lg:text-4xl font-bold text-gray-900 leading-relaxed mb-6 sm:mb-8 lg:mb-10 text-center px-2">
                {currentQuestion.sentence}
              </h2>

              <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
                {currentQuestion.wordBank.map((word, index) => (
                  <button
                    key={index}
                    onClick={() => handleAnswerSelect(word)}
                    className="group/word relative bg-gradient-to-r from-gray-50 to-white p-3 sm:p-4 border-2 border-gray-200 rounded-xl sm:rounded-2xl hover:border-vh-red hover:shadow-xl transition-all duration-300 text-left font-bold hover:bg-gradient-to-r hover:from-vh-beige/20 hover:to-white transform hover:scale-105 active:scale-95 min-h-[52px] sm:min-h-[56px] flex items-center justify-center text-center"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-vh-red/10 to-vh-beige/10 rounded-xl sm:rounded-2xl opacity-0 group-hover/word:opacity-100 transition-opacity duration-300"></div>
                    <span className="relative text-base sm:text-lg text-gray-800 group-hover/word:text-vh-red transition-colors duration-300">{word}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Results Screen
  if (currentScreen === 'results' && quizResults) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white relative overflow-hidden">
        {/* Celebration Background */}
        <div className="absolute inset-0">
          <div className="absolute top-20 right-20 w-72 h-72 bg-gradient-to-r from-green-400/10 to-vh-red/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 left-20 w-96 h-96 bg-gradient-to-l from-vh-beige/20 to-green-400/10 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-5">
            <div className="grid grid-cols-8 gap-8">
              {Array.from({ length: 64 }).map((_, i) => (
                <div key={i} className="aspect-square border border-vh-red/20 rounded-full animate-pulse" style={{animationDelay: `${i * 50}ms`}}></div>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-20 relative z-10">
          <div className="group relative mb-8 sm:mb-12 lg:mb-16">
            <div className="absolute inset-0 bg-gradient-to-br from-vh-red/20 to-green-400/20 rounded-3xl blur-2xl group-hover:blur-3xl transition-all duration-700"></div>
            <div className="relative bg-white rounded-3xl shadow-2xl p-6 sm:p-8 lg:p-12 border border-gray-100 group-hover:shadow-4xl transition-all duration-700">
              <div className="text-center mb-8 sm:mb-10 lg:mb-12">
                <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 bg-gradient-to-br from-green-400 to-vh-red rounded-full mb-6 sm:mb-8 shadow-2xl">
                  <Award className="text-white" size={32} />
                </div>
                <h1 className="text-3xl sm:text-4xl lg:text-6xl font-black text-gray-900 mb-4 sm:mb-6">
                  Quiz <span className="bg-gradient-to-r from-green-400 to-vh-red bg-clip-text text-transparent">Complete!</span>
                </h1>
                <div className="text-4xl sm:text-5xl lg:text-7xl font-black mb-3 sm:mb-4">
                  <span className="bg-gradient-to-r from-vh-red to-green-400 bg-clip-text text-transparent">{quizResults.score.toFixed(1)}</span>
                </div>
                <p className="text-lg sm:text-xl text-gray-600 mb-6 sm:mb-8">Final Score</p>
                
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="group/stat relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-green-400/20 to-transparent rounded-2xl blur-xl group-hover/stat:blur-2xl transition-all duration-500"></div>
                    <div className="relative bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-6 text-center border border-green-200 shadow-lg">
                      <div className="text-4xl font-black text-green-600 mb-2">{quizResults.correctAnswers}</div>
                      <div className="text-green-700 font-bold">Correct</div>
                    </div>
                  </div>
                  <div className="group/stat relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-red-400/20 to-transparent rounded-2xl blur-xl group-hover/stat:blur-2xl transition-all duration-500"></div>
                    <div className="relative bg-gradient-to-br from-red-50 to-red-100 rounded-2xl p-6 text-center border border-red-200 shadow-lg">
                      <div className="text-4xl font-black text-red-600 mb-2">{quizResults.wrongAnswers}</div>
                      <div className="text-red-700 font-bold">Wrong</div>
                    </div>
                  </div>
                  <div className="group/stat relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-gray-400/20 to-transparent rounded-2xl blur-xl group-hover/stat:blur-2xl transition-all duration-500"></div>
                    <div className="relative bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-6 text-center border border-gray-200 shadow-lg">
                      <div className="text-4xl font-black text-gray-600 mb-2">{quizResults.totalQuestions}</div>
                      <div className="text-gray-700 font-bold">Total</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border-t-4 border-vh-red">
            <h2 className="text-2xl font-semibold mb-4 text-gray-800">Detailed Results</h2>
            
            {explanations.length === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <p className="text-yellow-800 text-sm">
                  <span className="font-semibold">Note:</span> Detailed explanations could not be loaded. 
                  Basic results are shown below.
                </p>
              </div>
            )}
            
            <div className="space-y-4">
              {quizResults.results.map((result, index) => {
                const explanation = explanations[index];
                
                return (
                  <div key={index} className={`p-4 rounded-lg border-2 ${
                    result.isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                  }`}>
                    <div className="flex items-start justify-between mb-2">
                      <span className="font-semibold">Question {index + 1}</span>
                      <span className={`px-2 py-1 rounded text-sm font-medium ${
                        result.isCorrect ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
                      }`}>
                        {result.isCorrect ? 'Correct' : 'Incorrect'}
                      </span>
                    </div>
                    
                    <p className="mb-3 text-gray-700">
                      {result.sentence.replace('_______', `**${result.correctAnswer}**`)}
                    </p>
                    
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Your answer: </span>
                        <span className={result.isCorrect ? 'text-green-600' : 'text-red-600'}>
                          {result.userAnswer || 'No answer'}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium">Correct answer: </span>
                        <span className="text-green-600">{result.correctAnswer}</span>
                      </div>
                    </div>
                    
                    {explanation ? (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <h4 className="font-semibold text-gray-800 mb-1">{explanation.word}</h4>
                        <p className="text-gray-700 mb-2">{explanation.definition}</p>
                        <p className="text-gray-600 text-sm">{explanation.explanation}</p>
                      </div>
                    ) : (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-gray-500 text-sm italic">
                          Detailed explanation not available for this question.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <motion.div
            className="flex flex-col sm:flex-row gap-6 justify-center"
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
          >
            <Button
              variant="primary"
              size="lg"
              onClick={resetQuiz}
              className="group flex items-center justify-center gap-3"
            >
              <RotateCcw size={24} />
              Take Another Quiz
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                fetchLeaderboard();
                setShowLeaderboard(true);
              }}
              className="group flex items-center justify-center gap-3"
            >
              <Trophy size={24} />
              View Champions
            </Button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-vh-beige/20 flex items-center justify-center relative overflow-hidden">
      <div className="text-center relative z-10">
        <RefreshCw className="animate-spin mx-auto mb-4 text-vh-red" size={48} />
        <p className="text-gray-600 mb-2">Loading...</p>
      </div>
    </div>
  );
};

export default function VocabQuizPage() {
  return (
    <ProtectedRoute>
      <VocabularyQuizApp />
    </ProtectedRoute>
  );
}