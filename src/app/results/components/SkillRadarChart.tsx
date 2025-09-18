'use client';

import React from 'react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Legend,
  Tooltip
} from 'recharts';

interface SkillData {
  skill: string;
  score: number;
  maxScore: number;
  classAverage?: number;
}

interface SkillRadarChartProps {
  data: SkillData[];
  title?: string;
  height?: number;
  showClassAverage?: boolean;
}

const SkillRadarChart: React.FC<SkillRadarChartProps> = ({
  data,
  title = "Skill Analysis",
  height = 400,
  showClassAverage = false
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <p className="text-gray-500">No skill data available</p>
      </div>
    );
  }

  // Normalize data to percentage for better comparison
  const normalizedData = data.map(item => ({
    skill: item.skill,
    userScore: Math.round((item.score / item.maxScore) * 100),
    classAverage: item.classAverage ? Math.round((item.classAverage / item.maxScore) * 100) : 0
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-md">
          <p className="font-semibold text-gray-800">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.dataKey === 'userScore' && `Your Score: ${entry.value}%`}
              {entry.dataKey === 'classAverage' && `Class Average: ${entry.value}%`}
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
        <RadarChart data={normalizedData} margin={{ top: 20, right: 80, bottom: 20, left: 80 }}>
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis
            dataKey="skill"
            tick={{ fontSize: 12, fill: '#6b7280' }}
          />
          <PolarRadiusAxis
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: '#6b7280' }}
            tickCount={5}
          />
          <Tooltip content={<CustomTooltip />} />

          <Radar
            name="Your Performance"
            dataKey="userScore"
            stroke="#760F13"
            fill="#760F13"
            fillOpacity={0.3}
            strokeWidth={3}
            dot={{ fill: '#760F13', strokeWidth: 2, r: 4 }}
          />

          {showClassAverage && (
            <Radar
              name="Class Average"
              dataKey="classAverage"
              stroke="#D4B094"
              fill="#D4B094"
              fillOpacity={0.1}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ fill: '#D4B094', strokeWidth: 1, r: 3 }}
            />
          )}

          <Legend
            verticalAlign="bottom"
            height={36}
            iconType="line"
            wrapperStyle={{ fontSize: '12px' }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SkillRadarChart;