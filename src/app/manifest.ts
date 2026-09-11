import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Utility',
    short_name: 'Utility',
    description: 'A premium academic workspace. Access your syllabus, resources, AI assistant, and planner in one place.',
    start_url: '/',
    id: '/',
    scope: '/',
    lang: 'en',
    dir: 'ltr',
    display: 'standalone',
    orientation: 'any',
    background_color: '#09090b',
    theme_color: '#09090b',
    categories: ['education', 'productivity'],
    shortcuts: [
      {
        name: 'Ask AI',
        short_name: 'Ask',
        url: '/ask',
        description: 'RAG-powered academic assistant',
      },
      {
        name: 'Vault',
        short_name: 'Vault',
        url: '/resources',
        description: 'Subject files and notes',
      },
      {
        name: 'Study Planner',
        short_name: 'Planner',
        url: '/planner',
        description: 'Schedule and logs',
      },
      {
        name: 'Focus Timer',
        short_name: 'Timer',
        url: '/timer',
        description: 'Pomodoro study sessions',
      },
    ],
    // PWA install screenshots live in public/screenshots (excluded from Workbox precache).
    screenshots: [
      {
        src: '/screenshots/narrow-home.jpg',
        sizes: '360x780',
        type: 'image/jpeg',
        form_factor: 'narrow',
        label: 'Home',
      },
      {
        src: '/screenshots/narrow-timer.jpg',
        sizes: '360x780',
        type: 'image/jpeg',
        form_factor: 'narrow',
        label: 'Focus Timer',
      },
      {
        src: '/screenshots/narrow-visualize.jpg',
        sizes: '360x780',
        type: 'image/jpeg',
        form_factor: 'narrow',
        label: 'Visualize',
      },
      {
        src: '/screenshots/wide-home.jpg',
        sizes: '1280x800',
        type: 'image/jpeg',
        form_factor: 'wide',
        label: 'Home on desktop',
      },
      {
        src: '/screenshots/wide-visualize.jpg',
        sizes: '1280x800',
        type: 'image/jpeg',
        form_factor: 'wide',
        label: 'Visualize on desktop',
      },
    ],
    icons: [
      {
        src: '/icon-192x192.png?v=20260905',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512x512.png?v=20260905',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512x512.png?v=20260905',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/apple-icon.png?v=20260905',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
