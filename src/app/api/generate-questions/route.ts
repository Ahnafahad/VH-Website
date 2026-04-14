import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { isEmailAuthorized } from '@/lib/db-access-control';

/**
 * POST /api/generate-questions
 * Securely generates vocabulary quiz questions using DeepSeek (Gemini fallback)
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
    const isAuthorized = await isEmailAuthorized(session.user.email.toLowerCase());
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

    // 4. Call DeepSeek (primary) with Gemini fallback
    let data: unknown;

    const deepSeekKey = process.env.DEEPSEEK_API_KEY;
    const geminiKey   = process.env.GOOGLE_GEMINI_API_KEY;

    if (!deepSeekKey && !geminiKey) {
      console.error('No AI API keys configured');
      return NextResponse.json(
        { error: 'API configuration error. Please contact administrator.' },
        { status: 500 }
      );
    }

    if (deepSeekKey) {
      const dsRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${deepSeekKey}`,
        },
        body: JSON.stringify({
          model:    'deepseek-chat',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens:  2048,
        }),
      });

      if (dsRes.ok) {
        data = await dsRes.json();
      } else {
        console.warn('DeepSeek failed:', dsRes.status, await dsRes.text());
      }
    }

    if (!data && geminiKey) {
      const gmRes = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        }
      );

      if (!gmRes.ok) {
        const errorText = await gmRes.text();
        console.error('Gemini fallback error:', gmRes.status, errorText);
        return NextResponse.json(
          { error: 'Failed to generate questions', details: `API returned status ${gmRes.status}` },
          { status: gmRes.status }
        );
      }

      data = await gmRes.json();
    }

    if (!data) {
      return NextResponse.json({ error: 'All AI providers failed' }, { status: 502 });
    }

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
