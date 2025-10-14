'use client';

import React from 'react';

interface SimpleTestResult {
  score: number;
  correct: number;
  wrong: number;
  unattempted: number;
  rank: number;
  timestamp?: any;
}

interface FullTestResult {
  totalMarks: number;
  rank: number;
  timestamp?: any;
  sections?: {
    [sectionName: string]: {
      correct: number;
      wrong: number;
      marks: number;
    };
  };
  analytics?: {
    accuracy: number;
  };
}

interface Top5LeaderboardTableProps {
  testResults: any;
  isFullTest: boolean;
  title?: string;
}

const Top5LeaderboardTable: React.FC<Top5LeaderboardTableProps> = ({
  testResults,
  isFullTest,
  title = "Top 5 Performers"
}) => {
  // Calculate accuracy for both test types
  const calculateAccuracy = (result: any): number => {
    if (result.analytics?.accuracy !== undefined) {
      return result.analytics.accuracy;
    }

    if (isFullTest && result.sections) {
      const sections = Object.values(result.sections) as any[];
      const totalCorrect = sections.reduce((sum, section) => sum + (section.correct || 0), 0);
      const totalWrong = sections.reduce((sum, section) => sum + (section.wrong || 0), 0);
      const totalAttempted = totalCorrect + totalWrong;
      return totalAttempted > 0 ? (totalCorrect / totalAttempted) * 100 : 0;
    }

    const totalAttempted = (result.correct || 0) + (result.wrong || 0);
    return totalAttempted > 0 ? ((result.correct || 0) / totalAttempted) * 100 : 0;
  };

  // Get total questions answered for full tests
  const getTotalAnswered = (result: any): { correct: number; wrong: number; unattempted: number } => {
    if (isFullTest && result.sections) {
      const sections = Object.values(result.sections) as any[];
      const correct = sections.reduce((sum, section) => sum + (section.correct || 0), 0);
      const wrong = sections.reduce((sum, section) => sum + (section.wrong || 0), 0);

      // Calculate unattempted if responses are available
      let unattempted = 0;
      if (result.responses && typeof result.responses === 'object') {
        const totalQuestions = Object.keys(result.responses).length;
        unattempted = Math.max(0, totalQuestions - correct - wrong);
      }

      return { correct, wrong, unattempted };
    }

    return {
      correct: result.correct || 0,
      wrong: result.wrong || 0,
      unattempted: result.unattempted || 0
    };
  };

  // Sort and get top 5
  const top5Results = Object.values(testResults || {})
    .sort((a: any, b: any) => (a.rank || 999) - (b.rank || 999))
    .slice(0, 5);

  if (top5Results.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 bg-gray-50 rounded-lg">
        <p className="text-gray-500">No leaderboard data available</p>
      </div>
    );
  }

  // Medal icons for top 3
  const getMedalIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <span className="text-2xl">🥇</span>;
      case 2:
        return <span className="text-2xl">🥈</span>;
      case 3:
        return <span className="text-2xl">🥉</span>;
      default:
        return null;
    }
  };

  return (
    <div className="w-full">
      {title && <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse bg-white rounded-lg overflow-hidden shadow-sm">
          <thead>
            <tr className="bg-gradient-to-r from-vh-red to-vh-red/90">
              <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                Rank
              </th>
              {isFullTest ? (
                <>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-white uppercase tracking-wider">
                    Total Marks
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-white uppercase tracking-wider">
                    MCQ Marks
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-white uppercase tracking-wider">
                    Essay Marks
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-white uppercase tracking-wider">
                    MCQ %
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-white uppercase tracking-wider">
                    MCQ Accuracy
                  </th>
                </>
              ) : (
                <>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                    Score
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-white uppercase tracking-wider">
                    Correct
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-white uppercase tracking-wider">
                    Wrong
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-white uppercase tracking-wider">
                    Unattempted
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-white uppercase tracking-wider">
                    Accuracy
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {top5Results.map((result: any, index: number) => {
              const rank = result.rank || (index + 1);
              const accuracy = calculateAccuracy(result);
              const { correct, wrong, unattempted } = getTotalAnswered(result);
              const score = isFullTest ? result.totalMarks : result.score;

              return (
                <tr
                  key={index}
                  className={`transition-colors hover:bg-vh-beige/10 ${
                    rank === 1 ? 'bg-yellow-50/50' :
                    rank === 2 ? 'bg-gray-50/50' :
                    rank === 3 ? 'bg-orange-50/50' :
                    'bg-white'
                  }`}
                >
                  {/* Rank */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {getMedalIcon(rank)}
                      <span className={`text-lg font-bold ${
                        rank === 1 ? 'text-yellow-600' :
                        rank === 2 ? 'text-gray-600' :
                        rank === 3 ? 'text-orange-600' :
                        'text-gray-800'
                      }`}>
                        #{rank}
                      </span>
                    </div>
                  </td>

                  {isFullTest ? (
                    <>
                      {/* Total Marks */}
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <div className="text-xl font-bold text-vh-red">
                          {result.totalMarks}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {((result.totalPercentage || 0).toFixed(1))}%
                        </div>
                      </td>

                      {/* MCQ Marks */}
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <div className="text-lg font-bold text-blue-600">
                          {result.mcqMarks || 0}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {((result.mcqPercentage || 0).toFixed(1))}%
                        </div>
                      </td>

                      {/* Essay Marks */}
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <div className="text-lg font-bold text-purple-600">
                          {result.essayMarks || 0}
                        </div>
                        {result.maxEssayMarks && result.maxEssayMarks > 0 && (
                          <div className="text-xs text-gray-500 mt-1">
                            of {result.maxEssayMarks}
                          </div>
                        )}
                      </td>

                      {/* MCQ % */}
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <div className="text-lg font-bold text-gray-800">
                          {((result.mcqPercentage || 0).toFixed(1))}%
                        </div>
                        <div className="w-full max-w-[80px] mx-auto h-2 bg-gray-200 rounded-full overflow-hidden mt-1">
                          <div
                            className={`h-full rounded-full transition-all ${
                              (result.mcqPercentage || 0) >= 80 ? 'bg-green-500' :
                              (result.mcqPercentage || 0) >= 60 ? 'bg-yellow-500' :
                              'bg-red-500'
                            }`}
                            style={{ width: `${result.mcqPercentage || 0}%` }}
                          />
                        </div>
                      </td>

                      {/* MCQ Accuracy */}
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <div className="text-lg font-bold text-green-600">
                          {((result.mcqAccuracy || 0).toFixed(1))}%
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {result.mcqCorrect || 0}/{(result.mcqCorrect || 0) + (result.mcqWrong || 0)}
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      {/* Score */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-xl font-bold text-vh-red">
                          {score}
                        </div>
                      </td>

                      {/* Correct */}
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <div className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-green-100 border border-green-200">
                          <span className="text-sm font-semibold text-green-700">
                            {correct}
                          </span>
                        </div>
                      </td>

                      {/* Wrong */}
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <div className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-red-100 border border-red-200">
                          <span className="text-sm font-semibold text-red-700">
                            {wrong}
                          </span>
                        </div>
                      </td>

                      {/* Unattempted */}
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <div className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-gray-100 border border-gray-200">
                          <span className="text-sm font-semibold text-gray-700">
                            {unattempted}
                          </span>
                        </div>
                      </td>

                      {/* Accuracy */}
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <div className="flex flex-col items-center">
                          <div className="text-lg font-bold text-gray-800">
                            {accuracy.toFixed(1)}%
                          </div>
                          {/* Accuracy bar */}
                          <div className="w-full max-w-[80px] h-2 bg-gray-200 rounded-full overflow-hidden mt-1">
                            <div
                              className={`h-full rounded-full transition-all ${
                                accuracy >= 80 ? 'bg-green-500' :
                                accuracy >= 60 ? 'bg-yellow-500' :
                                'bg-red-500'
                              }`}
                              style={{ width: `${accuracy}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-600">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-100 border border-green-200"></div>
          <span>Correct Answers</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-100 border border-red-200"></div>
          <span>Wrong Answers</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-gray-100 border border-gray-200"></div>
          <span>Unattempted</span>
        </div>
      </div>
    </div>
  );
};

export default Top5LeaderboardTable;
