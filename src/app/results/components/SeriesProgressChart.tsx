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
  students: any;
  userEmail: string;
  highlightTest?: string;
  isClassView?: boolean;
  title?: string;
  height?: number;
}

const SeriesProgressChart: React.FC<SeriesProgressChartProps> = ({
  simpleTests,
  students,
  userEmail,
  highlightTest,
  isClassView = false,
  title = "Series Progression",
  height = 300
}) => {
  // Process data to create time-based progression
  const processProgressionData = (): SeriesDataPoint[] => {
    if (!simpleTests?.tests || !students?.students) return [];

    if (isClassView) {
      // For class view, calculate average progression
      const testNames = Object.keys(simpleTests.tests);
      return testNames.map(testName => {
        const test = simpleTests.tests[testName];
        const results = Object.values(test.results) as any[];

        const totalScore = results.reduce((sum: number, result: any) => sum + (result.score || 0), 0);
        const totalAccuracy = results.reduce((sum: number, result: any) => sum + (result.analytics?.accuracy || 0), 0);

        return {
          testName,
          score: Math.round((totalScore / results.length) * 100) / 100,
          rank: 0, // Not applicable for class average
          accuracy: Math.round((totalAccuracy / results.length) * 100) / 100
        };
      });
    } else {
      // For individual user view
      if (!userEmail) return [];

      const user = Object.values(students.students).find((s: any) => s.email === userEmail) as any;
      if (!user) return [];

      const userId = user.id;
      const userTests = Object.entries(simpleTests.tests)
        .filter(([_, test]: [string, any]) => test.results[userId])
        .sort(([, a], [, b]) => new Date((a as any).metadata.processedAt).getTime() - new Date((b as any).metadata.processedAt).getTime());

      return userTests.map(([testName, test]: [string, any]) => {
        const result = test.results[userId];
        return {
          testName,
          score: result.score || 0,
          rank: result.rank || 0,
          accuracy: result.analytics?.accuracy || 0
        };
      });
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