'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Play, SkipForward, RotateCcw, Clock, Target, Zap, Trophy, Award } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';

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

const MentalMathApp = () => {
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

  // Calculate points based on various factors
  const calculatePoints = useCallback((isCorrect: boolean, isSkipped = false, questionOperation: string) => {
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
      
      // Time bonus: faster answers get bonus points
      const timeSpent = Date.now() - (gameStartTime || Date.now());
      const avgTimePerQuestion = timeSpent / (questionsAnswered + 1);
      if (avgTimePerQuestion < 3000) { // Less than 3 seconds
        points *= 1.5;
      } else if (avgTimePerQuestion < 5000) { // Less than 5 seconds
        points *= 1.2;
      }
      
      return Math.floor(points);
    } else {
      return -Math.floor(basePoints[difficulty] * 0.5); // 50% penalty for wrong answer
    }
  }, [difficulty, selectedOperations.length, questionsAnswered, gameStartTime]);

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
    }
    setUserAnswer('');
  }, [generateNumbers, selectedOperations, previousQuestions]);

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
    generateNewQuestion();
  };

  // Fetch leaderboard data
  const fetchLeaderboard = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/mental-math/leaderboard');
      if (response.ok) {
        const data = await response.json();
        setLeaderboard(data);
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
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
    if (userAnswer === '' || !currentQuestion) return;
    
    const isCorrect = parseInt(userAnswer) === currentQuestion.answer;
    const points = calculatePoints(isCorrect, false, currentQuestion.operation);
    
    setScore(prev => prev + points);
    setQuestionsAnswered(prev => prev + 1);
    if (isCorrect) {
      setQuestionsCorrect(prev => prev + 1);
    }
    
    generateNewQuestion();
  };

  // Skip question
  const skipQuestion = () => {
    if (!currentQuestion) return;
    const points = calculatePoints(false, true, currentQuestion.operation);
    setScore(prev => prev + points);
    setQuestionsAnswered(prev => prev + 1);
    setQuestionsSkipped(prev => prev + 1);
    generateNewQuestion();
  };

  // Handle enter key press
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && userAnswer !== '') {
      submitAnswer();
    }
  };

  // Timer effect
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

  // Save game when finished
  useEffect(() => {
    if (gameState === 'finished' && questionsAnswered > 0) {
      const accuracy = Math.round((questionsCorrect / questionsAnswered) * 100);
      const gameResult: GameResult = {
        score,
        questionsCorrect,
        questionsAnswered,
        accuracy,
        difficulty,
        operations: selectedOperations,
        timeLimit,
        playedAt: new Date()
      };
      saveGameResult(gameResult);
    }
  }, [gameState, score, questionsCorrect, questionsAnswered, difficulty, selectedOperations, timeLimit, saveGameResult]);

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
        {/* Professional Background Elements */}
        <div className="absolute inset-0">
          <div className="absolute top-20 right-20 w-72 h-72 bg-vh-red/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-20 w-96 h-96 bg-vh-beige/10 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-3">
            <div className="grid grid-cols-12 gap-4 transform rotate-12">
              {Array.from({ length: 144 }).map((_, i) => (
                <div key={i} className="h-1 bg-gradient-to-r from-vh-red/10 to-transparent rounded animate-pulse" style={{ animationDelay: `${i * 100}ms` }}></div>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative z-10">
          <div className="text-center mb-16">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-vh-red to-vh-dark-red rounded-3xl mb-8 shadow-2xl">
              <Trophy className="text-white" size={40} />
            </div>
            <h1 className="text-6xl lg:text-7xl font-black text-gray-900 mb-6">
              Mental Math <span className="bg-gradient-to-r from-vh-red to-vh-dark-red bg-clip-text text-transparent">Leaderboard</span>
            </h1>
            <p className="text-2xl text-gray-600 max-w-4xl mx-auto leading-relaxed">Top performers in our intensive mental math challenges</p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 mb-16">
            {/* Individual Game Scores */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-br from-vh-red/20 to-transparent rounded-3xl blur-2xl group-hover:blur-3xl opacity-0 group-hover:opacity-100 transition-all duration-700"></div>
              <div className="relative bg-white rounded-3xl shadow-2xl p-10 border border-gray-100 group-hover:shadow-4xl group-hover:border-vh-red/20 transition-all duration-700">
                <div className="flex items-center mb-8">
                  <div className="w-16 h-16 bg-gradient-to-br from-vh-red to-vh-dark-red rounded-2xl flex items-center justify-center mr-6 shadow-xl">
                    <Trophy className="text-white" size={32} />
                  </div>
                  <h2 className="text-3xl font-black text-gray-900">Top Individual Scores</h2>
                </div>
              {isLoading ? (
                <div className="text-center py-8">Loading...</div>
              ) : (
                <div className="space-y-3">
                  {leaderboard.individual.slice(0, 10).map((entry, index) => (
                    <div key={index} className="group/item flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-white rounded-2xl border border-gray-100 hover:border-vh-red/30 hover:shadow-lg transition-all duration-300">
                      <div className="flex items-center gap-3">
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                          index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-600' : 'bg-vh-red'
                        }`}>
                          {index + 1}
                        </span>
                        <div>
                          <div className="font-semibold text-gray-800">{entry.playerName || 'Anonymous'}</div>
                          <div className="text-sm text-gray-600">
                            {entry.difficulty} • {entry.operations?.join(', ')} • {entry.accuracy}% accuracy
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
            </div>

            {/* Accumulated Scores */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-br from-vh-beige/20 to-transparent rounded-3xl blur-2xl group-hover:blur-3xl opacity-0 group-hover:opacity-100 transition-all duration-700"></div>
              <div className="relative bg-white rounded-3xl shadow-2xl p-10 border border-gray-100 group-hover:shadow-4xl group-hover:border-vh-beige/20 transition-all duration-700">
                <div className="flex items-center mb-8">
                  <div className="w-16 h-16 bg-gradient-to-br from-vh-beige to-vh-dark-beige rounded-2xl flex items-center justify-center mr-6 shadow-xl">
                    <Zap className="text-white" size={32} />
                  </div>
                  <h2 className="text-3xl font-black text-gray-900">Accumulated Champions</h2>
                </div>
              {isLoading ? (
                <div className="text-center py-8">Loading...</div>
              ) : (
                <div className="space-y-3">
                  {leaderboard.accumulated.slice(0, 10).map((entry, index) => (
                    <div key={index} className="group/item flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-white rounded-2xl border border-gray-100 hover:border-vh-beige/30 hover:shadow-lg transition-all duration-300">
                      <div className="flex items-center gap-3">
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                          index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-600' : 'bg-vh-red'
                        }`}>
                          {index + 1}
                        </span>
                        <div>
                          <div className="font-semibold text-gray-800">{entry.playerName || 'Anonymous'}</div>
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
            </div>
          </div>
        </div>

        <div className="text-center">
            <button 
              onClick={() => setGameState('setup')}
              className="group bg-gradient-to-r from-vh-red to-vh-dark-red text-white px-12 py-4 rounded-2xl font-bold text-lg hover:from-vh-dark-red hover:to-vh-red transition-all duration-300 shadow-2xl hover:shadow-vh-red/25 transform hover:-translate-y-1"
            >
              <Target className="inline mr-3" size={20} />
              Back to Game
            </button>
          </div>
        </div>
      </div>
    </div>
    );
  }

  if (gameState === 'setup') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white relative overflow-hidden">
        {/* Professional Background Elements */}
        <div className="absolute inset-0">
          <div className="absolute top-20 right-20 w-72 h-72 bg-vh-red/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-20 w-96 h-96 bg-vh-beige/10 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-3">
            <div className="grid grid-cols-12 gap-4 transform rotate-12">
              {Array.from({ length: 144 }).map((_, i) => (
                <div key={i} className="h-1 bg-gradient-to-r from-vh-red/10 to-transparent rounded animate-pulse" style={{ animationDelay: `${i * 100}ms` }}></div>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative z-10">
          <div className="text-center mb-16">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-vh-red to-vh-dark-red rounded-3xl mb-8 shadow-2xl">
              <Target className="text-white" size={40} />
            </div>
            <h1 className="text-6xl lg:text-7xl font-black text-gray-900 mb-6">
              Mental Math <span className="bg-gradient-to-r from-vh-red to-vh-dark-red bg-clip-text text-transparent">Trainer</span>
            </h1>
            <p className="text-2xl text-gray-600 max-w-4xl mx-auto leading-relaxed">Challenge your mind with lightning-fast calculations and compete for the top scores</p>
          </div>

          <div className="group relative mb-12">
            <div className="absolute inset-0 bg-gradient-to-br from-vh-red/10 to-transparent rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
            <div className="relative bg-white rounded-3xl shadow-2xl p-12 border border-gray-100 group-hover:shadow-4xl transition-all duration-500">
              <div className="space-y-8">
                <div>
                  <label className="block text-lg font-black text-gray-900 mb-6">
                    Choose Operations (Select one or more)
                  </label>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(operationLabels).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => toggleOperation(key)}
                      className={`p-4 rounded-lg border-2 transition-all font-medium ${
                        selectedOperations.includes(key)
                          ? 'border-vh-red bg-vh-red text-white shadow-lg transform scale-105'
                          : 'border-gray-200 hover:border-vh-red/50 hover:bg-vh-beige/20 text-gray-700'
                      }`}
                    >
                      <div className="text-sm">{label}</div>
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
          </div>

          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <button 
              onClick={startGame}
              className="group bg-gradient-to-r from-vh-red to-vh-dark-red text-white px-12 py-4 rounded-2xl font-bold text-lg hover:from-vh-dark-red hover:to-vh-red transition-all duration-300 flex items-center justify-center gap-3 shadow-2xl hover:shadow-vh-red/25 transform hover:-translate-y-1"
            >
              <Play size={24} />
              Start Challenge
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
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 mb-8 border border-white/20">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Clock size={24} className="text-vh-red" />
                <span className="font-mono text-2xl font-bold text-vh-red">
                  {formatTime(timeRemaining)}
                </span>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Target size={20} className="text-vh-red" />
                  <span className="font-bold text-lg">Score: {score}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap size={20} className="text-green-600" />
                  <span className="font-medium">{questionsAnswered} solved</span>
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
                <div className="text-6xl lg:text-7xl font-black text-gray-900 mb-10 tracking-tight">
                  {currentQuestion.num1} <span className="text-vh-red">{currentQuestion.symbol}</span> {currentQuestion.num2} = <span className="text-vh-red">?</span>
                </div>
              )}
              
              <input
                type="number"
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                onKeyPress={handleKeyPress}
                className="text-4xl font-black text-center p-6 border-3 border-gray-200 rounded-2xl focus:ring-4 focus:ring-vh-red/50 focus:border-vh-red bg-gradient-to-r from-gray-50 to-white w-80 shadow-xl transition-all duration-300"
                placeholder="Your answer"
                autoFocus
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={submitAnswer}
              disabled={userAnswer === ''}
              className="group flex-1 bg-gradient-to-r from-vh-red to-vh-dark-red text-white py-4 px-8 rounded-2xl hover:from-vh-dark-red hover:to-vh-red disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 font-bold text-lg shadow-2xl hover:shadow-vh-red/25 transform hover:-translate-y-1 disabled:transform-none"
            >
              <Target className="inline mr-3" size={20} />
              Submit Answer
            </button>
            <button
              onClick={skipQuestion}
              className="group bg-gradient-to-r from-orange-500 to-red-500 text-white py-4 px-8 rounded-2xl hover:from-orange-600 hover:to-red-600 transition-all duration-300 flex items-center justify-center gap-3 font-bold text-lg shadow-xl hover:shadow-orange-500/25 transform hover:-translate-y-1"
            >
              <SkipForward size={20} />
              Skip (-pts)
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