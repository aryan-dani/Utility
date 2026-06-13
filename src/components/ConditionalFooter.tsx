'use client';

import { usePathname } from 'next/navigation';
import Footer from './Footer';

export default function ConditionalFooter() {
  const pathname = usePathname();

  const allowedPaths = ['/', '/syllabus', '/resources', '/gpa', '/srs', '/community', '/install', '/timer'];
  const shouldShow = allowedPaths.some(path => {
    if (path === '/') return pathname === '/';
    return pathname === path || pathname.startsWith(path + '/');
  });

  if (!shouldShow) return null;

  return <Footer />;
}
