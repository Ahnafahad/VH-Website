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
  data: PerformanceData[];
  title?: string;
  height?: number;
  showUnattempted?: boolean;
}

const PerformanceBarChart: React.FC<PerformanceBarChartProps> = ({
  data,
  title = "Performance Breakdown",
  height = 300,
  showUnattempted = true
}) => {
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