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
  students,
  userEmail,
  testName,
  isClassView = false,
  title = "Performance Breakdown",
  height = 300,
  showUnattempted = true
}) => {
  // Process data from props
  const processPerformanceData = (): PerformanceData[] => {
    if (!simpleTests?.tests || !students?.students) return [];

    // If testName is provided, only show data for that specific test
    const testsToProcess = testName ?
      { [testName]: simpleTests.tests[testName] } :
      simpleTests.tests;

    if (isClassView || !userEmail) {
      // Return class average data for each test
      return Object.entries(testsToProcess).map(([testNameKey, test]: [string, any]) => {
        const results = Object.values(test.results) as any[];
        const totalCorrect = results.reduce((sum, r) => sum + (r.correct || 0), 0);
        const totalWrong = results.reduce((sum, r) => sum + (r.wrong || 0), 0);
        const totalUnattempted = results.reduce((sum, r) => sum + (r.unattempted || 0), 0);
        const averageScore = results.reduce((sum, r) => sum + (r.score || 0), 0) / results.length;

        return {
          name: testName ? 'Class Average' : testNameKey.slice(0, 20) + (testNameKey.length > 20 ? '...' : ''),
          correct: Math.round(totalCorrect / results.length),
          wrong: Math.round(totalWrong / results.length),
          unattempted: Math.round(totalUnattempted / results.length),
          score: Math.round(averageScore * 10) / 10
        };
      });
    } else {
      // Return individual user data for specified test(s)
      const user = Object.values(students.students).find((s: any) => s.email === userEmail) as any;
      if (!user) return [];

      const userId = user.id;
      return Object.entries(testsToProcess)
        .filter(([_, test]: [string, any]) => test.results && test.results[userId])
        .map(([testNameKey, test]: [string, any]) => {
          const result = test.results[userId];
          return {
            name: testName ? 'Your Performance' : testNameKey.slice(0, 20) + (testNameKey.length > 20 ? '...' : ''),
            correct: result.correct || 0,
            wrong: result.wrong || 0,
            unattempted: result.unattempted || 0,
            score: result.score || 0
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