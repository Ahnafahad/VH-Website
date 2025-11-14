'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { BarChart3, BookOpen, Users, GraduationCap } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { SimpleTestsData, FullTestsData, MockTestsData, StudentsData, SystemMetadata } from '@/types/results';
import SeriesProgressChart from './components/SeriesProgressChart';
import PerformanceBarChart from './components/PerformanceBarChart';

interface DashboardStats {
  totalTests: number;
  averageScore: number;
  rank: number;
  recentTestName: string;
  recentScore: number;
  improvement: number;
}

const ResultsDashboard = () => {
  const { data: session } = useSession();
  const router = useRouter();
  const [simpleTests, setSimpleTests] = useState<SimpleTestsData | null>(null);
  const [fullTests, setFullTests] = useState<FullTestsData | null>(null);
  const [mockTests, setMockTests] = useState<MockTestsData | null>(null);
  const [fbsMockTests, setFbsMockTests] = useState<any | null>(null);
  const [students, setStudents] = useState<StudentsData | null>(null);
  const [metadata, setMetadata] = useState<SystemMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userAccess, setUserAccess] = useState<{hasIBA: boolean, hasFBS: boolean}>({hasIBA: false, hasFBS: false});
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedStudentName, setSelectedStudentName] = useState<string>('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch all data files
        const [simpleResponse, fullResponse, mockResponse, fbsMockResponse, studentsResponse, metadataResponse, adminCheckResponse, userAccessResponse] = await Promise.all([
          fetch('/data/simple-tests.json').then(res => res.json()),
          fetch('/data/full-tests.json').then(res => res.json()),
          fetch('/data/mock-tests.json').then(res => res.json()),
          fetch('/data/fbs-mock-tests.json').then(res => res.json()).catch(() => ({tests: {}})),
          fetch('/data/students.json').then(res => res.json()),
          fetch('/data/metadata.json').then(res => res.json()),
          fetch('/api/auth/check-admin').then(res => res.json()),
          fetch('/api/user/access').then(res => res.json()).catch(() => ({hasIBA: true, hasFBS: true, isAdmin: false}))
        ]);

        setSimpleTests(simpleResponse);
        setFullTests(fullResponse);
        setMockTests(mockResponse);
        setFbsMockTests(fbsMockResponse);
        setStudents(studentsResponse);
        setMetadata(metadataResponse);
        setIsAdmin(adminCheckResponse.isAdmin || userAccessResponse.isAdmin);
        // Use userAccessResponse which already includes admin check
        setUserAccess({
          hasIBA: userAccessResponse.hasIBA,
          hasFBS: userAccessResponse.hasFBS
        });

        // Calculate user stats if authenticated
        if (session?.user?.email) {
          if (adminCheckResponse.isAdmin) {
            // Admin: don't show their own stats initially
            setStats(null);
            setSelectedStudentId(null);
            setSelectedStudentName('');
          } else {
            // Student: show their own stats
            calculateUserStats(simpleResponse, fullResponse, studentsResponse, session.user.email);
          }
        }

      } catch (err) {
        console.error('Error fetching results data:', err);
        setError('Failed to load results data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [session]);

  const handleStudentSelection = (studentId: string) => {
    if (!simpleTests || !fullTests || !students) return;

    setSelectedStudentId(studentId);

    // Find student name and email
    const student = Object.values(students.students).find((s: any) => s.id === studentId) as any;
    setSelectedStudentName(student?.name || '');

    // Calculate stats for selected student
    if (student?.email) {
      calculateUserStats(simpleTests, fullTests, students, student.email);
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

  const calculateUserStats = (
    simpleData: SimpleTestsData,
    fullData: FullTestsData,
    studentsData: StudentsData,
    userEmail: string
  ) => {
    // Find user by email
    const user = Object.values(studentsData.students).find(student => student.email === userEmail);
    if (!user) return;

    const userId = user.id;
    const userTests = Object.values(simpleData.tests).filter(test => test.results && test.results[userId]);

    if (userTests.length === 0) return;

    // Calculate stats
    const totalTests = userTests.length;
    const scores = userTests.map(test => test.results?.[userId]?.score || 0);
    const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    // Get most recent test
    const sortedTests = userTests.sort((a, b) =>
      new Date(a.metadata.processedAt).getTime() - new Date(b.metadata.processedAt).getTime()
    );
    const recentTest = sortedTests[sortedTests.length - 1];
    const recentScore = recentTest.results?.[userId]?.score || 0;
    const recentRank = recentTest.results?.[userId]?.rank || 0;

    // Calculate improvement (compare last two tests)
    let improvement = 0;
    if (sortedTests.length >= 2) {
      const previousScore = sortedTests[sortedTests.length - 2].results?.[userId]?.score || 0;
      improvement = previousScore ? ((recentScore - previousScore) / Math.abs(previousScore)) * 100 : 0;
    }

    setStats({
      totalTests,
      averageScore: Math.round(averageScore * 100) / 100,
      rank: recentRank,
      recentTestName: recentTest.testName,
      recentScore: Math.round(recentScore * 100) / 100,
      improvement: Math.round(improvement * 100) / 100
    });
  };

  const navigateToTest = (testName: string) => {
    router.push(`/results/test/${encodeURIComponent(testName)}`);
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-vh-beige/5 font-['Inter'] antialiased">
          <div className="max-w-6xl mx-auto px-6 py-12">
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-vh-red/20 border-t-vh-red rounded-full animate-spin mx-auto mb-6"></div>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Loading Dashboard</h2>
                <p className="text-gray-600">Preparing your analytics...</p>
              </div>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (error) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-vh-beige/5 font-['Inter'] antialiased">
          <div className="max-w-6xl mx-auto px-6 py-12">
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <div className="text-red-500 text-2xl">⚠️</div>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">Unable to Load Results</h2>
                <p className="text-gray-600 mb-6">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="bg-gradient-to-r from-vh-red to-vh-dark-red text-white px-6 py-3 rounded-xl hover:shadow-lg transition-all duration-300 font-semibold"
                >
                  Try Again
                </button>
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
          <div className="mb-12">
            <div className="text-center max-w-3xl mx-auto">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-vh-red to-vh-dark-red mb-6 shadow-lg">
                <BarChart3 className="text-white" size={28} />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 tracking-tight">
                Test Results
                <span className="bg-gradient-to-r from-vh-red to-vh-dark-red bg-clip-text text-transparent"> Dashboard</span>
              </h1>
              <p className="text-xl text-gray-600 leading-relaxed">
                {isAdmin ? 'View any student\'s academic progress with detailed analytics' : 'Track your academic progress with beautiful insights and detailed analytics'}
              </p>
            </div>

            {/* Admin Student Selector */}
            {isAdmin && students && (
              <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-xl max-w-2xl mx-auto">
                <div className="flex items-center gap-3 mb-4">
                  <Users size={24} className="text-blue-600" />
                  <h3 className="text-xl font-semibold text-blue-800">Admin: Select Student to View</h3>
                </div>
                <select
                  value={selectedStudentId || ''}
                  onChange={(e) => handleStudentSelection(e.target.value)}
                  className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                >
                  <option value="">Select a student to view their complete performance...</option>
                  {Object.values(students.students)
                    .sort((a: any, b: any) => a.name.localeCompare(b.name))
                    .map((student: any) => (
                      <option key={student.id} value={student.id}>
                        {student.name} (ID: {student.id})
                      </option>
                    ))}
                </select>
                {selectedStudentName && (
                  <div className="mt-3 text-sm text-blue-700">
                    <strong>Viewing:</strong> {selectedStudentName}'s complete test performance across all tests
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Stats Overview */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">

              {/* Total Tests */}
              <div className="group relative bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-vh-red/20 transition-all duration-500 p-8">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-vh-red rounded-full"></div>
                      <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Total Tests</p>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{stats.totalTests}</p>
                    <p className="text-sm text-gray-600">Assessments completed</p>
                  </div>
                  <div className="p-3 rounded-xl bg-gradient-to-br from-vh-red/10 to-vh-dark-red/10 group-hover:from-vh-red/20 group-hover:to-vh-dark-red/20 transition-all duration-300">
                    <BookOpen className="text-vh-red" size={24} />
                  </div>
                </div>
              </div>



              {/* Quick Actions */}
              <div className="relative overflow-hidden bg-gradient-to-br from-vh-red via-vh-red to-vh-dark-red rounded-2xl shadow-lg p-8 text-white">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-6">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                    <h3 className="font-bold text-lg">Quick Actions</h3>
                  </div>
                  <div className="space-y-3">
                    <button
                      onClick={() => router.push('/results/admin')}
                      className="w-full text-left py-4 px-5 rounded-xl bg-white/15 backdrop-blur-sm hover:bg-white/25 transition-all duration-300 border border-white/20 hover:border-white/30"
                    >
                      <div className="font-semibold">Class Analytics</div>
                      <div className="text-sm text-white/80">View comprehensive insights</div>
                    </button>
                    <button
                      onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}
                      className="w-full text-left py-4 px-5 rounded-xl bg-white/15 backdrop-blur-sm hover:bg-white/25 transition-all duration-300 border border-white/20 hover:border-white/30"
                    >
                      <div className="font-semibold">Browse Tests</div>
                      <div className="text-sm text-white/80">Explore all assessments</div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Performance Analytics Charts */}
          {stats && simpleTests && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 mb-12 md:mb-16">
              {/* Series Progress Chart */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-500 p-4 md:p-6 lg:p-8">
                <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
                  <div className="w-3 h-3 bg-gradient-to-r from-vh-red to-vh-dark-red rounded-full"></div>
                  <h3 className="text-lg md:text-xl font-bold text-gray-900">
                    {isAdmin && selectedStudentName ? `${selectedStudentName}'s Progress Over Time` : 'Progress Over Time'}
                  </h3>
                </div>
                <div className="h-64 md:h-80 mb-4">
                  <SeriesProgressChart
                    simpleTests={simpleTests}
                    fullTests={fullTests}
                    mockTests={mockTests}
                    students={students}
                    userEmail={getChartUserEmail() || ''}
                  />
                </div>
              </div>

              {/* Performance Bar Chart */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-500 p-4 md:p-6 lg:p-8">
                <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
                  <div className="w-3 h-3 bg-gradient-to-r from-vh-red to-vh-dark-red rounded-full"></div>
                  <h3 className="text-lg md:text-xl font-bold text-gray-900">
                    {isAdmin && selectedStudentName ? `${selectedStudentName}'s Performance Breakdown` : 'Performance Breakdown'}
                  </h3>
                </div>
                <div className="h-64 md:h-80 mb-4">
                  <PerformanceBarChart
                    simpleTests={simpleTests}
                    fullTests={fullTests}
                    mockTests={mockTests}
                    students={students}
                    userEmail={getChartUserEmail() || ''}
                  />
                </div>
              </div>

            </div>
          )}

          {/* Test Categories */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-8 mb-8">

            {/* Simple Tests */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-500 p-4 md:p-6 lg:p-8">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"></div>
                <h2 className="text-2xl font-bold text-gray-900">Simple Tests</h2>
              </div>
              <p className="text-gray-600 mb-8 text-lg">Quick assessments and quizzes</p>

              {simpleTests && Object.keys(simpleTests.tests).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(simpleTests.tests).map(([testName, test]) => {
                    // Get the correct user based on admin status
                    let userResult = null;
                    if (isAdmin && selectedStudentId) {
                      userResult = Object.values(students?.students || {}).find((s: any) => s.id === selectedStudentId);
                    } else if (session?.user?.email) {
                      userResult = Object.values(students?.students || {}).find((s: any) => s.email === session.user?.email);
                    }
                    const userId = userResult?.id;
                    const result = userId && test.results ? test.results[userId] : null;

                    return (
                      <div
                        key={testName}
                        onClick={() => navigateToTest(testName)}
                        className="group flex items-center justify-between p-6 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 cursor-pointer transition-all duration-300 hover:shadow-md"
                      >
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">{testName}</h3>
                          <p className="text-sm text-gray-500 mt-1">{test.testSeries}</p>
                        </div>
                        <div className="text-right">
                          {result ? (
                            <div className="bg-blue-50 px-3 py-2 rounded-lg border border-blue-100">
                              <p className="font-bold text-blue-700 text-lg">{result.score}</p>
                              <p className="text-xs text-blue-600">Rank #{result.rank}</p>
                            </div>
                          ) : (
                            <div className="bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
                              <p className="text-sm text-gray-500 font-medium">Not taken</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No simple tests available</p>
              )}
            </div>

            {/* Full Tests */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-500 p-4 md:p-6 lg:p-8">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-3 h-3 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full"></div>
                <h2 className="text-2xl font-bold text-gray-900">Full Tests</h2>
              </div>
              <p className="text-gray-600 mb-8 text-lg">Comprehensive examinations with detailed analytics</p>

              {fullTests && Object.keys(fullTests.tests).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(fullTests.tests).map(([testName, test]) => {
                    // Get the correct user based on admin status
                    let userResult = null;
                    if (isAdmin && selectedStudentId) {
                      userResult = Object.values(students?.students || {}).find((s: any) => s.id === selectedStudentId);
                    } else if (session?.user?.email) {
                      userResult = Object.values(students?.students || {}).find((s: any) => s.email === session.user?.email);
                    }
                    const userId = userResult?.id;
                    const result = userId && test.results ? test.results[userId] : null;

                    return (
                      <div
                        key={testName}
                        onClick={() => navigateToTest(testName)}
                        className="group flex items-center justify-between p-6 rounded-xl border border-gray-100 hover:border-purple-200 hover:bg-purple-50/30 cursor-pointer transition-all duration-300 hover:shadow-md"
                      >
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 group-hover:text-purple-700 transition-colors">{testName}</h3>
                          <p className="text-sm text-gray-500 mt-1">
                            {test.sections.length} section{test.sections.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="text-right">
                          {result ? (
                            <div className="bg-purple-50 px-3 py-2 rounded-lg border border-purple-100">
                              <p className="font-bold text-purple-700 text-lg">{result.totalMarks}</p>
                              <p className="text-xs text-purple-600">Rank #{result.rank}</p>
                            </div>
                          ) : (
                            <div className="bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
                              <p className="text-sm text-gray-500 font-medium">Not taken</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No full tests available</p>
              )}
            </div>

            {/* Mock Tests (IBA) */}
            {userAccess.hasIBA && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-500 p-4 md:p-6 lg:p-8">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-3 h-3 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full"></div>
                <h2 className="text-2xl font-bold text-gray-900">IBA Mock Tests</h2>
              </div>
              <p className="text-gray-600 mb-8 text-lg">DU IBA mock examinations</p>

              {mockTests && Object.keys(mockTests.tests).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(mockTests.tests).map(([testName, test]) => {
                    // Get the correct user based on admin status
                    let userResult = null;
                    if (isAdmin && selectedStudentId) {
                      userResult = Object.values(students?.students || {}).find((s: any) => s.id === selectedStudentId);
                    } else if (session?.user?.email) {
                      userResult = Object.values(students?.students || {}).find((s: any) => s.email === session.user?.email);
                    }
                    const userId = userResult?.id;
                    const result = userId && test.results ? test.results[userId] : null;

                    return (
                      <div
                        key={testName}
                        onClick={() => navigateToTest(testName)}
                        className="group flex items-center justify-between p-6 rounded-xl border border-gray-100 hover:border-orange-200 hover:bg-orange-50/30 cursor-pointer transition-all duration-300 hover:shadow-md"
                      >
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 group-hover:text-orange-700 transition-colors">{testName}</h3>
                          <p className="text-sm text-gray-500 mt-1">
                            {test.sections.length} section{test.sections.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="text-right">
                          {result ? (
                            <div className="bg-orange-50 px-3 py-2 rounded-lg border border-orange-100">
                              <p className="font-bold text-orange-700 text-lg">{result.totalMarks}</p>
                              <p className="text-xs text-orange-600">Rank #{result.rank}</p>
                            </div>
                          ) : (
                            <div className="bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
                              <p className="text-sm text-gray-500 font-medium">Not taken</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No mock tests available</p>
              )}
            </div>
            )}

            {/* FBS Mock Tests */}
            {userAccess.hasFBS && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-500 p-4 md:p-6 lg:p-8">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-3 h-3 bg-gradient-to-r from-green-500 to-green-600 rounded-full"></div>
                <h2 className="text-2xl font-bold text-gray-900">DU FBS Mocks</h2>
              </div>
              <p className="text-gray-600 mb-8 text-lg">DU FBS mock examinations</p>

              {fbsMockTests && Object.keys(fbsMockTests.tests).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(fbsMockTests.tests).map(([testName, test]: [string, any]) => {
                    // Get the correct user based on admin status
                    let userResult = null;
                    if (isAdmin && selectedStudentId) {
                      userResult = Object.values(students?.students || {}).find((s: any) => s.id === selectedStudentId);
                    } else if (session?.user?.email) {
                      userResult = Object.values(students?.students || {}).find((s: any) => s.email === session.user?.email);
                    }
                    const userId = userResult?.id;
                    const result = userId && test.results ? test.results[userId] : null;

                    return (
                      <div
                        key={testName}
                        onClick={() => navigateToTest(testName)}
                        className="group flex items-center justify-between p-6 rounded-xl border border-gray-100 hover:border-green-200 hover:bg-green-50/30 cursor-pointer transition-all duration-300 hover:shadow-md"
                      >
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 group-hover:text-green-700 transition-colors">{testName}</h3>
                          <p className="text-sm text-gray-500 mt-1">
                            <GraduationCap className="inline w-4 h-4 mr-1" />
                            DU FBS Format
                          </p>
                        </div>
                        <div className="text-right">
                          {result ? (
                            <div className="bg-green-50 px-3 py-2 rounded-lg border border-green-100">
                              <p className="font-bold text-green-700 text-lg">{result.totalMarks?.toFixed(2)}</p>
                              <p className="text-xs text-green-600">Rank #{result.rank}</p>
                            </div>
                          ) : (
                            <div className="bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
                              <p className="text-sm text-gray-500 font-medium">Not taken</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No FBS mock tests available</p>
              )}
            </div>
            )}
          </div>

          {/* System Info */}
          {metadata && (
            <div className="mt-16 py-8 border-t border-gray-100">
              <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-full">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-gray-600 font-medium">System Active</span>
                </div>
                <p className="text-sm text-gray-500">
                  Last updated: {(() => {
                    try {
                      const date = new Date(metadata.lastProcessed);
                      return !isNaN(date.getTime()) ? date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';
                    } catch {
                      return 'N/A';
                    }
                  })()} •
                  {metadata.totalStudents} students •
                  {metadata.totalSimpleTests + metadata.totalFullTests + (metadata.totalMockTests || 0)} total tests
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default ResultsDashboard;