import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { isEmailAuthorized } from '@/lib/generated-access-control';

/**
 * POST /api/generate-questions
 * Securely generates vocabulary quiz questions using Google Gemini API
 *
 * Security features:
 * - API key stored server-side only
 * - Requires user authentication
 * - Rate limiting ready
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authentication check
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // 2. Authorization check
    const isAuthorized = isEmailAuthorized(session.user.email.toLowerCase());
    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // 3. Get request body
    const body = await request.json();
    const { prompt, type } = body;

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    // 4. Validate API key exists
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GOOGLE_GEMINI_API_KEY is not configured');
      return NextResponse.json(
        { error: 'API configuration error. Please contact administrator.' },
        { status: 500 }
      );
    }

    // 5. Call Gemini API (server-side, key is protected)
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        })
      }
    );

    // 6. Handle API errors
    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', geminiResponse.status, errorText);

      return NextResponse.json(
        {
          error: 'Failed to generate questions',
          details: `API returned status ${geminiResponse.status}`
        },
        { status: geminiResponse.status }
      );
    }

    // 7. Parse and return response
    const data = await geminiResponse.json();

    // Log successful request (without sensitive data)
    console.log('Question generation successful:', {
      user: session.user.email,
      type: type || 'questions',
      timestamp: new Date().toISOString()
    });

    return NextResponse.json(data);

  } catch (error) {
    console.error('Error in generate-questions API:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
