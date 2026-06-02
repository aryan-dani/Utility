import { WifiOff } from 'lucide-react';
import Link from 'next/link';

export default function Offline() {
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center text-center px-4">
      <div className="bg-surface border border-border rounded-full p-4 mb-6">
        <WifiOff className="w-8 h-8 text-muted" />
      </div>
      <h1 className="text-2xl font-bold text-foreground mb-2">You're Offline</h1>
      <p className="text-muted max-w-md mb-8">
        It looks like you've lost your internet connection. Some features of Utility may be unavailable until you reconnect.
      </p>
      <Link 
        href="/"
        className="bg-primary text-primary-foreground hover:bg-primary-hover px-6 py-2 rounded-lg text-sm font-medium transition-colors"
      >
        Return to Home
      </Link>
    </div>
  );
}
