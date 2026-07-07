import type { NextConfig } from "next";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const withPWA = require("next-pwa");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options",  value: "nosniff" },
          { key: "X-Frame-Options",          value: "SAMEORIGIN" },
          { key: "X-XSS-Protection",         value: "1; mode=block" },
          { key: "Referrer-Policy",           value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy",        value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security",  value: "max-age=63072000; includeSubDomains; preload" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://*.googleusercontent.com https://lh3.googleusercontent.com",
              "connect-src 'self' https://accounts.google.com",
              "frame-src 'self' https://accounts.google.com",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

const pwaConfig = withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development" || process.env.DISABLE_SW === "1",
  register: true,
  skipWaiting: true,
  // Drop caches left behind by older Workbox precache versions so users with
  // a stale pre-fix service worker don't keep serving broken responses.
  // (This is next-pwa's default, but we depend on it — keep it explicit.)
  cleanupOutdatedCaches: true,
  // Never let the SW cache Next.js RSC payloads or API responses.
  // Stale RSC cache causes 2-minute blank screens on mobile navigation.
  //
  // networkTimeoutSeconds: without it, a stalled fetch (flaky mobile network,
  // backgrounded PWA) never resolves and App Router soft navigation hangs on
  // loading.tsx forever. With it, the strategy rejects after N seconds, the
  // fetch fails fast, and Next can surface an error / retry instead of hanging.
  //
  // Why NetworkFirst and not NetworkOnly: workbox-build's generateSW template
  // only allows networkTimeoutSeconds with NetworkFirst (it rejects it on
  // NetworkOnly at build time, even though the runtime strategy supports it).
  // So we use NetworkFirst with a cache that is NEVER populated:
  // cacheableResponse.statuses [0] means only opaque responses (cross-origin
  // no-cors) are cacheable — same-origin 200s are never stored. The cache
  // stays empty, so on timeout/failure there is no stale fallback and the
  // strategy rejects — identical behavior to NetworkOnly, plus the timeout.
  runtimeCaching: [
    // RSC fetch requests (Next.js App Router internal fetches — ?_rsc=xxx)
    {
      urlPattern: /_rsc=/,
      handler: "NetworkFirst",
      options: {
        cacheName: "rsc-network-only",
        networkTimeoutSeconds: 10,
        cacheableResponse: { statuses: [0] },
      },
    },
    // API routes — always fresh
    {
      urlPattern: /^\/api\//,
      handler: "NetworkFirst",
      options: {
        cacheName: "api-network-only",
        networkTimeoutSeconds: 10,
        cacheableResponse: { statuses: [0] },
      },
    },
    // Page navigations (HTML documents) — always fresh
    {
      urlPattern: ({ request }: { request: Request }) =>
        request.mode === "navigate",
      handler: "NetworkFirst",
      options: {
        cacheName: "pages-network-only",
        networkTimeoutSeconds: 10,
        cacheableResponse: { statuses: [0] },
      },
    },
    // Next.js build artifacts — safe to cache forever
    {
      urlPattern: /^\/_next\/static\/.*/i,
      handler: "CacheFirst",
      options: {
        cacheName: "next-static",
        expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },
    // Static files (images, fonts, icons)
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff2?)$/i,
      handler: "CacheFirst",
      options: {
        cacheName: "static-assets",
        expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },
  ],
});

export default pwaConfig(nextConfig);
