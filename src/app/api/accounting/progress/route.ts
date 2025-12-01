import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import AccountingProgress from '@/lib/models/AccountingProgress';
import User from '@/lib/models/User';
import { isAdminEmail } from '@/lib/db-access-control';
import { validateAuth, createErrorResponse, ApiException } from '@/lib/api-utils';
import { getShortTitle } from '@/lib/accounting-utils';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    // 1. Validate authentication
    const user = await validateAuth();

    // 2. Connect to database
    await connectToDatabase();

    // 3. Check if user is admin first (admins have access to everything)
    const isAdmin = await isAdminEmail(user.email);

    // 4. Check FBS access for non-admin users
    const dbUser = await User.findOne({ email: user.email.toLowerCase() });
    if (!isAdmin && !dbUser?.accessTypes?.FBS) {
      throw new ApiException(
        'This game is only available to FBS students',
        403,
        'FBS_ACCESS_REQUIRED'
      );
    }

    // 5. Fetch user's progress document
    let progress = await AccountingProgress.findOne({
      playerEmail: user.email.toLowerCase()
    });

    // 6. Load lecture metadata from accounting-questions.json
    const questionsPath = path.join(process.cwd(), 'public/data/accounting-questions.json');
    const questionsData = JSON.parse(fs.readFileSync(questionsPath, 'utf-8'));
    const allLectures = questionsData.lectures;

    // 7. If no progress exists, return empty state
    if (!progress) {
      return NextResponse.json({
        success: true,
        progress: {
          totalMastered: 0,
          totalQuestions: 281,
          overallPercentage: 0,
          lectureProgress: allLectures.map((lecture: any) => ({
            lectureNumber: lecture.lectureNumber,
            lectureName: lecture.shortTitle || lecture.title,
            totalQuestions: lecture.questionCount,
            masteredCount: 0,
            percentage: 0,
            completionCount: 0,
            isCompleted: false,
            lastPlayed: null
          })),
          masteredQuestionIds: [],
          lastUpdated: null
        }
      });
    }

    // 8. Build enriched response with per-lecture stats
    const lectureProgressArray = allLectures.map((lecture: any) => {
      const lectureNum = lecture.lectureNumber;
      const lectureData = progress.lectureProgress.get(lectureNum);

      if (!lectureData) {
        // Lecture never played
        return {
          lectureNumber: lectureNum,
          lectureName: lecture.shortTitle || lecture.title,
          totalQuestions: lecture.questionCount,
          masteredCount: 0,
          percentage: 0,
          completionCount: 0,
          isCompleted: false,
          lastPlayed: null
        };
      }

      const percentage = lecture.questionCount > 0
        ? (lectureData.masteredCount / lecture.questionCount) * 100
        : 0;

      return {
        lectureNumber: lectureNum,
        lectureName: lecture.shortTitle || lecture.title,
        totalQuestions: lectureData.totalQuestions,
        masteredCount: lectureData.masteredCount,
        percentage: Number(percentage.toFixed(1)),
        completionCount: lectureData.completionCount,
        isCompleted: lectureData.masteredCount === lecture.questionCount,
        lastPlayed: lectureData.lastPlayed
      };
    });

    const overallPercentage = progress.totalQuestions > 0
      ? (progress.totalMastered / progress.totalQuestions) * 100
      : 0;

    // 9. Return enriched progress data
    return NextResponse.json({
      success: true,
      progress: {
        totalMastered: progress.totalMastered,
        totalQuestions: progress.totalQuestions,
        overallPercentage: Number(overallPercentage.toFixed(1)),
        lectureProgress: lectureProgressArray,
        masteredQuestionIds: Array.from(progress.masteredQuestions),
        lastUpdated: progress.lastUpdated
      }
    });

  } catch (error) {
    return createErrorResponse(error);
  }
}
