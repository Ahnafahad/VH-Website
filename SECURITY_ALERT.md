# 🚨 SECURITY ALERT - Leaked Gemini API Key

## Issue
The Google Gemini API key has been exposed in the frontend code and has been disabled by Google.

## Impact
- Vocabulary Quiz game cannot generate questions
- API key: `AIzaSyBbzvVwymrwjGqKOkD77dkIgEnRGwbL30c` is compromised
- Key is visible in:
  - `src/app/games/vocab-quiz/page.tsx` (lines 155, 276)

## Required Actions

### 1. Get a New API Key (URGENT)
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create a new API key
3. **DO NOT commit it to git**

### 2. Create Environment Variable
Add to `.env.local`:
```env
NEXT_PUBLIC_GEMINI_API_KEY=your_new_key_here
```

### 3. Move API Calls to Backend (RECOMMENDED)
Create API route: `src/app/api/generate-questions/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to generate questions' },
      { status: 500 }
    );
  }
}
```

### 4. Update Frontend Code
Change API calls from direct Gemini calls to your backend:
```typescript
const response = await fetch('/api/generate-questions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt })
});
```

### 5. Add to .gitignore
Ensure `.env.local` is in `.gitignore`:
```
.env.local
.env*.local
```

## Security Best Practices
✅ Never commit API keys to git
✅ Use environment variables
✅ Keep sensitive keys on the server-side only
✅ Use API routes to proxy sensitive requests
✅ Rotate keys regularly
✅ Set up API key restrictions in Google Cloud Console

## References
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Google AI Studio](https://aistudio.google.com/)
