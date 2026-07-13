import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    latestVersion: process.env.LEXICORE_ANDROID_LATEST_VERSION ?? null,
    minimumVersion: process.env.LEXICORE_ANDROID_MINIMUM_VERSION ?? null,
    storeUrl: process.env.LEXICORE_ANDROID_STORE_URL ?? 'https://play.google.com/store/apps/details?id=org.beyondthehorizons.vhapp',
  }, {
    headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600' },
  });
}
