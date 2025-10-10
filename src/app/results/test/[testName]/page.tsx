'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Award, Target, TrendingUp, Eye, CheckCircle, XCircle, Clock, Minus, Users } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { SimpleTestsData, FullTestsData, StudentsData, SimpleTest, FullTest, SimpleTestResult, FullTestResult } from '@/types/results';
import SeriesProgressChart from '../../components/SeriesProgressChart';
import PerformanceBarChart from '../../components/PerformanceBarChart';
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedStudentName, setSelectedStudentName] = useState<string>('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [simpleResponse, fullResponse, studentsResponse, adminCheckResponse] = await Promise.all([
          fetch('/data/simple-tests.json').then(res => res.json()),
          fetch('/data/full-tests.json').then(res => res.json()),
          fetch('/data/students.json').then(res => res.json()),
          fetch('/api/auth/check-admin').then(res => res.json())
        ]);

        setSimpleTests(simpleResponse);
        setFullTests(fullResponse);
        setStudents(studentsResponse);
        setIsAdmin(adminCheckResponse.isAdmin);

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

        // Find user result based on admin status
        if (session?.user?.email) {
          if (adminCheckResponse.isAdmin) {
            // Admin: don't show their own results initially
            setUserResult(null);
            setSelectedStudentId(null);
            setSelectedStudentName('');
          } else {
            // Student: show their own results
            const user = Object.values(studentsResponse.students).find((s: any) => s.email === session.user?.email) as any;
            if (user && test.results && test.results[user.id]) {
              setUserResult(test.results[user.id]);
              setSelectedStudentId(user.id);
              setSelectedStudentName(user.name);
            }
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

  const handleStudentSelection = (studentId: string) => {
    if (!currentTest || !students) return;

    setSelectedStudentId(studentId);

    // Find student name
    const student = Object.values(students.students).find((s: any) => s.id === studentId) as any;
    setSelectedStudentName(student?.name || '');

    // Find student result
    if (currentTest.results && currentTest.results[studentId]) {
      setUserResult(currentTest.results[studentId]);
    } else {
      setUserResult(null);
    }
  };

  // Get the email to use for charts (selected student for admin, own email for students)
  const getChartUserEmail = (): string | undefined => {
    if (!session?.user?.email) return undefined;

    if (isAdmin && selectedStudentId && students) {
      const selectedStudent = Object.values(students.students).find((s: any) => s.id === selectedStudentId) as any;
      return selectedStudent?.email;
    }

    return session.user.email;
  };

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
    if (!isFullTest || !currentTest || !userResult || !session?.user?.email) {
      console.log('DEBUG: Early return - missing data', {
        isFullTest,
        hasCurrentTest: !!currentTest,
        hasUserResult: !!userResult,
        hasEmail: !!session?.user?.email
      });
      return null;
    }

    const test = currentTest as FullTest;
    const result = userResult as FullTestResult;

    if (!test.topQuestions || !result.responses) {
      console.log('DEBUG: Missing topQuestions or responses', {
        hasTopQuestions: !!test.topQuestions,
        hasResponses: !!result.responses,
        topQuestions: test.topQuestions
      });
      return null;
    }

    console.log('DEBUG: Starting analysis', {
      testName: test.testName,
      topQuestionsSections: Object.keys(test.topQuestions),
      responseCount: Object.keys(result.responses).length
    });

    const personalAnalysis: any = {};

    Object.entries(test.topQuestions).forEach(([sectionNum, sectionData]) => {
      console.log(`DEBUG: Processing section ${sectionNum}`, {
        mostCorrectLength: sectionData.mostCorrect?.length || 0,
        mostWrongLength: sectionData.mostWrong?.length || 0,
        mostSkippedLength: sectionData.mostSkipped?.length || 0
      });

      // Only process sections that have data
      if (!sectionData.mostCorrect?.length && !sectionData.mostWrong?.length && !sectionData.mostSkipped?.length) {
        console.log(`DEBUG: Skipping section ${sectionNum} - no data`);
        return; // Skip sections with no top questions data
      }

      personalAnalysis[sectionNum] = {
        // Top Ten Questions Right - questions most students got correct
        topRightCorrect: 0,
        topRightWrong: 0,
        topRightSkipped: 0,
        // Top Ten Questions Wrong - questions most students got wrong
        topWrongCorrect: 0,
        topWrongWrong: 0,
        topWrongSkipped: 0,
        // Ten Questions Skipped - questions most students skipped
        topSkippedCorrect: 0,
        topSkippedWrong: 0,
        topSkippedActuallySkipped: 0,
        // Store actual questions for display
        topRightQuestions: [],
        topWrongQuestions: [],
        topSkippedQuestions: []
      };

      // Analyze performance on questions most students got RIGHT (easiest)
      if (sectionData.mostCorrect?.length > 0) {
        sectionData.mostCorrect.forEach((question: any) => {
          const userResponse = result.responses[question.questionId];
          personalAnalysis[sectionNum].topRightQuestions.push({
            questionId: question.questionId,
            userResponse,
            classCorrect: question.count
          });

          if (userResponse === 'NAN') {
            personalAnalysis[sectionNum].topRightSkipped++;
          } else if (userResponse?.includes('(C)')) {
            personalAnalysis[sectionNum].topRightCorrect++;
          } else {
            personalAnalysis[sectionNum].topRightWrong++;
          }
        });
      }

      // Analyze performance on questions most students got WRONG (hardest)
      if (sectionData.mostWrong?.length > 0) {
        sectionData.mostWrong.forEach((question: any) => {
          const userResponse = result.responses[question.questionId];
          personalAnalysis[sectionNum].topWrongQuestions.push({
            questionId: question.questionId,
            userResponse,
            classWrong: question.count
          });

          if (userResponse === 'NAN') {
            personalAnalysis[sectionNum].topWrongSkipped++;
          } else if (userResponse?.includes('(C)')) {
            personalAnalysis[sectionNum].topWrongCorrect++;
          } else {
            personalAnalysis[sectionNum].topWrongWrong++;
          }
        });
      }

      // Analyze performance on questions most students SKIPPED
      if (sectionData.mostSkipped?.length > 0) {
        sectionData.mostSkipped.forEach((question: any) => {
          const userResponse = result.responses[question.questionId];
          personalAnalysis[sectionNum].topSkippedQuestions.push({
            questionId: question.questionId,
            userResponse,
            classSkipped: question.count
          });

          if (userResponse === 'NAN') {
            personalAnalysis[sectionNum].topSkippedActuallySkipped++;
          } else if (userResponse?.includes('(C)')) {
            personalAnalysis[sectionNum].topSkippedCorrect++;
          } else {
            personalAnalysis[sectionNum].topSkippedWrong++;
          }
        });
      }
    });

    console.log('DEBUG: Final personalAnalysis', {
      analysisKeys: Object.keys(personalAnalysis),
      analysis: personalAnalysis
    });

    return Object.keys(personalAnalysis).length > 0 ? personalAnalysis : null;
  };

  // Helper function to get user's performance indicator for a specific question
  const getUserQuestionStatus = (questionId: string): React.ReactNode => {
    if (!isFullTest || !userResult || !session?.user?.email) return null;

    const result = userResult as FullTestResult;
    const userResponse = result.responses?.[questionId];

    if (!userResponse || userResponse === 'NAN') {
      return <Minus size={14} className="text-gray-400" />;
    } else if (userResponse.includes('(C)')) {
      return <CheckCircle size={14} className="text-green-500" />;
    } else if (userResponse.includes('(W)')) {
      return <XCircle size={14} className="text-red-500" />;
    }
    return null;
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-vh-beige/5 font-['Inter'] antialiased">
          <div className="max-w-6xl mx-auto px-6 py-12">
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <div className="w-16 h-16 border-4 border-vh-red/20 border-t-vh-red rounded-full animate-spin mx-auto mb-6"></div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Loading Test</h2>
                <p className="text-gray-600">Preparing detailed analytics...</p>
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
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-vh-beige/5 font-['Inter'] antialiased">
          <div className="max-w-6xl mx-auto px-6 py-12">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-vh-red hover:text-vh-red/80 mb-6 font-semibold"
            >
              <ArrowLeft size={20} />
              Back to Results
            </button>
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <div className="text-red-500 text-2xl">⚠️</div>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">Test Not Found</h2>
                <p className="text-gray-600 mb-6">{error}</p>
              </div>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-vh-beige/5 font-['Inter'] antialiased">
        <div className="max-w-6xl mx-auto px-6 py-12">

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
                  {selectedStudentName && (
                    <div className="text-xs text-gray-500 mt-1">
                      Viewing: {selectedStudentName}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Admin Student Selector */}
            {isAdmin && students && currentTest && (
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-3 mb-3">
                  <Users size={20} className="text-blue-600" />
                  <h3 className="text-lg font-semibold text-blue-800">Admin: Select Student to View</h3>
                </div>
                <select
                  value={selectedStudentId || ''}
                  onChange={(e) => handleStudentSelection(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select a student...</option>
                  {Object.values(students.students)
                    .filter((student: any) => currentTest.results && currentTest.results[student.id])
                    .sort((a: any, b: any) => a.name.localeCompare(b.name))
                    .map((student: any) => (
                      <option key={student.id} value={student.id}>
                        {student.name} (ID: {student.id})
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>

          {!userResult ? (
            <div className="bg-gradient-to-br from-white to-vh-beige/5 rounded-xl shadow-lg p-8 text-center border border-vh-beige/30">
              {isAdmin ? (
                <>
                  <Users size={48} className="text-blue-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">No Student Selected</h3>
                  <p className="text-gray-600">Please select a student from the dropdown above to view their test results.</p>
                </>
              ) : (
                <>
                  <Clock size={48} className="text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">Test Not Taken</h3>
                  <p className="text-gray-600">You haven't taken this test yet.</p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-8">

              {/* Performance Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">

                {/* Score/Marks */}
                <div className="bg-gradient-to-br from-white to-vh-beige/5 rounded-xl shadow-lg border border-vh-beige/30 hover:shadow-xl transition-all duration-300 p-6">
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
                <div className="bg-gradient-to-br from-white to-vh-beige/5 rounded-xl shadow-lg border border-vh-beige/30 hover:shadow-xl transition-all duration-300 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">Class Rank</h3>
                    <Award className="text-vh-red" size={24} />
                  </div>
                  <div className="text-3xl font-bold text-vh-red mb-2">#{userResult.rank}</div>
                  <div className="text-sm text-gray-600">
                    out of {Object.keys(currentTest.results).length} students
                  </div>
                </div>

                {/* Accuracy/Percentage */}
                <div className="bg-gradient-to-br from-white to-vh-beige/5 rounded-xl shadow-lg border border-vh-beige/30 hover:shadow-xl transition-all duration-300 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">
                      {isFullTest ? 'Overall %' : 'Accuracy'}
                    </h3>
                    <TrendingUp className="text-vh-red" size={24} />
                  </div>
                  <div className="text-3xl font-bold text-vh-red mb-2">
                    {isFullTest ?
                      `${((userResult as FullTestResult).totalPercentage || 0).toFixed(2)}%` :
                      `${((userResult as SimpleTestResult).analytics.accuracy).toFixed(2)}%`
                    }
                  </div>
                  <div className="text-sm text-gray-600">
                    {isFullTest ?
                      `MCQ: ${((userResult as FullTestResult).mcqPercentage || 0).toFixed(2)}%` :
                      `${((userResult as SimpleTestResult).analytics.attemptRate).toFixed(2)}% attempted`
                    }
                  </div>
                </div>
              </div>

              {/* Simple Test Details */}
              {!isFullTest && (
                <div className="bg-gradient-to-br from-white to-vh-beige/5 rounded-xl shadow-lg border border-vh-beige/30 hover:shadow-xl transition-all duration-300 p-6 mb-8">
                  <h3 className="text-lg font-semibold text-gray-800 mb-6">Performance Breakdown</h3>

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
                <div className="space-y-8 mb-8">

                  {/* Marks Breakdown */}
                  {(userResult as FullTestResult).mcqMarks !== undefined && (
                    <div className="bg-gradient-to-br from-white to-vh-beige/5 rounded-xl shadow-lg border border-vh-beige/30 hover:shadow-xl transition-all duration-300 p-6">
                      <h3 className="text-lg font-semibold text-gray-800 mb-6">Performance Breakdown</h3>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-100">
                          <div className="text-2xl font-bold text-blue-600">{(userResult as FullTestResult).mcqMarks}</div>
                          <div className="text-sm text-blue-700 mt-1">MCQ Marks</div>
                          <div className="text-xs text-blue-600 mt-1">{((userResult as FullTestResult).mcqPercentage || 0).toFixed(2)}%</div>
                        </div>

                        <div className="text-center p-4 bg-green-50 rounded-lg border border-green-100">
                          <div className="text-2xl font-bold text-green-600">{((userResult as FullTestResult).mcqAccuracy || 0).toFixed(2)}%</div>
                          <div className="text-sm text-green-700 mt-1">MCQ Accuracy</div>
                          <div className="text-xs text-green-600 mt-1">{(userResult as FullTestResult).mcqCorrect}/{((userResult as FullTestResult).mcqCorrect || 0) + ((userResult as FullTestResult).mcqWrong || 0)} attempted</div>
                        </div>

                        {(userResult as FullTestResult).essayMarks !== undefined && (userResult as FullTestResult).essayMarks! > 0 && (
                          <>
                            <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-100">
                              <div className="text-2xl font-bold text-purple-600">{(userResult as FullTestResult).essayMarks}</div>
                              <div className="text-sm text-purple-700 mt-1">Essay Marks</div>
                              <div className="text-xs text-purple-600 mt-1">out of {(userResult as FullTestResult).maxEssayMarks || 0}</div>
                            </div>
                          </>
                        )}

                        <div className="text-center p-4 bg-vh-red/10 rounded-lg border border-vh-red/30">
                          <div className="text-2xl font-bold text-vh-red">{(userResult as FullTestResult).totalMarks}</div>
                          <div className="text-sm text-vh-red mt-1">Total Marks</div>
                          <div className="text-xs text-vh-red/80 mt-1">{((userResult as FullTestResult).totalPercentage || 0).toFixed(2)}%</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Section Performance */}
                  <div className="bg-gradient-to-br from-white to-vh-beige/5 rounded-xl shadow-lg border border-vh-beige/30 hover:shadow-xl transition-all duration-300 p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-6">MCQ Section Performance</h3>

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
                              <div className="text-lg font-semibold text-blue-600">{(section.percentage || 0).toFixed(2)}%</div>
                              <div className="text-gray-600">Percentage</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Essays for Full Tests */}
                    {(userResult as FullTestResult).essays && Object.keys((userResult as FullTestResult).essays!).length > 0 && (
                      <div className="mt-6 pt-6 border-t border-gray-200">
                        <h4 className="font-semibold text-gray-800 mb-4">Essay Scores</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                          {Object.entries((userResult as FullTestResult).essays!).map(([essayNum, score]) => (
                            <div key={essayNum} className="text-center p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg border border-purple-200 hover:shadow-md transition-all duration-300">
                              <div className="text-2xl font-bold text-purple-600 mb-1">{score}<span className="text-sm text-purple-500">/10</span></div>
                              <div className="text-sm text-purple-700 font-medium">Essay {essayNum}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Individual Responses */}
                  {(userResult as FullTestResult).responses && (
                    <div className="bg-gradient-to-br from-white to-vh-beige/5 rounded-xl shadow-lg border border-vh-beige/30 hover:shadow-xl transition-all duration-300 p-6">
                      <h3 className="text-lg font-semibold text-gray-800 mb-6">Question Responses</h3>

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
                    <div className="bg-gradient-to-br from-white to-vh-beige/5 rounded-xl shadow-lg border border-vh-beige/30 hover:shadow-xl transition-all duration-300 p-6">
                      <h3 className="text-lg font-semibold text-gray-800 mb-6">Advanced Analytics</h3>

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
                <div className="bg-gradient-to-br from-white to-vh-beige/5 rounded-xl shadow-lg border border-vh-beige/30 hover:shadow-xl transition-all duration-300 mb-8">
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-6">Your Position in Class</h3>
                    <div className="h-80 mb-4">
                      <PercentileChart
                        userScore={isFullTest ? (userResult as FullTestResult).totalMarks : (userResult as SimpleTestResult).score}
                        allScores={Object.values(currentTest.results || {}).map(result =>
                          isFullTest ? (result as FullTestResult).totalMarks : (result as SimpleTestResult).score
                        )}
                        title=""
                        height={280}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Class Comparison */}
              <div className="bg-gradient-to-br from-white to-vh-beige/5 rounded-xl shadow-lg border border-vh-beige/30 hover:shadow-xl transition-all duration-300 p-8 mb-8 mt-16">
                <h3 className="text-lg font-semibold text-gray-800 mb-8">Class Comparison</h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center p-6 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="text-3xl font-bold text-gray-700 mb-2">
                      {currentTest.classStats.averageScore.toFixed(1)}
                    </div>
                    <div className="text-sm font-medium text-gray-600">Class Average</div>
                  </div>

                  <div className="text-center p-6 bg-yellow-50 rounded-lg border border-yellow-200">
                    <div className="text-3xl font-bold text-yellow-700 mb-2">
                      {currentTest.classStats.top5Average.toFixed(1)}
                    </div>
                    <div className="text-sm font-medium text-yellow-800">Top 5 Average</div>
                  </div>

                  <div className="text-center p-6 bg-red-50 rounded-lg border border-red-200">
                    <div className="text-3xl font-bold text-red-700 mb-2">
                      {Math.round(currentTest.classStats.passRate)}%
                    </div>
                    <div className="text-sm font-medium text-red-800">Pass Rate</div>
                  </div>
                </div>
              </div>

              {/* Performance Analytics Charts */}
              {(simpleTests || fullTests) && students && getChartUserEmail() && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8 items-stretch">
                  {/* Progress Trend Chart */}
                  <div className="bg-gradient-to-br from-white to-vh-beige/5 rounded-xl shadow-lg border border-vh-beige/30 hover:shadow-xl transition-all duration-300 p-6 flex flex-col">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">
                      {isAdmin && selectedStudentName ? `${selectedStudentName}'s Progress Trend` : 'Your Progress Trend'}
                    </h3>
                    <div className="flex-1 min-h-[24rem]">
                      <SeriesProgressChart
                        simpleTests={simpleTests}
                        fullTests={fullTests}
                        students={students}
                        userEmail={getChartUserEmail()!}
                        highlightTest={testName}
                        targetSeries={testName.replace(/\s*\d+$/, '').trim()}
                        height={360}
                      />
                    </div>
                  </div>

                  {/* Performance Comparison */}
                  <div className="bg-gradient-to-br from-white to-vh-beige/5 rounded-xl shadow-lg border border-vh-beige/30 hover:shadow-xl transition-all duration-300 p-6 flex flex-col">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">
                      {isAdmin && selectedStudentName ? `${selectedStudentName} vs Class` : 'Performance vs Class'}
                    </h3>
                    <div className="flex-1 min-h-[24rem]">
                      <PerformanceBarChart
                        simpleTests={simpleTests}
                        fullTests={fullTests}
                        students={students}
                        userEmail={getChartUserEmail()!}
                        testName={testName}
                        height={360}
                      />
                    </div>
                  </div>

                </div>
              )}

              {/* Question Performance Analytics (Sheet 2 Data) */}
              {isFullTest && (currentTest as FullTest).topQuestions && (
                <div className="bg-gradient-to-br from-white to-vh-beige/5 rounded-xl shadow-lg border border-vh-beige/30 hover:shadow-xl transition-all duration-300 p-8 mb-8 mt-16">
                  <h3 className="text-lg font-semibold text-gray-800 mb-8">Question Difficulty Analysis</h3>
                  {userResult && (
                    <div className="bg-gray-50 border border-gray-100 rounded-lg p-4 mb-6">
                      <p className="text-sm font-medium text-gray-700 mb-2">Your Performance Legend:</p>
                      <div className="flex flex-wrap gap-4 text-sm">
                        <span className="flex items-center gap-2">
                          <CheckCircle size={14} className="text-green-500" />
                          <span className="text-gray-600">Correct</span>
                        </span>
                        <span className="flex items-center gap-2">
                          <XCircle size={14} className="text-red-500" />
                          <span className="text-gray-600">Wrong</span>
                        </span>
                        <span className="flex items-center gap-2">
                          <Minus size={14} className="text-gray-400" />
                          <span className="text-gray-600">Skipped</span>
                        </span>
                      </div>
                    </div>
                  )}

                  {Object.entries((currentTest as FullTest).topQuestions)
                    .filter(([sectionNum, sectionData]: [string, any]) =>
                      sectionData.mostCorrect.length > 0 ||
                      sectionData.mostWrong.length > 0 ||
                      sectionData.mostSkipped.length > 0
                    )
                    .map(([sectionNum, sectionData]) => (
                    <div key={sectionNum} className="mb-8">
                      <h4 className="font-semibold text-gray-700 mb-4 text-base">Section {sectionNum}</h4>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Most Correct Questions */}
                        <div className="bg-green-50 p-5 rounded-lg">
                          <h5 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                            <CheckCircle size={16} />
                            Easiest Questions
                          </h5>
                          <div className="space-y-1 max-h-64 overflow-y-auto">
                            {sectionData.mostCorrect.map((question: any, index: number) => (
                              <div key={question.questionId} className="flex justify-between items-center text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="text-green-700">{question.questionId.replace(`Section${sectionNum}-Q`, 'Q')}</span>
                                  {userResult && getUserQuestionStatus(question.questionId)}
                                </div>
                                <span className="text-green-600 font-medium">{question.count} correct</span>
                              </div>
                            ))}
                            {sectionData.mostCorrect.length === 0 && (
                              <div className="text-sm text-gray-500 italic">No data available</div>
                            )}
                          </div>
                        </div>

                        {/* Most Wrong Questions */}
                        <div className="bg-red-50 p-5 rounded-lg">
                          <h5 className="font-semibold text-red-800 mb-3 flex items-center gap-2">
                            <XCircle size={16} />
                            Hardest Questions
                          </h5>
                          <div className="space-y-1 max-h-64 overflow-y-auto">
                            {sectionData.mostWrong.map((question: any, index: number) => (
                              <div key={question.questionId} className="flex justify-between items-center text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="text-red-700">{question.questionId.replace(`Section${sectionNum}-Q`, 'Q')}</span>
                                  {userResult && getUserQuestionStatus(question.questionId)}
                                </div>
                                <span className="text-red-600 font-medium">{question.count} wrong</span>
                              </div>
                            ))}
                            {sectionData.mostWrong.length === 0 && (
                              <div className="text-sm text-gray-500 italic">No data available</div>
                            )}
                          </div>
                        </div>

                        {/* Most Skipped Questions */}
                        <div className="bg-gray-50 p-5 rounded-lg">
                          <h5 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                            <Clock size={16} />
                            Most Skipped
                          </h5>
                          <div className="space-y-1 max-h-64 overflow-y-auto">
                            {sectionData.mostSkipped.map((question: any, index: number) => (
                              <div key={question.questionId} className="flex justify-between items-center text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-700">{question.questionId.replace(`Section${sectionNum}-Q`, 'Q')}</span>
                                  {userResult && getUserQuestionStatus(question.questionId)}
                                </div>
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
                <div className="bg-gradient-to-br from-white to-vh-beige/5 rounded-xl shadow-lg border border-vh-beige/30 hover:shadow-xl transition-all duration-300 p-6 mb-8">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Your Performance vs Class Top Questions</h3>
                  <p className="text-sm text-gray-600 mb-6">See how you performed on the questions that were easiest, hardest, and most skipped by the class</p>

                  {(() => {
                    const personalAnalysis = analyzePersonalTopQuestionsPerformance();
                    if (!personalAnalysis) return null;

                    return Object.entries(personalAnalysis).map(([sectionNum, analysis]: [string, any]) => (
                      <div key={sectionNum} className="mb-8">
                        <h4 className="font-semibold text-gray-700 mb-4 text-base">Section {sectionNum}</h4>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                          {/* Performance on Easiest Questions */}
                          {analysis.topRightQuestions?.length > 0 && (
                          <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                            <h5 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                              <CheckCircle size={16} />
                              Top Questions Right (Class Easiest)
                            </h5>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-green-700">Got Correct:</span>
                                <span className="font-semibold text-green-600">{analysis.topRightCorrect}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-red-700">Got Wrong:</span>
                                <span className="font-semibold text-red-600">{analysis.topRightWrong}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-700">Skipped:</span>
                                <span className="font-semibold text-gray-600">{analysis.topRightSkipped}</span>
                              </div>
                              <div className="pt-2 border-t border-green-300">
                                <div className="flex justify-between font-semibold">
                                  <span className="text-green-800">Success Rate:</span>
                                  <span className="text-green-600">
                                    {analysis.topRightCorrect + analysis.topRightWrong > 0
                                      ? Math.round((analysis.topRightCorrect / (analysis.topRightCorrect + analysis.topRightWrong)) * 100)
                                      : 0}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                          )}

                          {/* Performance on Hardest Questions */}
                          {analysis.topWrongQuestions?.length > 0 && (
                          <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                            <h5 className="font-semibold text-red-800 mb-3 flex items-center gap-2">
                              <XCircle size={16} />
                              Top Questions Wrong (Class Hardest)
                            </h5>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-green-700">Got Correct:</span>
                                <span className="font-semibold text-green-600">{analysis.topWrongCorrect}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-red-700">Got Wrong:</span>
                                <span className="font-semibold text-red-600">{analysis.topWrongWrong}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-700">Skipped:</span>
                                <span className="font-semibold text-gray-600">{analysis.topWrongSkipped}</span>
                              </div>
                              <div className="pt-2 border-t border-red-300">
                                <div className="flex justify-between font-semibold">
                                  <span className="text-red-800">Success Rate:</span>
                                  <span className="text-red-600">
                                    {analysis.topWrongCorrect + analysis.topWrongWrong > 0
                                      ? Math.round((analysis.topWrongCorrect / (analysis.topWrongCorrect + analysis.topWrongWrong)) * 100)
                                      : 0}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                          )}

                          {/* Performance on Most Skipped Questions */}
                          {analysis.topSkippedQuestions?.length > 0 && (
                          <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
                            <h5 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                              <Clock size={16} />
                              Top Questions Skipped (Class Avoided)
                            </h5>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-green-700">Got Correct:</span>
                                <span className="font-semibold text-green-600">{analysis.topSkippedCorrect}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-red-700">Got Wrong:</span>
                                <span className="font-semibold text-red-600">{analysis.topSkippedWrong}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-700">Also Skipped:</span>
                                <span className="font-semibold text-gray-600">{analysis.topSkippedActuallySkipped}</span>
                              </div>
                              <div className="pt-2 border-t border-gray-300">
                                <div className="flex justify-between font-semibold">
                                  <span className="text-gray-800">Attempt Rate:</span>
                                  <span className="text-gray-600">
                                    {(analysis.topSkippedCorrect + analysis.topSkippedWrong + analysis.topSkippedActuallySkipped) > 0
                                      ? Math.round(((analysis.topSkippedCorrect + analysis.topSkippedWrong) / (analysis.topSkippedCorrect + analysis.topSkippedWrong + analysis.topSkippedActuallySkipped)) * 100)
                                      : 0}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                          )}
                        </div>

                        {/* Performance Summary */}
                        <div className="bg-vh-beige/10 border border-vh-beige/30 p-4 rounded-lg">
                          <h6 className="font-semibold text-vh-red mb-2">Section {sectionNum} Summary</h6>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div className="text-center">
                              <div className="text-2xl font-bold text-green-600">
                                {analysis.topRightCorrect + analysis.topWrongCorrect + analysis.topSkippedCorrect}
                              </div>
                              <div className="text-xs text-gray-600">Total Correct on Top Questions</div>
                            </div>
                            <div className="text-center">
                              <div className="text-2xl font-bold text-red-600">
                                {analysis.topRightWrong + analysis.topWrongWrong + analysis.topSkippedWrong}
                              </div>
                              <div className="text-xs text-gray-600">Total Wrong on Top Questions</div>
                            </div>
                            <div className="text-center">
                              <div className="text-2xl font-bold text-gray-600">
                                {analysis.topRightSkipped + analysis.topWrongSkipped + analysis.topSkippedActuallySkipped}
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