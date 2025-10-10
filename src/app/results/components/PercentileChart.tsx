'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface PercentileData {
  range: string;
  count: number;
  isUserRange: boolean;
  color: string;
}

interface PercentileChartProps {
  userScore: number;
  allScores: number[];
  title?: string;
  height?: number;
}

const PercentileChart: React.FC<PercentileChartProps> = ({
  userScore,
  allScores,
  title = "Class Distribution",
  height = 300
}) => {
  if (!allScores || allScores.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <p className="text-gray-500">No distribution data available</p>
      </div>
    );
  }

  // Calculate percentiles and create distribution data
  const createPercentileData = (): PercentileData[] => {
    const sortedScores = [...allScores].sort((a, b) => a - b);
    const minScore = Math.min(...sortedScores);
    const maxScore = Math.max(...sortedScores);

    // Create 10 ranges (0-10%, 10-20%, etc.)
    const ranges = [];
    const rangeSize = Math.ceil((maxScore - minScore) / 10);

    for (let i = 0; i < 10; i++) {
      const rangeStart = minScore + (i * rangeSize);
      const rangeEnd = i === 9 ? maxScore : rangeStart + rangeSize - 1;

      const scoresInRange = sortedScores.filter(score =>
        score >= rangeStart && score <= rangeEnd
      ).length;

      const isUserRange = userScore >= rangeStart && userScore <= rangeEnd;

      ranges.push({
        range: i === 9 ? `${rangeStart}+` : `${rangeStart}-${rangeEnd}`,
        count: scoresInRange,
        isUserRange,
        color: isUserRange ? '#760F13' : '#D4B094'
      });
    }

    return ranges;
  };

  // Calculate user's percentile
  const calculatePercentile = (): number => {
    const sortedScores = [...allScores].sort((a, b) => a - b);
    const userRank = sortedScores.filter(score => score < userScore).length;
    return Math.round((userRank / allScores.length) * 100);
  };

  const data = createPercentileData();
  const userPercentile = calculatePercentile();

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-md z-50">
          <p className="font-semibold text-gray-800">Score Range: {label}</p>
          <p className="text-sm text-gray-600">Students: {data.count}</p>
          {data.isUserRange && (
            <p className="text-sm text-vh-red font-semibold">← Your score is here</p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full">
      {title && <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>}

      {/* Percentile Information */}
      <div className="mb-4 p-3 bg-vh-beige/10 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm text-gray-600">Your Percentile: </span>
            <span className="font-bold text-vh-red text-lg">{userPercentile}th</span>
          </div>
          <div className="text-xs text-gray-500">
            You scored better than {userPercentile}% of students
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 70 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="range"
            stroke="#6b7280"
            fontSize={12}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis stroke="#6b7280" fontSize={12} />
          <Tooltip content={<CustomTooltip />} wrapperStyle={{ zIndex: 1000 }} />

          <Bar
            dataKey="count"
            fill="#D4B094"
            stroke="#760F13"
            strokeWidth={1}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.isUserRange ? '#760F13' : '#D4B094'}
                stroke={entry.isUserRange ? '#5A0B0F' : '#A86E58'}
                strokeWidth={entry.isUserRange ? 2 : 1}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Position Summary */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="text-center p-3 bg-green-50 rounded-lg border border-green-100">
          <div className="font-semibold text-green-800 text-sm mb-1">Better Than</div>
          <div className="text-2xl font-bold text-green-600">{userPercentile}%</div>
        </div>
        <div className="text-center p-3 bg-vh-beige/30 rounded-lg border border-vh-red/20">
          <div className="font-semibold text-vh-red text-sm mb-1">Your Score</div>
          <div className="text-2xl font-bold text-vh-red">{userScore}</div>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="font-semibold text-gray-700 text-sm mb-1">Class Size</div>
          <div className="text-2xl font-bold text-gray-600">{allScores.length}</div>
        </div>
      </div>
    </div>
  );
};

export default PercentileChart;