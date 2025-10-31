'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Award, Target, TrendingUp, CheckCircle, XCircle, Clock, BookOpen, Calculator, Brain } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

// Mock data for rank 3 student (Mahmud Rahman - based on Farhan Hossain)
const mockStudent = {
  id: '166388',
  name: 'মাহমুদ রহমান',
  englishName: 'Mahmud Rahman'
};

const mockTestData = {
  testName: 'IBA Mock Test 4',
  testDate: 'December 20, 2024',
  sections: {
    english: {
      title: 'English',
      icon: BookOpen,
      correct: 13,
      wrong: 7,
      skipped: 10,
      total: 30,
      accuracy: 65.0,
      attemptRate: 66.7
    },
    mathematics: {
      title: 'Mathematics',
      icon: Calculator,
      correct: 14,
      wrong: 4,
      skipped: 7,
      total: 25,
      accuracy: 77.8,
      attemptRate: 72.0
    },
    analytical: {
      title: 'Analytical Ability',
      icon: Brain,
      correct: 8,
      wrong: 1,
      skipped: 6,
      total: 15,
      accuracy: 88.9,
      attemptRate: 60.0
    }
  },
  overall: {
    totalCorrect: 35,
    totalWrong: 12,
    totalSkipped: 23,
    totalQuestions: 70,
    rank: 3,
    totalStudents: 20,
    percentile: 85,
    overallAccuracy: 74.5
  }
};

const MockResultsPage = () => {
  const router = useRouter();

  const calculatePercentage = (correct: number, total: number) => {
    return ((correct / total) * 100).toFixed(1);
  };

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-vh-beige/5 font-['Inter'] antialiased">
        <div className="max-w-6xl mx-auto px-6 py-12">

          {/* Back Button */}
          <button
            onClick={() => router.push('/results')}
            className="flex items-center gap-2 text-gray-600 hover:text-vh-red transition-colors mb-8 group"
          >
            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
            <span className="font-semibold">Back to Results Dashboard</span>
          </button>

          {/* Header */}
          <div className="mb-12">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h1 className="text-4xl font-bold text-gray-900 mb-2">
                    {mockTestData.testName}
                  </h1>
                  <div className="flex items-center gap-4 text-gray-600">
                    <div className="flex items-center gap-2">
                      <Clock size={16} />
                      <span>{mockTestData.testDate}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>•</span>
                      <span>Student: {mockStudent.name}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="px-6 py-3 bg-gradient-to-r from-vh-red to-vh-dark-red rounded-xl text-white">
                    <div className="text-sm opacity-90">Sample Results</div>
                    <div className="text-2xl font-bold">Demo</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {/* Rank Card */}
            <div className="group relative bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-vh-red/20 transition-all duration-500 p-8">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-vh-red rounded-full"></div>
                    <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Your Rank</p>
                  </div>
                  <p className="text-3xl font-bold text-gray-900">
                    {mockTestData.overall.rank}
                    <span className="text-xl text-gray-400">/{mockTestData.overall.totalStudents}</span>
                  </p>
                  <p className="text-sm text-gray-600">Top 15% of class</p>
                </div>
                <div className="p-3 rounded-xl bg-gradient-to-br from-vh-red/10 to-vh-dark-red/10 group-hover:from-vh-red/20 group-hover:to-vh-dark-red/20 transition-all duration-300">
                  <Award className="text-vh-red" size={24} />
                </div>
              </div>
            </div>

            {/* Total Correct Card */}
            <div className="group relative bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-green-500/20 transition-all duration-500 p-8">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Total Correct</p>
                  </div>
                  <p className="text-3xl font-bold text-gray-900">
                    {mockTestData.overall.totalCorrect}
                    <span className="text-xl text-gray-400">/{mockTestData.overall.totalQuestions}</span>
                  </p>
                  <p className="text-sm text-gray-600">50% overall</p>
                </div>
                <div className="p-3 rounded-xl bg-gradient-to-br from-green-500/10 to-green-600/10 group-hover:from-green-500/20 group-hover:to-green-600/20 transition-all duration-300">
                  <CheckCircle className="text-green-600" size={24} />
                </div>
              </div>
            </div>

            {/* Accuracy Card */}
            <div className="group relative bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-blue-500/20 transition-all duration-500 p-8">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Accuracy</p>
                  </div>
                  <p className="text-3xl font-bold text-gray-900">{mockTestData.overall.overallAccuracy}%</p>
                  <p className="text-sm text-gray-600">When attempted</p>
                </div>
                <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-600/10 group-hover:from-blue-500/20 group-hover:to-blue-600/20 transition-all duration-300">
                  <Target className="text-blue-600" size={24} />
                </div>
              </div>
            </div>

            {/* Percentile Card */}
            <div className="group relative bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-purple-500/20 transition-all duration-500 p-8">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Percentile</p>
                  </div>
                  <p className="text-3xl font-bold text-gray-900">{mockTestData.overall.percentile}<sup className="text-xl">th</sup></p>
                  <p className="text-sm text-gray-600">Better than {mockTestData.overall.percentile}%</p>
                </div>
                <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-600/10 group-hover:from-purple-500/20 group-hover:to-purple-600/20 transition-all duration-300">
                  <TrendingUp className="text-purple-600" size={24} />
                </div>
              </div>
            </div>
          </div>

          {/* Section-wise Performance */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-3 h-3 bg-gradient-to-r from-vh-red to-vh-dark-red rounded-full"></div>
              <h2 className="text-2xl font-bold text-gray-900">Section-wise Performance</h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {Object.entries(mockTestData.sections).map(([key, section]) => {
                const Icon = section.icon;
                const colorClass = key === 'english' ? 'red' : key === 'mathematics' ? 'blue' : 'purple';

                return (
                  <div key={key} className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-500 p-8">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">{section.title}</h3>
                        <p className="text-sm text-gray-500 mt-1">{section.total} questions</p>
                      </div>
                      <div className={`p-3 rounded-xl bg-gradient-to-br from-${colorClass}-500/10 to-${colorClass}-600/10`}>
                        <Icon className={`text-${colorClass}-600`} size={28} />
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <CheckCircle size={16} className="text-green-600" />
                          <span className="text-2xl font-bold text-green-600">{section.correct}</span>
                        </div>
                        <p className="text-xs text-gray-500">Correct</p>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <XCircle size={16} className="text-red-600" />
                          <span className="text-2xl font-bold text-red-600">{section.wrong}</span>
                        </div>
                        <p className="text-xs text-gray-500">Wrong</p>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <Clock size={16} className="text-gray-400" />
                          <span className="text-2xl font-bold text-gray-400">{section.skipped}</span>
                        </div>
                        <p className="text-xs text-gray-500">Skipped</p>
                      </div>
                    </div>

                    {/* Progress Bars */}
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-600">Accuracy</span>
                          <span className="font-semibold text-gray-900">{section.accuracy}%</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full transition-all duration-1000"
                            style={{ width: `${section.accuracy}%` }}
                          ></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-600">Attempt Rate</span>
                          <span className="font-semibold text-gray-900">{section.attemptRate}%</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-1000"
                            style={{ width: `${section.attemptRate}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    {/* Score Display */}
                    <div className="mt-6 pt-6 border-t border-gray-100">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Section Score</span>
                        <span className="text-2xl font-bold text-gray-900">
                          {calculatePercentage(section.correct, section.total)}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Performance Insights */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-3 h-3 bg-gradient-to-r from-vh-red to-vh-dark-red rounded-full"></div>
              <h2 className="text-2xl font-bold text-gray-900">Performance Insights</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Strengths */}
              <div className="p-6 bg-green-50 rounded-xl border border-green-100">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="text-green-600" size={24} />
                  <h3 className="text-lg font-bold text-green-800">Strengths</h3>
                </div>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-green-600 rounded-full mt-2"></div>
                    <span className="text-green-900">Excellent performance in Analytical Ability (88.9% accuracy)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-green-600 rounded-full mt-2"></div>
                    <span className="text-green-900">Strong Mathematics skills with 77.8% accuracy</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-green-600 rounded-full mt-2"></div>
                    <span className="text-green-900">Achieved rank 3 out of 20 students (Top 15%)</span>
                  </li>
                </ul>
              </div>

              {/* Areas for Improvement */}
              <div className="p-6 bg-blue-50 rounded-xl border border-blue-100">
                <div className="flex items-center gap-2 mb-4">
                  <Target className="text-blue-600" size={24} />
                  <h3 className="text-lg font-bold text-blue-800">Areas for Improvement</h3>
                </div>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2"></div>
                    <span className="text-blue-900">Improve attempt rate in Analytical section (only 60% attempted)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2"></div>
                    <span className="text-blue-900">Focus on English comprehension (10 questions skipped)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2"></div>
                    <span className="text-blue-900">Work on time management to attempt more questions</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Sample Data Notice */}
          <div className="bg-gradient-to-r from-vh-red/10 to-vh-dark-red/10 border border-vh-red/20 rounded-2xl p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-vh-red to-vh-dark-red mb-4">
              <Award className="text-white" size={28} />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">Sample Results Page</h3>
            <p className="text-gray-600 max-w-2xl mx-auto leading-relaxed">
              This is a demonstration of how your test results will be displayed. The data shown here is for sample purposes only and represents a rank 3 student's performance on IBA Mock Test 4.
            </p>
          </div>

        </div>
      </div>
      <Footer />
    </>
  );
};

export default MockResultsPage;
