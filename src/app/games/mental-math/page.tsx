'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, SkipForward, RotateCcw, Clock, Target, Zap, Trophy, Award } from 'lucide-react';
import { motion, useScroll, useTransform, useInView, AnimatePresence } from 'framer-motion';
import ProtectedRoute from '@/components/ProtectedRoute';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';

interface Question {
  num1: number;
  num2: number;
  answer: number;
  symbol: string;
  operation: string;
}

interface GameResult {
  score: number;
  questionsCorrect: number;
  questionsAnswered: number;
  accuracy: number;
  difficulty: string;
  operations: string[];
  timeLimit: number;
  playerName?: string;
  playedAt: Date;
}

interface LeaderboardEntry {
  playerName: string;
  score: number;
  questionsCorrect: number;
  questionsAnswered: number;
  accuracy: number;
  difficulty: string;
  operations?: string[];
  playedAt: Date;
}

interface AccumulatedScore {
  playerName: string;
  totalScore: number;
  gamesPlayed: number;
  averageScore: number;
  bestScore: number;
  overallAccuracy: number;
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

const MentalMathApp = () => {
  const { scrollY } = useScroll();
  const [gameState, setGameState] = useState<'setup' | 'playing' | 'finished' | 'leaderboard'>('setup');
  const [selectedOperations, setSelectedOperations] = useState<string[]>(['addition']);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | 'extreme'>('easy');
  const [timeLimit, setTimeLimit] = useState(2); // minutes
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [score, setScore] = useState(0);
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const [questionsCorrect, setQuestionsCorrect] = useState(0);
  const [questionsSkipped, setQuestionsSkipped] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [gameStartTime, setGameStartTime] = useState<number | null>(null);
  const [previousQuestions, setPreviousQuestions] = useState<Question[]>([]);
  const [leaderboard, setLeaderboard] = useState<{ individual: LeaderboardEntry[], accumulated: AccumulatedScore[] }>({ individual: [], accumulated: [] });
  const [isLoading, setIsLoading] = useState(false);

  // Refs for scroll animations
  const leaderboardHeaderRef = useRef(null);
  const leaderboardHeaderInView = useInView(leaderboardHeaderRef, { once: true });
  const setupHeaderRef = useRef(null);
  const configRef = useRef(null);
  const setupHeaderInView = useInView(setupHeaderRef, { once: true });
  const configInView = useInView(configRef, { once: true, margin: "-100px" });

  // Anti-cheat system state
  const [questionStartTime, setQuestionStartTime] = useState<number | null>(null);
  const [questionTimeRemaining, setQuestionTimeRemaining] = useState(0);
  const [responseTimes, setResponseTimes] = useState<number[]>([]);
  const [suspiciousResponses, setSuspiciousResponses] = useState<boolean[]>([]);

  // Skip limit system
  const [skipsRemaining, setSkipsRemaining] = useState(3);
  const [timePenalty, setTimePenalty] = useState(0); // Additional seconds added to question timers

  const operationLabels: { [key: string]: string } = {
    addition: 'Addition (+)',
    subtraction: 'Subtraction (−)',
    multiplication: 'Multiplication (×)',
    division: 'Division (÷)'
  };

  const timeOptions = [
    { value: 0.5, label: '30 seconds' },
    { value: 1, label: '1 minute' },
    { value: 1.5, label: '1.5 minutes' },
    { value: 2, label: '2 minutes' },
    { value: 3, label: '3 minutes' },
    { value: 5, label: '5 minutes' }
  ];

  // Calculate dynamic time per question based on operation and difficulty
  const getQuestionTimeLimit = useCallback((operation: string, difficulty: string): number => {
    const baseTimes = {
      addition: { easy: 5, medium: 8, hard: 12, extreme: 18 },
      subtraction: { easy: 6, medium: 10, hard: 15, extreme: 20 },
      multiplication: { easy: 8, medium: 12, hard: 20, extreme: 25 },
      division: { easy: 10, medium: 15, hard: 25, extreme: 30 }
    };

    const baseTime = baseTimes[operation as keyof typeof baseTimes]?.[difficulty as keyof typeof baseTimes.addition] || 15;
    return baseTime + timePenalty; // Add progressive time penalty for excessive skips
  }, [timePenalty]);

  // Calculator detection algorithm
  const detectCalculatorUse = (responseTime: number, operation: string, difficulty: string): boolean => {
    const expectedTime = getQuestionTimeLimit(operation, difficulty);
    const minHumanTime = Math.max(2, expectedTime * 0.1); // Minimum human response time

    // Suspicious if too fast (likely calculator) or consistently at exact intervals
    if (responseTime < minHumanTime) return true;

    // Check for pattern in response times (calculator users often have consistent timing)
    if (responseTimes.length >= 3) {
      const recentTimes = responseTimes.slice(-3);
      const avgTime = recentTimes.reduce((a, b) => a + b, 0) / recentTimes.length;
      const variance = recentTimes.reduce((acc, time) => acc + Math.pow(time - avgTime, 2), 0) / recentTimes.length;

      // Very low variance in response times is suspicious
      if (variance < 0.5 && responseTime < expectedTime * 0.3) return true;
    }

    return false;
  };

  // Handle operation selection (multiple)
  const toggleOperation = (operation: string) => {
    setSelectedOperations(prev => {
      if (prev.includes(operation)) {
        // Don't allow removing if it's the only one selected
        if (prev.length === 1) return prev;
        return prev.filter(op => op !== operation);
      } else {
        return [...prev, operation];
      }
    });
  };

  // Generate random numbers based on operation and difficulty
  const generateNumbers = useCallback((operation: string) => {
    let num1, num2;
    
    switch (operation) {
      case 'addition':
        if (difficulty === 'easy') {
          num1 = Math.floor(Math.random() * 9) + 1; // 1-9
          num2 = Math.floor(Math.random() * 9) + 1; // 1-9
        } else if (difficulty === 'medium') {
          num1 = Math.floor(Math.random() * 90) + 10; // 10-99
          num2 = Math.floor(Math.random() * 9) + 1; // 1-9
        } else if (difficulty === 'hard') {
          num1 = Math.floor(Math.random() * 90) + 10; // 10-99
          num2 = Math.floor(Math.random() * 90) + 10; // 10-99
        } else { // extreme
          num1 = Math.floor(Math.random() * 150) + 50; // 50-199
          num2 = Math.floor(Math.random() * 150) + 50; // 50-199
          // Ensure sum doesn't exceed 200
          if (num1 + num2 > 200) {
            num2 = 200 - num1;
          }
        }
        return { num1, num2, answer: num1 + num2, symbol: '+', operation };
        
      case 'subtraction':
        if (difficulty === 'easy') {
          num2 = Math.floor(Math.random() * 9) + 1; // 1-9
          num1 = num2 + Math.floor(Math.random() * 9) + 1; // Ensure positive result
        } else if (difficulty === 'medium') {
          num2 = Math.floor(Math.random() * 9) + 1; // 1-9
          num1 = Math.floor(Math.random() * 90) + 10; // 10-99
        } else if (difficulty === 'hard') {
          num2 = Math.floor(Math.random() * 90) + 10; // 10-99
          num1 = num2 + Math.floor(Math.random() * 90) + 10; // Ensure positive result
        } else { // extreme
          num2 = Math.floor(Math.random() * 100) + 50; // 50-149
          num1 = Math.floor(Math.random() * 100) + 100; // 100-199
          // Ensure num1 > num2 for positive result and num1 <= 200
          if (num1 <= num2) {
            num1 = num2 + Math.floor(Math.random() * 50) + 10;
          }
          if (num1 > 200) {
            num1 = 200;
          }
        }
        return { num1, num2, answer: num1 - num2, symbol: '−', operation };
        
      case 'multiplication':
        if (difficulty === 'easy') {
          num1 = Math.floor(Math.random() * 9) + 1; // 1-9
          num2 = Math.floor(Math.random() * 9) + 1; // 1-9
        } else if (difficulty === 'medium') {
          num1 = Math.floor(Math.random() * 9) + 1; // 1-9
          num2 = Math.floor(Math.random() * 16) + 10; // 10-25
        } else if (difficulty === 'hard') {
          num1 = Math.floor(Math.random() * 16) + 10; // 10-25
          num2 = Math.floor(Math.random() * 16) + 10; // 10-25
        } else { // extreme
          num1 = Math.floor(Math.random() * 21) + 10; // 10-30
          num2 = Math.floor(Math.random() * 21) + 10; // 10-30
        }
        return { num1, num2, answer: num1 * num2, symbol: '×', operation };
        
      case 'division':
        if (difficulty === 'easy') {
          num2 = Math.floor(Math.random() * 9) + 1; // 1-9
          const quotient = Math.floor(Math.random() * 9) + 1; // 1-9
          num1 = num2 * quotient;
        } else if (difficulty === 'medium') {
          num2 = Math.floor(Math.random() * 9) + 1; // 1-9
          const quotient = Math.floor(Math.random() * 16) + 10; // 10-25
          num1 = num2 * quotient;
        } else if (difficulty === 'hard') {
          num2 = Math.floor(Math.random() * 16) + 10; // 10-25
          const quotient = Math.floor(Math.random() * 16) + 10; // 10-25
          num1 = num2 * quotient;
        } else { // extreme
          num2 = Math.floor(Math.random() * 21) + 10; // 10-30
          const quotient = Math.floor(Math.random() * 21) + 10; // 10-30
          num1 = num2 * quotient;
        }
        return { num1, num2, answer: num1 / num2, symbol: '÷', operation };
        
      default:
        return null;
    }
  }, [difficulty]);

  // Calculate points based on various factors including time penalties
  const calculatePoints = useCallback((isCorrect: boolean, isSkipped = false, questionOperation: string, timeOverage = 0) => {
    const basePoints = {
      easy: 10,
      medium: 15,
      hard: 25,
      extreme: 40
    };

    const difficultyMultiplier = {
      easy: 1,
      medium: 1.5,
      hard: 2,
      extreme: 3
    };

    const operationBonus: { [key: string]: number } = {
      addition: 1,
      subtraction: 1.2,
      multiplication: 1.5,
      division: 1.8
    };

    // Multi-operation bonus
    const multiOpBonus = selectedOperations.length > 1 ? 1.3 : 1;

    if (isSkipped) {
      return -Math.floor(basePoints[difficulty] * 0.3); // 30% penalty for skipping
    }

    if (isCorrect) {
      let points = basePoints[difficulty];
      points *= difficultyMultiplier[difficulty];
      points *= operationBonus[questionOperation];
      points *= multiOpBonus;

      // Time bonus for fast answers (within allocated time)
      if (timeOverage <= 0) {
        const timeSpent = Date.now() - (gameStartTime || Date.now());
        const avgTimePerQuestion = timeSpent / (questionsAnswered + 1);
        if (avgTimePerQuestion < 3000) { // Less than 3 seconds
          points *= 1.5;
        } else if (avgTimePerQuestion < 5000) { // Less than 5 seconds
          points *= 1.2;
        }
      }

      // Exponential time penalty for overtime
      if (timeOverage > 0) {
        const allocatedTime = getQuestionTimeLimit(questionOperation, difficulty);
        // Penalty factor increases exponentially - shorter questions penalize more severely
        const penaltyRate = Math.max(0.1, 1 / Math.sqrt(allocatedTime)); // Inverse square root for exponential effect
        const penaltyMultiplier = Math.pow(0.5, timeOverage * penaltyRate);
        points *= Math.max(0.1, penaltyMultiplier); // Minimum 10% of original points
      }

      return Math.floor(points);
    } else {
      return -Math.floor(basePoints[difficulty] * 0.5); // 50% penalty for wrong answer
    }
  }, [difficulty, selectedOperations.length, questionsAnswered, gameStartTime, getQuestionTimeLimit]);

  // Generate new question
  const generateNewQuestion = useCallback(() => {
    // Check if question is unique
    const isQuestionUnique = (newQuestion: Question) => {
      return !previousQuestions.some(prev =>
        prev.num1 === newQuestion.num1 &&
        prev.num2 === newQuestion.num2 &&
        prev.operation === newQuestion.operation
      );
    };

    let attempts = 0;
    let question;

    do {
      // Randomly select from chosen operations
      const randomOperation = selectedOperations[Math.floor(Math.random() * selectedOperations.length)];
      question = generateNumbers(randomOperation);
      attempts++;
    } while (question && !isQuestionUnique(question) && attempts < 50); // Prevent infinite loop

    if (question) {
      setCurrentQuestion(question);
      setPreviousQuestions(prev => [...prev.slice(-20), question]); // Keep last 20 questions

      // Set dynamic timer for this specific question
      const timeLimit = getQuestionTimeLimit(question.operation, difficulty);
      setQuestionTimeRemaining(timeLimit);
      setQuestionStartTime(Date.now());
    }
    setUserAnswer('');
  }, [generateNumbers, selectedOperations, previousQuestions, difficulty, getQuestionTimeLimit]);

  // Start the game
  const startGame = () => {
    setGameState('playing');
    setScore(0);
    setQuestionsAnswered(0);
    setQuestionsCorrect(0);
    setQuestionsSkipped(0);
    setTimeRemaining(timeLimit * 60); // Convert minutes to seconds
    setGameStartTime(Date.now());
    setPreviousQuestions([]);

    // Reset anti-cheat tracking
    setResponseTimes([]);
    setSuspiciousResponses([]);

    // Reset skip system
    setSkipsRemaining(3);
    setTimePenalty(0);

    generateNewQuestion();
  };

  // Fetch leaderboard data
  const fetchLeaderboard = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/mental-math/leaderboard');
      if (response.ok) {
        const data = await response.json();
        setLeaderboard({
          individual: data.individual || [],
          accumulated: data.accumulated || []
        });
      } else {
        console.error('Failed to fetch leaderboard:', response.status, response.statusText);
        setLeaderboard({ individual: [], accumulated: [] }); // Set empty arrays on error
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      setLeaderboard({ individual: [], accumulated: [] }); // Set empty arrays on error
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save game result to database
  const saveGameResult = useCallback(async (result: GameResult) => {
    try {
      const response = await fetch('/api/mental-math/scores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(result),
      });
      
      if (response.ok) {
        const responseData = await response.json();
        console.log('Math score saved successfully:', responseData);
        // Refresh leaderboard after saving
        fetchLeaderboard();
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Failed to save score:', errorData);
      }
    } catch (error) {
      console.error('Error saving game result:', error);
    }
  }, [fetchLeaderboard]);

  // Handle answer submission
  const submitAnswer = () => {
    if (userAnswer === '' || !currentQuestion || !questionStartTime) return;

    const responseTime = (Date.now() - questionStartTime) / 1000; // Convert to seconds
    const isCorrect = parseInt(userAnswer) === currentQuestion.answer;

    // Calculate time overage (negative questionTimeRemaining means overtime)
    const allocatedTime = getQuestionTimeLimit(currentQuestion.operation, difficulty);
    const timeOverage = Math.max(0, allocatedTime - questionTimeRemaining);

    // Run calculator detection
    const isSuspicious = detectCalculatorUse(responseTime, currentQuestion.operation, difficulty);

    // Update tracking arrays
    setResponseTimes(prev => [...prev, responseTime]);
    setSuspiciousResponses(prev => [...prev, isSuspicious]);

    const points = calculatePoints(isCorrect, false, currentQuestion.operation, timeOverage);

    setScore(prev => prev + points);
    setQuestionsAnswered(prev => prev + 1);
    if (isCorrect) {
      setQuestionsCorrect(prev => prev + 1);
    }

    generateNewQuestion();
  };

  // Skip question
  const skipQuestion = useCallback(() => {
    if (!currentQuestion || !questionStartTime) return;

    const responseTime = (Date.now() - questionStartTime) / 1000;

    // Mark skipped questions as not suspicious (user chose to skip rather than cheat)
    setResponseTimes(prev => [...prev, responseTime]);
    setSuspiciousResponses(prev => [...prev, false]);

    const points = calculatePoints(false, true, currentQuestion.operation, 0); // No time overage for skips
    setScore(prev => prev + points);
    setQuestionsAnswered(prev => prev + 1);
    setQuestionsSkipped(prev => prev + 1);

    // Handle skip limit and progressive penalties
    if (skipsRemaining > 0) {
      setSkipsRemaining(prev => prev - 1);
    } else {
      // Progressive time penalty: +60 seconds for each skip beyond the limit
      setTimePenalty(prev => prev + 60);
    }

    generateNewQuestion();
  }, [currentQuestion, questionStartTime, calculatePoints, generateNewQuestion, skipsRemaining]);

  // Handle enter key press
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && userAnswer !== '') {
      submitAnswer();
    }
  };

  // Main game timer effect
  useEffect(() => {
    if (gameState === 'playing' && timeRemaining > 0) {
      const timer = setTimeout(() => {
        setTimeRemaining(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (gameState === 'playing' && timeRemaining === 0) {
      setGameState('finished');
    }
  }, [gameState, timeRemaining]);

  // Per-question timer effect
  useEffect(() => {
    if (gameState === 'playing') {
      const timer = setTimeout(() => {
        setQuestionTimeRemaining(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [gameState, questionTimeRemaining]);

  // Save game when finished
  useEffect(() => {
    if (gameState === 'finished' && questionsAnswered > 0) {
      const accuracy = Math.round((questionsCorrect / questionsAnswered) * 100);
      const suspiciousCount = suspiciousResponses.filter(Boolean).length;
      const suspiciousPercentage = (suspiciousCount / questionsAnswered) * 100;

      const gameResult: GameResult & { isSuspicious?: boolean } = {
        score,
        questionsCorrect,
        questionsAnswered,
        accuracy,
        difficulty,
        operations: selectedOperations,
        timeLimit,
        playedAt: new Date(),
        isSuspicious: suspiciousPercentage > 30 // Mark as suspicious if >30% of responses were flagged
      };
      saveGameResult(gameResult);
    }
  }, [gameState, score, questionsCorrect, questionsAnswered, difficulty, selectedOperations, timeLimit, suspiciousResponses, saveGameResult]);

  // Format time display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate accuracy
  const accuracy = questionsAnswered > 0 ? Math.round((questionsCorrect / questionsAnswered) * 100) : 0;

  if (gameState === 'leaderboard') {
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
            ref={leaderboardHeaderRef}
            className="text-center mb-16"
            variants={fadeInUp}
            initial="hidden"
            animate={leaderboardHeaderInView ? "visible" : "hidden"}
          >
            <motion.div
              className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-vh-red-600 to-vh-red-800 rounded-3xl mb-8 shadow-2xl"
              whileHover={{ scale: 1.05, rotate: 5 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <Trophy className="text-white" size={40} />
            </motion.div>
            <h1 className="text-6xl lg:text-7xl font-black text-gray-900 mb-6">
              Mental Math <span className="bg-gradient-to-r from-vh-red-600 to-vh-red-800 bg-clip-text text-transparent">Leaderboard</span>
            </h1>
            <p className="text-2xl text-gray-600 max-w-4xl mx-auto leading-relaxed">Top performers in our intensive mental math challenges</p>
          </motion.div>

          <motion.div
            className="grid lg:grid-cols-2 gap-12 mb-16"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {/* Individual Game Scores */}
            <motion.div variants={scaleIn} className="group relative">
              <div className="absolute inset-0 bg-gradient-to-br from-vh-red-600/20 to-transparent rounded-3xl blur-2xl group-hover:blur-3xl opacity-0 group-hover:opacity-100 transition-all duration-700"></div>
              <Card variant="elevated" padding="xl" className="relative group-hover:shadow-4xl transition-all duration-700">
                <div className="flex items-center mb-8">
                  <div className="w-16 h-16 bg-gradient-to-br from-vh-red to-vh-dark-red rounded-2xl flex items-center justify-center mr-6 shadow-xl">
                    <Trophy className="text-white" size={32} />
                  </div>
                  <h2 className="text-3xl font-black text-gray-900">Top Individual Scores</h2>
                </div>
              {isLoading ? (
                <div className="text-center py-8">Loading...</div>
              ) : leaderboard.individual.length === 0 ? (
                <div className="text-center py-8">
                  <Target className="w-16 h-16 mx-auto mb-4 text-vh-red/40" />
                  <p className="text-gray-600 text-lg">No individual scores yet. Be the first to play!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {leaderboard.individual.slice(0, 10).map((entry, index) => (
                    <div key={index} className="group/item flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-white rounded-2xl border border-gray-100 hover:border-vh-red/30 hover:shadow-lg transition-all duration-300">
                      <div className="flex items-center gap-3">
                        <span className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold min-w-[44px] min-h-[44px] ${
                          index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-600' : 'bg-vh-red'
                        }`}>
                          {index + 1}
                        </span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-800">{entry.playerName || 'Anonymous'}</span>
                            {(entry as any).isSuspicious && (
                              <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold flex items-center gap-1" title="Suspicious calculator usage detected">
                                C
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600">
                            {entry.difficulty} • {entry.operations?.join(', ')} • {entry.accuracy}% accuracy • {(entry as any).timeLimit}min game
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-vh-red text-lg">{entry.score}</div>
                        <div className="text-xs text-gray-500">{entry.questionsCorrect}/{entry.questionsAnswered}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              </Card>
            </motion.div>

            {/* Accumulated Scores */}
            <motion.div variants={scaleIn} className="group relative">
              <div className="absolute inset-0 bg-gradient-to-br from-vh-beige-500/20 to-transparent rounded-3xl blur-2xl group-hover:blur-3xl opacity-0 group-hover:opacity-100 transition-all duration-700"></div>
              <Card variant="elevated" padding="xl" className="relative group-hover:shadow-4xl transition-all duration-700">
                <div className="flex items-center mb-8">
                  <div className="w-16 h-16 bg-gradient-to-br from-vh-beige to-vh-dark-beige rounded-2xl flex items-center justify-center mr-6 shadow-xl">
                    <Zap className="text-white" size={32} />
                  </div>
                  <h2 className="text-3xl font-black text-gray-900">Accumulated Champions</h2>
                </div>
              {isLoading ? (
                <div className="text-center py-8">Loading...</div>
              ) : leaderboard.accumulated.length === 0 ? (
                <div className="text-center py-8">
                  <Zap className="w-16 h-16 mx-auto mb-4 text-vh-beige/60" />
                  <p className="text-gray-600 text-lg">No accumulated scores yet. Start your math journey!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {leaderboard.accumulated.slice(0, 10).map((entry, index) => (
                    <div key={index} className="group/item flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-white rounded-2xl border border-gray-100 hover:border-vh-beige/30 hover:shadow-lg transition-all duration-300">
                      <div className="flex items-center gap-3">
                        <span className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold min-w-[44px] min-h-[44px] ${
                          index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-600' : 'bg-vh-red'
                        }`}>
                          {index + 1}
                        </span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-800">{entry.playerName || 'Anonymous'}</span>
                            {(entry as any).hasSuspiciousGames && (
                              <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold flex items-center gap-1" title="Has suspicious games with calculator usage">
                                C
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600">
                            {entry.gamesPlayed} games • Avg: {Math.round(entry.averageScore)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-vh-red text-lg">{entry.totalScore}</div>
                        <div className="text-xs text-gray-500">Total Points</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              </Card>
            </motion.div>
          </motion.div>

          <motion.div
            className="text-center"
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
          >
            <Button
              variant="solid"
              size="lg"
              onClick={() => setGameState('setup')}
              className="group"
            >
              <Target className="inline mr-3" size={20} />
              Back to Game
            </Button>
          </motion.div>
        </div>
      </div>
    );
  }

  if (gameState === 'setup') {
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
              <Target className="text-white" size={40} />
            </motion.div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-gray-900 mb-6">
              Mental Math <span className="bg-gradient-to-r from-vh-red-600 to-vh-red-800 bg-clip-text text-transparent">Trainer</span>
            </h1>
            <p className="text-lg sm:text-xl md:text-2xl text-gray-600 max-w-4xl mx-auto leading-relaxed px-4">Challenge your mind with lightning-fast calculations and compete for the top scores</p>
          </motion.div>

          <motion.div
            ref={configRef}
            className="group relative mb-12"
            variants={scaleIn}
            initial="hidden"
            animate={configInView ? "visible" : "hidden"}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-vh-red-600/10 to-transparent rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
            <Card variant="elevated" padding="xl" className="relative group-hover:shadow-4xl transition-all duration-500">
              <div className="space-y-8">
                <div>
                  <label className="block text-lg font-black text-gray-900 mb-6">
                    Choose Operations (Select one or more)
                  </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  {Object.entries(operationLabels).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => toggleOperation(key)}
                      className={`p-3 sm:p-4 rounded-lg border-2 transition-all font-medium min-h-[48px] sm:min-h-[52px] flex items-center justify-center text-sm sm:text-base ${
                        selectedOperations.includes(key)
                          ? 'border-vh-red bg-vh-red text-white shadow-lg transform scale-105'
                          : 'border-gray-200 hover:border-vh-red/50 hover:bg-vh-beige/20 text-gray-700'
                      }`}
                    >
                      <div>{label}</div>
                    </button>
                  ))}
                </div>
                {selectedOperations.length > 1 && (
                  <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800 font-medium flex items-center gap-2">
                      🎉 Multi-operation bonus: +30% points!
                    </p>
                  </div>
                )}
              </div>
              
                <div>
                  <label className="block text-lg font-black text-gray-900 mb-4">
                    Difficulty Level
                  </label>
                  <select 
                    value={difficulty} 
                    onChange={(e) => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard' | 'extreme')}
                    className="w-full p-4 border-2 border-gray-200 rounded-2xl focus:ring-2 focus:ring-vh-red focus:border-vh-red font-medium text-lg bg-gradient-to-r from-gray-50 to-white"
                  >
                  <option value="easy">Easy - Single Digits</option>
                  <option value="medium">Medium - Mixed Difficulty</option>
                  <option value="hard">Hard - Double Digits</option>
                  <option value="extreme">Extreme 🔥 - Challenge Mode</option>
                </select>
                {difficulty === 'extreme' && (
                  <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="text-sm text-red-800">
                      <strong>Extreme Mode:</strong> Addition/Subtraction up to 200, Multiplication/Division up to 30×30
                    </div>
                  </div>
                )}
              </div>
              
                <div>
                  <label className="block text-lg font-black text-gray-900 mb-4">
                    Time Limit
                  </label>
                  <select 
                    value={timeLimit} 
                    onChange={(e) => setTimeLimit(parseFloat(e.target.value))}
                    className="w-full p-4 border-2 border-gray-200 rounded-2xl focus:ring-2 focus:ring-vh-red focus:border-vh-red font-medium text-lg bg-gradient-to-r from-gray-50 to-white"
                  >
                  {timeOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            </Card>
          </motion.div>

          <motion.div
            className="flex flex-col sm:flex-row gap-6 justify-center"
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
          >
            {/* Start Challenge Button */}
            <Button
              variant="solid"
              size="lg"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Start Challenge button clicked');
                try {
                  startGame();
                } catch (error) {
                  console.error('Error in startGame:', error);
                }
              }}
              disabled={selectedOperations.length === 0}
              className="group flex items-center justify-center gap-3"
            >
              <Play size={24} />
              Start Challenge
            </Button>

            {/* View Leaderboard Button */}
            <Button
              variant="outline"
              size="lg"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('View Leaderboard button clicked');
                try {
                  fetchLeaderboard();
                  setGameState('leaderboard');
                } catch (error) {
                  console.error('Error in fetchLeaderboard:', error);
                }
              }}
              className="group flex items-center justify-center gap-3"
            >
              <Trophy size={24} />
              View Leaderboard
            </Button>
          </motion.div>
        </div>
      </div>
    );
  }

  if (gameState === 'playing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-vh-dark-red relative overflow-hidden">
        {/* Dynamic Background Elements */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-r from-vh-red/20 to-transparent rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-to-l from-vh-beige/10 to-transparent rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
          {/* Header with stats */}
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-3 sm:p-4 md:p-6 lg:p-8 mb-4 sm:mb-6 md:mb-8 border border-white/20">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 md:gap-4">
                <div className="flex items-center gap-2">
                  <Clock size={20} className="text-vh-red sm:w-6 sm:h-6" />
                  <span className="font-mono text-xl sm:text-2xl font-bold text-vh-red">
                    {formatTime(timeRemaining)}
                  </span>
                </div>
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${
                  questionTimeRemaining < 0
                    ? 'bg-red-100 border-red-300'
                    : questionTimeRemaining <= 3
                      ? 'bg-yellow-100 border-yellow-300'
                      : 'bg-orange-100 border-orange-300'
                }`}>
                  <Clock size={16} className={
                    questionTimeRemaining < 0
                      ? 'text-red-600'
                      : questionTimeRemaining <= 3
                        ? 'text-yellow-600'
                        : 'text-orange-600'
                  } />
                  <span className={`font-mono text-lg font-bold ${
                    questionTimeRemaining < 0
                      ? 'text-red-600 animate-pulse'
                      : questionTimeRemaining <= 3
                        ? 'text-yellow-600 animate-pulse'
                        : 'text-orange-600'
                  }`}>
                    {questionTimeRemaining < 0 ? `+${Math.abs(questionTimeRemaining)}s` : `${questionTimeRemaining}s`}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 sm:gap-4 md:gap-6">
                <div className="flex items-center gap-2">
                  <Target size={16} className="text-vh-red sm:w-5 sm:h-5" />
                  <span className="font-bold text-base sm:text-lg">Score: {score}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap size={16} className="text-green-600 sm:w-5 sm:h-5" />
                  <span className="font-medium text-sm sm:text-base">{questionsAnswered} solved</span>
                </div>
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${
                  skipsRemaining > 0
                    ? 'bg-blue-100 border-blue-300 text-blue-700'
                    : 'bg-red-100 border-red-300 text-red-700'
                }`}>
                  <SkipForward size={16} />
                  <span className="font-bold text-sm">
                    {skipsRemaining > 0 ? `${skipsRemaining} skips left` : `+${timePenalty}s penalty`}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Active operations indicator */}
            <div className="flex flex-wrap gap-2">
              {selectedOperations.map(op => (
                <span 
                  key={op} 
                  className="px-3 py-1 bg-vh-beige text-vh-red rounded-full text-sm font-medium border border-vh-red/20"
                >
                  {operationLabels[op]}
                </span>
              ))}
            </div>
          </div>

          {/* Question */}
          <div className="group relative mb-8">
            <div className="absolute inset-0 bg-gradient-to-br from-vh-red/30 to-vh-dark-red/30 rounded-3xl blur-2xl group-hover:blur-3xl transition-all duration-500"></div>
            <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-12 border border-white/20 text-center">
              <div className="mb-6">
                <span className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-vh-red to-vh-dark-red text-white rounded-full text-sm font-bold uppercase tracking-wide shadow-lg">
                  {currentQuestion?.operation} • {difficulty}
                  {difficulty === 'extreme' && <span className="ml-2 text-lg">🔥</span>}
                </span>
              </div>
              {currentQuestion && (
                <div className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-black text-gray-900 mb-8 sm:mb-10 tracking-tight">
                  {currentQuestion.num1} <span className="text-vh-red">{currentQuestion.symbol}</span> {currentQuestion.num2} = <span className="text-vh-red">?</span>
                </div>
              )}

              <input
                type="number"
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                onKeyPress={handleKeyPress}
                className="text-2xl sm:text-3xl md:text-4xl font-black text-center p-4 sm:p-6 border-3 border-gray-200 rounded-2xl focus:ring-4 focus:ring-vh-red/50 focus:border-vh-red bg-gradient-to-r from-gray-50 to-white w-full max-w-xs sm:max-w-sm shadow-xl transition-all duration-300"
                placeholder="Your answer"
                autoFocus
              />
            </div>
          </div>

          {/* Overtime warning */}
          {questionTimeRemaining < 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 text-center">
              <div className="text-red-800 font-bold mb-2">⏱️ Time Over!</div>
              <div className="text-red-700 text-sm">
                You've exceeded the allocated time by <span className="font-bold">{Math.abs(questionTimeRemaining)} seconds</span>
                <br />
                Your points for this question will be reduced exponentially based on overtime.
              </div>
            </div>
          )}

          {/* Skip warning */}
          {skipsRemaining === 0 && timePenalty > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 text-center">
              <div className="text-red-800 font-bold mb-2">⚠️ No Free Skips Remaining</div>
              <div className="text-red-700 text-sm">
                Each skip now adds +60 seconds to all future questions in this game.
                <br />
                Current penalty: <span className="font-bold">+{timePenalty} seconds</span>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <button
              onClick={submitAnswer}
              disabled={userAnswer === ''}
              className="group flex-1 bg-gradient-to-r from-vh-red to-vh-dark-red text-white py-3 sm:py-4 px-6 sm:px-8 rounded-2xl hover:from-vh-dark-red hover:to-vh-red disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 font-bold text-base sm:text-lg shadow-2xl hover:shadow-vh-red/25 transform hover:-translate-y-1 disabled:transform-none min-h-[52px]"
            >
              <Target className="inline mr-2 sm:mr-3" size={18} />
              Submit Answer
            </button>
            <button
              onClick={skipQuestion}
              className={`group py-4 px-8 rounded-2xl transition-all duration-300 flex items-center justify-center gap-3 font-bold text-lg shadow-xl transform hover:-translate-y-1 ${
                skipsRemaining > 0
                  ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600 hover:shadow-orange-500/25'
                  : 'bg-gradient-to-r from-red-600 to-red-700 text-white hover:from-red-700 hover:to-red-800 hover:shadow-red-600/25'
              }`}
              title={
                skipsRemaining > 0
                  ? `${skipsRemaining} free skips remaining`
                  : `Skip will add +60s penalty to all future questions`
              }
            >
              <SkipForward size={20} />
              {skipsRemaining > 0
                ? `Skip (${skipsRemaining} left)`
                : 'Skip (+60s penalty)'
              }
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'finished') {
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

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative z-10">
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-vh-red/20 to-green-400/20 rounded-3xl blur-2xl group-hover:blur-3xl transition-all duration-700"></div>
            <div className="relative bg-white rounded-3xl shadow-2xl p-12 border border-gray-100 group-hover:shadow-4xl transition-all duration-700">
              <div className="text-center mb-12">
                <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-green-400 to-vh-red rounded-full mb-8 shadow-2xl">
                  <Award className="text-white" size={48} />
                </div>
                <h1 className="text-5xl lg:text-6xl font-black text-gray-900 mb-4">
                  Challenge <span className="bg-gradient-to-r from-green-400 to-vh-red bg-clip-text text-transparent">Complete!</span>
                </h1>
                <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">Outstanding performance! You've completed the mental math challenge.</p>
              </div>
            
              <div className="mb-12">
                <div className="relative group/score">
                  <div className="absolute inset-0 bg-gradient-to-r from-vh-red/20 to-green-400/20 rounded-3xl blur-xl group-hover/score:blur-2xl transition-all duration-500"></div>
                  <div className="relative bg-gradient-to-br from-gray-50 to-white rounded-3xl p-10 border border-gray-200 shadow-xl text-center">
                    <div className="text-6xl lg:text-7xl font-black mb-4">
                      <span className="bg-gradient-to-r from-vh-red to-green-400 bg-clip-text text-transparent">{score}</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-600 mb-2">Final Score</div>
                    <div className="text-lg text-gray-500">
                      {score > 0 ? 'Exceptional performance!' : 'Keep practicing to reach new heights!'}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="grid md:grid-cols-4 gap-6 mb-12">
                <div className="group relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-green-400/20 to-transparent rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                  <div className="relative bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-6 text-center border border-green-200 shadow-lg">
                    <div className="text-3xl font-black text-green-600 mb-2">{questionsCorrect}</div>
                    <div className="text-green-700 font-bold">Correct</div>
                  </div>
                </div>
                <div className="group relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-red-400/20 to-transparent rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                  <div className="relative bg-gradient-to-br from-red-50 to-red-100 rounded-2xl p-6 text-center border border-red-200 shadow-lg">
                    <div className="text-3xl font-black text-red-600 mb-2">{questionsAnswered - questionsCorrect}</div>
                    <div className="text-red-700 font-bold">Incorrect</div>
                  </div>
                </div>
                <div className="group relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 to-transparent rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                  <div className="relative bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-6 text-center border border-blue-200 shadow-lg">
                    <div className="text-3xl font-black text-blue-600 mb-2">{accuracy}%</div>
                    <div className="text-blue-700 font-bold">Accuracy</div>
                  </div>
                </div>
                <div className="group relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-400/20 to-transparent rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                  <div className="relative bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl p-6 text-center border border-orange-200 shadow-lg">
                    <div className="text-3xl font-black text-orange-600 mb-2">{questionsSkipped}</div>
                    <div className="text-orange-700 font-bold">Skipped</div>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg text-center border border-blue-200">
                  <div className="text-2xl font-bold text-blue-600">{accuracy}%</div>
                  <div className="text-sm text-blue-700 font-medium">Accuracy</div>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg text-center border border-orange-200">
                  <div className="text-2xl font-bold text-orange-600">{questionsSkipped}</div>
                  <div className="text-sm text-orange-700 font-medium">Skipped</div>
                </div>
              </div>

              {/* Game summary */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="text-sm text-gray-700 text-center space-y-1">
                  <div><strong>Operations:</strong> {selectedOperations.map(op => operationLabels[op]).join(', ')}</div>
                  <div><strong>Difficulty:</strong> {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}{difficulty === 'extreme' ? ' 🔥' : ''}</div>
                  <div><strong>Duration:</strong> {timeOptions.find(t => t.value === timeLimit)?.label}</div>
                </div>
              </div>
            </div>
          </div>
            
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
                <button 
                  onClick={() => setGameState('setup')}
                  className="group bg-gradient-to-r from-vh-red to-vh-dark-red text-white px-12 py-4 rounded-2xl font-bold text-lg hover:from-vh-dark-red hover:to-vh-red transition-all duration-300 flex items-center justify-center gap-3 shadow-2xl hover:shadow-vh-red/25 transform hover:-translate-y-1"
                >
                  <RotateCcw size={24} />
                  Play Again
                </button>
                <button 
                  onClick={() => {
                    fetchLeaderboard();
                    setGameState('leaderboard');
                  }}
                  className="group border-2 border-vh-red text-vh-red px-12 py-4 rounded-2xl font-bold text-lg hover:bg-vh-red hover:text-white transition-all duration-300 flex items-center justify-center gap-3 shadow-lg"
                >
                  <Trophy size={24} />
                  View Leaderboard
                </button>
              </div>
        </div>
      </div>
    );
  }
};

const MentalMathPage = () => {
  return (
    <ProtectedRoute>
      <MentalMathApp />
    </ProtectedRoute>
  );
};

export default MentalMathPage;