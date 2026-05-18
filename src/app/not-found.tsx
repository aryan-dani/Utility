import { FileQuestion, Home } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex-1 w-full flex flex-col items-center justify-center min-h-[70vh] p-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center mb-6 shadow-sm">
        <FileQuestion className="w-8 h-8 text-muted" />
      </div>
      <h2 className="text-2xl font-bold text-foreground mb-2 tracking-tight">Page Not Found</h2>
      <p className="text-muted text-sm max-w-md mb-8 leading-relaxed">
        The academic resource or page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/"
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-foreground text-background text-sm font-semibold hover:opacity-90 transition-all shadow-sm"
      >
        <Home className="w-4 h-4" />
        Return to Dashboard
      </Link>
    </div>
  );
}
