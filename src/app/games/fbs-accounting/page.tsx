'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';
import {
  Play,
  Trophy,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Circle,
  Lock,
  BookOpen,
  Clock,
  Calculator
} from 'lucide-react';
import {
  GameState,
  LectureData,
  AccountingQuestion,
  QuestionResult,
  GameResults,
  SingularLeaderboardEntry,
  CumulativeLeaderboardEntry
} from './types';
import {
  getAccountingQuestions,
  getQuestionsByLectures,
  calculateSimpleScore,
  calculateDynamicScore,
  calculateSpeedBonus,
  generateQuestionResults,
  getShortTitle,
  formatTime,
  getTotalAvailableQuestions,
  isLectureAvailable,
  saveScore,
  fetchLeaderboard
} from '@/lib/accounting-utils';

function FBSAccountingGame() {
  const { data: session } = useSession();

  // FBS Access Control
  const [hasFBSAccess, setHasFBSAccess] = useState<boolean | null>(null);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);

  // Game state
  const [gameState, setGameState] = useState<GameState>('setup');

  // Lecture data
  const [allLectures, setAllLectures] = useState<LectureData[]>([]);
  const [loading, setLoading] = useState(true);

  // Setup configuration
  const [selectedLectures, setSelectedLectures] = useState<number[]>([]);

  // Playing state
  const [questions, setQuestions] = useState<AccountingQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<(string | null)[]>([]);
  const [questionTimes, setQuestionTimes] = useState<number[]>([]); // Time taken per question
  const [questionStartTime, setQuestionStartTime] = useState<number>(0); // When current question started
  const [startTime, setStartTime] = useState<number>(0); // Overall quiz start time

  // Results state
  const [gameResults, setGameResults] = useState<GameResults | null>(null);
  const [isSavingScore, setIsSavingScore] = useState(false);

  // Leaderboard state
  const [singularLeaderboard, setSingularLeaderboard] = useState<SingularLeaderboardEntry[]>([]);
  const [cumulativeLeaderboard, setCumulativeLeaderboard] = useState<CumulativeLeaderboardEntry[]>([]);
  const [activeLeaderboardTab, setActiveLeaderboardTab] = useState<'singular' | 'cumulative'>('singular');
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);

  // Check FBS access on mount
  useEffect(() => {
    const checkFBSAccess = async () => {
      if (!session?.user?.email) {
        setIsCheckingAccess(false);
        return;
      }

      try {
        const response = await fetch('/api/user/access');
        if (response.ok) {
          const data = await response.json();
          setHasFBSAccess(data.accessTypes?.FBS === true);
        } else {
          setHasFBSAccess(false);
        }
      } catch (error) {
        console.error('Error checking FBS access:', error);
        setHasFBSAccess(false);
      } finally {
        setIsCheckingAccess(false);
      }
    };

    checkFBSAccess();
  }, [session]);

  // Load lectures on mount
  useEffect(() => {
    const loadLectures = async () => {
      try {
        const lectures = await getAccountingQuestions();
        setAllLectures(lectures);
      } catch (error) {
        console.error('Error loading lectures:', error);
      } finally {
        setLoading(false);
      }
    };

    loadLectures();
  }, []);

  // Live timer for current question (updates every second during play)
  const [currentQuestionElapsed, setCurrentQuestionElapsed] = useState(0);

  useEffect(() => {
    if (gameState !== 'playing') {
      setCurrentQuestionElapsed(0);
      return;
    }

    const timer = setInterval(() => {
      setCurrentQuestionElapsed(Math.floor((Date.now() - questionStartTime) / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState, questionStartTime]);

  // Toggle lecture selection
  const toggleLecture = (lectureNum: number) => {
    setSelectedLectures(prev => {
      if (prev.includes(lectureNum)) {
        return prev.filter(l => l !== lectureNum);
      } else {
        return [...prev, lectureNum].sort((a, b) => a - b);
      }
    });
  };

  // Start quiz (always 16 questions)
  const startQuiz = () => {
    if (selectedLectures.length === 0) {
      alert('Please select at least one lecture');
      return;
    }

    try {
      const quizQuestions = getQuestionsByLectures(
        allLectures,
        selectedLectures
      );

      setQuestions(quizQuestions);
      setUserAnswers(new Array(quizQuestions.length).fill(null));
      setQuestionTimes(new Array(quizQuestions.length).fill(0));
      setCurrentQuestionIndex(0);
      setStartTime(Date.now());
      setQuestionStartTime(Date.now());
      setGameState('playing');
    } catch (error) {
      console.error('Error starting quiz:', error);
      alert(error instanceof Error ? error.message : 'Failed to start quiz');
    }
  };

  // Answer question (track time taken)
  const answerQuestion = (answer: string) => {
    const timeTaken = Math.floor((Date.now() - questionStartTime) / 1000);

    const newAnswers = [...userAnswers];
    newAnswers[currentQuestionIndex] = answer;
    setUserAnswers(newAnswers);

    const newTimes = [...questionTimes];
    newTimes[currentQuestionIndex] = timeTaken;
    setQuestionTimes(newTimes);
  };

  // Navigate questions (reset timer for new question)
  const goToPrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      setQuestionStartTime(Date.now());
    }
  };

  const goToNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      // Save time for current question if not already answered
      if (questionTimes[currentQuestionIndex] === 0) {
        const timeTaken = Math.floor((Date.now() - questionStartTime) / 1000);
        const newTimes = [...questionTimes];
        newTimes[currentQuestionIndex] = timeTaken;
        setQuestionTimes(newTimes);
      }

      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setQuestionStartTime(Date.now());
    }
  };

  // Finish quiz (calculate dual scores)
  const finishQuiz = () => {
    // Ensure last question's time is recorded
    const finalTimes = [...questionTimes];
    if (finalTimes[currentQuestionIndex] === 0) {
      finalTimes[currentQuestionIndex] = Math.floor((Date.now() - questionStartTime) / 1000);
    }

    const totalTimeTaken = Math.floor((Date.now() - startTime) / 1000);

    // Calculate simple score
    const simpleScoreData = calculateSimpleScore(questions, userAnswers);

    // Generate question results with time and speed bonuses
    const questionResults = generateQuestionResults(questions, userAnswers, finalTimes);

    // Calculate dynamic score
    const dynamicScoreData = calculateDynamicScore(
      questionResults,
      selectedLectures.length
    );

    const results: GameResults = {
      simpleScore: simpleScoreData.score,
      dynamicScore: dynamicScoreData.dynamicScore,
      totalSpeedBonus: dynamicScoreData.totalSpeedBonus,
      lectureCoverageBonus: dynamicScoreData.lectureCoverageBonus,
      questionsAnswered: questions.length,
      correctAnswers: simpleScoreData.correct,
      wrongAnswers: simpleScoreData.wrong,
      skippedAnswers: simpleScoreData.skipped,
      accuracy: simpleScoreData.accuracy,
      selectedLectures,
      timeTaken: totalTimeTaken,
      results: questionResults
    };

    setGameResults(results);
    setGameState('finished');

    // Auto-save score
    if (results.questionsAnswered > 0) {
      setIsSavingScore(true);
      saveScore(results)
        .then(() => {
          console.log('Score saved successfully');
        })
        .catch(error => {
          console.error('Error saving score:', error);
        })
        .finally(() => {
          setIsSavingScore(false);
        });
    }
  };

  // Load leaderboard (both singular and cumulative)
  const loadLeaderboard = async () => {
    setIsLoadingLeaderboard(true);
    setGameState('leaderboard');
    try {
      const data = await fetchLeaderboard();
      setSingularLeaderboard(data.singular || []);
      setCumulativeLeaderboard(data.cumulative || []);
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    } finally {
      setIsLoadingLeaderboard(false);
    }
  };

  // Reset to setup
  const resetToSetup = () => {
    setGameState('setup');
    setCurrentQuestionIndex(0);
    setUserAnswers([]);
    setGameResults(null);
  };

  // Access denied screen
  if (isCheckingAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-vh-red mx-auto mb-4"></div>
          <p className="text-gray-600">Checking access...</p>
        </div>
      </div>
    );
  }

  if (hasFBSAccess === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-md text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock className="text-red-600" size={40} />
          </div>
          <h1 className="text-3xl font-black text-gray-900 mb-4">FBS Students Only</h1>
          <p className="text-gray-600 mb-2">
            This game is exclusively available to FBS students.
          </p>
          <p className="text-sm text-gray-500 mb-8">
            If you believe this is an error, please contact your administrator.
          </p>
          <Link href="/" className="inline-block bg-gradient-to-r from-vh-red to-vh-dark-red text-white px-8 py-3 rounded-2xl font-bold hover:shadow-lg transition-all">
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-vh-red mx-auto mb-4"></div>
          <p className="text-gray-600">Loading accounting questions...</p>
        </div>
      </div>
    );
  }

  // =========================
  // STATE 1: SETUP SCREEN
  // =========================
  if (gameState === 'setup') {
    const totalAvailable = getTotalAvailableQuestions(allLectures, selectedLectures);

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white py-12 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-vh-red to-vh-dark-red rounded-2xl mb-6">
              <Calculator className="text-white" size={40} />
            </div>
            <h1 className="text-5xl font-black text-gray-900 mb-4">
              FBS Accounting Game
            </h1>
            <p className="text-xl text-gray-600">
              Master accounting concepts with interactive MCQs
            </p>
          </div>

          {/* Lecture Selection */}
          <div className="bg-white rounded-3xl shadow-2xl p-8 mb-8">
            <h2 className="text-2xl font-black text-gray-900 mb-6">
              Select Lectures to Practice
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {allLectures.map(lecture => {
                const isSelected = selectedLectures.includes(lecture.lectureNumber);
                const isAvailable = isLectureAvailable(lecture);

                return (
                  <div key={lecture.lectureNumber} className="relative group">
                    {/* Checkbox Card */}
                    <label
                      className={`
                        flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer
                        transition-all duration-300
                        ${isSelected
                          ? 'border-vh-red bg-vh-red/5'
                          : 'border-gray-200 hover:border-vh-red/50'
                        }
                        ${!isAvailable ? 'opacity-50 cursor-not-allowed' : ''}
                      `}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleLecture(lecture.lectureNumber)}
                        disabled={!isAvailable}
                        className="w-5 h-5 text-vh-red"
                      />

                      <div className="flex-1">
                        <div className="font-bold text-gray-900 flex items-center gap-2">
                          <BookOpen size={16} className="text-vh-red" />
                          Lecture {lecture.lectureNumber}: {getShortTitle(lecture.topics)}
                        </div>
                        <div className="text-sm text-gray-600">
                          {lecture.questionCount} questions
                          {!isAvailable && (
                            <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                              Coming Soon
                            </span>
                          )}
                        </div>
                      </div>
                    </label>

                    {/* Tooltip */}
                    {isAvailable && (
                      <div className="absolute left-0 top-full mt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 pointer-events-none">
                        <div className="bg-gray-900 text-white rounded-lg shadow-xl p-4 max-w-md">
                          <div className="font-semibold mb-2">Lecture {lecture.lectureNumber} Topics:</div>
                          <div className="text-sm leading-relaxed">{lecture.topics}</div>
                          <div className="mt-2 text-xs text-gray-400">
                            {lecture.sections.length} sections • {lecture.questionCount} questions
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Summary - Professional Card */}
            <div className="bg-gradient-to-br from-vh-red/5 via-vh-beige/10 to-vh-red/5 border-2 border-vh-red/20 rounded-2xl p-6 shadow-inner">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-600 uppercase tracking-wide mb-1">
                    Quiz Configuration
                  </div>
                  <div className="text-2xl font-black text-gray-900">
                    <span className="text-vh-red">{selectedLectures.length}</span> lecture{selectedLectures.length !== 1 ? 's' : ''} selected
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-600 uppercase tracking-wide mb-1">
                    Questions
                  </div>
                  <div className="text-2xl font-black text-gray-900">
                    <span className="text-vh-red">16</span> total
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>+1 per correct</span>
                  </div>
                  <div className="text-gray-400">•</div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span>-0.25 per wrong</span>
                  </div>
                  <div className="text-gray-400">•</div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span>Speed bonuses</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={startQuiz}
              disabled={selectedLectures.length === 0}
              className="flex-1 flex items-center justify-center gap-3 bg-gradient-to-r from-vh-red to-vh-dark-red text-white px-8 py-4 rounded-2xl font-bold text-lg hover:shadow-2xl hover:shadow-vh-red/25 transform hover:-translate-y-1 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              <Play size={24} />
              Start Quiz
            </button>

            <button
              onClick={loadLeaderboard}
              className="flex-1 flex items-center justify-center gap-3 border-2 border-vh-red text-vh-red px-8 py-4 rounded-2xl font-bold text-lg hover:bg-vh-red hover:text-white transition-all duration-300"
            >
              <Trophy size={24} />
              View Leaderboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================
  // STATE 2: PLAYING SCREEN
  // =========================
  if (gameState === 'playing') {
    const currentQuestion = questions[currentQuestionIndex];
    const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
    const answeredCount = userAnswers.filter(a => a !== null).length;

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-vh-dark-red text-white py-8 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-medium text-gray-400">
                Question {currentQuestionIndex + 1} of {questions.length}
              </div>
              <div className="flex items-center gap-4">
                {/* Live Timer with Speed Bonus Indicator */}
                <div className={`
                  flex items-center gap-2 px-4 py-2 rounded-xl font-mono font-bold transition-all
                  ${currentQuestionElapsed < 5
                    ? 'bg-green-500/20 text-green-400 ring-2 ring-green-500/30'
                    : currentQuestionElapsed < 10
                    ? 'bg-blue-500/20 text-blue-400'
                    : currentQuestionElapsed < 15
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'bg-gray-700 text-gray-400'
                  }
                `}>
                  <Clock size={18} />
                  <span className="text-lg">{formatTime(currentQuestionElapsed)}</span>
                  {currentQuestionElapsed < 5 && (
                    <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">+0.5</span>
                  )}
                  {currentQuestionElapsed >= 5 && currentQuestionElapsed < 10 && (
                    <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">+0.3</span>
                  )}
                  {currentQuestionElapsed >= 10 && currentQuestionElapsed < 15 && (
                    <span className="text-xs bg-yellow-500 text-white px-2 py-0.5 rounded-full">+0.15</span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Circle size={16} className="text-green-500" />
                  {answeredCount} answered
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-800 rounded-full h-2.5 overflow-hidden shadow-inner">
              <div
                className="bg-gradient-to-r from-vh-red via-pink-500 to-vh-dark-red h-full transition-all duration-500 shadow-lg"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Lecture Badge */}
            <div className="mt-4 inline-flex items-center gap-2 bg-gradient-to-r from-vh-red/20 to-vh-dark-red/20 border border-vh-red/50 px-5 py-2.5 rounded-xl backdrop-blur-sm">
              <BookOpen size={18} className="text-vh-red" />
              <span className="text-sm font-bold text-white">
                Lecture {currentQuestion.lecture}
              </span>
              <span className="text-gray-400">•</span>
              <span className="text-sm text-gray-300">
                {currentQuestion.section}
              </span>
            </div>
          </div>

          {/* Question */}
          <div className="bg-white rounded-3xl shadow-2xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 leading-relaxed mb-8">
              {currentQuestion.question}
            </h2>

            {/* Options */}
            <div className="grid grid-cols-1 gap-3">
              {['A', 'B', 'C', 'D', 'E'].map(letter => (
                <button
                  key={letter}
                  onClick={() => answerQuestion(letter)}
                  className={`
                    p-4 rounded-2xl font-medium text-lg text-left transition-all duration-300
                    ${userAnswers[currentQuestionIndex] === letter
                      ? 'bg-gradient-to-r from-vh-red to-vh-dark-red text-white ring-4 ring-vh-red/30'
                      : 'bg-gray-100 text-gray-900 hover:bg-vh-red/10 hover:text-vh-red'
                    }
                  `}
                >
                  <span className="font-bold mr-3">{letter}.</span>
                  {currentQuestion.options[letter as 'A' | 'B' | 'C' | 'D' | 'E']}
                </button>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between gap-4">
            <button
              onClick={goToPrevious}
              disabled={currentQuestionIndex === 0}
              className="flex items-center gap-2 bg-gray-800 text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-700 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={20} />
              Previous
            </button>

            <button
              onClick={finishQuiz}
              className="bg-gradient-to-r from-green-600 to-green-700 text-white px-8 py-3 rounded-xl font-bold hover:shadow-lg transition-all"
            >
              Finish Quiz
            </button>

            <button
              onClick={goToNext}
              disabled={currentQuestionIndex === questions.length - 1}
              className="flex items-center gap-2 bg-gray-800 text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-700 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Answer Status Indicator */}
          <div className="mt-8 flex justify-center gap-2 flex-wrap">
            {questions.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentQuestionIndex(idx)}
                className={`
                  w-8 h-8 rounded-lg font-medium text-sm transition-all
                  ${idx === currentQuestionIndex
                    ? 'bg-vh-red text-white ring-2 ring-white'
                    : userAnswers[idx] !== null
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-700 text-gray-400'
                  }
                `}
              >
                {idx + 1}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // =========================
  // STATE 3: FINISHED SCREEN
  // =========================
  if (gameState === 'finished' && gameResults) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white py-12 px-4">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-500 to-green-700 rounded-full mb-6 animate-pulse">
              <Check className="text-white" size={40} />
            </div>
            <h1 className="text-5xl font-black text-gray-900 mb-4">
              Quiz Complete!
            </h1>
            <p className="text-xl text-gray-600">
              Here's how you performed
            </p>
            {isSavingScore && (
              <p className="text-sm text-gray-500 mt-2">Saving score...</p>
            )}
          </div>

          {/* Dual Score Display - Premium Design */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Dynamic Score (Primary) */}
            <div className="relative bg-gradient-to-br from-vh-red via-pink-600 to-vh-dark-red text-white rounded-3xl p-8 shadow-2xl overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
              <div className="relative z-10">
                <div className="text-sm font-bold uppercase tracking-wider opacity-90 mb-2">
                  Dynamic Score (Leaderboard)
                </div>
                <div className="text-6xl font-black mb-3 drop-shadow-lg">
                  {gameResults.dynamicScore.toFixed(2)}
                </div>
                <div className="flex flex-col gap-2 text-sm">
                  <div className="flex items-center justify-between bg-white/10 rounded-lg px-3 py-2 backdrop-blur-sm">
                    <span className="opacity-90">Simple Score</span>
                    <span className="font-bold">+{gameResults.simpleScore.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between bg-white/10 rounded-lg px-3 py-2 backdrop-blur-sm">
                    <span className="opacity-90">Speed Bonuses</span>
                    <span className="font-bold text-green-300">+{gameResults.totalSpeedBonus.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between bg-white/10 rounded-lg px-3 py-2 backdrop-blur-sm">
                    <span className="opacity-90">Lecture Coverage</span>
                    <span className="font-bold text-blue-300">+{gameResults.lectureCoverageBonus.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Simple Score (Secondary) */}
            <div className="bg-white border-2 border-gray-200 rounded-3xl p-8 shadow-xl">
              <div className="text-sm font-bold uppercase tracking-wider text-gray-600 mb-2">
                Simple Score (Base)
              </div>
              <div className="text-6xl font-black text-gray-900 mb-6">
                {gameResults.simpleScore.toFixed(2)}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                  <div className="text-2xl font-black text-green-700">+{gameResults.correctAnswers}</div>
                  <div className="text-xs font-medium text-green-600 mt-1">Correct</div>
                  <div className="text-xs text-gray-500 mt-0.5">+{gameResults.correctAnswers}.00</div>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                  <div className="text-2xl font-black text-red-700">{gameResults.wrongAnswers}</div>
                  <div className="text-xs font-medium text-red-600 mt-1">Wrong</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {gameResults.wrongAnswers > 0 ? `-${(gameResults.wrongAnswers * 0.25).toFixed(2)}` : '0.00'}
                  </div>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
                  <div className="text-2xl font-black text-gray-700">{gameResults.skippedAnswers}</div>
                  <div className="text-xs font-medium text-gray-600 mt-1">Skipped</div>
                  <div className="text-xs text-gray-500 mt-0.5">0.00</div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>Accuracy:</span>
                  <span className="font-bold text-gray-900">{gameResults.accuracy.toFixed(1)}%</span>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-600 mt-2">
                  <span>Total Time:</span>
                  <span className="font-bold text-gray-900">{formatTime(gameResults.timeTaken)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bonus Breakdown Card */}
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-blue-200 rounded-2xl p-6 mb-8">
            <div className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-lg">🚀</span>
              How Your Dynamic Score Was Calculated
            </div>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="font-semibold text-gray-700 mb-2">Base Score</div>
                <div className="text-gray-600 leading-relaxed">
                  {gameResults.correctAnswers} correct (+1 each) = <span className="font-bold text-green-600">+{gameResults.correctAnswers}.00</span><br/>
                  {gameResults.wrongAnswers} wrong (-0.25 each) = <span className="font-bold text-red-600">-{(gameResults.wrongAnswers * 0.25).toFixed(2)}</span>
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="font-semibold text-gray-700 mb-2">Speed Bonuses</div>
                <div className="text-gray-600 leading-relaxed">
                  Answered quickly across {gameResults.results.filter(r => r.speedBonus > 0).length} questions<br/>
                  Total bonus: <span className="font-bold text-blue-600">+{gameResults.totalSpeedBonus.toFixed(2)}</span>
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="font-semibold text-gray-700 mb-2">Lecture Coverage</div>
                <div className="text-gray-600 leading-relaxed">
                  Selected {selectedLectures.length} lectures<br/>
                  Coverage bonus: <span className="font-bold text-purple-600">+{gameResults.lectureCoverageBonus.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Results */}
          <div className="bg-white rounded-3xl shadow-2xl p-8 mb-8">
            <h2 className="text-2xl font-black text-gray-900 mb-6">Detailed Results</h2>

            <div className="space-y-4">
              {gameResults.results.map((result, idx) => (
                <details key={idx} className="group">
                  <summary className={`
                    cursor-pointer p-5 rounded-xl transition-all hover:shadow-md
                    ${result.isCorrect
                      ? 'bg-green-50 border-2 border-green-500'
                      : result.isSkipped
                      ? 'bg-gray-50 border-2 border-gray-300'
                      : 'bg-red-50 border-2 border-red-500'
                    }
                  `}>
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 mt-1">
                        {result.isCorrect ? (
                          <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                            <Check size={20} className="text-white" />
                          </div>
                        ) : result.isSkipped ? (
                          <div className="w-10 h-10 bg-gray-400 rounded-full flex items-center justify-center">
                            <Circle size={20} className="text-white" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
                            <X size={20} className="text-white" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-bold text-gray-900">
                            Question {idx + 1} • Lecture {result.question.lecture}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600 font-mono">
                              {formatTime(result.timeTaken)}
                            </span>
                            {result.speedBonus > 0 && (
                              <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                                +{result.speedBonus}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-gray-700">
                          {result.question.question}
                        </div>
                      </div>
                    </div>
                  </summary>

                  <div className="mt-4 pl-4 pr-4 pb-4 space-y-3">
                    {/* Your Answer */}
                    <div>
                      <div className="text-sm font-medium text-gray-600 mb-1">Your Answer:</div>
                      <div className={`
                        p-3 rounded-lg
                        ${result.isCorrect
                          ? 'bg-green-100 text-green-900'
                          : result.isSkipped
                          ? 'bg-gray-100 text-gray-600'
                          : 'bg-red-100 text-red-900'
                        }
                      `}>
                        {result.isSkipped
                          ? 'Not answered (skipped)'
                          : `${result.userAnswer}. ${result.question.options[result.userAnswer!]}`
                        }
                      </div>
                    </div>

                    {/* Correct Answer */}
                    {!result.isCorrect && (
                      <div>
                        <div className="text-sm font-medium text-gray-600 mb-1">Correct Answer:</div>
                        <div className="p-3 rounded-lg bg-green-100 text-green-900">
                          {result.question.correctAnswer}. {result.question.options[result.question.correctAnswer]}
                        </div>
                      </div>
                    )}

                    {/* Explanation */}
                    {result.question.explanation && (
                      <div>
                        <div className="text-sm font-medium text-gray-600 mb-1">Explanation:</div>
                        <div className="p-3 rounded-lg bg-blue-50 text-gray-700">
                          {result.question.explanation}
                        </div>
                      </div>
                    )}
                  </div>
                </details>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={resetToSetup}
              className="flex-1 flex items-center justify-center gap-3 border-2 border-vh-red text-vh-red px-8 py-4 rounded-2xl font-bold text-lg hover:bg-vh-red hover:text-white transition-all duration-300"
            >
              <RotateCcw size={24} />
              Try Again
            </button>

            <button
              onClick={loadLeaderboard}
              className="flex-1 flex items-center justify-center gap-3 bg-gradient-to-r from-vh-red to-vh-dark-red text-white px-8 py-4 rounded-2xl font-bold text-lg hover:shadow-2xl hover:shadow-vh-red/25 transform hover:-translate-y-1 transition-all duration-300"
            >
              <Trophy size={24} />
              View Leaderboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================
  // STATE 4: LEADERBOARD SCREEN
  // =========================
  if (gameState === 'leaderboard') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white py-12 px-4">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-yellow-500 to-yellow-700 rounded-full mb-6 shadow-xl">
              <Trophy className="text-white" size={40} />
            </div>
            <h1 className="text-5xl font-black text-gray-900 mb-4">
              Top FBS Students
            </h1>
            <p className="text-xl text-gray-600 mb-6">
              See who's mastering accounting
            </p>

            {/* Tab Switcher - Premium Design */}
            <div className="inline-flex items-center bg-gray-100 rounded-2xl p-1.5 shadow-inner">
              <button
                onClick={() => setActiveLeaderboardTab('singular')}
                className={`
                  px-8 py-3 rounded-xl font-bold text-sm transition-all duration-300
                  ${activeLeaderboardTab === 'singular'
                    ? 'bg-gradient-to-r from-vh-red to-vh-dark-red text-white shadow-lg'
                    : 'text-gray-600 hover:text-gray-900'
                  }
                `}
              >
                🏆 Best Single Game
              </button>
              <button
                onClick={() => setActiveLeaderboardTab('cumulative')}
                className={`
                  px-8 py-3 rounded-xl font-bold text-sm transition-all duration-300
                  ${activeLeaderboardTab === 'cumulative'
                    ? 'bg-gradient-to-r from-vh-red to-vh-dark-red text-white shadow-lg'
                    : 'text-gray-600 hover:text-gray-900'
                  }
                `}
              >
                📊 Total Score
              </button>
            </div>
          </div>

          {/* Leaderboard Container */}
          <div className="bg-white rounded-3xl shadow-2xl p-8 mb-8">
            {isLoadingLeaderboard ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-vh-red mx-auto mb-4"></div>
                <p className="text-gray-600">Loading leaderboard...</p>
              </div>
            ) : activeLeaderboardTab === 'singular' ? (
              /* Singular Leaderboard - Best Single Game */
              singularLeaderboard.length === 0 ? (
                <div className="text-center py-12">
                  <Trophy size={48} className="mx-auto mb-4 text-gray-400" />
                  <p className="text-xl text-gray-600 mb-2">No scores yet!</p>
                  <p className="text-gray-500">Be the first to play and set a record.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-gray-200">
                        <th className="text-left py-4 px-4 font-bold text-gray-700">Rank</th>
                        <th className="text-left py-4 px-4 font-bold text-gray-700">Player</th>
                        <th className="text-right py-4 px-4 font-bold text-gray-700">Dynamic Score</th>
                        <th className="text-right py-4 px-4 font-bold text-gray-700">Simple Score</th>
                        <th className="text-right py-4 px-4 font-bold text-gray-700">Accuracy</th>
                        <th className="text-right py-4 px-4 font-bold text-gray-700">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {singularLeaderboard.map((entry, index) => {
                        const isCurrentUser = entry.playerEmail === session?.user?.email;
                        const rank = index + 1;
                        let rankBg = 'bg-vh-red text-white';
                        if (rank === 1) rankBg = 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-white shadow-lg';
                        if (rank === 2) rankBg = 'bg-gradient-to-r from-gray-300 to-gray-500 text-white shadow-md';
                        if (rank === 3) rankBg = 'bg-gradient-to-r from-orange-400 to-orange-600 text-white shadow-md';

                        return (
                          <tr
                            key={entry.playerEmail}
                            className={`
                              border-b border-gray-100 hover:bg-gray-50 transition-all duration-200
                              ${isCurrentUser ? 'bg-vh-red/5 ring-2 ring-vh-red/30 rounded-lg' : ''}
                            `}
                          >
                            <td className="py-4 px-4">
                              <span className={`inline-flex items-center justify-center w-11 h-11 rounded-xl font-black text-sm ${rankBg}`}>
                                {rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : rank}
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              <div className="font-bold text-gray-900">
                                {entry.playerName}
                                {isCurrentUser && (
                                  <span className="ml-2 text-xs bg-vh-red text-white px-2 py-0.5 rounded-full">You</span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 mt-0.5">
                                {entry.selectedLecturesCount} lectures selected
                              </div>
                            </td>
                            <td className="py-4 px-4 text-right">
                              <span className="font-black text-vh-red text-xl">
                                {entry.bestDynamicScore.toFixed(2)}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-right">
                              <span className="text-gray-600 font-semibold">
                                {entry.bestSimpleScore.toFixed(2)}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-right text-gray-700">
                              {entry.accuracy.toFixed(1)}%
                            </td>
                            <td className="py-4 px-4 text-right text-gray-600 font-mono text-sm">
                              {formatTime(entry.timeTaken)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            ) : (
              /* Cumulative Leaderboard - Total Score */
              cumulativeLeaderboard.length === 0 ? (
                <div className="text-center py-12">
                  <Trophy size={48} className="mx-auto mb-4 text-gray-400" />
                  <p className="text-xl text-gray-600 mb-2">No scores yet!</p>
                  <p className="text-gray-500">Be the first to play and set a record.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-gray-200">
                        <th className="text-left py-4 px-4 font-bold text-gray-700">Rank</th>
                        <th className="text-left py-4 px-4 font-bold text-gray-700">Player</th>
                        <th className="text-right py-4 px-4 font-bold text-gray-700">Total Dynamic</th>
                        <th className="text-right py-4 px-4 font-bold text-gray-700">Total Simple</th>
                        <th className="text-right py-4 px-4 font-bold text-gray-700">Games</th>
                        <th className="text-right py-4 px-4 font-bold text-gray-700">Avg Accuracy</th>
                        <th className="text-right py-4 px-4 font-bold text-gray-700">Lectures</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cumulativeLeaderboard.map((entry, index) => {
                        const isCurrentUser = entry.playerEmail === session?.user?.email;
                        const rank = index + 1;
                        let rankBg = 'bg-vh-red text-white';
                        if (rank === 1) rankBg = 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-white shadow-lg';
                        if (rank === 2) rankBg = 'bg-gradient-to-r from-gray-300 to-gray-500 text-white shadow-md';
                        if (rank === 3) rankBg = 'bg-gradient-to-r from-orange-400 to-orange-600 text-white shadow-md';

                        return (
                          <tr
                            key={entry.playerEmail}
                            className={`
                              border-b border-gray-100 hover:bg-gray-50 transition-all duration-200
                              ${isCurrentUser ? 'bg-vh-red/5 ring-2 ring-vh-red/30 rounded-lg' : ''}
                            `}
                          >
                            <td className="py-4 px-4">
                              <span className={`inline-flex items-center justify-center w-11 h-11 rounded-xl font-black text-sm ${rankBg}`}>
                                {rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : rank}
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              <div className="font-bold text-gray-900">
                                {entry.playerName}
                                {isCurrentUser && (
                                  <span className="ml-2 text-xs bg-vh-red text-white px-2 py-0.5 rounded-full">You</span>
                                )}
                              </div>
                            </td>
                            <td className="py-4 px-4 text-right">
                              <span className="font-black text-vh-red text-xl">
                                {entry.totalDynamicScore.toFixed(2)}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-right">
                              <span className="text-gray-600 font-semibold">
                                {entry.totalSimpleScore.toFixed(2)}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-right text-gray-700 font-semibold">
                              {entry.gamesPlayed}
                            </td>
                            <td className="py-4 px-4 text-right text-gray-700">
                              {entry.averageAccuracy.toFixed(1)}%
                            </td>
                            <td className="py-4 px-4 text-right text-gray-700">
                              {entry.lecturesCoveredCount}/11
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>

          {/* Back Button */}
          <div className="text-center">
            <button
              onClick={resetToSetup}
              className="inline-flex items-center gap-3 bg-gradient-to-r from-vh-red to-vh-dark-red text-white px-8 py-4 rounded-2xl font-bold text-lg hover:shadow-2xl hover:shadow-vh-red/25 transform hover:-translate-y-1 transition-all duration-300"
            >
              <RotateCcw size={24} />
              Back to Quiz Setup
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default function AccountingGamePage() {
  return (
    <ProtectedRoute>
      <FBSAccountingGame />
    </ProtectedRoute>
  );
}
