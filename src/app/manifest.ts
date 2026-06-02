import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Utility — Academic OS',
    short_name: 'Utility',
    description: 'A premium academic workspace. Access your syllabus, resources, AI assistant, and planner in one place.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#09090b', // slate-950 or zinc-950 style
    theme_color: '#09090b',
    icons: [
      {
        src: '/api/icon?size=192',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/api/icon?size=512',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/api/icon?size=180',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      }
    ],
  };
}
