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
  data: SeriesDataPoint[];
  title?: string;
  height?: number;
}

const SeriesProgressChart: React.FC<SeriesProgressChartProps> = ({
  data,
  title = "Series Progression",
  height = 300
}) => {
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
          <YAxis stroke="#6b7280" fontSize={12} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />

          <Line
            type="monotone"
            dataKey="score"
            stroke="#760F13"
            strokeWidth={3}
            dot={{ fill: '#760F13', strokeWidth: 2, r: 5 }}
            activeDot={{ r: 7, stroke: '#760F13', strokeWidth: 2 }}
            name="Score"
          />

          <Line
            type="monotone"
            dataKey="accuracy"
            stroke="#D4B094"
            strokeWidth={2}
            dot={{ fill: '#D4B094', strokeWidth: 2, r: 4 }}
            name="Accuracy (%)"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SeriesProgressChart;