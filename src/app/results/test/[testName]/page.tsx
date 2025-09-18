'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Award, Target, TrendingUp, Eye, CheckCircle, XCircle, Clock } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { SimpleTestsData, FullTestsData, StudentsData, SimpleTest, FullTest, SimpleTestResult, FullTestResult } from '@/types/results';

const TestDetailPage = () => {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const testName = decodeURIComponent(params.testName as string);

  const [, setSimpleTests] = useState<SimpleTestsData | null>(null);
  const [, setFullTests] = useState<FullTestsData | null>(null);
  const [, setStudents] = useState<StudentsData | null>(null);
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

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gradient-to-br from-vh-beige/10 to-white">
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
        <div className="min-h-screen bg-gradient-to-br from-vh-beige/10 to-white">
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
            <div className="bg-white rounded-xl shadow-md p-8 text-center border border-vh-beige/20">
              <Clock size={48} className="text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Test Not Taken</h3>
              <p className="text-gray-600">You haven't taken this test yet.</p>
            </div>
          ) : (
            <div className="space-y-8">

              {/* Performance Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Score/Marks */}
                <div className="bg-white rounded-xl shadow-md p-6 border border-vh-beige/20">
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
                <div className="bg-white rounded-xl shadow-md p-6 border border-vh-beige/20">
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
                <div className="bg-white rounded-xl shadow-md p-6 border border-vh-beige/20">
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
                <div className="bg-white rounded-xl shadow-md p-6 border border-vh-beige/20">
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
                  <div className="bg-white rounded-xl shadow-md p-6 border border-vh-beige/20">
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
                    <div className="bg-white rounded-xl shadow-md p-6 border border-vh-beige/20">
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
                    <div className="bg-white rounded-xl shadow-md p-6 border border-vh-beige/20">
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

              {/* Class Comparison */}
              <div className="bg-white rounded-xl shadow-md p-6 border border-vh-beige/20">
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
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default TestDetailPage;