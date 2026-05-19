import { Suspense } from 'react';
import SrsClient from './SrsClientComponent';

export const metadata = {
  title: 'SRS Flashcards',
  description: 'Spaced Repetition System for rapid memorization and learning.',
};

export default function SrsPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-border border-t-foreground rounded-full animate-spin" />
      </div>
    }>
      <SrsClient />
    </Suspense>
  );
}
