import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="flex-1 w-full flex flex-col items-center justify-center min-h-[70vh]">
      <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
      <p className="text-sm font-semibold text-foreground animate-pulse">Loading academic workspace...</p>
    </div>
  );
}
