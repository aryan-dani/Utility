import type { Metadata, Viewport } from 'next';
import { Inter, Newsreader } from 'next/font/google';
import { Suspense } from 'react';
import './globals.css';
import Navigation from '@/components/Navigation';
import ConditionalFooter from '@/components/ConditionalFooter';
import Footer from '@/components/Footer';
import { Providers } from '@/components/Providers';
import InstallPrompt from '@/components/pwa/InstallPrompt';
import { SW_RECOVERY_SCRIPT } from '@/components/pwa/swRecoveryScript';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const newsreader = Newsreader({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  style: ['normal', 'italic'],
});

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#09090b' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  metadataBase: new URL("https://utilityos.tech"),
  title: {
    default: 'Utility',
    template: '%s | Utility',
  },
  description: 'A premium academic workspace. Access your syllabus, resources, AI assistant, and planner in one place.',
  keywords: ['academic', 'syllabus', 'resources', 'planner', 'university', 'student', 'AI'],
  icons: {
    icon: [
      { url: '/favicon.ico?v=20260905', sizes: 'any' },
      { url: '/utility-logo.svg?v=20260905', type: 'image/svg+xml' },
      { url: '/icon-192x192.png?v=20260905', type: 'image/png', sizes: '192x192' },
      { url: '/icon-512x512.png?v=20260905', type: 'image/png', sizes: '512x512' },
    ],
    apple: [{ url: '/apple-icon.png?v=20260905', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title: 'Utility',
    description: 'A premium academic workspace. Access your syllabus, resources, AI assistant, and planner in one place.',
    type: 'website',
    url: 'https://utilityos.tech',
    siteName: 'Utility',
    images: [{ url: '/utility-logo-og.png?v=20260905', width: 512, height: 512, alt: 'Utility' }],
  },
  twitter: {
    card: 'summary',
    title: 'Utility',
    description: 'A premium academic workspace. Access your syllabus, resources, AI assistant, and planner in one place.',
    images: ['/utility-logo-og.png?v=20260905'],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Utility',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${newsreader.variable}`}
      suppressHydrationWarning
    >
      {/* Inline in <head> so it runs before paint; next/script beforeInteractive
          triggers a React 19 client warning when rendered in <body>. */}
      <head>
        <script
          id="utility-sw-recovery"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: SW_RECOVERY_SCRIPT }}
        />
      </head>
      <body className={`${inter.className} antialiased min-h-screen bg-background text-foreground overflow-x-hidden`}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[9999] focus:rounded-md focus:bg-foreground focus:px-4 focus:py-2 focus:text-sm focus:text-background"
        >
          Skip to main content
        </a>
        <Providers>
          <div className="flex min-h-screen w-full">
            <Navigation />
            <div className="flex-1 flex flex-col min-w-0 w-full">
              <main id="main-content" role="main" className="flex-1 w-full flex flex-col pt-[calc(3.5rem+env(safe-area-inset-top))] pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pt-0 md:pb-0">
                <Suspense
                  fallback={
                    <div
                      className="flex-1 flex flex-col items-center justify-center gap-3 min-h-[60vh]"
                      role="status"
                      aria-live="polite"
                      aria-label="Loading"
                    >
                      <span className="loading-orb" aria-hidden />
                      <p className="text-xs font-medium text-muted tracking-wide">Loading…</p>
                    </div>
                  }
                >
                  {children}
                </Suspense>
              </main>
              <Suspense fallback={<Footer />}>
                <ConditionalFooter />
              </Suspense>
            </div>
          </div>
          <InstallPrompt />
        </Providers>
        <Analytics />
        <SpeedInsights sampleRate={0.1} />
      </body>
    </html>
  );
}

