import withPWAInit from '@ducanh2912/next-pwa';
import bundleAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Stop next dev from writing AGENTS.md / CLAUDE.md into the repo root.
  agentRules: false,
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "api.qrserver.com" },
    ],
  },
  bundlePagesRouterDependencies: true,
  experimental: {
    // lucide-react is already optimized by default
    optimizePackageImports: ["framer-motion"],
  },
  // Keep heavy Node-only libs out of the serverless bundle where possible.
  serverExternalPackages: [
    "googleapis",
    "firebase-admin",
    "pdf-parse",
    "pdfjs-dist",
    "officeparser",
  ],
  async headers() {
    const csp = [
      "default-src 'self'",
      // apis.google.com: Firebase Auth (gapi iframe for popup/redirect sign-in).
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://apis.google.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      // *.googleusercontent.com: Google avatar + Drive download redirects (fetched via SW).
      "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebase.com https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://drive.usercontent.google.com https://*.googleusercontent.com https://vitals.vercel-insights.com https://va.vercel-insights.com https://*.google.com wss://*.firebaseio.com",
      // *.firebaseapp.com + accounts.google.com: Firebase Auth helper iframes.
      "frame-src https://drive.google.com https://*.google.com https://accounts.google.com https://*.firebaseapp.com https://view.officeapps.live.com",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
    ].join("; ");

    return [
      {
        source: "/.well-known/assetlinks.json",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=300, s-maxage=300",
          },
          { key: "Content-Type", value: "application/json" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(self), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // CSP stays Report-Only. Do not rename to Content-Security-Policy without a
          // staging smoke of Google login, Drive viewer, chat, and the PWA worker.
          {
            key: "Content-Security-Policy-Report-Only",
            value: csp,
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
        ],
      },
    ];
  },
};

const isDev = process.env.NODE_ENV === 'development';

const config = isDev
  ? nextConfig
  : withPWAInit({
      dest: 'public',
      disable: false,
      register: true,
      // false so Workbox emits the SKIP_WAITING message listener (PwaUpdater posts it).
      skipWaiting: false,
      cacheOnFrontEndNav: false,
      aggressiveFrontEndNavCaching: false,
      // Keep heavy assets out of the install-time precache (fetch on demand).
      publicExcludes: [
        "!pdf.worker.min.mjs",
        "!utility-logo.png",
        "!utility-logo-og.png",
        "!screenshots/**",
        "!.well-known/**",
      ],
      // Offline document only via NetworkFirst handlerDidError — never App Shell navigateFallback
      // (that serves /~offline for every navigation and causes React hydration #418).
      fallbacks: {
        document: '/~offline',
      },
      // Keep default Workbox page/asset caching, but do not CacheFirst/NetworkFirst third-party
      // origins (Drive PDFs must stay on the app Cache API, not Workbox).
      // Google Drive/usercontent hosts must NOT be handled by the SW at all — NetworkOnly
      // still intercepts fetch() and strips/breaks CORS for drive.usercontent.google.com.
      extendDefaultRuntimeCaching: true,
      workboxOptions: {
        skipWaiting: false,
        clientsClaim: true,
        exclude: [/\.map$/, /^manifest.*\.js$/],
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && url.pathname.startsWith("/_next/static/"),
            handler: "CacheFirst",
            options: {
              cacheName: "next-static",
              expiration: {
                maxEntries: 128,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
          {
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && url.pathname.startsWith("/api/"),
            handler: "NetworkOnly",
            options: {
              cacheName: "apis",
            },
          },
          {
            urlPattern: ({ url, sameOrigin }) => {
              if (sameOrigin) return false;
              const host = url.hostname;
              if (
                host === "drive.usercontent.google.com" ||
                host === "drive.google.com" ||
                host.endsWith(".googleusercontent.com")
              ) {
                return false;
              }
              return true;
            },
            handler: "NetworkOnly",
            options: {
              cacheName: "cross-origin",
            },
          },
        ],
      },
    })(nextConfig);

export default withBundleAnalyzer(config);
