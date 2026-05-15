'use client';

import { useChat } from '@ai-sdk/react';
import { useState, useEffect, useRef, useMemo } from 'react';
import { Send, Trash2, Bot, User, Brain, ArrowDown, Loader2, Copy, Check } from 'lucide-react';
import { useAcademicStore } from '@/store/academicStore';
import { createClient } from '@/lib/supabase';

const SUGGESTED_PROMPTS = [
  'Explain DBMS normalization with examples',
  'What are OS scheduling algorithms? Compare them.',
  'Create 10 flashcards on Computer Networks basics',
  'Summarize the key topics in Data Structures',
  'Write a Python program for binary search tree',
  'Explain the difference between TCP and UDP',
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted hover:text-foreground transition-all"
      title="Copy"
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

import ReactMarkdown from 'react-markdown';

/* Professional markdown renderer using react-markdown */
function MessageContent({ content }: { content: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-surface prose-pre:border prose-pre:border-border prose-pre:rounded-lg prose-code:text-primary prose-code:bg-primary/5 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
      <ReactMarkdown
        components={{
          pre: ({ children }) => <div className="relative group my-4">{children}</div>,
          code: ({ inline, className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || '');
            const lang = match ? match[1] : '';
            const code = String(children).replace(/\n$/, '');
            
            if (!inline && match) {
              return (
                <div className="rounded-lg overflow-hidden border border-border">
                  <div className="flex items-center justify-between px-3 py-1.5 bg-surface-hover border-b border-border text-[10px] font-mono text-muted uppercase tracking-wider">
                    {lang}
                    <CopyButton text={code} />
                  </div>
                  <pre className="p-3 bg-surface overflow-x-auto m-0">
                    <code className="text-xs font-mono text-foreground whitespace-pre">{code}</code>
                  </pre>
                </div>
              );
            }
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function getMessageContent(m: any): string {
  if (m.content) return m.content;
  if (m.parts && Array.isArray(m.parts)) {
    return m.parts.map((p: any) => p.text || '').join('\n');
  }
  return '';
}

export default function AskClient() {
  const { branch, semester } = useAcademicStore();
  const [subjects, setSubjects] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);

  // Fetch subjects for context
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('subjects')
      .select('name')
      .eq('branch', branch)
      .eq('semester', semester)
      .then(({ data }) => {
        if (data) setSubjects(data.map((s: { name: string }) => s.name).filter((n: string) => n.toUpperCase() !== 'SYLLABUS'));
      });
  }, [branch, semester]);

  const chatHelpers = (useChat as any)({
    api: '/api/chat',
    body: {
      context: { branch, semester, subjects },
    },
  });
  const { 
    messages = [], 
    sendMessage,
    status,
    setMessages,
  } = chatHelpers;

  const [input, setInput] = useState('');
  const isLoading = status === 'streaming' || status === 'loading';
  
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!(input || '').trim() || isLoading) return;
    sendMessage({ 
      text: input,
      context: { branch, semester, subjects } 
    });
    setInput('');
  };
  // Auto-scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Track scroll position for "scroll to bottom" button
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
      setShowScrollDown(!isNearBottom && messages.length > 0);
    };
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [messages.length]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSuggestion = (prompt: string) => {
    setInput(prompt);
    // Small delay to let setInput propagate, then submit
    setTimeout(() => {
      const form = document.getElementById('chat-form') as HTMLFormElement;
      if (form) form.requestSubmit();
    }, 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const form = document.getElementById('chat-form') as HTMLFormElement;
      if (form && (input || '').trim()) form.requestSubmit();
    }
  };

  // Auto-resize textarea
  const handleTextareaInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const t = e.currentTarget;
    t.style.height = 'auto';
    t.style.height = Math.min(t.scrollHeight, 160) + 'px';
  };

  const [randomPrompts, setRandomPrompts] = useState<string[]>([]);
  useEffect(() => {
    const shuffled = [...SUGGESTED_PROMPTS].sort(() => Math.random() - 0.5);
    setRandomPrompts(shuffled.slice(0, 4));
  }, []);

  return (
    <div className="flex-1 w-full flex flex-col max-w-3xl mx-auto h-[calc(100vh-4rem)]">
      {/* Messages area */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 relative">
        {messages.length === 0 ? (
          /* Empty state */
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="w-16 h-16 rounded-3xl bg-surface border border-border flex items-center justify-center mb-6 shadow-sm">
              <Brain className="w-8 h-8 text-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-10 tracking-tight">Academic Assistant</h1>

            {/* Suggested prompts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
              {randomPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleSuggestion(prompt)}
                  className="text-left px-3.5 py-2.5 rounded-xl border border-border bg-card hover:bg-surface text-sm text-muted hover:text-foreground transition-colors leading-snug"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Chat messages */
          <div className="space-y-6">
            {messages.map((m: any) => (
              <div
                key={m.id}
                className={`flex gap-3 group ${m.role === 'user' ? 'justify-end' : ''}`}
              >
                {m.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-lg bg-surface border border-border flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5 text-foreground" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] ${
                    m.role === 'user'
                      ? 'bg-foreground text-background rounded-2xl rounded-br-md px-4 py-2.5'
                      : 'flex-1 min-w-0'
                  }`}
                >
                  {m.role === 'user' ? (
                    <p className="text-sm whitespace-pre-wrap">{getMessageContent(m)}</p>
                  ) : (
                    <div className="relative">
                      <MessageContent content={getMessageContent(m)} />
                      <div className="mt-2">
                        <CopyButton text={getMessageContent(m)} />
                      </div>
                    </div>
                  )}
                </div>

                {m.role === 'user' && (
                  <div className="w-7 h-7 rounded-lg bg-foreground flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5 text-background" />
                  </div>
                )}
              </div>
            ))}

            {/* Streaming indicator */}
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-lg bg-surface border border-border flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5 text-foreground" />
                </div>
                <div className="flex items-center gap-1.5 py-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce [animation-delay:0ms]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce [animation-delay:150ms]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Scroll to bottom FAB */}
        {showScrollDown && (
          <button
            onClick={scrollToBottom}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-card border border-border shadow-popover flex items-center justify-center text-muted hover:text-foreground transition-colors z-10"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Input bar */}
      <div className="border-t border-border bg-background px-4 sm:px-6 py-4">
        <div className="flex items-center gap-2 mb-2">
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="inline-flex items-center gap-1.5 text-[11px] text-muted hover:text-foreground transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              Clear chat
            </button>
          )}
          <span className="text-[11px] text-muted ml-auto">
            {branch} · Sem {semester}
          </span>
        </div>

        <form id="chat-form" onSubmit={handleSubmit} className="relative group">
          <div className="flex items-end gap-2 bg-surface border border-border rounded-2xl p-1.5 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all shadow-sm group-hover:border-border-strong">
            <textarea
              ref={inputRef}
              value={input || ''}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onInput={handleTextareaInput}
              placeholder="Type your question..."
              rows={1}
              className="flex-1 bg-transparent border-0 rounded-xl pl-3 pr-2 py-2.5 text-sm outline-none text-foreground placeholder:text-muted resize-none overflow-hidden"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !(input || '').trim()}
              className="flex-shrink-0 w-9 h-9 rounded-xl bg-foreground text-background flex items-center justify-center disabled:opacity-30 hover:opacity-90 transition-all shadow-sm mb-0.5 mr-0.5"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </form>

        <p className="text-[10px] text-muted mt-2 text-center">
          Powered by Groq · Llama 3.3 70B — Responses may not always be accurate
        </p>
      </div>
    </div>
  );
}
