'use client';

import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend
} from 'recharts';

interface DistributionData {
  name: string;
  value: number;
  percentage: number;
  [key: string]: any;
}

interface ClassDistributionChartProps {
  simpleTests?: any;
  fullTests?: any;
  mockTests?: any;
  students?: any;
  title?: string;
  height?: number;
  colors?: string[];
}

const ClassDistributionChart: React.FC<ClassDistributionChartProps> = ({
  simpleTests,
  fullTests,
  mockTests,
  students,
  title = "Class Distribution",
  height = 300,
  colors = ['#760F13', '#D4B094', '#8B5A3C', '#F4E6D9', '#5D4E37']
}) => {
  // Process distribution data
  const processDistributionData = (): DistributionData[] => {
    if (!simpleTests?.tests || !students?.students) return [];

    const gradeRanges = [
      { name: 'A (90-100)', min: 90, max: 100, count: 0 },
      { name: 'B (80-89)', min: 80, max: 89, count: 0 },
      { name: 'C (70-79)', min: 70, max: 79, count: 0 },
      { name: 'D (60-69)', min: 60, max: 69, count: 0 },
      { name: 'F (0-59)', min: 0, max: 59, count: 0 }
    ];

    const allTests = { ...simpleTests.tests, ...(fullTests?.tests || {}), ...(mockTests?.tests || {}) };
    const allScores: number[] = [];

    Object.values(allTests).forEach((test: any) => {
      // Skip if test is undefined or null
      if (!test) return;

      Object.values(test.results || {}).forEach((result: any) => {
        const score = 'score' in result ? result.score : result.totalMarks;
        allScores.push(score);
      });
    });

    allScores.forEach(score => {
      gradeRanges.forEach(range => {
        if (score >= range.min && score <= range.max) {
          range.count++;
        }
      });
    });

    return gradeRanges.map(range => ({
      name: range.name,
      value: range.count,
      percentage: allScores.length > 0 ? Math.round((range.count / allScores.length) * 100) : 0
    }));
  };

  const data = processDistributionData();

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <p className="text-gray-500">No distribution data available</p>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-md">
          <p className="font-semibold text-gray-800">{data.name}</p>
          <p className="text-sm text-gray-600">Count: {data.value}</p>
          <p className="text-sm text-gray-600">Percentage: {data.percentage.toFixed(1)}%</p>
        </div>
      );
    }
    return null;
  };

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percentage }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    if (percentage < 5) return null; // Don't show label for small slices

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        fontSize={12}
        fontWeight="bold"
      >
        {`${percentage.toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="w-full">
      {title && <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>}

      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomLabel}
            outerRadius={Math.min(height * 0.35, 120)}
            fill="#8884d8"
            dataKey="value"
            stroke="#ffffff"
            strokeWidth={2}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={colors[index % colors.length]}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="bottom"
            height={36}
            iconType="circle"
            wrapperStyle={{ fontSize: '12px' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ClassDistributionChart;