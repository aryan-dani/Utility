'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback, memo, Children, isValidElement, cloneElement, type ReactNode, type ReactElement, type ComponentPropsWithoutRef } from 'react';
import { 
  Send, 
  Trash2, 
  Bot, 
  User, 
  Brain, 
  ArrowDown, 
  Loader2, 
  Copy, 
  Check, 
  Layers, 
  HelpCircle, 
  RotateCw, 
  CheckCircle2, 
  XCircle, 
  ChevronLeft, 
  ChevronRight,
  BookOpen,
  Plus,
  Pencil,
  Mic,
  Globe,
  FileText,
  X,
  Square,
  Flag,
} from 'lucide-react';
import { useAcademicStore } from '@/store/academicStore';
import { auth } from '@/lib/firebase';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { logActivity } from '@/lib/activity';
import { NotesDisclaimer } from '@/components/NotesDisclaimer';
import { notify } from '@/lib/toast';
import { useSRSStore } from '@/store/srsStore';
import { useSearchParams, useRouter } from 'next/navigation';
import AcademicBreadcrumb from '@/components/AcademicBreadcrumb';
import AppLink from '@/components/ui/AppLink';
import { buildResourcesHref, pageFromSectionLabel } from '@/lib/resourceUrl';
import { Button, ButtonLink, Modal, Select, PageHeader, Segmented, IconButton } from '@/components/ui';
import { SourceCardList, renderWithCitations } from '@/components/ask/SourceCard';
import type { RetrievalSource } from '@/lib/rag/types';
import { stripInvalidCitations, validMarkerSet } from '@/lib/agent/router';
import { authFetch, getAuthHeaders } from '@/lib/authFetch';
import { useWorkspaceResources } from '@/lib/useWorkspaceResources';
import { generateId } from '@/lib/id';

type AskTab = 'chat' | 'flashcards' | 'quiz';

const ASK_TAB_OPTIONS: { value: AskTab; label: string }[] = [
  { value: 'chat', label: 'Chat' },
  { value: 'flashcards', label: 'Flashcards' },
  { value: 'quiz', label: 'Quiz' },
];

/** Shared height so sidebar + chat toolbars share one baseline. */
const ASK_CHROME_ROW =
  'h-11 shrink-0 border-b border-border flex items-center px-3 gap-2';

/** Legacy persisted messages may include a plain `content` field. */
type ChatMessage = UIMessage & { content?: string };

interface SpeechRecognitionResultItem {
  transcript: string;
}

interface SpeechRecognitionResult {
  0: SpeechRecognitionResultItem;
  length: number;
}

interface SpeechRecognitionResultList {
  0: SpeechRecognitionResult;
  length: number;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: SpeechRecognition, ev: Event) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionWindow extends Window {
  SpeechRecognition?: new () => SpeechRecognition;
  webkitSpeechRecognition?: new () => SpeechRecognition;
}

type MarkdownCodeProps = ComponentPropsWithoutRef<'code'> & { inline?: boolean };

const SUGGESTED_PROMPTS = [
  'Explain overfitting vs underfitting in Machine Learning with examples',
  'How do Graph Neural Networks embed nodes? Keep it exam-oriented.',
  'Walk through Matplotlib vs Seaborn for a DVP dashboard assignment',
  'Compare FCFS, SJF, and Round Robin OS scheduling with a small table',
  'Create 10 flashcards on OS deadlock prevention and Banker’s algorithm',
  'Outline UI/UX heuristic evaluation steps for a Sem 5 mini-project',
];

function ReportButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className="opacity-100 md:opacity-0 md:group-hover:opacity-100 min-h-11 min-w-11 md:min-h-0 md:min-w-0 md:p-1"
      title="Report this response"
      aria-label="Report this response"
    >
      <Flag className="w-3 h-3" />
    </Button>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={copy}
      className="opacity-100 md:opacity-0 md:group-hover:opacity-100 min-h-11 min-w-11 md:min-h-0 md:min-w-0 md:p-1"
      title="Copy"
      aria-label={copied ? "Copied" : "Copy"}
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
    </Button>
  );
}

/** Close an unclosed fenced code block so streaming markdown does not swallow the rest of the reply. */
function stabilizeStreamingMarkdown(content: string): string {
  const fenceCount = content.match(/```/g)?.length ?? 0;
  if (fenceCount % 2 === 1) {
    return `${content}\n\`\`\``;
  }
  return content;
}

function injectCitationChips(
  children: ReactNode,
  onCitationClick?: (marker: string) => void,
): ReactNode {
  if (!onCitationClick) return children;
  return Children.map(children, (child) => {
    if (typeof child === "string") {
      return <>{renderWithCitations(child, onCitationClick)}</>;
    }
    if (isValidElement(child) && (child as ReactElement<{ children?: ReactNode }>).props.children != null) {
      const el = child as ReactElement<{ children?: ReactNode }>;
      return cloneElement(el, {
        children: injectCitationChips(el.props.children, onCitationClick),
      });
    }
    return child;
  });
}

/* Professional markdown renderer using react-markdown */
const MessageContent = memo(function MessageContent({
  content,
  showCursor,
  onCitationClick,
}: {
  content: string;
  showCursor?: boolean;
  onCitationClick?: (marker: string) => void;
}) {
  const markdown = showCursor ? stabilizeStreamingMarkdown(content) : content;
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-surface prose-pre:border prose-pre:border-border prose-pre:rounded-lg prose-code:text-primary prose-code:bg-primary/5 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: ({ children }) => <div className="relative group my-4">{children}</div>,
          code: ({ inline, className, children, ...props }: MarkdownCodeProps) => {
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
          p: ({ children }) => (
            <p>{injectCitationChips(children, onCitationClick)}</p>
          ),
          li: ({ children }) => (
            <li>{injectCitationChips(children, onCitationClick)}</li>
          ),
          td: ({ children }) => (
            <td className="px-4 py-3 text-xs text-foreground/75 border-b border-border/40 font-semibold leading-relaxed">
              {injectCitationChips(children, onCitationClick)}
            </td>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-6 border border-border bg-card shadow-sm rounded-xl">
              <table className="min-w-full divide-y divide-border/60 text-xs">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-surface/50 font-bold uppercase tracking-wider text-muted">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-4 py-3.5 text-left text-xs font-bold text-foreground/85 border-b border-border/60">
              {children}
            </th>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-surface/20 transition-colors">
              {children}
            </tr>
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
      {showCursor ? (
        <span
          className="inline-block w-[2px] h-[1em] ml-0.5 align-text-bottom bg-foreground animate-pulse"
          aria-hidden
        />
      ) : null}
    </div>
  );
});

function getMessageContent(m: ChatMessage): string {
  if (m.content) return m.content;
  if (m.parts && Array.isArray(m.parts)) {
    return m.parts.map((p) => (p.type === 'text' ? p.text : '')).join('\n');
  }
  return '';
}

interface Flashcard {
  id: string;
  question: string;
  answer: string;
}

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  citations?: string[];
}

function AddToSrsButton({ cards, defaultName }: { cards: Flashcard[]; defaultName: string }) {
  const { decks, createDeck, addMultipleCards, initStore } = useSRSStore();
  const [isOpen, setIsOpen] = useState(false);
  const [added, setAdded] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initStore();
  }, [initStore]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleAddToDeck = (deckId: string) => {
    const formatted = cards.map(c => ({ question: c.question, answer: c.answer }));
    addMultipleCards(deckId, formatted);
    setAdded(true);
    setIsOpen(false);
    notify.success('Added cards to SRS deck');
    setTimeout(() => setAdded(false), 2000);
  };

  const handleCreateAndAdd = () => {
    const newDeck = createDeck(defaultName);
    const formatted = cards.map(c => ({ question: c.question, answer: c.answer }));
    addMultipleCards(newDeck.id, formatted);
    setAdded(true);
    setIsOpen(false);
    notify.success(`Created deck "${defaultName}" and added cards`);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div ref={dropdownRef} className="relative shrink-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={added}
        className="flex items-center gap-1.5 px-4 py-2 border border-border hover:bg-surface text-xs font-semibold rounded-xl text-foreground transition-all shadow-xs whitespace-nowrap"
      >
        {added ? (
          <>
            <Check className="w-3.5 h-3.5 text-foreground" />
            Saved to SRS!
          </>
        ) : (
          <>
            <Plus className="w-3.5 h-3.5 text-muted shrink-0" />
            Add to SRS
          </>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 bottom-full mb-2 w-56 bg-card border border-border shadow-popover rounded-2xl overflow-hidden z-[100] p-1.5 flex flex-col gap-0.5">
          <div className="px-3 py-1.5 border-b border-border/60 mb-1">
            <p className="text-[9px] uppercase font-extrabold tracking-wider text-muted">Select SRS Deck</p>
          </div>
          {decks.map(deck => (
            <button
              key={deck.id}
              onClick={() => handleAddToDeck(deck.id)}
              className="w-full text-left px-3 py-2 text-xs font-semibold rounded-xl hover:bg-surface text-foreground transition-colors"
            >
              {deck.name}
            </button>
          ))}
          <button
            onClick={handleCreateAndAdd}
            className="w-full text-left px-3 py-2 text-xs font-bold rounded-xl text-primary bg-surface border border-border/80 hover:bg-surface-hover transition-colors mt-1"
          >
            + Create &quot;{defaultName.slice(0, 16)}...&quot;
          </button>
        </div>
      )}
    </div>
  );
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
}

function createInitialChatSession(): ChatSession {
  const initialId = generateId();
  return {
    id: initialId,
    title: 'New Chat',
    messages: [],
    createdAt: new Date().toISOString(),
  };
}

function loadChatSessionsFromStorage(): { sessions: ChatSession[]; activeSessionId: string } {
  const saved = localStorage.getItem('utility_chat_sessions');
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as ChatSession[];
      if (parsed.length > 0) {
        return { sessions: parsed, activeSessionId: parsed[0].id };
      }
    } catch (e) {
      console.error('Failed to parse chat sessions', e);
    }
  }
  const session = createInitialChatSession();
  return { sessions: [session], activeSessionId: session.id };
}

const EMPTY_ARRAY: ChatMessage[] = [];

export default function AskClient() {
  const { academicYear, branch, semester } = useAcademicStore();
  const {
    resources,
    subjects,
    loading: catalogLoading,
  } = useWorkspaceResources();
  const [activeTab, setActiveTab] = useState<AskTab>('chat');

  const searchParams = useSearchParams();
  const router = useRouter();

  // Grounded Document Chat States
  const [selectedResourceId, setSelectedResourceId] = useState<string>('all');
  void catalogLoading;

  // Speech Recognition States
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Chat History / Sessions - empty until after mount (avoids SSR generateId/localStorage mismatch)
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionsReady, setSessionsReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState('');
  const [reportReason, setReportReason] = useState('inaccurate');
  const [reportSending, setReportSending] = useState(false);

  // Chat refs & state
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const [showScrollDown, setShowScrollDown] = useState(false);

  const focusOptions = useMemo(
    () => [
      { value: 'all' as const, label: 'Entire Library (RAG Search)' },
      ...resources.map((res) => ({
        value: res.id,
        label: res.title,
      })),
    ],
    [resources],
  );

  useEffect(() => {
    queueMicrotask(() => {
      const loaded = loadChatSessionsFromStorage();
      setSessions(loaded.sessions);
      setActiveSessionId(loaded.activeSessionId);
      setSessionsReady(true);
    });
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const apply = () => setSidebarOpen(mq.matches);
    queueMicrotask(apply);
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const [flashcardTopic, setFlashcardTopic] = useState('');
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isGeneratingFlashcards, setIsGeneratingFlashcards] = useState(false);
  const [knownCards, setKnownCards] = useState<Record<string, boolean>>({});
  const [isPublishingDeck, setIsPublishingDeck] = useState(false);
  const [publishedDeck, setPublishedDeck] = useState(false);

  // Quiz state
  const [quizTopic, setQuizTopic] = useState('');
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  const [input, setInput] = useState('');
  const [assistantSources, setAssistantSources] = useState<RetrievalSource[]>([]);
  const [scopeWidened, setScopeWidened] = useState(false);

  // Workspace catalog is loaded via useWorkspaceResources (shared module cache)

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const speechWindow = window as SpeechRecognitionWindow;
      const SpeechRecognitionCtor =
        speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
      if (SpeechRecognitionCtor) {
        const rec = new SpeechRecognitionCtor();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = 'en-US';

        rec.onstart = () => setIsListening(true);
        rec.onend = () => setIsListening(false);
        rec.onresult = (event: SpeechRecognitionEvent) => {
          const transcript = event.results[0][0].transcript;
          if (transcript) {
            setInput(prev => (prev ? prev + ' ' : '') + transcript);
            notify.success("Voice transcribed");
          }
        };
        rec.onerror = (e: Event) => {
          console.error("Speech recognition error", e);
          setIsListening(false);
        };
        recognitionRef.current = rec;
      }
    }
    return () => {
      try {
        recognitionRef.current?.abort?.();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    };
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      notify.error("Web Speech API is not supported in this browser.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  const chatBody = useMemo(() => ({
    context: { 
      academicYear,
      branch, 
      semester, 
      subjects, 
      resourceId: selectedResourceId !== 'all' ? selectedResourceId : undefined 
    },
  }), [academicYear, branch, semester, subjects, selectedResourceId]);

  const chatTransport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        headers: async (): Promise<Record<string, string>> => getAuthHeaders(),
        body: chatBody,
      }),
    [chatBody],
  );

  const chatSessionKey = useMemo(() => {
    return activeSessionId ? `${activeSessionId}-${selectedResourceId}-${academicYear}-${branch}-${semester}` : undefined;
  }, [activeSessionId, selectedResourceId, academicYear, branch, semester]);

  const initialMessages = useMemo(() => {
    if (!activeSessionId) return EMPTY_ARRAY;
    const session = sessions.find(s => s.id === activeSessionId);
    return session ? session.messages : EMPTY_ARRAY;
  }, [activeSessionId, sessions]);

  const chatHelpers = useChat({
    id: chatSessionKey,
    messages: initialMessages,
    transport: chatTransport,
    onData: (dataPart: { type?: string; data?: unknown }) => {
      if (dataPart?.type === 'data-sources' && Array.isArray(dataPart.data)) {
        setAssistantSources(dataPart.data as RetrievalSource[]);
      }
      if (dataPart?.type === 'data-scope') {
        const scope = dataPart.data as { widened?: boolean };
        setScopeWidened(Boolean(scope?.widened));
      }
    },
  });

  const { 
    messages = [], 
    sendMessage,
    regenerate,
    status,
    setMessages,
    stop,
  } = chatHelpers;

  const isLoading = status === 'submitted' || status === 'streaming';
  const lastScrubbedMsgRef = useRef<string | null>(null);

  const openCitation = (marker: string) => {
    const source = assistantSources.find(
      (s) => s.marker === marker || s.marker === `S${marker.replace(/^S/i, "")}`,
    );
    if (!source?.resource_id) {
      notify.message("Source not available");
      return;
    }
    const page = pageFromSectionLabel(source.section_label);
    const href = buildResourcesHref({
      academicYear,
      branch,
      semester,
      subject: source.subject_name,
      view: source.resource_id,
      page,
    });
    router.push(href);
  };

  // Scrub invalid citation markers once the assistant message finishes (matches cache path).
  useEffect(() => {
    if (status !== 'ready' || messages.length === 0) return;
    const last = messages[messages.length - 1] as { id?: string; role?: string; parts?: Array<{ type?: string; text?: string }>; content?: string };
    if (last?.role !== 'assistant') return;
    const msgId = last.id || String(messages.length);
    if (lastScrubbedMsgRef.current === msgId) return;

    const markers = validMarkerSet(assistantSources);
    const scrubPartText = (text: string) => stripInvalidCitations(text, markers);
    let changed = false;

    if (Array.isArray(last.parts)) {
      const nextParts = last.parts.map((p) => {
        if (p?.type === 'text' && typeof p.text === 'string') {
          const cleaned = scrubPartText(p.text);
          if (cleaned !== p.text) {
            changed = true;
            return { ...p, text: cleaned };
          }
        }
        return p;
      });
      if (changed) {
        lastScrubbedMsgRef.current = msgId;
        setMessages((prev: typeof messages) => {
          const copy = [...prev];
          copy[copy.length - 1] = {
            ...copy[copy.length - 1],
            parts: nextParts as ChatMessage['parts'],
          };
          return copy;
        });
      } else {
        lastScrubbedMsgRef.current = msgId;
      }
    } else if (typeof last.content === 'string') {
      const cleaned = scrubPartText(last.content);
      if (cleaned !== last.content) {
        lastScrubbedMsgRef.current = msgId;
        setMessages((prev: typeof messages) => {
          const copy = [...prev];
          copy[copy.length - 1] = { ...copy[copy.length - 1], content: cleaned };
          return copy;
        });
      } else {
        lastScrubbedMsgRef.current = msgId;
      }
    }
  }, [status, messages, assistantSources, setMessages]);

  // Load chat sessions on mount - lazy useState initializer above

  const displaySessions = useMemo(() => {
    if (!activeSessionId || (status !== 'ready' && status !== 'error')) return sessions;
    return sessions.map((s) => {
      if (s.id !== activeSessionId) return s;
      let title = s.title;
      if (title === 'New Chat' && messages.length > 0) {
        const firstUserMsg = messages.find((m) => m.role === 'user');
        if (firstUserMsg) {
          const content = getMessageContent(firstUserMsg);
          if (content) {
            title = content.slice(0, 30) + (content.length > 30 ? '...' : '');
          }
        }
      }
      return { ...s, messages, title };
    });
  }, [sessions, activeSessionId, messages, status]);

  useEffect(() => {
    if (!sessionsReady || !activeSessionId) return;
    if (status !== 'ready' && status !== 'error') return;
    const session = sessions.find((s) => s.id === activeSessionId);
    if (!session) return;
    const merged = displaySessions;
    if (JSON.stringify(session.messages) === JSON.stringify(messages)) return;
    localStorage.setItem('utility_chat_sessions', JSON.stringify(merged));
  }, [sessionsReady, activeSessionId, status, sessions, messages, displaySessions]);

  // Save sessions helper
  const saveSessions = (updated: ChatSession[]) => {
    setSessions(updated);
    localStorage.setItem('utility_chat_sessions', JSON.stringify(updated));
  };

  // Sync current messages back to active session - persisted via localStorage effect above

  const handleNewChat = () => {
    const newId = generateId();
    const newSession: ChatSession = {
      id: newId,
      title: 'New Chat',
      messages: [],
      createdAt: new Date().toISOString()
    };
    saveSessions([newSession, ...sessions]);
    setActiveSessionId(newId);
  };

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = sessions.filter(s => s.id !== sessionId);
    saveSessions(updated);
    if (activeSessionId === sessionId) {
      if (updated.length > 0) {
        setActiveSessionId(updated[0].id);
      } else {
        const newId = generateId();
        const newSession = {
          id: newId,
          title: 'New Chat',
          messages: [],
          createdAt: new Date().toISOString()
        };
        saveSessions([newSession]);
        setActiveSessionId(newId);
      }
    }
  };

  const handleRenameSession = (sessionId: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newTitle = prompt('Rename Chat:', currentTitle);
    if (newTitle && newTitle.trim()) {
      const updated = sessions.map(s => s.id === sessionId ? { ...s, title: newTitle.trim() } : s);
      saveSessions(updated);
    }
  };

  const handleSwitchSession = (sessionId: string) => {
    const merged = displaySessions;
    setSessions(merged);
    localStorage.setItem('utility_chat_sessions', JSON.stringify(merged));
    const session = merged.find(s => s.id === sessionId);
    if (session) {
      setActiveSessionId(sessionId);
    }
  };

  const searchParamsKey = searchParams.toString();
  const [prevSearchParamsKey, setPrevSearchParamsKey] = useState(searchParamsKey);
  if (prevSearchParamsKey !== searchParamsKey) {
    setPrevSearchParamsKey(searchParamsKey);
    const tab = searchParams.get('tab');
    const topic = searchParams.get('topic');
    const prompt = searchParams.get('prompt');
    if (tab === 'flashcards' || tab === 'quiz' || tab === 'chat') {
      setActiveTab(tab);
    }
    if (topic) {
      if (tab === 'flashcards') {
        setFlashcardTopic(topic);
      } else if (tab === 'quiz') {
        setQuizTopic(topic);
      }
    }
    if (prompt && tab === 'chat') {
      setInput(prompt);
    }
  }

  // Auto-resize textarea when input state updates (handles both programmatic set and typing)
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 160) + 'px';
    }
  }, [input]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!(input || '').trim() || isLoading) return;

    if (!auth.currentUser) {
      notify.error('Please sign in to use Ask AI.');
      return;
    }

    stickToBottomRef.current = true;
    sendMessage({ text: input });
    logActivity('ai_prompt', 1);
    setInput('');
  };

  // Keep the transcript pinned to the chat scroller - never the window.
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || activeTab !== 'chat') return;

    const handleScroll = () => {
      const gap = container.scrollHeight - container.scrollTop - container.clientHeight;
      const atBottom = gap < 96;
      stickToBottomRef.current = atBottom;
      setShowScrollDown(!atBottom && container.scrollHeight > container.clientHeight);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [activeTab]);

  useLayoutEffect(() => {
    if (activeTab !== 'chat') return;
    const container = scrollContainerRef.current;
    if (!container) return;

    const content = container.querySelector('[data-chat-log]');
    if (!content) return;

    const snap = () => {
      if (!stickToBottomRef.current) return;
      container.scrollTop = container.scrollHeight;
    };

    snap();
    const observer = new ResizeObserver(snap);
    observer.observe(content);
    return () => observer.disconnect();
  }, [activeTab, messages.length]);

  const scrollToBottom = () => {
    stickToBottomRef.current = true;
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
    setShowScrollDown(false);
  };

  const handleSuggestion = (prompt: string) => {
    setInput(prompt);
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

  const handleTextareaInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const t = e.currentTarget;
    t.style.height = 'auto';
    t.style.height = Math.min(t.scrollHeight, 160) + 'px';
  };

  const [randomPrompts, setRandomPrompts] = useState(() =>
    SUGGESTED_PROMPTS.slice(0, 4),
  );
  useEffect(() => {
    queueMicrotask(() => {
      const shuffled = [...SUGGESTED_PROMPTS].sort(() => Math.random() - 0.5);
      setRandomPrompts(shuffled.slice(0, 4));
    });
  }, []);

  // Keep the document from growing extra viewports while the transcript streams.
  useEffect(() => {
    const { documentElement, body } = document;
    const prev = {
      htmlOverflow: documentElement.style.overflow,
      bodyOverflow: body.style.overflow,
      htmlOverscroll: documentElement.style.overscrollBehavior,
      bodyOverscroll: body.style.overscrollBehavior,
    };
    documentElement.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    documentElement.style.overscrollBehavior = 'none';
    body.style.overscrollBehavior = 'none';
    return () => {
      documentElement.style.overflow = prev.htmlOverflow;
      body.style.overflow = prev.bodyOverflow;
      documentElement.style.overscrollBehavior = prev.htmlOverscroll;
      body.style.overscrollBehavior = prev.bodyOverscroll;
    };
  }, []);

  // Generate Flashcards API Call
  const handleGenerateFlashcards = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!flashcardTopic.trim() || isGeneratingFlashcards) return;
    await Promise.resolve();
    setIsGeneratingFlashcards(true);
    setFlashcards([]);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setKnownCards({});

    try {
      if (!auth.currentUser) {
        notify.error('Please sign in to generate flashcards.');
        return;
      }
      const res = await authFetch('/api/study', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'flashcards',
          topic: flashcardTopic,
          context: { academicYear, branch, semester, subjects }
        }),
      });
      if (res.status === 401) {
        notify.error('Please sign in to generate flashcards.');
        return;
      }
      const data = await res.json();
      if (data.flashcards) {
        setFlashcards(data.flashcards);
        logActivity('flashcard_generated', data.flashcards.length);
      }
    } catch (err) {
      console.error('Failed to generate flashcards:', err);
      notify.error('Failed to generate flashcards. Please try again.');
    } finally {
      setIsGeneratingFlashcards(false);
    }
  }, [flashcardTopic, isGeneratingFlashcards, academicYear, branch, semester, subjects]);

  const handlePublishDeck = async () => {
    if (flashcards.length === 0 || isPublishingDeck) return;
    setIsPublishingDeck(true);
    try {
      if (!auth.currentUser) {
        notify.error("Sign in to publish a deck.");
        return;
      }
      const authorName = auth.currentUser.email
        ? auth.currentUser.email.split('@')[0]
        : 'Anonymous Scholar';

      await notify.promise(
        (async () => {
          const res = await authFetch('/api/community-decks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: flashcardTopic || 'Academic Flashcards',
              branch,
              semester,
              author_name: authorName,
              flashcards,
            }),
          });
          if (!res.ok) throw new Error(await res.text());
          setPublishedDeck(true);
          logActivity('community_deck_published', 1);
        })(),
        {
          loading: 'Publishing deck…',
          success: 'Deck published to Community Vault',
          error: 'Could not publish deck',
          id: 'ask-publish-deck',
        }
      );
      setTimeout(() => setPublishedDeck(false), 3000);
    } catch {
      // notify.promise already surfaced the error
    } finally {
      setIsPublishingDeck(false);
    }
  };

  // Generate Quiz API Call
  const handleGenerateQuiz = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!quizTopic.trim() || isGeneratingQuiz) return;
    await Promise.resolve();
    setIsGeneratingQuiz(true);
    setQuizQuestions([]);
    setSelectedAnswers({});
    setQuizSubmitted(false);

    try {
      if (!auth.currentUser) {
        notify.error('Please sign in to generate a quiz.');
        return;
      }
      const res = await authFetch('/api/study', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'quiz',
          topic: quizTopic,
          context: { academicYear, branch, semester, subjects }
        }),
      });
      if (res.status === 401) {
        notify.error('Please sign in to generate a quiz.');
        return;
      }
      const data = await res.json();
      if (data.quiz) {
        setQuizQuestions(data.quiz);
        logActivity('quiz_generated', data.quiz.length);
      }
    } catch (err) {
      console.error('Failed to generate quiz:', err);
      notify.error('Failed to generate quiz. Please try again.');
    } finally {
      setIsGeneratingQuiz(false);
    }
  }, [quizTopic, isGeneratingQuiz, academicYear, branch, semester, subjects]);

  const autoFiredRef = useRef(false);
  useEffect(() => {
    if (autoFiredRef.current) return;
    if (searchParams.get('auto') !== 'true') return;
    const topic = searchParams.get('topic');
    if (!topic?.trim()) return;
    const tab = searchParams.get('tab');
    if (tab === 'flashcards') {
      if (flashcardTopic !== topic) return;
      autoFiredRef.current = true;
      void Promise.resolve().then(() => {
        void handleGenerateFlashcards();
      });
    } else if (tab === 'quiz') {
      if (quizTopic !== topic) return;
      autoFiredRef.current = true;
      void Promise.resolve().then(() => {
        void handleGenerateQuiz();
      });
    }
  }, [searchParams, flashcardTopic, quizTopic, handleGenerateFlashcards, handleGenerateQuiz]);

  const calculateQuizScore = () => {
    let correct = 0;
    quizQuestions.forEach((q) => {
      if (selectedAnswers[q.id] === q.correctIndex) correct++;
    });
    return correct;
  };

  const submitAiReport = async () => {
    if (!auth.currentUser) {
      notify.error('Sign in to report a response.');
      return;
    }
    if (!reportText.trim()) return;
    setReportSending(true);
    try {
      const res = await authFetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'ai-report',
          reason: reportReason,
          message: reportText.slice(0, 2000),
        }),
      });
      if (!res.ok) {
        throw new Error('Could not send the report.');
      }
      notify.success('Thanks, we received your report.');
      setReportOpen(false);
      setReportText('');
    } catch (err) {
      notify.error(err, 'Could not send the report.');
    } finally {
      setReportSending(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 w-full mx-auto grid grid-rows-[auto_minmax(0,1fr)] overflow-hidden overscroll-none h-full max-h-full page-gutter">
      {/* Top Navigation Tabs */}
      <div className="border-b border-border px-4 sm:px-6 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
        <div className="flex flex-col gap-1.5 min-w-0">
          <AcademicBreadcrumb
            branch={branch}
            semester={semester}
            crumbs={[
              { label: "Ask AI" },
              {
                label: "Vault",
                href: buildResourcesHref({ academicYear, branch, semester }),
              },
            ]}
          />
          <Segmented
            value={activeTab}
            options={ASK_TAB_OPTIONS}
            onChange={setActiveTab}
            size="sm"
            aria-label="Ask modes"
            className="w-fit max-w-full"
          />
        </div>

        <ButtonLink
          href={`/syllabus?year=${encodeURIComponent(academicYear)}&branch=${branch}&semester=${semester}`}
          variant="secondary"
          size="sm"
          className="self-start sm:self-auto"
        >
          Syllabus
        </ButtonLink>
      </div>

      {/* Tab 1: Chat Assistant */}
      {activeTab === 'chat' && (
        <div className="min-h-0 min-w-0 flex overflow-hidden w-full relative">
          
          {/* Chat Sessions - overlay drawer on mobile, inline rail on md+ */}
          {sidebarOpen && (
            <>
              <button
                type="button"
                aria-label="Close chat history"
                onClick={() => setSidebarOpen(false)}
                className="absolute inset-0 bg-black/50 z-30 lg:hidden"
              />
              <div className="absolute lg:relative inset-y-0 left-0 z-40 lg:z-auto w-[min(16rem,85vw)] lg:w-64 min-h-0 border-r border-border bg-background-subtle flex flex-col shrink-0 shadow-popover lg:shadow-none">
              <div className={`${ASK_CHROME_ROW} justify-between bg-surface/30`}>
                <span className="text-[10px] uppercase font-bold text-muted tracking-wider">
                  Chat History
                </span>
                <div className="flex items-center gap-1">
                <IconButton
                  variant="secondary"
                  size="sm"
                  label="New chat"
                  onClick={handleNewChat}
                >
                  <Plus className="w-3.5 h-3.5" />
                </IconButton>
                <IconButton
                  variant="secondary"
                  size="sm"
                  label="Close chat history"
                  onClick={() => setSidebarOpen(false)}
                  className="lg:hidden"
                >
                  <X className="w-3.5 h-3.5" />
                </IconButton>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar">
                {displaySessions.map(s => {
                  const isActive = s.id === activeSessionId;
                  return (
                    <div
                      key={s.id}
                      onClick={() => handleSwitchSession(s.id)}
                      className={`group/session w-full flex items-center justify-between px-2.5 h-9 rounded-lg text-xs font-semibold cursor-pointer transition-colors border ${
                        isActive 
                          ? 'bg-card border-border-strong text-foreground shadow-xs' 
                          : 'border-transparent text-muted hover:text-foreground hover:bg-card/80 hover:border-border'
                      }`}
                    >
                      <span className="truncate min-w-0 flex-1 mr-1.5">{s.title}</span>
                      <div className="flex items-center gap-0.5 opacity-100 md:opacity-0 md:group-hover/session:opacity-100 transition-opacity shrink-0">
                        <IconButton
                          variant="ghost"
                          size="sm"
                          label="Rename chat"
                          onClick={(e) => handleRenameSession(s.id, s.title, e)}
                          className={isActive ? 'text-foreground/75' : undefined}
                        >
                          <Pencil className="w-3 h-3" />
                        </IconButton>
                        <IconButton
                          variant="ghost"
                          size="sm"
                          label="Delete chat"
                          onClick={(e) => handleDeleteSession(s.id, e)}
                          className={`hover:text-destructive ${isActive ? 'text-foreground/75' : ''}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </IconButton>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            </>
          )}

          {/* Main Chat Area */}
          <div className="flex-1 min-h-0 min-w-0 grid grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
            
            {/* Top Toolbar: Sidebar toggle & grounded document selector */}
            <div className={`${ASK_CHROME_ROW} justify-between flex-nowrap bg-surface/30 sm:px-4`}>
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <IconButton
                  variant="secondary"
                  size="sm"
                  label={sidebarOpen ? "Hide chat history" : "Show chat history"}
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                >
                  <ChevronLeft className={`w-3.5 h-3.5 transition-transform ${sidebarOpen ? '' : 'rotate-180'}`} />
                </IconButton>
                
                <div className="h-4 w-px bg-border hidden sm:block shrink-0" />

                {/* Grounded Document Selector */}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-[10px] uppercase font-bold text-muted select-none hidden sm:inline shrink-0 tracking-wider">
                    AI Focus
                  </span>
                  <Select
                    value={selectedResourceId}
                    options={focusOptions}
                    onChange={setSelectedResourceId}
                    icon={selectedResourceId === 'all' ? Globe : FileText}
                    size="sm"
                    searchable
                    searchPlaceholder="Search documents…"
                    className="w-full max-w-full sm:max-w-xs"
                  />
                </div>
              </div>

              {selectedResourceId !== 'all' && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-foreground bg-foreground/5 px-1.5 py-0.5 rounded border border-foreground/15 shrink-0 hidden sm:inline">
                  Grounded
                </span>
              )}
            </div>

            {status === 'error' && (
              <div
                role="alert"
                className="mx-4 sm:mx-6 mt-3 shrink-0 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
              >
                Something went wrong generating a reply. Check your connection and try again.
              </div>
            )}

            <div ref={scrollContainerRef} className="min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-4 sm:px-6 py-6 relative [overflow-anchor:none]">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-4">
                  <div className="w-16 h-16 bg-surface border border-border flex items-center justify-center mb-6 rounded-2xl shadow-sm">
                    <Brain className="w-8 h-8 text-foreground" />
                  </div>
                  <PageHeader
                    className="mb-4 sm:flex-col sm:items-center [&_p]:hidden"
                    title="Academic AI Assistant"
                  />
                  <NotesDisclaimer compact className="mb-3 max-w-md mx-auto" />
                  <p className="text-xs text-muted mb-8 max-w-md mx-auto leading-relaxed">
                    Ask AI can be wrong. Report a response from any answer.{' '}
                    <AppLink href="/privacy" className="text-foreground underline underline-offset-4">
                      Privacy
                    </AppLink>
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-border/60 rounded-xl overflow-hidden border border-border/70 shadow-sm w-full max-w-lg">
                    {randomPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => handleSuggestion(prompt)}
                        className="text-left px-3.5 py-2.5 bg-card hover:bg-surface/50 text-sm text-muted hover:text-foreground transition-all duration-200 leading-snug w-full h-full"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-6" data-chat-log>
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex gap-3 group/msg ${m.role === 'user' ? 'justify-end' : ''}`}
                    >
                      {m.role === 'assistant' && (
                        <div className="w-7 h-7 rounded-lg bg-surface border border-border flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                          <Bot className="w-3.5 h-3.5 text-foreground" />
                        </div>
                      )}

                      <div
                        className={`${
                          m.role === 'user'
                            ? 'w-fit max-w-[min(85%,28rem)] bg-foreground text-background rounded-2xl rounded-br-md px-3.5 py-2 shadow-sm'
                            : 'max-w-[85%] bg-card border border-border/80 rounded-2xl px-4 py-3 shadow-xs relative group/bubble'
                        }`}
                      >
                        {m.role === 'user' ? (
                          <p className="text-sm whitespace-pre-wrap">{getMessageContent(m)}</p>
                        ) : (
                          <div className="relative">
                            <MessageContent 
                              content={getMessageContent(m)} 
                              showCursor={isLoading && m.id === messages[messages.length - 1].id}
                              onCitationClick={
                                m.id === messages[messages.length - 1]?.id
                                  ? openCitation
                                  : undefined
                              }
                            />
                            {m.id === messages[messages.length - 1]?.id && assistantSources.length > 0 && (
                              <SourceCardList
                                sources={assistantSources}
                                widened={scopeWidened}
                                branch={branch}
                                semester={semester}
                                onCitationClick={openCitation}
                              />
                            )}
                            <div className="absolute top-0 right-0 flex items-center opacity-100 md:opacity-0 md:group-hover/bubble:opacity-100 transition-opacity">
                              <ReportButton
                                disabled={isLoading && m.id === messages[messages.length - 1]?.id}
                                onClick={() => {
                                  setReportText(getMessageContent(m).slice(0, 2000));
                                  setReportReason('inaccurate');
                                  setReportOpen(true);
                                }}
                              />
                              <CopyButton text={getMessageContent(m)} />
                            </div>
                          </div>
                        )}
                      </div>

                      {m.role === 'user' && (
                        <div className="w-7 h-7 rounded-lg bg-foreground flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                          <User className="w-3.5 h-3.5 text-background" />
                        </div>
                      )}
                    </div>
                  ))}

                  {isLoading && messages[messages.length - 1]?.role === 'user' && (
                    <div className="flex gap-3">
                      <div className="w-7 h-7 rounded-lg bg-surface border border-border flex items-center justify-center shrink-0 shadow-xs">
                        <Bot className="w-3.5 h-3.5 text-foreground" />
                      </div>
                      <div className="flex items-center gap-1.5 py-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce [animation-delay:0ms]" />
                        <div className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce [animation-delay:150ms]" />
                        <div className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce [animation-delay:300ms]" />
                      </div>
                    </div>
                  )}

                </div>
              )}

              {showScrollDown && (
                <button
                  onClick={scrollToBottom}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-card border border-border shadow-popover flex items-center justify-center text-muted hover:text-foreground transition-colors z-10"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="border-t border-border px-4 sm:px-6 py-4 shrink-0 md:safe-bottom">
              {messages.length > 0 && (
                <div className="flex items-center gap-4 mb-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => regenerate()}
                    className="text-[11px] h-auto min-h-0 px-0"
                  >
                    <RotateCw className="w-3 h-3" />
                    Regenerate
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMessages([])}
                    className="text-[11px] h-auto min-h-0 px-0 hover:text-destructive"
                  >
                    <Trash2 className="w-3 h-3" />
                    Clear chat
                  </Button>
                </div>
              )}

              <form id="chat-form" onSubmit={handleSubmit} className="relative group max-w-4xl mx-auto w-full">
                <div className="flex items-end gap-2 bg-card border border-border p-2 rounded-2xl transition-all duration-300 shadow-md focus-within:border-border-strong focus-within:shadow-lg focus-within:ring-4 focus-within:ring-foreground/[0.02]">
                  <textarea
                    ref={inputRef}
                    value={input || ''}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    onInput={handleTextareaInput}
                    placeholder={selectedResourceId !== 'all' ? "Ask about this document..." : "Type your question..."}
                    rows={1}
                    className="flex-1 bg-transparent border-0 rounded-xl pl-3 pr-2 py-2.5 text-sm outline-none text-foreground placeholder:text-muted/70 resize-none overflow-y-auto font-bold custom-scrollbar"
                    disabled={isLoading}
                  />
                  
                  <div className="flex items-center gap-2 flex-shrink-0 mb-0.5 mr-0.5">
                    <span className="hidden sm:inline-flex items-center text-[9px] font-mono text-muted border border-border px-1.5 py-0.5 rounded-md bg-surface select-none">
                      Enter
                    </span>
                    {/* Speech to Text Microphone button */}
                    <button
                      type="button"
                      onClick={toggleListening}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-205 hover:scale-105 active:scale-95 ${
                        isListening
                          ? 'bg-red-500 text-white animate-pulse shadow-md shadow-red-500/25'
                          : 'bg-surface text-muted hover:text-foreground border border-border hover:bg-surface-hover'
                      }`}
                      title={isListening ? "Listening... click to stop" : "Start Voice Query"}
                    >
                      <Mic className="w-4 h-4" />
                    </button>

                    <button
                      type={isLoading ? "button" : "submit"}
                      disabled={!isLoading && !(input || '').trim()}
                      onClick={isLoading ? () => stop?.() : undefined}
                      className="w-9 h-9 rounded-xl bg-foreground text-background flex items-center justify-center disabled:opacity-30 hover:scale-105 active:scale-95 transition-all duration-200 shadow-sm"
                      title={isLoading ? "Stop generating" : "Send"}
                      aria-label={isLoading ? "Stop generating" : "Send"}
                    >
                      {isLoading ? (
                        <Square className="w-3.5 h-3.5 fill-current" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </form>

              <p className="text-[10px] text-muted mt-2 text-center flex items-center justify-center gap-1.5 flex-wrap">
                <span>Powered by Groq. Responses may not always be accurate</span>
                <span className="text-muted/40">•</span>
                <span>Crafted by <a href="https://www.aryandani.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-muted hover:text-foreground hover:underline transition-all">Aryan Dani</a></span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Flashcards */}
      {activeTab === 'flashcards' && (
        <div className="min-h-0 overflow-y-auto px-4 sm:px-6 py-6 flex flex-col items-center">
          <div className="w-full max-w-2xl mb-8">
            <form onSubmit={handleGenerateFlashcards} className="flex gap-2">
              <input
                type="text"
                placeholder="Enter a topic (e.g. DBMS Normalization, CPU Scheduling, Binary Trees)..."
                value={flashcardTopic}
                onChange={(e) => setFlashcardTopic(e.target.value)}
                disabled={isGeneratingFlashcards}
                className="flex-1 bg-surface border border-border rounded-lg px-3 min-h-9 text-sm outline-none text-foreground placeholder:text-muted focus:ring-0 focus-visible:ring-0 transition-[border-color,box-shadow] duration-150 shadow-xs input-premium-focus"
              />
              <Button
                type="submit"
                disabled={isGeneratingFlashcards || !flashcardTopic.trim()}
                size="sm"
                className="shrink-0"
              >
                {isGeneratingFlashcards ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Layers className="w-3.5 h-3.5" />
                    Generate
                  </>
                )}
              </Button>
            </form>

            {/* Quick subject prompt pills */}
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="text-xs font-semibold text-muted flex items-center mr-1">Try topics:</span>
              {subjects.slice(0, 4).map((sub) => (
                <button
                  key={sub}
                  type="button"
                  onClick={() => {
                    setFlashcardTopic(sub);
                  }}
                  className="text-xs bg-surface border border-border hover:border-border-strong text-muted hover:text-foreground px-2.5 py-1 rounded-lg transition-colors shadow-xs"
                >
                  {sub}
                </button>
              ))}
            </div>
          </div>

          {isGeneratingFlashcards ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center my-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
              <p className="text-sm font-semibold text-foreground mb-1">AI is reading your course materials...</p>
              <p className="text-xs text-muted max-w-xs">Creating high-yield flashcards grounded in your Sem {semester} curriculum.</p>
            </div>
          ) : flashcards.length > 0 ? (
            <div className="w-full max-w-xl flex flex-col items-center my-auto">
              {/* Card Counter & Progress */}
              <div className="flex items-center justify-between w-full mb-4 px-1">
                <span className="text-xs font-bold uppercase tracking-wider text-muted">
                  Card {currentCardIndex + 1} of {flashcards.length}
                </span>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-surface border border-border text-foreground">
                  {Object.values(knownCards).filter(Boolean).length} Known
                </span>
              </div>

              {/* The 3D Flashcard */}
              <div 
                className="w-full min-h-[300px] cursor-pointer"
                style={{ perspective: '1000px' }}
                onClick={() => setIsFlipped(!isFlipped)}
              >
                <div 
                  className="w-full h-full min-h-[300px] relative transition-transform duration-500 ease-out"
                  style={{ 
                    transformStyle: 'preserve-3d',
                    transform: isFlipped ? 'rotateY(180deg)' : 'none'
                  }}
                >
                  {/* Front Side (Question) */}
                  <div 
                    className="absolute inset-0 w-full h-full p-8 flex flex-col items-center justify-center text-center rounded-2xl border border-border bg-card shadow-md group select-none hover:border-foreground/35 transition-colors"
                    style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
                  >
                    <div className="absolute top-4 right-4 text-[10px] font-extrabold uppercase tracking-widest text-muted bg-surface px-2.5 py-1 rounded-md border border-border shadow-xs">
                      Question
                    </div>
                    <div className="absolute top-4 left-4 text-muted group-hover:text-foreground transition-colors">
                      <RotateCw className="w-4 h-4" />
                    </div>
                    <p className="text-lg sm:text-xl font-bold text-foreground max-w-md leading-snug px-4">
                      {flashcards[currentCardIndex].question}
                    </p>
                    <p className="absolute bottom-4 text-[11px] font-bold text-muted uppercase tracking-wider">
                      Click to reveal answer
                    </p>
                  </div>

                  {/* Back Side (Answer) */}
                  <div 
                    className="absolute inset-0 w-full h-full p-8 flex flex-col items-center justify-center text-center rounded-2xl border border-border bg-card shadow-md group select-none hover:border-foreground/35 transition-colors"
                    style={{ 
                      backfaceVisibility: 'hidden', 
                      WebkitBackfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)' 
                    }}
                  >
                    <div className="absolute top-4 right-4 text-[10px] font-extrabold uppercase tracking-widest text-muted bg-surface px-2.5 py-1 rounded-md border border-border shadow-xs">
                      Answer
                    </div>
                    <div className="absolute top-4 left-4 text-muted group-hover:text-foreground transition-colors">
                      <RotateCw className="w-4 h-4" />
                    </div>
                    <p className="text-lg sm:text-xl font-bold text-foreground max-w-md leading-snug px-4">
                      {flashcards[currentCardIndex].answer}
                    </p>
                    <p className="absolute bottom-4 text-[11px] font-bold text-muted uppercase tracking-wider">
                      Click to view question
                    </p>
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between w-full mt-6 gap-4">
                <button
                  onClick={() => {
                    setIsFlipped(false);
                    setCurrentCardIndex((prev) => (prev - 1 + flashcards.length) % flashcards.length);
                  }}
                  className="inline-flex items-center gap-1.5 h-8 px-3 bg-surface border border-border rounded-lg text-xs font-semibold text-foreground hover:bg-surface-hover transition-colors shadow-xs"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Prev
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setKnownCards((prev) => ({ ...prev, [currentCardIndex]: false }));
                      setIsFlipped(false);
                      setCurrentCardIndex((prev) => (prev + 1) % flashcards.length);
                    }}
                    className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold border transition-colors shadow-xs ${
                      knownCards[currentCardIndex] === false
                        ? 'bg-destructive text-destructive-foreground border-destructive'
                        : 'bg-surface border-border text-muted hover:text-foreground'
                    }`}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Review
                  </button>

                  <button
                    onClick={() => {
                      setKnownCards((prev) => ({ ...prev, [currentCardIndex]: true }));
                      setIsFlipped(false);
                      setCurrentCardIndex((prev) => (prev + 1) % flashcards.length);
                    }}
                    className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold border transition-colors shadow-xs ${
                      knownCards[currentCardIndex] === true
                        ? 'bg-foreground text-background border-foreground font-semibold'
                        : 'bg-surface border-border text-muted hover:text-foreground'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Got it
                  </button>
                </div>

                <button
                  onClick={() => {
                    setIsFlipped(false);
                    setCurrentCardIndex((prev) => (prev + 1) % flashcards.length);
                  }}
                  className="inline-flex items-center gap-1.5 h-8 px-3 bg-surface border border-border rounded-lg text-xs font-semibold text-foreground hover:bg-surface-hover transition-colors shadow-xs"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Save & Publish Deck CTA */}
              <div className="mt-8 pt-6 border-t border-border w-full flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-foreground">Save to Study Decks</h4>
                  <p className="text-[11px] text-muted mt-0.5">Add these flashcards to your personal Spaced Repetition (SRS) box or publish them.</p>
                </div>
                
                <div className="flex items-center gap-2">
                  <AddToSrsButton cards={flashcards} defaultName={flashcardTopic || 'Academic Flashcards'} />
                  
                  <button
                    onClick={handlePublishDeck}
                    disabled={isPublishingDeck || publishedDeck}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-foreground text-background text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-all shadow-xs shrink-0 whitespace-nowrap"
                  >
                    {isPublishingDeck ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Publishing...
                      </>
                    ) : publishedDeck ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-foreground" />
                        Published to Community!
                      </>
                    ) : (
                      <>
                        <BookOpen className="w-3.5 h-3.5" />
                        Publish Deck
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center my-12 px-4 max-w-sm">
              <div className="w-16 h-16 bg-surface border border-border flex items-center justify-center mb-6 rounded-2xl shadow-sm">
                <Layers className="w-8 h-8 text-muted" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">AI Flashcards</h3>
              <p className="text-sm text-muted leading-relaxed">
                Generate custom, high-yield flashcards instantly. Perfect for active recall and exam preparation.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Practice Quiz */}
      {activeTab === 'quiz' && (
        <div className="min-h-0 overflow-y-auto px-4 sm:px-6 py-6 flex flex-col items-center">
          <div className="w-full max-w-2xl mb-8">
            <form onSubmit={handleGenerateQuiz} className="flex gap-2">
              <input
                type="text"
                placeholder="Enter a topic for your quiz (e.g. OS Memory Management, Computer Networks)..."
                value={quizTopic}
                onChange={(e) => setQuizTopic(e.target.value)}
                disabled={isGeneratingQuiz}
                className="flex-1 bg-surface border border-border rounded-lg px-3 min-h-9 text-sm outline-none text-foreground placeholder:text-muted focus:ring-0 focus-visible:ring-0 transition-[border-color,box-shadow] duration-150 shadow-xs input-premium-focus"
              />
              <Button
                type="submit"
                disabled={isGeneratingQuiz || !quizTopic.trim()}
                size="sm"
                className="shrink-0"
              >
                {isGeneratingQuiz ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <HelpCircle className="w-3.5 h-3.5" />
                    Generate
                  </>
                )}
              </Button>
            </form>

            <div className="flex flex-wrap gap-2 mt-3">
              <span className="text-xs font-semibold text-muted flex items-center mr-1">Try topics:</span>
              {subjects.slice(0, 4).map((sub) => (
                <button
                  key={sub}
                  type="button"
                  onClick={() => {
                    setQuizTopic(sub);
                  }}
                  className="text-xs bg-surface border border-border hover:border-border-strong text-muted hover:text-foreground px-2.5 py-1 rounded-lg transition-colors shadow-xs"
                >
                  {sub}
                </button>
              ))}
            </div>
          </div>

          {isGeneratingQuiz ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center my-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
              <p className="text-sm font-semibold text-foreground mb-1">AI is crafting your quiz...</p>
              <p className="text-xs text-muted max-w-xs">Analyzing your syllabus and resource vault to create challenging MCQs.</p>
            </div>
          ) : quizQuestions.length > 0 ? (
            <div className="w-full max-w-2xl space-y-8 pb-12">
              {quizQuestions.map((q, qIndex) => (
                <div key={q.id} className="bg-card border border-border p-6 sm:p-8 rounded-2xl shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted bg-surface px-2.5 py-1 rounded-md border border-border shadow-xs">
                      Question {qIndex + 1}
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg font-bold text-foreground mb-6 leading-snug">
                    {q.question}
                  </h3>

                  <div className="grid grid-cols-1 gap-px bg-border/60 rounded-xl overflow-hidden border border-border/70 shadow-sm">
                    {q.options.map((opt, optIdx) => {
                      const isSelected = selectedAnswers[q.id] === optIdx;
                      const isCorrect = q.correctIndex === optIdx;

                      let btnStyle = 'bg-card hover:bg-surface/50 text-foreground';
                      if (quizSubmitted) {
                        if (isCorrect) {
                          btnStyle = 'bg-foreground/10 text-foreground font-bold';
                        } else if (isSelected && !isCorrect) {
                          btnStyle = 'bg-destructive/10 text-destructive font-semibold';
                        }
                      } else if (isSelected) {
                        btnStyle = 'bg-foreground text-background font-semibold';
                      }

                      return (
                        <button
                          key={optIdx}
                          type="button"
                          disabled={quizSubmitted}
                          onClick={() => setSelectedAnswers((prev) => ({ ...prev, [q.id]: optIdx }))}
                          className={`w-full flex items-center justify-between p-4 text-sm text-left transition-all ${btnStyle}`}
                        >
                          <span>{opt}</span>
                          {quizSubmitted && isCorrect && <CheckCircle2 className="w-4 h-4 text-foreground shrink-0 ml-2" />}
                          {quizSubmitted && isSelected && !isCorrect && <XCircle className="w-4 h-4 text-destructive shrink-0 ml-2" />}
                        </button>
                      );
                    })}
                  </div>

                  {quizSubmitted && (
                    <div className="mt-6 p-4 rounded-xl bg-surface border border-border text-xs text-muted leading-relaxed space-y-3">
                      <div>
                        <span className="font-semibold text-foreground block mb-1">Explanation:</span>
                        <p>{q.explanation}</p>
                      </div>
                      {q.citations && q.citations.length > 0 && (
                        <div className="pt-2.5 border-t border-border/40 flex flex-wrap gap-1.5 items-center">
                          <span className="font-bold text-[9px] text-muted uppercase tracking-wider mr-1">Cited Sources:</span>
                          {q.citations.map((cite: string, idx: number) => {
                            const cleanedCite = cite.replace(/^\[?SOURCE:\s*/i, '').replace(/\]$/, '').trim();
                            if (!cleanedCite || cleanedCite.toLowerCase() === 'leave empty array if no context snippet was used.') return null;
                            return (
                              <span 
                                key={idx} 
                                className="inline-flex items-center gap-1 bg-card px-2.5 py-0.5 border border-border text-[9px] font-bold text-foreground rounded-md shadow-xs"
                              >
                                <BookOpen className="w-3 h-3 text-muted shrink-0" />
                                {cleanedCite}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Submit / Score Section */}
              <div className="bg-surface border border-border p-6 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl shadow-sm">
                <div>
                  {quizSubmitted ? (
                    <>
                      <p className="text-lg font-bold text-foreground mb-1">
                        Your Score: {calculateQuizScore()} / {quizQuestions.length}
                      </p>
                      <p className="text-xs text-muted">
                        {calculateQuizScore() === quizQuestions.length ? 'Perfect score! Excellent work.' : 'Keep practicing to master these concepts!'}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-base font-bold text-foreground mb-1">Ready to submit?</p>
                      <p className="text-xs text-muted">Make sure you&apos;ve answered all questions before submitting.</p>
                    </>
                  )}
                </div>

                <div className="flex gap-2 w-full sm:w-auto">
                  {quizSubmitted ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAnswers({});
                        setQuizSubmitted(false);
                      }}
                      className="flex-1 sm:flex-none px-6 py-3 bg-surface border border-border hover:bg-surface-hover rounded-xl text-sm font-semibold text-foreground transition-colors shadow-xs"
                    >
                      Retake Quiz
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={Object.keys(selectedAnswers).length < quizQuestions.length}
                      onClick={() => {
                        setQuizSubmitted(true);
                        logActivity('quiz_submitted', quizQuestions.length);
                      }}
                      className="flex-1 sm:flex-none px-6 py-3 bg-foreground text-background rounded-xl text-sm font-semibold disabled:opacity-30 hover:opacity-90 transition-all shadow-sm"
                    >
                      Submit Answers
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center my-12 px-4 max-w-sm">
              <div className="w-16 h-16 bg-surface border border-border flex items-center justify-center mb-6 rounded-2xl shadow-sm">
                <HelpCircle className="w-8 h-8 text-muted" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">AI Practice Quiz</h3>
              <p className="text-sm text-muted leading-relaxed">
                Test your knowledge with AI-generated multiple-choice questions grounded in your course materials.
              </p>
            </div>
          )}
        </div>
      )}
      <Modal
        open={reportOpen}
        onClose={() => {
          if (reportSending) return;
          setReportOpen(false);
        }}
        title="Report this response"
        size="sm"
      >
        <p className="text-sm text-muted leading-relaxed">
          Tell us what is wrong. We store a truncated copy of the answer with
          your report. See the{' '}
          <AppLink href="/privacy" className="text-foreground underline underline-offset-4">
            privacy policy
          </AppLink>
          .
        </p>
        <label className="block mt-4 text-xs font-semibold text-foreground">
          Reason
          <Select
            className="mt-1.5"
            value={reportReason}
            onChange={setReportReason}
            options={[
              { value: 'inaccurate', label: 'Inaccurate or misleading' },
              { value: 'harmful', label: 'Harmful or inappropriate' },
              { value: 'off-topic', label: 'Off-topic' },
              { value: 'other', label: 'Other' },
            ]}
          />
        </label>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-5">
          <Button
            type="button"
            variant="secondary"
            disabled={reportSending}
            onClick={() => setReportOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={reportSending}
            onClick={() => void submitAiReport()}
          >
            {reportSending ? 'Sending…' : 'Submit report'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
