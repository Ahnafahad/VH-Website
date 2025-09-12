'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Play, SkipForward, RotateCcw, Clock, Target, Zap, Trophy, Eye } from 'lucide-react';
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

  // Check if question is unique
  const isQuestionUnique = (newQuestion: Question) => {
    return !previousQuestions.some(prev => 
      prev.num1 === newQuestion.num1 && 
      prev.num2 === newQuestion.num2 && 
      prev.operation === newQuestion.operation
    );
  };

  // Generate new question
  const generateNewQuestion = useCallback(() => {
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

  // Save game result to database
  const saveGameResult = async (result: GameResult) => {
    try {
      const response = await fetch('/api/mental-math/scores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(result),
      });
      
      if (response.ok) {
        // Refresh leaderboard after saving
        fetchLeaderboard();
      }
    } catch (error) {
      console.error('Error saving game result:', error);
    }
  };

  // Fetch leaderboard data
  const fetchLeaderboard = async () => {
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
  };

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
  }, [gameState, score, questionsCorrect, questionsAnswered, difficulty, selectedOperations, timeLimit]);

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
      <div className="min-h-screen bg-vh-beige/20 p-4 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 left-10 text-vh-red text-8xl font-bold">+</div>
          <div className="absolute top-40 right-20 text-vh-red text-6xl font-bold">×</div>
          <div className="absolute bottom-20 left-20 text-vh-red text-7xl font-bold">÷</div>
          <div className="absolute bottom-40 right-10 text-vh-red text-9xl font-bold">−</div>
        </div>

        <div className="max-w-4xl mx-auto relative z-10">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-vh-red mb-2">Mental Math Leaderboard</h1>
            <p className="text-gray-600">Top performers in our mental math challenges</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-8">
            {/* Individual Game Scores */}
            <div className="bg-white rounded-xl shadow-lg p-6 border-t-4 border-vh-red">
              <h2 className="text-2xl font-semibold mb-4 text-gray-800 flex items-center gap-2">
                <Trophy className="text-vh-red" />
                Top Individual Scores
              </h2>
              {isLoading ? (
                <div className="text-center py-8">Loading...</div>
              ) : (
                <div className="space-y-3">
                  {leaderboard.individual.slice(0, 10).map((entry, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-vh-beige/20 rounded-lg">
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
            <div className="bg-white rounded-xl shadow-lg p-6 border-t-4 border-vh-red">
              <h2 className="text-2xl font-semibold mb-4 text-gray-800 flex items-center gap-2">
                <Zap className="text-vh-red" />
                Accumulated Top Scorers
              </h2>
              {isLoading ? (
                <div className="text-center py-8">Loading...</div>
              ) : (
                <div className="space-y-3">
                  {leaderboard.accumulated.slice(0, 10).map((entry, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-vh-beige/20 rounded-lg">
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

          <div className="text-center">
            <button 
              onClick={() => setGameState('setup')}
              className="bg-vh-red text-white py-3 px-8 rounded-xl hover:bg-vh-dark-red transition-colors font-semibold shadow-lg"
            >
              Back to Game
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'setup') {
    return (
      <div className="min-h-screen bg-vh-beige/20 p-4 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 left-10 text-vh-red text-8xl font-bold">+</div>
          <div className="absolute top-40 right-20 text-vh-red text-6xl font-bold">×</div>
          <div className="absolute bottom-20 left-20 text-vh-red text-7xl font-bold">÷</div>
          <div className="absolute bottom-40 right-10 text-vh-red text-9xl font-bold">−</div>
        </div>

        <div className="max-w-2xl mx-auto relative z-10">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-vh-red mb-2">Mental Math Trainer</h1>
            <p className="text-gray-600">Challenge your mind with lightning-fast calculations</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-8 mb-6 border-t-4 border-vh-red">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
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
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Difficulty Level
                </label>
                <select 
                  value={difficulty} 
                  onChange={(e) => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard' | 'extreme')}
                  className="w-full p-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-vh-red focus:border-vh-red font-medium"
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
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Time Limit
                </label>
                <select 
                  value={timeLimit} 
                  onChange={(e) => setTimeLimit(parseFloat(e.target.value))}
                  className="w-full p-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-vh-red focus:border-vh-red font-medium"
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

          <div className="flex gap-4">
            <button 
              onClick={startGame}
              className="flex-1 bg-vh-red text-white py-4 px-6 rounded-xl hover:bg-vh-dark-red transition-colors flex items-center justify-center gap-2 font-semibold shadow-lg"
            >
              <Play size={20} />
              Start Game
            </button>
            <button 
              onClick={() => {
                fetchLeaderboard();
                setGameState('leaderboard');
              }}
              className="bg-white border-2 border-vh-red text-vh-red py-4 px-6 rounded-xl hover:bg-vh-beige/20 transition-colors flex items-center justify-center gap-2 font-semibold"
            >
              <Eye size={20} />
              Leaderboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'playing') {
    return (
      <div className="min-h-screen bg-vh-beige/20 p-4 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 left-10 text-vh-red text-8xl font-bold">+</div>
          <div className="absolute top-40 right-20 text-vh-red text-6xl font-bold">×</div>
          <div className="absolute bottom-20 left-20 text-vh-red text-7xl font-bold">÷</div>
          <div className="absolute bottom-40 right-10 text-vh-red text-9xl font-bold">−</div>
        </div>

        <div className="max-w-2xl mx-auto relative z-10">
          {/* Header with stats */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border-t-4 border-vh-red">
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
          <div className="bg-white rounded-xl shadow-lg p-10 mb-6 border-t-4 border-vh-red">
            <div className="text-center">
              <div className="mb-4">
                <span className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                  {currentQuestion?.operation} • {difficulty}
                </span>
                {difficulty === 'extreme' && <span className="ml-2 text-lg">🔥</span>}
              </div>
              {currentQuestion && (
                <div className="text-5xl font-bold text-gray-800 mb-8">
                  {currentQuestion.num1} {currentQuestion.symbol} {currentQuestion.num2} = ?
                </div>
              )}
              
              <input
                type="number"
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                onKeyPress={handleKeyPress}
                className="text-3xl font-bold text-center p-4 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-vh-red focus:border-vh-red w-64"
                placeholder="Your answer"
                autoFocus
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-4">
            <button
              onClick={submitAnswer}
              disabled={userAnswer === ''}
              className="flex-1 bg-vh-red text-white py-4 px-6 rounded-xl hover:bg-vh-dark-red disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-semibold shadow-lg"
            >
              Submit Answer
            </button>
            <button
              onClick={skipQuestion}
              className="bg-orange-500 text-white py-4 px-6 rounded-xl hover:bg-orange-600 transition-colors flex items-center gap-2 font-semibold shadow-lg"
            >
              <SkipForward size={18} />
              Skip (-pts)
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'finished') {
    return (
      <div className="min-h-screen bg-vh-beige/20 p-4 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 left-10 text-vh-red text-8xl font-bold">+</div>
          <div className="absolute top-40 right-20 text-vh-red text-6xl font-bold">×</div>
          <div className="absolute bottom-20 left-20 text-vh-red text-7xl font-bold">÷</div>
          <div className="absolute bottom-40 right-10 text-vh-red text-9xl font-bold">−</div>
        </div>

        <div className="max-w-xl mx-auto relative z-10">
          <div className="bg-white rounded-xl shadow-lg p-8 border-t-4 border-vh-red">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-vh-red mb-2">Game Complete!</h1>
              <p className="text-gray-600">Great job on completing the challenge!</p>
            </div>
            
            <div className="space-y-4 mb-8">
              <div className="bg-vh-beige/30 p-6 rounded-lg border border-vh-beige">
                <div className="text-3xl font-bold text-vh-red text-center mb-2">
                  Final Score: {score}
                </div>
                <div className="text-center text-gray-600">
                  {score > 0 ? 'Excellent work!' : 'Keep practicing to improve!'}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 p-4 rounded-lg text-center border border-green-200">
                  <div className="text-2xl font-bold text-green-600">{questionsCorrect}</div>
                  <div className="text-sm text-green-700 font-medium">Correct</div>
                </div>
                <div className="bg-red-50 p-4 rounded-lg text-center border border-red-200">
                  <div className="text-2xl font-bold text-red-600">{questionsAnswered - questionsCorrect}</div>
                  <div className="text-sm text-red-700 font-medium">Incorrect</div>
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
            
            <div className="flex gap-4">
              <button 
                onClick={() => setGameState('setup')}
                className="flex-1 bg-vh-red text-white py-3 px-6 rounded-xl hover:bg-vh-dark-red transition-colors flex items-center justify-center gap-2 font-semibold shadow-lg"
              >
                <RotateCcw size={20} />
                Play Again
              </button>
              <button 
                onClick={() => {
                  fetchLeaderboard();
                  setGameState('leaderboard');
                }}
                className="bg-white border-2 border-vh-red text-vh-red py-3 px-6 rounded-xl hover:bg-vh-beige/20 transition-colors flex items-center justify-center gap-2 font-semibold"
              >
                <Trophy size={20} />
                Leaderboard
              </button>
            </div>
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