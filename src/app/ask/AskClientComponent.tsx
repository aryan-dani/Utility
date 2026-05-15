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

/* Simple markdown-ish renderer — handles bold, code, code blocks, lists */
function MessageContent({ content }: { content: string }) {
  const blocks = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="text-sm leading-relaxed space-y-2">
      {blocks.map((block, i) => {
        // Fenced code block
        if (block.startsWith('```') && block.endsWith('```')) {
          const lines = block.slice(3, -3).split('\n');
          const lang = lines[0]?.trim() || '';
          const code = (lang ? lines.slice(1) : lines).join('\n').trim();
          return (
            <div key={i} className="relative group">
              {lang && (
                <div className="flex items-center justify-between px-3 py-1.5 bg-surface-hover border border-border rounded-t-lg text-[10px] font-mono text-muted uppercase tracking-wider">
                  {lang}
                  <CopyButton text={code} />
                </div>
              )}
              <pre className={`bg-surface border border-border ${lang ? 'rounded-b-lg border-t-0' : 'rounded-lg'} p-3 overflow-x-auto`}>
                <code className="text-xs font-mono text-foreground whitespace-pre">{code}</code>
              </pre>
            </div>
          );
        }

        // Inline markdown
        return (
          <div key={i}>
            {block.split('\n').map((line, j) => {
              // Headings
              if (/^#{1,3}\s/.test(line)) {
                const level = line.match(/^(#{1,3})/)?.[1].length || 1;
                const text = line.replace(/^#{1,3}\s/, '');
                const Tag = level === 1 ? 'h3' : level === 2 ? 'h4' : 'h5';
                return <Tag key={j} className="font-semibold text-foreground mt-3 mb-1">{text}</Tag>;
              }

              // Bullet points
              if (/^[-*]\s/.test(line.trim())) {
                const text = line.trim().replace(/^[-*]\s/, '');
                return (
                  <div key={j} className="flex gap-2 pl-1">
                    <span className="text-muted mt-1 shrink-0">•</span>
                    <span dangerouslySetInnerHTML={{ __html: inlineMarkdown(text) }} />
                  </div>
                );
              }

              // Numbered lists
              if (/^\d+\.\s/.test(line.trim())) {
                const match = line.trim().match(/^(\d+)\.\s(.*)/);
                if (match) {
                  return (
                    <div key={j} className="flex gap-2 pl-1">
                      <span className="text-muted font-mono text-xs mt-0.5 shrink-0 w-4 text-right">{match[1]}.</span>
                      <span dangerouslySetInnerHTML={{ __html: inlineMarkdown(match[2]) }} />
                    </div>
                  );
                }
              }

              // Empty line
              if (!line.trim()) return <div key={j} className="h-2" />;

              // Normal paragraph
              return (
                <p key={j} dangerouslySetInnerHTML={{ __html: inlineMarkdown(line) }} />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function inlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
    .replace(/`(.+?)`/g, '<code class="px-1 py-0.5 bg-surface border border-border rounded text-xs font-mono">$1</code>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
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
            <div className="w-12 h-12 rounded-2xl bg-surface border border-border flex items-center justify-center mb-5">
              <Brain className="w-6 h-6 text-foreground" />
            </div>
            <h1 className="text-xl font-bold text-foreground mb-2">Ask anything about your courses</h1>
            <p className="text-sm text-muted mb-8 max-w-md">
              Get explanations, create flashcards, summarize topics, or write code — powered by AI.
              {subjects.length > 0 && (
                <span className="block mt-1 text-xs">
                  Context: {branch} Sem {semester} — {subjects.join(', ')}
                </span>
              )}
            </p>

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

        <form id="chat-form" onSubmit={handleSubmit} className="relative">
          <textarea
            ref={inputRef}
            value={input || ''}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onInput={handleTextareaInput}
            placeholder="Ask a question..."
            rows={1}
            className="w-full bg-surface border border-border rounded-xl pl-4 pr-12 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground placeholder:text-muted resize-none overflow-hidden transition-all"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !(input || '').trim()}
            className="absolute right-2 bottom-2 w-8 h-8 rounded-lg bg-foreground text-background flex items-center justify-center disabled:opacity-30 hover:opacity-80 transition-opacity"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>

        <p className="text-[10px] text-muted mt-2 text-center">
          Powered by Groq · Llama 3.3 70B — Responses may not always be accurate
        </p>
      </div>
    </div>
  );
}
