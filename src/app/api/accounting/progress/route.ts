import { NextResponse } from 'next/server';
import { db, accountingProgress } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { isAdminEmail, hasProduct } from '@/lib/db-access-control';
import { validateAuth, createErrorResponse, ApiException } from '@/lib/api-utils';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const user = await validateAuth();
    const isAdmin = await isAdminEmail(user.email);

    if (!isAdmin && !(await hasProduct(user.email, 'fbs'))) {
      throw new ApiException('This game is only available to FBS students', 403, 'FBS_ACCESS_REQUIRED');
    }

    // Load lecture metadata
    const questionsPath = path.join(process.cwd(), 'public/data/accounting-questions.json');
    const questionsData = JSON.parse(fs.readFileSync(questionsPath, 'utf-8'));
    const allLectures = questionsData.lectures;

    const progress = await db
      .select()
      .from(accountingProgress)
      .where(eq(accountingProgress.playerEmail, user.email.toLowerCase()))
      .get();

    if (!progress) {
      return NextResponse.json({
        success: true,
        progress: {
          totalMastered: 0,
          totalQuestions: 281,
          overallPercentage: 0,
          lectureProgress: allLectures.map((l: any) => ({
            lectureNumber: l.lectureNumber,
            lectureName:   l.shortTitle || l.title,
            totalQuestions: l.questionCount,
            masteredCount:  0,
            percentage:     0,
            completionCount: 0,
            isCompleted:    false,
            lastPlayed:     null,
          })),
          masteredQuestionIds: [],
          lastUpdated: null,
        },
      });
    }

    const masteredQuestions: string[] = JSON.parse(progress.masteredQuestions);
    const lectureProgressMap: Record<string, any> = JSON.parse(progress.lectureProgress);

    const lectureProgressArray = allLectures.map((lecture: any) => {
      const lectureNum = lecture.lectureNumber;
      const data = lectureProgressMap[lectureNum];
      if (!data) {
        return {
          lectureNumber:  lectureNum,
          lectureName:    lecture.shortTitle || lecture.title,
          totalQuestions: lecture.questionCount,
          masteredCount:  0,
          percentage:     0,
          completionCount: 0,
          isCompleted:    false,
          lastPlayed:     null,
        };
      }
      const percentage = lecture.questionCount > 0
        ? (data.masteredCount / lecture.questionCount) * 100 : 0;
      return {
        lectureNumber:   lectureNum,
        lectureName:     lecture.shortTitle || lecture.title,
        totalQuestions:  data.totalQuestions,
        masteredCount:   data.masteredCount,
        percentage:      Number(percentage.toFixed(1)),
        completionCount: data.completionCount,
        isCompleted:     data.masteredCount === lecture.questionCount,
        lastPlayed:      data.lastPlayed,
      };
    });

    const overallPercentage = progress.totalQuestions > 0
      ? (progress.totalMastered / progress.totalQuestions) * 100 : 0;

    return NextResponse.json({
      success: true,
      progress: {
        totalMastered:       progress.totalMastered,
        totalQuestions:      progress.totalQuestions,
        overallPercentage:   Number(overallPercentage.toFixed(1)),
        lectureProgress:     lectureProgressArray,
        masteredQuestionIds: masteredQuestions,
        lastUpdated:         progress.lastUpdated,
      },
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}
