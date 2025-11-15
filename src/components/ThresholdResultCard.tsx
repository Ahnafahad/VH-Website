'use client';

import React from 'react';
import { CheckCircle, XCircle, AlertCircle, TrendingUp, Award } from 'lucide-react';
import { SimpleTestResult, FullTestResult } from '@/types/results';
import Card from './ui/Card';
import Badge from './ui/Badge';

interface ThresholdResultCardProps {
  result: SimpleTestResult | FullTestResult;
  isFullTest?: boolean;
}

/**
 * Displays threshold-based pass/fail status with section breakdown
 * Shows green for passed sections, red for failed sections
 */
const ThresholdResultCard: React.FC<ThresholdResultCardProps> = ({ result }) => {
  // Check if this result has threshold data
  const hasThresholdData = result.sections && Object.values(result.sections).some(s => s.threshold !== undefined);

  if (!hasThresholdData) {
    return null; // Don't show if no threshold data
  }

  const passedAll = result.passedAll ?? true;
  const failedSections = result.failedSections ?? [];

  return (
    <Card variant="elevated" padding="none" className="overflow-hidden">
      {/* Header - Overall Status */}
      <div className={`p-6 border-b-2 ${
        passedAll
          ? 'bg-gradient-to-r from-success-50 to-success-100 border-success-200'
          : 'bg-gradient-to-r from-error-50 to-error-100 border-error-200'
      }`}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            {passedAll ? (
              <div className="p-3 bg-success-600 rounded-full shadow-lg">
                <CheckCircle size={28} className="text-white" />
              </div>
            ) : (
              <div className="p-3 bg-error-600 rounded-full shadow-lg">
                <XCircle size={28} className="text-white" />
              </div>
            )}
            <div>
              <h3 className={`text-2xl md:text-3xl font-black ${passedAll ? 'text-success-800' : 'text-error-800'}`}>
                {passedAll ? 'PASSED' : 'FAILED'}
              </h3>
              <p className={`text-sm md:text-base ${passedAll ? 'text-success-700' : 'text-error-700'}`}>
                {passedAll
                  ? 'You passed all sections! 🎉'
                  : `Failed ${failedSections.length} section${failedSections.length > 1 ? 's' : ''}`
                }
              </p>
            </div>
          </div>

          {/* Rank with color coding */}
          <div className={`text-right p-4 rounded-xl border-2 ${
            passedAll
              ? 'bg-success-100 border-success-300'
              : 'bg-error-100 border-error-300'
          }`}>
            <div className="flex items-center gap-2 justify-end mb-1">
              <Award size={20} className={passedAll ? 'text-success-600' : 'text-error-600'} />
              <span className="text-xs font-semibold text-gray-600">RANK</span>
            </div>
            <div className={`text-3xl font-black ${passedAll ? 'text-success-700' : 'text-error-700'}`}>
              #{result.rank}
            </div>
            <Badge
              variant="subtle"
              colorScheme={passedAll ? 'success' : 'error'}
              size="sm"
              className="mt-1"
            >
              {passedAll ? 'Qualified' : 'Not Qualified'}
            </Badge>
          </div>
        </div>

        {/* Note about passing requirement */}
        {!passedAll && (
          <div className="mt-4 p-4 bg-white/80 rounded-xl border border-error-200">
            <div className="flex items-start gap-3">
              <AlertCircle size={18} className="text-error-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-error-800">
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
                    ? 'bg-success-50 border-success-200 hover:border-success-300 hover:shadow-md'
                    : 'bg-error-50 border-error-200 hover:border-error-300 hover:shadow-md'
                }`}
              >
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    {sectionPassed ? (
                      <CheckCircle size={20} className="text-success-600" />
                    ) : (
                      <XCircle size={20} className="text-error-600" />
                    )}
                    <div>
                      <div className="font-bold text-gray-900">Section {sectionId}</div>
                      <div className="text-xs text-gray-600">
                        Threshold: {thresholdMarks.toFixed(2)} marks
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className={`text-2xl font-black ${sectionPassed ? 'text-success-700' : 'text-error-700'}`}>
                      {studentMarks.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-600 mb-1">marks</div>
                    <Badge
                      variant="solid"
                      colorScheme={sectionPassed ? 'success' : 'error'}
                      size="sm"
                    >
                      {sectionPassed ? 'PASS' : 'FAIL'}
                    </Badge>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      sectionPassed ? 'bg-gradient-to-r from-success-500 to-success-600' : 'bg-gradient-to-r from-error-500 to-error-600'
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
                  ? 'bg-success-50 border-success-200 hover:border-success-300 hover:shadow-md'
                  : 'bg-error-50 border-error-200 hover:border-error-300 hover:shadow-md'
              }`}
            >
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  {result.essayPassed ? (
                    <CheckCircle size={20} className="text-success-600" />
                  ) : (
                    <XCircle size={20} className="text-error-600" />
                  )}
                  <div>
                    <div className="font-bold text-gray-900">Essay</div>
                    <div className="text-xs text-gray-600">
                      Threshold: {result.essayThreshold.toFixed(2)} marks (Fixed)
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className={`text-2xl font-black ${result.essayPassed ? 'text-success-700' : 'text-error-700'}`}>
                    {((result as any).essayMarks ?? 0).toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-600 mb-1">marks</div>
                  <Badge
                    variant="solid"
                    colorScheme={result.essayPassed ? 'success' : 'error'}
                    size="sm"
                  >
                    {result.essayPassed ? 'PASS' : 'FAIL'}
                  </Badge>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    result.essayPassed ? 'bg-gradient-to-r from-success-500 to-success-600' : 'bg-gradient-to-r from-error-500 to-error-600'
                  }`}
                  style={{ width: `${Math.min(100, result.essayThreshold > 0 ? (((result as any).essayMarks ?? 0) / result.essayThreshold) * 100 : 0)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Threshold Info */}
        <div className="mt-6 p-4 bg-info-50 rounded-xl border border-info-200">
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="text-info-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-info-800">
              <p className="font-semibold mb-2">About Thresholds</p>
              <p className="leading-relaxed">
                Each section has a minimum threshold (in marks) you must achieve to pass. The essay threshold is always fixed at 40% of total essay marks,
                while other section thresholds may be adjusted to ensure at least 20% of students pass overall. Thresholds are displayed in marks, not percentages.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ThresholdResultCard;
