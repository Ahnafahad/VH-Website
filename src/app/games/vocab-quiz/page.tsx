'use client';

import React, { useState, useEffect } from 'react';
import { Clock, BookOpen, Target, Award, RefreshCw } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';

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

interface Explanation {
  word: string;
  definition: string;
  explanation: string;
}

const VocabularyQuizApp = () => {
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
  }, [timeRemaining, currentScreen]);

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

Format rules:
1. Each sentence should have ONE blank marked with _______
2. Word bank should have 8-10 words (include correct answer + distractors)
3. Questions should test contextual understanding
4. Use formal, academic language

Respond with JSON in this exact format:
{
  "questions": [
    {
      "sentence": "Complete sentence with _______",
      "wordBank": ["word1", "word2", "word3", "word4", "word5", "word6", "word7", "word8"],
      "correctAnswer": "correctword",
      "difficulty": "easy|medium|hard"
    }
  ]
}

DO NOT OUTPUT ANYTHING OTHER THAN VALID JSON.`;

      const requestBody = {
        model: "deepseek/deepseek-chat-v3.1:free",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 4000,
        temperature: 0.7
      };
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=AIzaSyBbzvVwymrwjGqKOkD77dkIgEnRGwbL30c`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Google Gemini API request failed: ${response.status} ${response.statusText}. ${errorText}`);
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
      } catch (parseError) {
        console.error('Failed to parse JSON:', cleanedResponse);
        throw new Error('Failed to parse AI response as JSON');
      }
      
      if (!parsedResponse.questions || !Array.isArray(parsedResponse.questions)) {
        throw new Error('No valid questions found in AI response');
      }
      
      const validQuestions = parsedResponse.questions.filter((q: Question) => 
        q.sentence && q.wordBank && q.correctAnswer && q.difficulty &&
        Array.isArray(q.wordBank) && q.wordBank.length >= 6
      );
      
      if (validQuestions.length === 0) {
        throw new Error('No valid questions generated');
      }
      
      setQuestions(validQuestions.slice(0, quizConfig.questionCount));
      setCurrentScreen('quiz');
      setTimeRemaining(quizConfig.timePerQuestion);
      
    } catch (error) {
      console.error('Question generation failed:', error);
      setError(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    setIsLoading(false);
  };

  // Generate explanations using OpenRouter
  const generateExplanations = async (questionsWithAnswers: (Question & { userAnswer: string })[]) => {
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

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=AIzaSyBbzvVwymrwjGqKOkD77dkIgEnRGwbL30c`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
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
  };

  // Handle answer selection
  const handleAnswerSelect = (selectedWord: string) => {
    const newAnswers = [...userAnswers];
    newAnswers[currentQuestionIndex] = selectedWord;
    setUserAnswers(newAnswers);
    
    setTimeout(() => {
      handleNextQuestion();
    }, 500);
  };

  // Handle next question
  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setTimeRemaining(quizConfig.timePerQuestion);
    } else {
      finishQuiz();
    }
  };

  // Finish quiz and calculate results
  const finishQuiz = () => {
    const results = questions.map((q, index) => ({
      ...q,
      userAnswer: userAnswers[index],
      isCorrect: userAnswers[index] === q.correctAnswer
    }));

    const correctCount = results.filter(r => r.isCorrect).length;
    const wrongCount = results.length - correctCount;
    const score = correctCount * 1 + wrongCount * (-0.25);

    setQuizResults({
      totalQuestions: results.length,
      correctAnswers: correctCount,
      wrongAnswers: wrongCount,
      score: Math.max(0, score),
      results: results
    });

    generateExplanations(results);
    setCurrentScreen('results');
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
  };

  // Section Selection Screen
  if (currentScreen === 'setup') {
    return (
      <div className="min-h-screen bg-vh-beige/20 p-4 relative overflow-hidden">
        <div className="max-w-4xl mx-auto relative z-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-vh-red to-vh-dark-red rounded-lg mb-4">
              <BookOpen className="text-white" size={32} />
            </div>
            <h1 className="text-4xl font-bold text-gray-800 mb-2 flex items-center justify-center gap-3">
              Vocabulary Quiz
            </h1>
            <p className="text-vh-red font-medium text-lg">Test your vocabulary mastery with adaptive difficulty</p>
            
            <div className="mt-4 p-4 bg-white rounded-lg border-l-4 border-vh-red shadow-lg">
              <p className="text-sm font-bold text-vh-red mb-1">
                🚀 Powered by AI-Generated Questions
              </p>
              <p className="text-xs text-gray-600">
                This quiz uses advanced AI to generate custom questions tailored to your selected sections
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border-t-4 border-vh-red">
            <h2 className="text-2xl font-semibold mb-4 text-gray-800">Select Vocabulary Sections</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
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
                  className={`p-3 rounded-lg border-2 transition-all ${
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
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border-t-4 border-vh-red">
            <h2 className="text-2xl font-semibold mb-4 text-gray-800">Quiz Configuration</h2>
            
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
          </div>

          <div className="text-center">
            {error && (
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
            
            <button
              onClick={generateQuestions}
              disabled={selectedSections.length === 0 || isLoading}
              className="bg-gradient-to-r from-vh-red to-vh-dark-red text-white px-8 py-3 rounded-lg text-lg font-semibold hover:from-vh-dark-red hover:to-vh-red disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center gap-2 mx-auto shadow-lg"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="animate-spin" size={20} />
                  Generating Questions...
                </>
              ) : (
                <>
                  <Target size={20} />
                  Start Quiz
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Quiz Screen
  if (currentScreen === 'quiz' && questions.length > 0) {
    const currentQuestion = questions[currentQuestionIndex];
    
    return (
      <div className="min-h-screen bg-vh-beige/20 p-4 relative overflow-hidden">
        <div className="max-w-4xl mx-auto relative z-10">
          <div className="bg-white rounded-xl shadow-lg p-4 mb-6 border-t-4 border-vh-red">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <span className="text-lg font-semibold">
                  Question {currentQuestionIndex + 1} of {questions.length}
                </span>
                <div className="bg-vh-beige px-3 py-1 rounded-full text-sm font-medium text-vh-red">
                  {currentQuestion.difficulty.toUpperCase()}
                </div>
              </div>
              
              <div className="flex items-center gap-2 text-lg font-bold">
                <Clock className={timeRemaining <= 10 ? 'text-red-500' : 'text-vh-red'} />
                <span className={timeRemaining <= 10 ? 'text-red-500' : 'text-vh-red'}>
                  {timeRemaining}s
                </span>
              </div>
            </div>
            
            <div className="mt-3 bg-gray-200 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-vh-red to-vh-dark-red h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-8 mb-6 border-t-4 border-vh-red">
            <h2 className="text-2xl font-semibold mb-6 text-gray-800 leading-relaxed">
              {currentQuestion.sentence}
            </h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {currentQuestion.wordBank.map((word, index) => (
                <button
                  key={index}
                  onClick={() => handleAnswerSelect(word)}
                  className="p-3 border-2 border-gray-200 rounded-lg hover:border-vh-red hover:bg-vh-beige/20 transition-all text-left font-medium hover:shadow-md"
                >
                  {word}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Results Screen
  if (currentScreen === 'results' && quizResults) {
    return (
      <div className="min-h-screen bg-vh-beige/20 p-4 relative overflow-hidden">
        <div className="max-w-4xl mx-auto relative z-10">
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border-t-4 border-vh-red">
            <div className="text-center">
              <Award className="mx-auto text-vh-red mb-4" size={48} />
              <h1 className="text-3xl font-bold text-gray-800 mb-2">Quiz Complete!</h1>
              <div className="text-5xl font-bold text-vh-red mb-4">
                {quizResults.score.toFixed(2)}
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <div className="text-2xl font-bold text-green-600">{quizResults.correctAnswers}</div>
                  <div className="text-green-700">Correct</div>
                </div>
                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                  <div className="text-2xl font-bold text-red-600">{quizResults.wrongAnswers}</div>
                  <div className="text-red-700">Wrong</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="text-2xl font-bold text-gray-600">{quizResults.totalQuestions}</div>
                  <div className="text-gray-600">Total</div>
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

          <div className="text-center">
            <button
              onClick={resetQuiz}
              className="bg-gradient-to-r from-vh-red to-vh-dark-red text-white px-8 py-3 rounded-lg text-lg font-semibold hover:from-vh-dark-red hover:to-vh-red transition-all duration-300 shadow-lg"
            >
              Take Another Quiz
            </button>
          </div>
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