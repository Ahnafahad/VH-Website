'use client';

import React from 'react';
import { CheckCircle, XCircle, AlertCircle, TrendingUp, Award, UserX } from 'lucide-react';
import { SimpleTestResult, FullTestResult } from '@/types/results';

interface ThresholdResultCardProps {
  result: SimpleTestResult | FullTestResult;
  isFullTest?: boolean;
}

/**
 * Displays threshold-based pass/fail status with section breakdown
 * Shows green for passed sections, red for failed sections, gray for absent
 */
const ThresholdResultCard: React.FC<ThresholdResultCardProps> = ({ result, isFullTest = false }) => {
  // Check if this result has threshold data
  const hasThresholdData = result.sections && Object.values(result.sections).some(s => s.threshold !== undefined);

  if (!hasThresholdData) {
    return null; // Don't show if no threshold data
  }

  // Check if student is absent (0 total marks)
  const isAbsent = result.isAbsent || result.rankStatus === 'absent';

  if (isAbsent) {
    return (
      <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-lg border-2 border-gray-300 overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-gray-100 to-slate-100 border-b-2 border-gray-300">
          <div className="flex items-center justify-center gap-3">
            <div className="p-3 bg-gray-500 rounded-full">
              <UserX size={28} className="text-white" />
            </div>
            <div className="text-center">
              <h3 className="text-2xl font-black text-gray-800">ABSENT</h3>
              <p className="text-sm text-gray-600">Student did not attend this test</p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-center">
            <p className="text-sm text-gray-700">
              No marks recorded for this test. Students with 0 total marks are marked as absent and are not ranked.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const passedAll = result.passedAll ?? true;
  const failedSections = result.failedSections ?? [];

  return (
    <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-lg border-2 border-gray-200 overflow-hidden">
      {/* Header - Overall Status */}
      <div className={`p-6 ${passedAll ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-b-2 border-green-200' : 'bg-gradient-to-r from-red-50 to-rose-50 border-b-2 border-red-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {passedAll ? (
              <div className="p-3 bg-green-500 rounded-full">
                <CheckCircle size={28} className="text-white" />
              </div>
            ) : (
              <div className="p-3 bg-red-500 rounded-full">
                <XCircle size={28} className="text-white" />
              </div>
            )}
            <div>
              <h3 className={`text-2xl font-black ${passedAll ? 'text-green-800' : 'text-red-800'}`}>
                {passedAll ? 'PASSED' : 'FAILED'}
              </h3>
              <p className={`text-sm ${passedAll ? 'text-green-600' : 'text-red-600'}`}>
                {passedAll
                  ? 'You passed all sections! 🎉'
                  : `Failed ${failedSections.length} section${failedSections.length > 1 ? 's' : ''}`
                }
              </p>
            </div>
          </div>

          {/* Rank with color coding */}
          {result.rank !== null && result.rank !== undefined && (
            <div className={`text-right p-4 rounded-xl ${passedAll ? 'bg-green-100 border-2 border-green-300' : 'bg-red-100 border-2 border-red-300'}`}>
              <div className="flex items-center gap-2 justify-end mb-1">
                <Award size={20} className={passedAll ? 'text-green-600' : 'text-red-600'} />
                <span className="text-xs font-semibold text-gray-600">RANK</span>
              </div>
              <div className={`text-3xl font-black ${passedAll ? 'text-green-700' : 'text-red-700'}`}>
                #{result.rank}
              </div>
              <div className={`text-xs mt-1 ${passedAll ? 'text-green-600' : 'text-red-600'}`}>
                {passedAll ? 'Qualified' : 'Not Qualified'}
              </div>
            </div>
          )}
        </div>

        {/* Note about passing requirement */}
        {!passedAll && (
          <div className="mt-4 p-3 bg-white/70 rounded-lg border border-red-200">
            <div className="flex items-start gap-2">
              <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">
                <strong>Note:</strong> You must pass all sections (including essays) to pass this test overall.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Section Breakdown */}
      <div className="p-6">
        <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <TrendingUp size={20} className="text-vh-red" />
          Section Performance
        </h4>

        <div className="space-y-3">
          {/* MCQ Sections */}
          {result.sections && Object.entries(result.sections).map(([sectionId, section]) => {
            const sectionPassed = section.passed ?? true;
            const thresholdMarks = section.threshold ?? 0;
            const studentMarks = section.marks ?? 0;

            return (
              <div
                key={sectionId}
                className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                  sectionPassed
                    ? 'bg-green-50 border-green-200 hover:border-green-300'
                    : 'bg-red-50 border-red-200 hover:border-red-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {sectionPassed ? (
                      <CheckCircle size={20} className="text-green-600" />
                    ) : (
                      <XCircle size={20} className="text-red-600" />
                    )}
                    <div>
                      <div className="font-bold text-gray-800">Section {sectionId}</div>
                      <div className="text-xs text-gray-600">
                        Threshold: {thresholdMarks.toFixed(2)} marks
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className={`text-2xl font-black ${sectionPassed ? 'text-green-700' : 'text-red-700'}`}>
                      {studentMarks.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-600">marks</div>
                    <div className={`text-xs font-semibold ${sectionPassed ? 'text-green-600' : 'text-red-600'}`}>
                      {sectionPassed ? 'PASS' : 'FAIL'}
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      sectionPassed ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-gradient-to-r from-red-500 to-rose-500'
                    }`}
                    style={{ width: `${Math.min(100, thresholdMarks > 0 ? (studentMarks / thresholdMarks) * 100 : 0)}%` }}
                  />
                </div>
              </div>
            );
          })}

          {/* Essay Section */}
          {result.essayThreshold !== undefined && result.essayPassed !== undefined && (
            <div
              className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                result.essayPassed
                  ? 'bg-green-50 border-green-200 hover:border-green-300'
                  : 'bg-red-50 border-red-200 hover:border-red-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {result.essayPassed ? (
                    <CheckCircle size={20} className="text-green-600" />
                  ) : (
                    <XCircle size={20} className="text-red-600" />
                  )}
                  <div>
                    <div className="font-bold text-gray-800">Essay</div>
                    <div className="text-xs text-gray-600">
                      Threshold: {result.essayThreshold.toFixed(2)} marks (Fixed)
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className={`text-2xl font-black ${result.essayPassed ? 'text-green-700' : 'text-red-700'}`}>
                    {((result as any).essayMarks ?? 0).toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-600">marks</div>
                  <div className={`text-xs font-semibold ${result.essayPassed ? 'text-green-600' : 'text-red-600'}`}>
                    {result.essayPassed ? 'PASS' : 'FAIL'}
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    result.essayPassed ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-gradient-to-r from-red-500 to-rose-500'
                  }`}
                  style={{ width: `${Math.min(100, result.essayThreshold > 0 ? (((result as any).essayMarks ?? 0) / result.essayThreshold) * 100 : 0)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Threshold Info */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-start gap-2">
            <AlertCircle size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">About Thresholds</p>
              <p>
                Each section has a minimum threshold (in marks) you must achieve to pass. The essay threshold is always fixed at 40% of total essay marks,
                while other section thresholds may be adjusted to ensure at least 20% of students pass overall. Thresholds are displayed in marks, not percentages.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThresholdResultCard;
