'use client';

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface SeriesDataPoint {
  testName: string;
  score: number;
  rank: number;
  accuracy: number;
}

interface SeriesProgressChartProps {
  simpleTests: any;
  fullTests?: any; // Add full tests to combine with simple tests for series detection
  students: any;
  userEmail: string;
  highlightTest?: string;
  targetSeries?: string; // Only show progression for this specific test series
  isClassView?: boolean;
  title?: string;
  height?: number;
}

const SeriesProgressChart: React.FC<SeriesProgressChartProps> = ({
  simpleTests,
  fullTests,
  students,
  userEmail,
  highlightTest,
  targetSeries,
  isClassView = false,
  title = "Series Progression",
  height = 300
}) => {
  // Helper function to extract score from result (handles both simple and full tests)
  const getScore = (result: any): number => {
    // Full test: use totalMarks
    if (result.totalMarks !== undefined) {
      return result.totalMarks;
    }
    // Simple test: use score
    return result.score || 0;
  };

  // Helper function to calculate accuracy from result (handles both simple and full tests)
  const getAccuracy = (result: any): number => {
    // If analytics.accuracy exists, use it
    if (result.analytics?.accuracy !== undefined) {
      return result.analytics.accuracy;
    }

    // Full test: calculate from sections
    if (result.sections && typeof result.sections === 'object') {
      const sections = Object.values(result.sections) as any[];
      const totalCorrect = sections.reduce((sum, section) => sum + (section.correct || 0), 0);
      const totalWrong = sections.reduce((sum, section) => sum + (section.wrong || 0), 0);
      const totalAttempted = totalCorrect + totalWrong;

      return totalAttempted > 0 ? (totalCorrect / totalAttempted) * 100 : 0;
    }

    // Simple test: calculate from correct/wrong
    if (result.correct !== undefined && result.wrong !== undefined) {
      const totalAttempted = result.correct + result.wrong;
      return totalAttempted > 0 ? (result.correct / totalAttempted) * 100 : 0;
    }

    return 0;
  };

  // Process data to create series-based progression (group by test name base)
  const processProgressionData = (): SeriesDataPoint[] => {
    if (!simpleTests?.tests || !students?.students) {
      return [];
    }

    if (isClassView) {
      // For class view, calculate average progression by series
      // Combine both simple and full tests for comprehensive series detection
      const allTests = {
        ...(simpleTests?.tests || {}),
        ...(fullTests?.tests || {})
      };
      const testEntries = Object.entries(allTests);

      // Group tests by base name (remove numbers)
      const seriesGroups: { [key: string]: any[] } = {};

      testEntries.forEach(([testName, test]: [string, any]) => {
        // Only process tests that have results data
        if (!test || !test.results) {
          return;
        }

        const baseName = testName.replace(/\s*\d+$/, '').trim(); // Remove trailing numbers
        if (!seriesGroups[baseName]) seriesGroups[baseName] = [];
        seriesGroups[baseName].push({ testName, test });
      });

      // Filter to target series if specified
      const filteredGroups = targetSeries ?
        { [targetSeries]: seriesGroups[targetSeries] || [] } :
        seriesGroups;

      // Only return series with multiple tests
      const seriesData: SeriesDataPoint[] = [];
      Object.entries(filteredGroups).forEach(([baseName, tests]) => {
        if (tests && tests.length > 1) {
          tests.forEach(({ testName, test }) => {
            const results = Object.values(test.results || {}) as any[];
            const totalScore = results.reduce((sum: number, result: any) => sum + getScore(result), 0);
            const totalAccuracy = results.reduce((sum: number, result: any) => sum + getAccuracy(result), 0);

            seriesData.push({
              testName,
              score: Math.round((totalScore / results.length) * 100) / 100,
              rank: 0,
              accuracy: Math.round((totalAccuracy / results.length) * 100) / 100
            });
          });
        }
      });

      return seriesData.sort((a, b) => a.testName.localeCompare(b.testName));
    } else {
      // For individual user view - only show series with multiple tests
      if (!userEmail) return [];

      const user = Object.values(students.students).find((s: any) => s.email === userEmail) as any;
      if (!user) return [];

      const userId = user.id;
      // Combine simple and full tests for comprehensive series detection
      const allTests = {
        ...(simpleTests?.tests || {}),
        ...(fullTests?.tests || {})
      };

      const userTests = Object.entries(allTests)
        .filter(([testName, test]: [string, any]) => {
          if (!test || !test.results) {
            return false;
          }

          return !!(test.results && test.results[userId]);
        });

      // Group by base name
      const seriesGroups: { [key: string]: any[] } = {};
      userTests.forEach(([testName, test]) => {
        const baseName = testName.replace(/\s*\d+$/, '').trim();
        if (!seriesGroups[baseName]) seriesGroups[baseName] = [];
        seriesGroups[baseName].push({ testName, test });
      });

      // Filter to target series if specified
      const filteredGroups = targetSeries ?
        { [targetSeries]: seriesGroups[targetSeries] || [] } :
        seriesGroups;

      // Only return series with multiple tests
      const seriesData: SeriesDataPoint[] = [];
      Object.entries(filteredGroups).forEach(([baseName, tests]) => {
        if (tests && tests.length > 1) {
          tests.forEach(({ testName, test }) => {
            const result = test.results?.[userId] || {};
            seriesData.push({
              testName,
              score: getScore(result),
              rank: result.rank || 0,
              accuracy: getAccuracy(result)
            });
          });
        }
      });

      return seriesData.sort((a, b) => a.testName.localeCompare(b.testName));
    }
  };

  const data = processProgressionData();

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <p className="text-gray-500">No progression data available</p>
      </div>
    );
  }

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-md">
          <p className="font-semibold text-gray-800">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.dataKey === 'score' && `Score: ${entry.value}`}
              {entry.dataKey === 'rank' && `Rank: #${entry.value}`}
              {entry.dataKey === 'accuracy' && `Accuracy: ${entry.value}%`}
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
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="testName"
            stroke="#6b7280"
            fontSize={12}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis yAxisId="left" stroke="#6b7280" fontSize={12} />
          {!isClassView && (
            <YAxis
              yAxisId="rank"
              orientation="right"
              stroke="#9A1B20"
              fontSize={12}
              reversed={true}
            />
          )}
          <Tooltip content={<CustomTooltip />} />
          <Legend />

          <Line
            type="monotone"
            dataKey="score"
            stroke="#760F13"
            strokeWidth={3}
            yAxisId="left"
            dot={(props: any) => {
              const isHighlighted = highlightTest && props.payload.testName === highlightTest;
              return (
                <circle
                  cx={props.cx}
                  cy={props.cy}
                  r={isHighlighted ? 8 : 5}
                  fill={isHighlighted ? "#9A1B20" : "#760F13"}
                  stroke={isHighlighted ? "#5A0B0F" : "#760F13"}
                  strokeWidth={isHighlighted ? 3 : 2}
                />
              );
            }}
            activeDot={{ r: 7, stroke: '#760F13', strokeWidth: 2 }}
            name="Score"
          />

          <Line
            type="monotone"
            dataKey="accuracy"
            stroke="#D4B094"
            strokeWidth={2}
            yAxisId="left"
            dot={(props: any) => {
              const isHighlighted = highlightTest && props.payload.testName === highlightTest;
              return (
                <circle
                  cx={props.cx}
                  cy={props.cy}
                  r={isHighlighted ? 6 : 4}
                  fill={isHighlighted ? "#A86E58" : "#D4B094"}
                  stroke={isHighlighted ? "#8B4513" : "#D4B094"}
                  strokeWidth={isHighlighted ? 2 : 1}
                />
              );
            }}
            name="Accuracy (%)"
          />

          {/* Add rank line for individual view */}
          {!isClassView && (
            <Line
              type="monotone"
              dataKey="rank"
              stroke="#9A1B20"
              strokeWidth={2}
              dot={{ fill: '#9A1B20', strokeWidth: 2, r: 3 }}
              name="Rank"
              strokeDasharray="5 5"
              yAxisId="rank"
            />
          )}
        </LineChart>
      </ResponsiveContainer>

      {/* Trend Analysis */}
      {data.length > 1 && !isClassView && (
        <div className="mt-4 p-3 bg-vh-beige/10 rounded-lg">
          <h4 className="font-semibold text-gray-800 text-sm mb-2">Trend Analysis</h4>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-gray-600">Score Trend: </span>
              <span className={`font-semibold ${
                data[data.length - 1].score >= data[0].score ? 'text-green-600' : 'text-red-600'
              }`}>
                {data[data.length - 1].score >= data[0].score ? '↗' : '↘'}
                {Math.abs(data[data.length - 1].score - data[0].score).toFixed(1)} points
              </span>
            </div>
            <div>
              <span className="text-gray-600">Accuracy Trend: </span>
              <span className={`font-semibold ${
                data[data.length - 1].accuracy >= data[0].accuracy ? 'text-green-600' : 'text-red-600'
              }`}>
                {data[data.length - 1].accuracy >= data[0].accuracy ? '↗' : '↘'}
                {Math.abs(data[data.length - 1].accuracy - data[0].accuracy).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SeriesProgressChart;