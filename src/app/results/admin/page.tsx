'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Shield, Users, BarChart3, TrendingUp, Award, Clock, Eye, Download, ArrowLeft } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { SimpleTestsData, FullTestsData, StudentsData, SystemMetadata } from '@/types/results';
import ClassDistributionChart from '../components/ClassDistributionChart';
import SeriesProgressChart from '../components/SeriesProgressChart';
import PerformanceBarChart from '../components/PerformanceBarChart';

interface ClassStats {
  totalStudents: number;
  testsCompleted: number;
  averagePerformance: number;
  topPerformer: string;
  recentActivity: string;
}

interface StudentSummary {
  id: string;
  name: string;
  email: string;
  testsCompleted: number;
  averageScore: number;
  bestTest: string;
  bestScore: number;
  lastActivity: string;
}

const AdminDashboard = () => {
  const { data: session } = useSession();
  const router = useRouter();
  const [simpleTests, setSimpleTests] = useState<SimpleTestsData | null>(null);
  const [fullTests, setFullTests] = useState<FullTestsData | null>(null);
  const [students, setStudents] = useState<StudentsData | null>(null);
  const [metadata, setMetadata] = useState<SystemMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [classStats, setClassStats] = useState<ClassStats | null>(null);
  const [studentSummaries, setStudentSummaries] = useState<StudentSummary[]>([]);
  const [selectedTest, setSelectedTest] = useState<string>('');

  useEffect(() => {
    // Check if user is admin
    const checkAdminStatus = async () => {
      try {
        const response = await fetch('/api/auth/check-admin');
        const data = await response.json();
        setIsAdmin(data.isAdmin);

        if (!data.isAdmin) {
          router.push('/results');
          return;
        }
      } catch (err) {
        console.error('Error checking admin status:', err);
        router.push('/results');
        return;
      }
    };

    if (session?.user?.email) {
      checkAdminStatus();
    }
  }, [session, router]);

  useEffect(() => {
    if (!isAdmin) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

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

        // Calculate class statistics
        calculateClassStats(simpleResponse, fullResponse, studentsResponse);
        generateStudentSummaries(simpleResponse, fullResponse, studentsResponse);

      } catch (err) {
        console.error('Error fetching admin data:', err);
        setError('Failed to load admin data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isAdmin]);

  const calculateClassStats = (
    simpleData: SimpleTestsData,
    fullData: FullTestsData,
    studentsData: StudentsData
  ) => {
    const totalStudents = Object.keys(studentsData.students).length;
    const allTests = { ...simpleData.tests, ...fullData.tests };
    const testsCompleted = Object.keys(allTests).length;

    // Calculate average performance across all tests
    let totalScores = 0;
    let scoreCount = 0;
    let topScore = 0;
    let topPerformer = '';
    let latestTestDate = '';
    let latestTestName = '';

    Object.entries(allTests).forEach(([testName, test]) => {
      Object.entries(test.results).forEach(([studentId, result]) => {
        const score = 'score' in result ? result.score : (result as any).totalMarks;
        totalScores += score;
        scoreCount++;

        if (score > topScore) {
          topScore = score;
          const student = studentsData.students[studentId];
          topPerformer = student ? student.name : 'Unknown';
        }
      });

      if (test.metadata.processedAt > latestTestDate) {
        latestTestDate = test.metadata.processedAt;
        latestTestName = testName;
      }
    });

    setClassStats({
      totalStudents,
      testsCompleted,
      averagePerformance: scoreCount > 0 ? Math.round((totalScores / scoreCount) * 100) / 100 : 0,
      topPerformer,
      recentActivity: latestTestName
    });
  };

  const generateStudentSummaries = (
    simpleData: SimpleTestsData,
    fullData: FullTestsData,
    studentsData: StudentsData
  ) => {
    const summaries: StudentSummary[] = [];
    const allTests = { ...simpleData.tests, ...fullData.tests };

    Object.entries(studentsData.students).forEach(([studentId, student]) => {
      const studentTests = Object.entries(allTests).filter(([, test]) => test.results[studentId]);

      if (studentTests.length === 0) {
        summaries.push({
          id: studentId,
          name: student.name,
          email: student.email,
          testsCompleted: 0,
          averageScore: 0,
          bestTest: 'None',
          bestScore: 0,
          lastActivity: 'Never'
        });
        return;
      }

      const scores = studentTests.map(([, test]) => {
        const result = test.results[studentId];
        return 'score' in result ? result.score : (result as any).totalMarks;
      });

      const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      const bestScore = Math.max(...scores);
      const bestTestIndex = scores.indexOf(bestScore);
      const bestTest = studentTests[bestTestIndex][0];

      // Find last activity
      const latestTest = studentTests.sort((a, b) =>
        new Date(b[1].metadata.processedAt).getTime() - new Date(a[1].metadata.processedAt).getTime()
      )[0];

      summaries.push({
        id: studentId,
        name: student.name,
        email: student.email,
        testsCompleted: studentTests.length,
        averageScore: Math.round(averageScore * 100) / 100,
        bestTest,
        bestScore: Math.round(bestScore * 100) / 100,
        lastActivity: new Date(latestTest[1].metadata.processedAt).toLocaleDateString()
      });
    });

    // Sort by average score descending
    summaries.sort((a, b) => b.averageScore - a.averageScore);
    setStudentSummaries(summaries);
  };

  const exportData = async () => {
    try {
      const dataToExport = {
        classStats,
        studentSummaries,
        metadata,
        timestamp: new Date().toISOString()
      };

      const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vh-results-admin-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting data:', err);
    }
  };

  const getTestAnalytics = () => {
    if (!simpleTests || !fullTests || !selectedTest) return null;

    const test = simpleTests.tests[selectedTest] || fullTests.tests[selectedTest];
    if (!test) return null;

    const results = Object.values(test.results);
    const scores = results.map(r => 'score' in r ? r.score : (r as any).totalMarks);

    return {
      participants: results.length,
      averageScore: scores.reduce((a, b) => a + b, 0) / scores.length,
      highestScore: Math.max(...scores),
      lowestScore: Math.min(...scores),
      passRate: test.classStats.passRate
    };
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-vh-beige/10 to-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Please log in to access admin dashboard.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gradient-to-br from-vh-beige/20 via-white to-vh-light-red/5">
          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-vh-red mx-auto mb-4"></div>
                <p className="text-gray-600">Loading admin dashboard...</p>
              </div>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (error || !isAdmin) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gradient-to-br from-vh-beige/20 via-white to-vh-light-red/5">
          <div className="max-w-7xl mx-auto px-4 py-8">
            <button
              onClick={() => router.push('/results')}
              className="flex items-center gap-2 text-vh-red hover:text-vh-red/80 mb-6"
            >
              <ArrowLeft size={20} />
              Back to Results
            </button>
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <Shield size={48} className="text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-800 mb-2">Access Denied</h2>
                <p className="text-gray-600">You don't have admin privileges to view this page.</p>
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
              onClick={() => router.push('/results')}
              className="flex items-center gap-2 text-vh-red hover:text-vh-red/80 mb-4"
            >
              <ArrowLeft size={20} />
              Back to Results
            </button>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="text-vh-red" size={32} />
                <div>
                  <h1 className="text-3xl font-bold text-gray-800">Admin Dashboard</h1>
                  <p className="text-gray-600">Complete overview of class performance and analytics</p>
                </div>
              </div>

              <button
                onClick={exportData}
                className="flex items-center gap-2 bg-vh-red text-white px-4 py-2 rounded-lg hover:bg-vh-red/90 transition-colors"
              >
                <Download size={16} />
                Export Data
              </button>
            </div>
          </div>

          {/* Class Overview Stats */}
          {classStats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">

              <div className="bg-gradient-to-br from-white to-vh-beige/5 rounded-xl shadow-lg border border-vh-beige/30 hover:shadow-xl transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Students</p>
                    <p className="text-2xl font-bold text-gray-800">{classStats.totalStudents}</p>
                  </div>
                  <Users className="text-vh-red" size={32} />
                </div>
              </div>

              <div className="bg-gradient-to-br from-white to-vh-beige/5 rounded-xl shadow-lg border border-vh-beige/30 hover:shadow-xl transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Tests Available</p>
                    <p className="text-2xl font-bold text-gray-800">{classStats.testsCompleted}</p>
                  </div>
                  <BarChart3 className="text-vh-red" size={32} />
                </div>
              </div>

              <div className="bg-gradient-to-br from-white to-vh-beige/5 rounded-xl shadow-lg border border-vh-beige/30 hover:shadow-xl transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Class Average</p>
                    <p className="text-2xl font-bold text-gray-800">{classStats.averagePerformance}</p>
                  </div>
                  <TrendingUp className="text-vh-red" size={32} />
                </div>
              </div>

              <div className="bg-gradient-to-br from-white to-vh-beige/5 rounded-xl shadow-lg border border-vh-beige/30 hover:shadow-xl transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Top Performer</p>
                    <p className="text-lg font-bold text-gray-800 truncate">{classStats.topPerformer}</p>
                  </div>
                  <Award className="text-vh-red" size={32} />
                </div>
              </div>

              <div className="bg-gradient-to-br from-white to-vh-beige/5 rounded-xl shadow-lg border border-vh-beige/30 hover:shadow-xl transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Latest Test</p>
                    <p className="text-sm font-bold text-gray-800 truncate">{classStats.recentActivity}</p>
                  </div>
                  <Clock className="text-vh-red" size={32} />
                </div>
              </div>
            </div>
          )}

          {/* Class Analytics Charts */}
          {simpleTests && fullTests && classStats && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Class Distribution Chart */}
              <div className="bg-gradient-to-br from-white to-vh-beige/5 rounded-xl shadow-lg border border-vh-beige/30 hover:shadow-xl transition-all duration-300">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Class Performance Distribution</h3>
                <ClassDistributionChart
                  simpleTests={simpleTests}
                  fullTests={fullTests}
                  students={students}
                />
              </div>

              {/* Class Progress Chart */}
              <div className="bg-gradient-to-br from-white to-vh-beige/5 rounded-xl shadow-lg border border-vh-beige/30 hover:shadow-xl transition-all duration-300">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Average Class Progress</h3>
                <SeriesProgressChart
                  simpleTests={simpleTests}
                  students={students}
                  userEmail=""
                  isClassView={true}
                />
              </div>

              {/* Class Performance Breakdown */}
              <div className="bg-gradient-to-br from-white to-vh-beige/5 rounded-xl shadow-lg border border-vh-beige/30 hover:shadow-xl transition-all duration-300">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Overall Performance Analysis</h3>
                <PerformanceBarChart
                  simpleTests={simpleTests}
                  students={students}
                  userEmail=""
                  isClassView={true}
                />
              </div>
            </div>
          )}

          {/* Test Analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">

            {/* Test Selector */}
            <div className="bg-gradient-to-br from-white to-vh-beige/5 rounded-xl shadow-lg border border-vh-beige/30 hover:shadow-xl transition-all duration-300">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Test Analytics</h3>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Test</label>
                <select
                  value={selectedTest}
                  onChange={(e) => setSelectedTest(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-vh-red focus:border-vh-red"
                >
                  <option value="">Choose a test...</option>
                  {simpleTests && Object.keys(simpleTests.tests).map(testName => (
                    <option key={testName} value={testName}>{testName} (Simple)</option>
                  ))}
                  {fullTests && Object.keys(fullTests.tests).map(testName => (
                    <option key={testName} value={testName}>{testName} (Full)</option>
                  ))}
                </select>
              </div>

              {selectedTest && getTestAnalytics() && (
                <div className="space-y-3">
                  {Object.entries(getTestAnalytics()!).map(([key, value]) => (
                    <div key={key} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm font-medium text-gray-600 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                      <span className="font-semibold text-gray-800">
                        {typeof value === 'number' ? value.toFixed(1) : value}
                        {key === 'passRate' ? '%' : ''}
                      </span>
                    </div>
                  ))}

                  <button
                    onClick={() => router.push(`/results/test/${encodeURIComponent(selectedTest)}`)}
                    className="w-full mt-4 flex items-center justify-center gap-2 bg-vh-red text-white py-2 px-4 rounded-lg hover:bg-vh-red/90 transition-colors"
                  >
                    <Eye size={16} />
                    View Test Details
                  </button>
                </div>
              )}
            </div>

            {/* System Information */}
            <div className="bg-gradient-to-br from-white to-vh-beige/5 rounded-xl shadow-lg border border-vh-beige/30 hover:shadow-xl transition-all duration-300">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">System Information</h3>

              {metadata && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-600">Processing Version</span>
                    <span className="font-semibold text-gray-800">{metadata.version}</span>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-600">Last Updated</span>
                    <span className="font-semibold text-gray-800">
                      {new Date(metadata.lastProcessed).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-600">Total Students</span>
                    <span className="font-semibold text-gray-800">{metadata.totalStudents}</span>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-600">Simple Tests</span>
                    <span className="font-semibold text-gray-800">{metadata.totalSimpleTests}</span>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-600">Full Tests</span>
                    <span className="font-semibold text-gray-800">{metadata.totalFullTests}</span>
                  </div>

                  {metadata.processingStats.warnings.length > 0 && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm font-medium text-yellow-800 mb-2">Processing Warnings:</p>
                      <ul className="text-xs text-yellow-700 space-y-1">
                        {metadata.processingStats.warnings.map((warning, index) => (
                          <li key={index}>• {warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Comprehensive Class Analytics */}
          {simpleTests && fullTests && classStats && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Performance Distribution */}
              <div className="bg-gradient-to-br from-white to-vh-beige/5 rounded-xl shadow-lg border border-vh-beige/30 hover:shadow-xl transition-all duration-300">
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Class Performance Distribution</h3>
                  {(() => {
                    // Calculate performance distribution across all tests
                    const allScores: number[] = [];
                    const allTests = { ...simpleTests.tests, ...fullTests.tests };

                    Object.values(allTests).forEach((test: any) => {
                      Object.values(test.results).forEach((result: any) => {
                        const score = 'score' in result ? result.score : result.totalMarks;
                        allScores.push(score);
                      });
                    });

                    // Create distribution ranges
                    const distribution = [
                      { range: '90-100%', count: 0, color: '#22C55E' },
                      { range: '80-89%', count: 0, color: '#84CC16' },
                      { range: '70-79%', count: 0, color: '#EAB308' },
                      { range: '60-69%', count: 0, color: '#F97316' },
                      { range: 'Below 60%', count: 0, color: '#EF4444' }
                    ];

                    allScores.forEach(score => {
                      if (score >= 90) distribution[0].count++;
                      else if (score >= 80) distribution[1].count++;
                      else if (score >= 70) distribution[2].count++;
                      else if (score >= 60) distribution[3].count++;
                      else distribution[4].count++;
                    });

                    return (
                      <div className="space-y-3">
                        {distribution.map((range, index) => (
                          <div key={index} className="flex items-center gap-4">
                            <div className="w-20 text-sm font-medium text-gray-700">{range.range}</div>
                            <div className="flex-1 bg-gray-200 rounded-full h-4 relative">
                              <div
                                className="h-4 rounded-full transition-all duration-500"
                                style={{
                                  backgroundColor: range.color,
                                  width: `${allScores.length > 0 ? (range.count / allScores.length) * 100 : 0}%`
                                }}
                              />
                            </div>
                            <div className="w-12 text-sm font-semibold text-gray-800">{range.count}</div>
                          </div>
                        ))}
                        <div className="mt-4 text-xs text-gray-500 text-center">
                          Total Submissions: {allScores.length}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Test Difficulty Analysis */}
              <div className="bg-gradient-to-br from-white to-vh-beige/5 rounded-xl shadow-lg border border-vh-beige/30 hover:shadow-xl transition-all duration-300">
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Test Difficulty Analysis</h3>
                  {(() => {
                    const allTests = { ...simpleTests.tests, ...fullTests.tests };
                    const testAnalysis = Object.entries(allTests).map(([testName, test]: [string, any]) => {
                      const results = Object.values(test.results) as any[];
                      const scores = results.map(r => 'score' in r ? r.score : r.totalMarks);
                      const average = scores.reduce((a, b) => a + b, 0) / scores.length;

                      let difficulty = '';
                      let difficultyColor = '';
                      if (average >= 80) {
                        difficulty = 'Easy';
                        difficultyColor = 'text-green-600';
                      } else if (average >= 65) {
                        difficulty = 'Medium';
                        difficultyColor = 'text-yellow-600';
                      } else {
                        difficulty = 'Hard';
                        difficultyColor = 'text-red-600';
                      }

                      return {
                        testName,
                        average: Math.round(average * 10) / 10,
                        difficulty,
                        difficultyColor,
                        submissions: results.length
                      };
                    }).sort((a, b) => a.average - b.average);

                    return (
                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {testAnalysis.map((test, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex-1">
                              <div className="font-medium text-gray-800 text-sm truncate">{test.testName}</div>
                              <div className="text-xs text-gray-500">{test.submissions} students</div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold text-gray-800">{test.average}</div>
                              <div className={`text-xs font-medium ${test.difficultyColor}`}>{test.difficulty}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Top Performers Analysis */}
          {studentSummaries.length > 0 && (
            <div className="mb-8">
              <div className="bg-gradient-to-br from-white to-vh-beige/5 rounded-xl shadow-lg border border-vh-beige/30 hover:shadow-xl transition-all duration-300">
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Top Performers Insights</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Top 3 Students */}
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-3">Top 3 Students</h4>
                      <div className="space-y-2">
                        {studentSummaries.slice(0, 3).map((student, index) => (
                          <div key={student.id} className="flex items-center gap-3 p-2 bg-yellow-50 rounded-lg">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              index === 0 ? 'bg-yellow-500 text-white' :
                              index === 1 ? 'bg-gray-400 text-white' :
                              'bg-orange-400 text-white'
                            }`}>
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <div className="font-medium text-sm">{student.name}</div>
                              <div className="text-xs text-gray-600">{student.averageScore} avg</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Class Statistics */}
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-3">Class Statistics</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Active Students:</span>
                          <span className="font-semibold">{studentSummaries.filter(s => s.testsCompleted > 0).length}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Avg Tests/Student:</span>
                          <span className="font-semibold">
                            {Math.round((studentSummaries.reduce((sum, s) => sum + s.testsCompleted, 0) / studentSummaries.length) * 10) / 10}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Class Average:</span>
                          <span className="font-semibold text-vh-red">{classStats?.averagePerformance || 0}</span>
                        </div>
                      </div>
                    </div>

                    {/* Performance Insights */}
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-3">Performance Insights</h4>
                      <div className="space-y-2">
                        {(() => {
                          const activeStudents = studentSummaries.filter(s => s.testsCompleted > 0);
                          const highPerformers = activeStudents.filter(s => s.averageScore >= 80).length;
                          const needsSupport = activeStudents.filter(s => s.averageScore < 60).length;

                          return (
                            <>
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600">High Performers (≥80):</span>
                                <span className="font-semibold text-green-600">{highPerformers}</span>
                              </div>
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600">Needs Support (&lt;60):</span>
                                <span className="font-semibold text-red-600">{needsSupport}</span>
                              </div>
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600">Success Rate:</span>
                                <span className="font-semibold text-blue-600">
                                  {activeStudents.length > 0 ? Math.round((highPerformers / activeStudents.length) * 100) : 0}%
                                </span>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Student Performance Table */}
          <div className="bg-gradient-to-br from-white to-vh-beige/5 rounded-xl shadow-lg border border-vh-beige/30 overflow-hidden hover:shadow-xl transition-all duration-300">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">Student Performance Overview</h3>
              <p className="text-sm text-gray-600 mt-1">Complete performance summary for all students</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tests Completed</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Average Score</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Best Performance</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Activity</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {studentSummaries.map((student, index) => (
                    <tr key={student.id} className={index < 3 ? 'bg-yellow-50' : 'hover:bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className={`text-sm font-semibold ${index < 3 ? 'text-yellow-600' : 'text-gray-600'}`}>
                            #{index + 1}
                          </span>
                          {index === 0 && <Award size={16} className="text-yellow-500 ml-1" />}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{student.name}</div>
                          <div className="text-sm text-gray-500">{student.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">{student.testsCompleted}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-semibold text-vh-red">{student.averageScore}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{student.bestScore}</div>
                          <div className="text-sm text-gray-500 truncate max-w-32">{student.bestTest}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {student.lastActivity}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default AdminDashboard;