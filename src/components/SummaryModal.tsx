'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { X, Brain, Loader2, Copy, Check, Info, Layers } from 'lucide-react';

interface SummaryModalProps {
  resourceId: string;
  resourceTitle: string;
  onClose: () => void;
}

export default function SummaryModal({ resourceId, resourceTitle, onClose }: SummaryModalProps) {
  const router = useRouter();
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function fetchSummary() {
      try {
        setLoading(true);
        const res = await fetch(`/api/resources/summarize?id=${resourceId}`);
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error || 'Failed to generate summary');
        
        setSummary(data.summary);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchSummary();
  }, [resourceId]);

  const handleCopy = () => {
    if (summary) {
      navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-surface/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Brain className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground line-clamp-1">AI Study Guide</h3>
                <p className="text-[10px] text-muted uppercase font-bold tracking-wider">{resourceTitle}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-surface rounded-full text-muted hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-card">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                >
                  <Loader2 className="w-10 h-10 text-primary opacity-50" />
                </motion.div>
                <h4 className="mt-4 text-base font-semibold text-foreground">Reading & Summarizing...</h4>
                <p className="text-sm text-muted max-w-xs mt-2">
                  Our AI is analyzing the document content to generate a high-density study guide for you.
                </p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                  <Info className="w-6 h-6 text-destructive" />
                </div>
                <h4 className="text-base font-semibold text-foreground">Couldn't Generate Summary</h4>
                <p className="text-sm text-muted mt-2 max-w-sm">{error}</p>
                <button
                  onClick={onClose}
                  className="mt-6 px-4 py-2 bg-surface border border-border rounded-lg text-sm font-medium hover:bg-surface-hover transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-foreground prose-p:text-muted prose-li:text-muted"
              >
                <div className="flex items-center gap-2 mb-6 text-xs font-bold uppercase tracking-widest text-primary bg-primary/5 px-3 py-1.5 rounded-full border border-primary/10 w-fit">
                  AI-Generated Intelligence
                </div>
                
                <div className="markdown-content text-muted-foreground leading-relaxed">
                  <ReactMarkdown
                    components={{
                      h3: ({node, ...props}) => <h3 className="text-foreground font-bold mt-6 mb-3 border-b border-border pb-1" {...props} />,
                      strong: ({node, ...props}) => <strong className="text-foreground font-bold" {...props} />,
                      ul: ({node, ...props}) => <ul className="list-disc pl-5 space-y-2 mb-4" {...props} />,
                      ol: ({node, ...props}) => <ol className="list-decimal pl-5 space-y-2 mb-4" {...props} />,
                      li: ({node, ...props}) => <li className="pl-1" {...props} />,
                      p: ({node, ...props}) => <p className="mb-4 last:mb-0" {...props} />,
                    }}
                  >
                    {summary || ''}
                  </ReactMarkdown>
                </div>
              </motion.div>
            )}
          </div>

          {/* Footer */}
          {!loading && !error && (
            <div className="px-6 py-4 border-t border-border bg-surface/30 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-[10px] text-muted flex items-center gap-1.5 font-medium">
                <Info className="w-3 h-3 shrink-0" />
                Summaries are AI-generated and may occasionally be inaccurate.
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => {
                    onClose();
                    router.push(`/ask?tab=flashcards&topic=${encodeURIComponent(resourceTitle)}`);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-surface border border-border text-foreground hover:bg-surface-hover rounded-lg text-xs font-bold transition-all active:scale-95"
                >
                  <Layers className="w-3.5 h-3.5 text-primary" />
                  Generate Cards
                </button>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-2 px-3 py-1.5 bg-foreground text-background rounded-lg text-xs font-bold hover:opacity-90 transition-all active:scale-95"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied!' : 'Copy Summary'}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
