'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Award, Target, TrendingUp, Eye, CheckCircle, XCircle, Clock } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { SimpleTestsData, FullTestsData, StudentsData, SimpleTest, FullTest, SimpleTestResult, FullTestResult } from '@/types/results';
import SeriesProgressChart from '../../components/SeriesProgressChart';
import PerformanceBarChart from '../../components/PerformanceBarChart';
import SkillRadarChart from '../../components/SkillRadarChart';
import PercentileChart from '../../components/PercentileChart';

const TestDetailPage = () => {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const testName = decodeURIComponent(params.testName as string);

  const [simpleTests, setSimpleTests] = useState<SimpleTestsData | null>(null);
  const [fullTests, setFullTests] = useState<FullTestsData | null>(null);
  const [students, setStudents] = useState<StudentsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentTest, setCurrentTest] = useState<SimpleTest | FullTest | null>(null);
  const [userResult, setUserResult] = useState<SimpleTestResult | FullTestResult | null>(null);
  const [isFullTest, setIsFullTest] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [simpleResponse, fullResponse, studentsResponse] = await Promise.all([
          fetch('/data/simple-tests.json').then(res => res.json()),
          fetch('/data/full-tests.json').then(res => res.json()),
          fetch('/data/students.json').then(res => res.json())
        ]);

        setSimpleTests(simpleResponse);
        setFullTests(fullResponse);
        setStudents(studentsResponse);

        // Find the test
        let test = simpleResponse.tests[testName];
        let isFullTestType = false;

        if (!test) {
          test = fullResponse.tests[testName];
          isFullTestType = true;
        }

        if (!test) {
          setError(`Test "${testName}" not found.`);
          return;
        }

        setCurrentTest(test);
        setIsFullTest(isFullTestType);

        // Find user result
        if (session?.user?.email) {
          const user = Object.values(studentsResponse.students).find((s: any) => s.email === session.user?.email) as any;
          if (user && test.results[user.id]) {
            setUserResult(test.results[user.id]);
          }
        }

      } catch (err) {
        console.error('Error fetching test data:', err);
        setError('Failed to load test data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [testName, session]);

  const formatResponseText = (response: string) => {
    if (response === 'NAN') return 'Not Attempted';

    // Parse response like "E (C)" or "A (W)"
    const match = response.match(/(.+?)\s*\(([CW])\)/);
    if (match) {
      const [, answer, result] = match;
      const isCorrect = result === 'C';
      return (
        <span className={`flex items-center gap-1 ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
          <span className="font-mono">{answer}</span>
          {isCorrect ? <CheckCircle size={14} /> : <XCircle size={14} />}
        </span>
      );
    }

    return response;
  };

  const analyzePersonalTopQuestionsPerformance = () => {
    if (!isFullTest || !currentTest || !userResult || !session?.user?.email) return null;

    const test = currentTest as FullTest;
    const result = userResult as FullTestResult;

    if (!test.topQuestions || !result.responses) return null;

    const personalAnalysis: any = {};

    Object.entries(test.topQuestions).forEach(([sectionNum, sectionData]) => {
      personalAnalysis[sectionNum] = {
        easiestCorrect: 0,
        easiestWrong: 0,
        easiestSkipped: 0,
        hardestCorrect: 0,
        hardestWrong: 0,
        hardestSkipped: 0,
        mostSkippedCorrect: 0,
        mostSkippedWrong: 0,
        mostSkippedActuallySkipped: 0
      };

      // Analyze performance on easiest questions
      sectionData.mostCorrect.forEach((question: any) => {
        const userResponse = result.responses[question.questionId];
        if (userResponse === 'NAN') {
          personalAnalysis[sectionNum].easiestSkipped++;
        } else if (userResponse?.includes('(C)')) {
          personalAnalysis[sectionNum].easiestCorrect++;
        } else if (userResponse?.includes('(W)')) {
          personalAnalysis[sectionNum].easiestWrong++;
        }
      });

      // Analyze performance on hardest questions
      sectionData.mostWrong.forEach((question: any) => {
        const userResponse = result.responses[question.questionId];
        if (userResponse === 'NAN') {
          personalAnalysis[sectionNum].hardestSkipped++;
        } else if (userResponse?.includes('(C)')) {
          personalAnalysis[sectionNum].hardestCorrect++;
        } else if (userResponse?.includes('(W)')) {
          personalAnalysis[sectionNum].hardestWrong++;
        }
      });

      // Analyze performance on most skipped questions
      sectionData.mostSkipped.forEach((question: any) => {
        const userResponse = result.responses[question.questionId];
        if (userResponse === 'NAN') {
          personalAnalysis[sectionNum].mostSkippedActuallySkipped++;
        } else if (userResponse?.includes('(C)')) {
          personalAnalysis[sectionNum].mostSkippedCorrect++;
        } else if (userResponse?.includes('(W)')) {
          personalAnalysis[sectionNum].mostSkippedWrong++;
        }
      });
    });

    return personalAnalysis;
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gradient-to-br from-vh-beige/20 via-white to-vh-light-red/5">
          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-vh-red mx-auto mb-4"></div>
                <p className="text-gray-600">Loading test details...</p>
              </div>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (error || !currentTest) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gradient-to-br from-vh-beige/20 via-white to-vh-light-red/5">
          <div className="max-w-7xl mx-auto px-4 py-8">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-vh-red hover:text-vh-red/80 mb-6"
            >
              <ArrowLeft size={20} />
              Back to Results
            </button>
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <div className="text-red-500 text-6xl mb-4">⚠️</div>
                <h2 className="text-xl font-semibold text-gray-800 mb-2">Test Not Found</h2>
                <p className="text-gray-600">{error}</p>
              </div>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-vh-beige/10 to-white">
        <div className="max-w-7xl mx-auto px-4 py-8">

          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-vh-red hover:text-vh-red/80 mb-4"
            >
              <ArrowLeft size={20} />
              Back to Results
            </button>

            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-800 mb-2">{testName}</h1>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <Eye size={16} />
                    {isFullTest ? 'Full Test' : 'Simple Test'}
                  </span>
                  {!isFullTest && (currentTest as SimpleTest).testSeries && (
                    <span>Series: {(currentTest as SimpleTest).testSeries}</span>
                  )}
                  {isFullTest && (currentTest as FullTest).sections && (
                    <span>{(currentTest as FullTest).sections.length} Sections</span>
                  )}
                </div>
              </div>

              {userResult && (
                <div className="text-right">
                  <div className="text-2xl font-bold text-vh-red">
                    {isFullTest ? (userResult as FullTestResult).totalMarks : (userResult as SimpleTestResult).score}
                  </div>
                  <div className="text-sm text-gray-600">Rank #{userResult.rank}</div>
                </div>
              )}
            </div>
          </div>

          {!userResult ? (
            <div className="bg-gradient-to-br from-white to-vh-beige/5 rounded-xl shadow-lg p-8 text-center border border-vh-beige/30">
              <Clock size={48} className="text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Test Not Taken</h3>
              <p className="text-gray-600">You haven't taken this test yet.</p>
            </div>
          ) : (
            <div className="space-y-8">

              {/* Performance Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Score/Marks */}
                <div className="bg-gradient-to-br from-white to-vh-beige/5 rounded-xl shadow-lg border border-vh-beige/30 hover:shadow-xl transition-all duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">
                      {isFullTest ? 'Total Marks' : 'Score'}
                    </h3>
                    <Target className="text-vh-red" size={24} />
                  </div>
                  <div className="text-3xl font-bold text-vh-red mb-2">
                    {isFullTest ? (userResult as FullTestResult).totalMarks : (userResult as SimpleTestResult).score}
                  </div>
                  {!isFullTest && (
                    <div className="text-sm text-gray-600">
                      Threshold: {(userResult as SimpleTestResult).threshold}
                    </div>
                  )}
                </div>

                {/* Rank */}
                <div className="bg-gradient-to-br from-white to-vh-beige/5 rounded-xl shadow-lg border border-vh-beige/30 hover:shadow-xl transition-all duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">Class Rank</h3>
                    <Award className="text-vh-red" size={24} />
                  </div>
                  <div className="text-3xl font-bold text-vh-red mb-2">#{userResult.rank}</div>
                  <div className="text-sm text-gray-600">
                    out of {Object.keys(currentTest.results).length} students
                  </div>
                </div>

                {/* Accuracy */}
                <div className="bg-gradient-to-br from-white to-vh-beige/5 rounded-xl shadow-lg border border-vh-beige/30 hover:shadow-xl transition-all duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">Accuracy</h3>
                    <TrendingUp className="text-vh-red" size={24} />
                  </div>
                  <div className="text-3xl font-bold text-vh-red mb-2">
                    {isFullTest ?
                      Math.round(((userResult as FullTestResult).totalMarks / Math.max(...Object.values(currentTest.results).map(r => (r as FullTestResult).totalMarks))) * 100) :
                      (userResult as SimpleTestResult).analytics.accuracy
                    }%
                  </div>
                  <div className="text-sm text-gray-600">
                    {!isFullTest && `${(userResult as SimpleTestResult).analytics.attemptRate}% attempted`}
                  </div>
                </div>
              </div>

              {/* Simple Test Details */}
              {!isFullTest && (
                <div className="bg-gradient-to-br from-white to-vh-beige/5 rounded-xl shadow-lg border border-vh-beige/30 hover:shadow-xl transition-all duration-300">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Performance Breakdown</h3>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {(userResult as SimpleTestResult).correct}
                      </div>
                      <div className="text-sm text-green-700">Correct</div>
                    </div>

                    <div className="text-center p-4 bg-red-50 rounded-lg">
                      <div className="text-2xl font-bold text-red-600">
                        {(userResult as SimpleTestResult).wrong}
                      </div>
                      <div className="text-sm text-red-700">Wrong</div>
                    </div>

                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-gray-600">
                        {(userResult as SimpleTestResult).unattempted || 0}
                      </div>
                      <div className="text-sm text-gray-700">Unattempted</div>
                    </div>

                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {(userResult as SimpleTestResult).totalQuestions}
                      </div>
                      <div className="text-sm text-blue-700">Total Questions</div>
                    </div>
                  </div>

                  {/* Sections breakdown if available */}
                  {(userResult as SimpleTestResult).sections && Object.keys((userResult as SimpleTestResult).sections!).length > 0 && (
                    <div className="mt-6">
                      <h4 className="font-semibold text-gray-800 mb-3">Section Performance</h4>
                      <div className="space-y-2">
                        {Object.entries((userResult as SimpleTestResult).sections!).map(([sectionNum, section]) => (
                          <div key={sectionNum} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <span className="font-medium">Section {sectionNum}</span>
                            <div className="flex items-center gap-4 text-sm">
                              <span className="text-green-600">{section.correct} correct</span>
                              <span className="text-red-600">{section.wrong} wrong</span>
                              <span className="font-semibold">{section.score} points</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Essays if available */}
                  {(userResult as SimpleTestResult).essays && Object.keys((userResult as SimpleTestResult).essays!).length > 0 && (
                    <div className="mt-6">
                      <h4 className="font-semibold text-gray-800 mb-3">Essay Scores</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {Object.entries((userResult as SimpleTestResult).essays!).map(([essayNum, score]) => (
                          <div key={essayNum} className="text-center p-3 bg-purple-50 rounded-lg">
                            <div className="text-lg font-bold text-purple-600">{score}</div>
                            <div className="text-sm text-purple-700">Essay {essayNum}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Full Test Details */}
              {isFullTest && (
                <div className="space-y-6">

                  {/* Section Performance */}
                  <div className="bg-gradient-to-br from-white to-vh-beige/5 rounded-xl shadow-lg border border-vh-beige/30 hover:shadow-xl transition-all duration-300">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Section Performance</h3>

                    <div className="space-y-4">
                      {Object.entries((userResult as FullTestResult).sections).map(([sectionNum, section]) => (
                        <div key={sectionNum} className="p-4 border border-gray-200 rounded-lg">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold text-gray-800">Section {sectionNum}</h4>
                            <div className="text-lg font-bold text-vh-red">{section.marks} marks</div>
                          </div>

                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div className="text-center">
                              <div className="text-lg font-semibold text-green-600">{section.correct}</div>
                              <div className="text-gray-600">Correct</div>
                            </div>
                            <div className="text-center">
                              <div className="text-lg font-semibold text-red-600">{section.wrong}</div>
                              <div className="text-gray-600">Wrong</div>
                            </div>
                            <div className="text-center">
                              <div className="text-lg font-semibold text-blue-600">{section.percentage}%</div>
                              <div className="text-gray-600">Percentage</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Individual Responses */}
                  {(userResult as FullTestResult).responses && (
                    <div className="bg-gradient-to-br from-white to-vh-beige/5 rounded-xl shadow-lg border border-vh-beige/30 hover:shadow-xl transition-all duration-300">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">Question Responses</h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
                        {Object.entries((userResult as FullTestResult).responses).map(([questionId, response]) => (
                          <div key={questionId} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                            <span className="font-mono text-gray-600">{questionId.replace('Section', 'S').replace('-Q', '-')}</span>
                            <div>{formatResponseText(response)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Advanced Analytics */}
                  {(userResult as FullTestResult).analytics && (
                    <div className="bg-gradient-to-br from-white to-vh-beige/5 rounded-xl shadow-lg border border-vh-beige/30 hover:shadow-xl transition-all duration-300">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">Advanced Analytics</h3>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="text-center p-4 bg-blue-50 rounded-lg">
                          <div className="text-2xl font-bold text-blue-600">
                            {(userResult as FullTestResult).analytics.skipStrategy}
                          </div>
                          <div className="text-sm text-blue-700">Skip Strategy Score</div>
                          <div className="text-xs text-gray-600 mt-1">How well you skipped difficult questions</div>
                        </div>

                        <div className="text-center p-4 bg-green-50 rounded-lg">
                          <div className="text-2xl font-bold text-green-600">
                            {(userResult as FullTestResult).analytics.questionChoiceStrategy}
                          </div>
                          <div className="text-sm text-green-700">Question Choice Score</div>
                          <div className="text-xs text-gray-600 mt-1">Quality of question selection</div>
                        </div>

                        <div className="text-center p-4 bg-purple-50 rounded-lg">
                          <div className="text-2xl font-bold text-purple-600">
                            {(userResult as FullTestResult).analytics.recoveryScore}
                          </div>
                          <div className="text-sm text-purple-700">Recovery Score</div>
                          <div className="text-xs text-gray-600 mt-1">How quickly you recovered from mistakes</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Class Percentile Positioning */}
              {userResult && currentTest && (
                <div className="bg-gradient-to-br from-white to-vh-beige/5 rounded-xl shadow-lg border border-vh-beige/30 hover:shadow-xl transition-all duration-300">
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Your Position in Class</h3>
                    <PercentileChart
                      userScore={isFullTest ? (userResult as FullTestResult).totalMarks : (userResult as SimpleTestResult).score}
                      allScores={Object.values(currentTest.results).map(result =>
                        isFullTest ? (result as FullTestResult).totalMarks : (result as SimpleTestResult).score
                      )}
                      title=""
                      height={250}
                    />
                  </div>
                </div>
              )}

              {/* Class Comparison */}
              <div className="bg-gradient-to-br from-white to-vh-beige/5 rounded-xl shadow-lg border border-vh-beige/30 hover:shadow-xl transition-all duration-300">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Class Comparison</h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-600">
                      {currentTest.classStats.averageScore.toFixed(1)}
                    </div>
                    <div className="text-sm text-gray-700">Class Average</div>
                  </div>

                  <div className="text-center p-4 bg-yellow-50 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600">
                      {currentTest.classStats.top5Average.toFixed(1)}
                    </div>
                    <div className="text-sm text-yellow-700">Top 5 Average</div>
                  </div>

                  <div className="text-center p-4 bg-vh-beige/20 rounded-lg">
                    <div className="text-2xl font-bold text-vh-red">
                      {Math.round(currentTest.classStats.passRate)}%
                    </div>
                    <div className="text-sm text-vh-red">Pass Rate</div>
                  </div>
                </div>
              </div>

              {/* Performance Analytics Charts */}
              {simpleTests && students && session?.user?.email && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Progress Trend Chart */}
                  <div className="bg-gradient-to-br from-white to-vh-beige/5 rounded-xl shadow-lg border border-vh-beige/30 hover:shadow-xl transition-all duration-300">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Your Progress Trend</h3>
                    <SeriesProgressChart
                      simpleTests={simpleTests}
                      students={students}
                      userEmail={session.user.email}
                      highlightTest={testName}
                    />
                  </div>

                  {/* Performance Comparison */}
                  <div className="bg-gradient-to-br from-white to-vh-beige/5 rounded-xl shadow-lg border border-vh-beige/30 hover:shadow-xl transition-all duration-300">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Performance vs Class</h3>
                    <PerformanceBarChart
                      simpleTests={simpleTests}
                      students={students}
                      userEmail={session.user.email}
                      testName={testName}
                    />
                  </div>

                  {/* Skill Analysis */}
                  <div className="bg-gradient-to-br from-white to-vh-beige/5 rounded-xl shadow-lg border border-vh-beige/30 hover:shadow-xl transition-all duration-300">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Skill Breakdown</h3>
                    <SkillRadarChart
                      simpleTests={simpleTests}
                      students={students}
                      userEmail={session.user.email}
                      testName={testName}
                    />
                  </div>
                </div>
              )}

              {/* Question Performance Analytics (Sheet 2 Data) */}
              {isFullTest && (currentTest as FullTest).topQuestions && (
                <div className="bg-gradient-to-br from-white to-vh-beige/5 rounded-xl shadow-lg border border-vh-beige/30 hover:shadow-xl transition-all duration-300">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Question Difficulty Analysis</h3>

                  {Object.entries((currentTest as FullTest).topQuestions).map(([sectionNum, sectionData]) => (
                    <div key={sectionNum} className="mb-6">
                      <h4 className="font-semibold text-gray-700 mb-3">Section {sectionNum}</h4>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Most Correct Questions */}
                        <div className="bg-green-50 p-4 rounded-lg">
                          <h5 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                            <CheckCircle size={16} />
                            Easiest Questions
                          </h5>
                          <div className="space-y-1">
                            {sectionData.mostCorrect.slice(0, 5).map((question: any, index: number) => (
                              <div key={question.questionId} className="flex justify-between text-sm">
                                <span className="text-green-700">{question.questionId.replace('Section1-Q', 'Q')}</span>
                                <span className="text-green-600 font-medium">{question.count} correct</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Most Wrong Questions */}
                        <div className="bg-red-50 p-4 rounded-lg">
                          <h5 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
                            <XCircle size={16} />
                            Hardest Questions
                          </h5>
                          <div className="space-y-1">
                            {sectionData.mostWrong.slice(0, 5).map((question: any, index: number) => (
                              <div key={question.questionId} className="flex justify-between text-sm">
                                <span className="text-red-700">{question.questionId.replace('Section1-Q', 'Q')}</span>
                                <span className="text-red-600 font-medium">{question.count} wrong</span>
                              </div>
                            ))}
                            {sectionData.mostWrong.length === 0 && (
                              <div className="text-sm text-gray-500 italic">No data available</div>
                            )}
                          </div>
                        </div>

                        {/* Most Skipped Questions */}
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <h5 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                            <Clock size={16} />
                            Most Skipped
                          </h5>
                          <div className="space-y-1">
                            {sectionData.mostSkipped.slice(0, 5).map((question: any, index: number) => (
                              <div key={question.questionId} className="flex justify-between text-sm">
                                <span className="text-gray-700">{question.questionId.replace('Section1-Q', 'Q')}</span>
                                <span className="text-gray-600 font-medium">{question.count} skipped</span>
                              </div>
                            ))}
                            {sectionData.mostSkipped.length === 0 && (
                              <div className="text-sm text-gray-500 italic">No data available</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Personal Performance vs Top Questions */}
              {isFullTest && (currentTest as FullTest).topQuestions && userResult && (
                <div className="bg-gradient-to-br from-white to-vh-beige/5 rounded-xl shadow-lg border border-vh-beige/30 hover:shadow-xl transition-all duration-300">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 p-6 pb-0">Your Performance vs Class Top Questions</h3>
                  <p className="text-sm text-gray-600 mb-6 px-6">See how you performed on the questions that were easiest, hardest, and most skipped by the class</p>

                  {(() => {
                    const personalAnalysis = analyzePersonalTopQuestionsPerformance();
                    if (!personalAnalysis) return null;

                    return Object.entries(personalAnalysis).map(([sectionNum, analysis]: [string, any]) => (
                      <div key={sectionNum} className="mb-6 px-6">
                        <h4 className="font-semibold text-gray-700 mb-4">Section {sectionNum}</h4>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                          {/* Performance on Easiest Questions */}
                          <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                            <h5 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                              <CheckCircle size={16} />
                              Easiest Questions Performance
                            </h5>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-green-700">Got Correct:</span>
                                <span className="font-semibold text-green-600">{analysis.easiestCorrect}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-red-700">Got Wrong:</span>
                                <span className="font-semibold text-red-600">{analysis.easiestWrong}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-700">Skipped:</span>
                                <span className="font-semibold text-gray-600">{analysis.easiestSkipped}</span>
                              </div>
                              <div className="pt-2 border-t border-green-300">
                                <div className="flex justify-between font-semibold">
                                  <span className="text-green-800">Success Rate:</span>
                                  <span className="text-green-600">
                                    {analysis.easiestCorrect + analysis.easiestWrong > 0
                                      ? Math.round((analysis.easiestCorrect / (analysis.easiestCorrect + analysis.easiestWrong)) * 100)
                                      : 0}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Performance on Hardest Questions */}
                          <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                            <h5 className="font-semibold text-red-800 mb-3 flex items-center gap-2">
                              <XCircle size={16} />
                              Hardest Questions Performance
                            </h5>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-green-700">Got Correct:</span>
                                <span className="font-semibold text-green-600">{analysis.hardestCorrect}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-red-700">Got Wrong:</span>
                                <span className="font-semibold text-red-600">{analysis.hardestWrong}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-700">Skipped:</span>
                                <span className="font-semibold text-gray-600">{analysis.hardestSkipped}</span>
                              </div>
                              <div className="pt-2 border-t border-red-300">
                                <div className="flex justify-between font-semibold">
                                  <span className="text-red-800">Success Rate:</span>
                                  <span className="text-red-600">
                                    {analysis.hardestCorrect + analysis.hardestWrong > 0
                                      ? Math.round((analysis.hardestCorrect / (analysis.hardestCorrect + analysis.hardestWrong)) * 100)
                                      : 0}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Performance on Most Skipped Questions */}
                          <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
                            <h5 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                              <Clock size={16} />
                              Most Skipped Questions Performance
                            </h5>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-green-700">Got Correct:</span>
                                <span className="font-semibold text-green-600">{analysis.mostSkippedCorrect}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-red-700">Got Wrong:</span>
                                <span className="font-semibold text-red-600">{analysis.mostSkippedWrong}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-700">Also Skipped:</span>
                                <span className="font-semibold text-gray-600">{analysis.mostSkippedActuallySkipped}</span>
                              </div>
                              <div className="pt-2 border-t border-gray-300">
                                <div className="flex justify-between font-semibold">
                                  <span className="text-gray-800">Attempt Rate:</span>
                                  <span className="text-gray-600">
                                    {(analysis.mostSkippedCorrect + analysis.mostSkippedWrong + analysis.mostSkippedActuallySkipped) > 0
                                      ? Math.round(((analysis.mostSkippedCorrect + analysis.mostSkippedWrong) / (analysis.mostSkippedCorrect + analysis.mostSkippedWrong + analysis.mostSkippedActuallySkipped)) * 100)
                                      : 0}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Performance Summary */}
                        <div className="bg-vh-beige/10 border border-vh-beige/30 p-4 rounded-lg">
                          <h6 className="font-semibold text-vh-red mb-2">Section {sectionNum} Summary</h6>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div className="text-center">
                              <div className="text-2xl font-bold text-green-600">
                                {analysis.easiestCorrect + analysis.hardestCorrect + analysis.mostSkippedCorrect}
                              </div>
                              <div className="text-xs text-gray-600">Total Correct on Top Questions</div>
                            </div>
                            <div className="text-center">
                              <div className="text-2xl font-bold text-red-600">
                                {analysis.easiestWrong + analysis.hardestWrong + analysis.mostSkippedWrong}
                              </div>
                              <div className="text-xs text-gray-600">Total Wrong on Top Questions</div>
                            </div>
                            <div className="text-center">
                              <div className="text-2xl font-bold text-gray-600">
                                {analysis.easiestSkipped + analysis.hardestSkipped + analysis.mostSkippedActuallySkipped}
                              </div>
                              <div className="text-xs text-gray-600">Total Skipped on Top Questions</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default TestDetailPage;