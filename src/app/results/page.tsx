'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { BarChart3, TrendingUp, Award, Clock, BookOpen, Target } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { SimpleTestsData, FullTestsData, StudentsData, SystemMetadata } from '@/types/results';
import SeriesProgressChart from './components/SeriesProgressChart';
import PerformanceBarChart from './components/PerformanceBarChart';
import SkillRadarChart from './components/SkillRadarChart';

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
  const [students, setStudents] = useState<StudentsData | null>(null);
  const [metadata, setMetadata] = useState<SystemMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch all data files
        const [simpleResponse, fullResponse, studentsResponse, metadataResponse] = await Promise.all([
          fetch('/data/simple-tests.json').then(res => res.json()),
          fetch('/data/full-tests.json').then(res => res.json()),
          fetch('/data/students.json').then(res => res.json()),
          fetch('/data/metadata.json').then(res => res.json())
        ]);

        setSimpleTests(simpleResponse);
        setFullTests(fullResponse);
        setStudents(studentsResponse);
        setMetadata(metadataResponse);

        // Calculate user stats if authenticated
        if (session?.user?.email) {
          calculateUserStats(simpleResponse, fullResponse, studentsResponse, session.user.email);
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
    const userTests = Object.values(simpleData.tests).filter(test => test.results[userId]);

    if (userTests.length === 0) return;

    // Calculate stats
    const totalTests = userTests.length;
    const scores = userTests.map(test => test.results[userId].score);
    const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    // Get most recent test
    const sortedTests = userTests.sort((a, b) =>
      new Date(a.metadata.processedAt).getTime() - new Date(b.metadata.processedAt).getTime()
    );
    const recentTest = sortedTests[sortedTests.length - 1];
    const recentScore = recentTest.results[userId].score;
    const recentRank = recentTest.results[userId].rank;

    // Calculate improvement (compare last two tests)
    let improvement = 0;
    if (sortedTests.length >= 2) {
      const previousScore = sortedTests[sortedTests.length - 2].results[userId].score;
      improvement = ((recentScore - previousScore) / Math.abs(previousScore)) * 100;
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
        <div className="min-h-screen bg-gradient-to-br from-vh-beige/20 via-white to-vh-light-red/5">
          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-vh-red mx-auto mb-4"></div>
                <p className="text-gray-600">Loading your results...</p>
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
        <div className="min-h-screen bg-gradient-to-br from-vh-beige/20 via-white to-vh-light-red/5">
          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <div className="text-red-500 text-6xl mb-4">⚠️</div>
                <h2 className="text-xl font-semibold text-gray-800 mb-2">Unable to Load Results</h2>
                <p className="text-gray-600 mb-4">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="bg-vh-red text-white px-6 py-2 rounded-lg hover:bg-vh-red/90 transition-colors"
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
      <div className="min-h-screen bg-gradient-to-br from-vh-beige/20 via-white to-vh-light-red/5">
        <div className="max-w-7xl mx-auto px-4 py-8">

          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <BarChart3 className="text-vh-red" size={32} />
              <h1 className="text-3xl font-bold text-gray-800">Test Results Dashboard</h1>
            </div>
            <p className="text-gray-600">
              Track your academic progress and performance across all tests and assessments.
            </p>
          </div>

          {/* Stats Overview */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">

              {/* Total Tests */}
              <div className="bg-gradient-to-br from-white to-vh-beige/5 rounded-xl shadow-lg border border-vh-beige/30 hover:shadow-xl transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Tests</p>
                    <p className="text-2xl font-bold text-gray-800">{stats.totalTests}</p>
                  </div>
                  <BookOpen className="text-vh-red" size={32} />
                </div>
              </div>

              {/* Average Score */}
              <div className="bg-gradient-to-br from-white to-vh-beige/5 rounded-xl shadow-lg border border-vh-beige/30 hover:shadow-xl transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Average Score</p>
                    <p className="text-2xl font-bold text-gray-800">{stats.averageScore}</p>
                  </div>
                  <Target className="text-vh-red" size={32} />
                </div>
              </div>

              {/* Recent Performance */}
              <div className="bg-gradient-to-br from-white to-vh-beige/5 rounded-xl shadow-lg border border-vh-beige/30 hover:shadow-xl transition-all duration-300 md:col-span-2 lg:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Recent Test</p>
                    <p className="text-lg font-semibold text-gray-800">{stats.recentTestName}</p>
                    <p className="text-2xl font-bold text-gray-800">{stats.recentScore} points</p>
                  </div>
                  <Clock className="text-vh-red" size={32} />
                </div>
                {stats.improvement !== 0 && (
                  <div className={`flex items-center gap-2 text-sm ${stats.improvement > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    <TrendingUp size={16} className={stats.improvement < 0 ? 'rotate-180' : ''} />
                    <span>
                      {stats.improvement > 0 ? '+' : ''}{stats.improvement}% from previous test
                    </span>
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="bg-gradient-to-br from-vh-red via-vh-light-red to-vh-dark-red rounded-xl shadow-lg p-6 text-white hover:shadow-xl transition-all duration-300">
                <h3 className="font-semibold mb-4">Quick Actions</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => router.push('/results/admin')}
                    className="w-full text-left py-2 px-3 rounded-lg bg-white/20 hover:bg-white/30 transition-colors text-sm"
                  >
                    View Class Analytics
                  </button>
                  <button
                    onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}
                    className="w-full text-left py-2 px-3 rounded-lg bg-white/20 hover:bg-white/30 transition-colors text-sm"
                  >
                    Browse All Tests
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Performance Analytics Charts */}
          {stats && simpleTests && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Series Progress Chart */}
              <div className="bg-gradient-to-br from-white to-vh-beige/5 rounded-xl shadow-lg border border-vh-beige/30 hover:shadow-xl transition-all duration-300">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Progress Over Time</h3>
                <SeriesProgressChart
                  simpleTests={simpleTests}
                  students={students}
                  userEmail={session?.user?.email || ''}
                />
              </div>

              {/* Performance Bar Chart */}
              <div className="bg-gradient-to-br from-white to-vh-beige/5 rounded-xl shadow-lg border border-vh-beige/30 hover:shadow-xl transition-all duration-300">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Performance Breakdown</h3>
                <PerformanceBarChart
                  simpleTests={simpleTests}
                  students={students}
                  userEmail={session?.user?.email || ''}
                />
              </div>

              {/* Skill Radar Chart */}
              <div className="bg-gradient-to-br from-white to-vh-beige/5 rounded-xl shadow-lg border border-vh-beige/30 hover:shadow-xl transition-all duration-300">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Skill Analysis</h3>
                <SkillRadarChart
                  simpleTests={simpleTests}
                  students={students}
                  userEmail={session?.user?.email || ''}
                />
              </div>
            </div>
          )}

          {/* Test Categories */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* Simple Tests */}
            <div className="bg-gradient-to-br from-white to-vh-beige/5 rounded-xl shadow-lg border border-vh-beige/30 hover:shadow-xl transition-all duration-300">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Simple Tests</h2>
              <p className="text-gray-600 mb-6">Quick assessments and quizzes</p>

              {simpleTests && Object.keys(simpleTests.tests).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(simpleTests.tests).slice(0, 5).map(([testName, test]) => {
                    const userResult = session?.user?.email ?
                      Object.values(students?.students || {}).find(s => s.email === session.user?.email) : null;
                    const userId = userResult?.id;
                    const result = userId ? test.results[userId] : null;

                    return (
                      <div
                        key={testName}
                        onClick={() => navigateToTest(testName)}
                        className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-vh-red/50 hover:bg-vh-beige/5 cursor-pointer transition-all"
                      >
                        <div>
                          <h3 className="font-medium text-gray-800">{testName}</h3>
                          <p className="text-sm text-gray-600">{test.testSeries}</p>
                        </div>
                        <div className="text-right">
                          {result ? (
                            <>
                              <p className="font-semibold text-vh-red">{result.score}</p>
                              <p className="text-xs text-gray-500">Rank #{result.rank}</p>
                            </>
                          ) : (
                            <p className="text-sm text-gray-400">Not taken</p>
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
            <div className="bg-gradient-to-br from-white to-vh-beige/5 rounded-xl shadow-lg border border-vh-beige/30 hover:shadow-xl transition-all duration-300">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Full Tests</h2>
              <p className="text-gray-600 mb-6">Comprehensive examinations with detailed analytics</p>

              {fullTests && Object.keys(fullTests.tests).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(fullTests.tests).slice(0, 5).map(([testName, test]) => {
                    const userResult = session?.user?.email ?
                      Object.values(students?.students || {}).find(s => s.email === session.user?.email) : null;
                    const userId = userResult?.id;
                    const result = userId ? test.results[userId] : null;

                    return (
                      <div
                        key={testName}
                        onClick={() => navigateToTest(testName)}
                        className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-vh-red/50 hover:bg-vh-beige/5 cursor-pointer transition-all"
                      >
                        <div>
                          <h3 className="font-medium text-gray-800">{testName}</h3>
                          <p className="text-sm text-gray-600">
                            {test.sections.length} section{test.sections.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="text-right">
                          {result ? (
                            <>
                              <p className="font-semibold text-vh-red">{result.totalMarks}</p>
                              <p className="text-xs text-gray-500">Rank #{result.rank}</p>
                            </>
                          ) : (
                            <p className="text-sm text-gray-400">Not taken</p>
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
          </div>

          {/* System Info */}
          {metadata && (
            <div className="mt-8 text-center text-sm text-gray-500">
              <p>
                Last updated: {new Date(metadata.lastProcessed).toLocaleDateString()} •
                {metadata.totalStudents} students •
                {metadata.totalSimpleTests + metadata.totalFullTests} total tests
              </p>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default ResultsDashboard;