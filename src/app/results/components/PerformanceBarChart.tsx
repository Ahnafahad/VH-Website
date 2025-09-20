'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface PerformanceData {
  name: string;
  correct: number;
  wrong: number;
  unattempted?: number;
  score: number;
}

interface PerformanceBarChartProps {
  simpleTests?: any;
  fullTests?: any;
  students?: any;
  userEmail?: string;
  testName?: string;
  isClassView?: boolean;
  title?: string;
  height?: number;
  showUnattempted?: boolean;
}

const PerformanceBarChart: React.FC<PerformanceBarChartProps> = ({
  simpleTests,
  fullTests,
  students,
  userEmail,
  testName,
  isClassView = false,
  title = "Performance Breakdown",
  height = 300,
  showUnattempted = true
}) => {
  // Helper function to extract performance data from a result object
  const extractPerformanceData = (result: any): { correct: number; wrong: number; unattempted: number; score: number } => {
    // Check if this is a full test (has sections)
    if (result.sections && typeof result.sections === 'object') {
      // Full test: aggregate from sections
      const sections = Object.values(result.sections) as any[];
      const totalCorrect = sections.reduce((sum, section) => sum + (section.correct || 0), 0);
      const totalWrong = sections.reduce((sum, section) => sum + (section.wrong || 0), 0);
      const score = result.totalMarks || 0;

      // Calculate unattempted based on responses if available
      let unattempted = 0;
      if (result.responses && typeof result.responses === 'object') {
        const totalQuestions = Object.keys(result.responses).length;
        const attempted = totalCorrect + totalWrong;
        unattempted = Math.max(0, totalQuestions - attempted);
      }

      return {
        correct: totalCorrect,
        wrong: totalWrong,
        unattempted,
        score
      };
    } else {
      // Simple test: use direct properties
      return {
        correct: result.correct || 0,
        wrong: result.wrong || 0,
        unattempted: result.unattempted || 0,
        score: result.score || 0
      };
    }
  };

  // Process data from props
  const processPerformanceData = (): PerformanceData[] => {
    if (!students?.students) return [];

    // If testName is provided, only show data for that specific test
    // Combine both simple and full tests to find the correct test
    const allTests = {
      ...(simpleTests?.tests || {}),
      ...(fullTests?.tests || {})
    };

    const testsToProcess = testName ?
      { [testName]: allTests[testName] } :
      allTests;

    if (isClassView || !userEmail) {
      // Return class average data for each test
      return Object.entries(testsToProcess).map(([testNameKey, test]: [string, any]) => {
        const results = Object.values(test.results || {}) as any[];
        if (results.length === 0) return {
          name: testName ? 'Class Average' : testNameKey.slice(0, 20) + (testNameKey.length > 20 ? '...' : ''),
          correct: 0,
          wrong: 0,
          unattempted: 0,
          score: 0
        };

        // Extract performance data from each result and average
        const performanceData = results.map(result => extractPerformanceData(result));
        const totalCorrect = performanceData.reduce((sum, p) => sum + p.correct, 0);
        const totalWrong = performanceData.reduce((sum, p) => sum + p.wrong, 0);
        const totalUnattempted = performanceData.reduce((sum, p) => sum + p.unattempted, 0);
        const totalScore = performanceData.reduce((sum, p) => sum + p.score, 0);

        return {
          name: testName ? 'Class Average' : testNameKey.slice(0, 20) + (testNameKey.length > 20 ? '...' : ''),
          correct: Math.round(totalCorrect / results.length),
          wrong: Math.round(totalWrong / results.length),
          unattempted: Math.round(totalUnattempted / results.length),
          score: Math.round((totalScore / results.length) * 10) / 10
        };
      });
    } else {
      // Return individual user data for specified test(s)
      const user = Object.values(students.students).find((s: any) => s.email === userEmail) as any;
      if (!user) return [];

      const userId = user.id;
      return Object.entries(testsToProcess)
        .filter(([, test]: [string, any]) => test.results && test.results[userId])
        .map(([testNameKey, test]: [string, any]) => {
          const result = test.results?.[userId] || {};
          const performanceData = extractPerformanceData(result);

          return {
            name: testName ? 'Your Performance' : testNameKey.slice(0, 20) + (testNameKey.length > 20 ? '...' : ''),
            correct: performanceData.correct,
            wrong: performanceData.wrong,
            unattempted: performanceData.unattempted,
            score: performanceData.score
          };
        });
    }
  };

  const data = processPerformanceData();

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <p className="text-gray-500">No performance data available</p>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-md">
          <p className="font-semibold text-gray-800">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.dataKey}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full">
      {title && <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>}

      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="name"
            stroke="#6b7280"
            fontSize={12}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis stroke="#6b7280" fontSize={12} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />

          <Bar
            dataKey="correct"
            fill="#10b981"
            name="Correct"
            radius={[2, 2, 0, 0]}
          />

          <Bar
            dataKey="wrong"
            fill="#ef4444"
            name="Wrong"
            radius={[2, 2, 0, 0]}
          />

          {showUnattempted && (
            <Bar
              dataKey="unattempted"
              fill="#6b7280"
              name="Unattempted"
              radius={[2, 2, 0, 0]}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PerformanceBarChart;