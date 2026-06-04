'use client';

import { useChat } from '@ai-sdk/react';
import { useState, useEffect, useRef, useMemo } from 'react';
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
  MessageSquare, 
  Layers, 
  HelpCircle, 
  RotateCw, 
  CheckCircle2, 
  XCircle, 
  ChevronLeft, 
  ChevronRight,
  BookOpen,
  Plus,
  Mic
} from 'lucide-react';
import { useAcademicStore } from '@/store/academicStore';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { logActivity } from '@/components/ActivityHeatmap';
import { toast } from 'sonner';
import { useSRSStore } from '@/store/srsStore';
import { useSearchParams } from 'next/navigation';

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

/* Professional markdown renderer using react-markdown */
function MessageContent({ content, showCursor }: { content: string, showCursor?: boolean }) {
  const displayContent = showCursor ? content + ' ▋' : content;
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-surface prose-pre:border prose-pre:border-border prose-pre:rounded-lg prose-code:text-primary prose-code:bg-primary/5 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
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
          table: ({ children }) => (
            <div className="overflow-x-auto my-6 rounded-2xl border border-border bg-card/50 backdrop-blur-md shadow-xs">
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
          td: ({ children }) => (
            <td className="px-4 py-3 text-xs text-foreground/75 border-b border-border/40 font-semibold leading-relaxed">
              {children}
            </td>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-surface/20 transition-colors">
              {children}
            </tr>
          ),
        }}
      >
        {displayContent}
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
    toast.success('Added cards to SRS Deck!');
    setTimeout(() => setAdded(false), 2000);
  };

  const handleCreateAndAdd = () => {
    const newDeck = createDeck(defaultName);
    const formatted = cards.map(c => ({ question: c.question, answer: c.answer }));
    addMultipleCards(newDeck.id, formatted);
    setAdded(true);
    setIsOpen(false);
    toast.success(`Created deck "${defaultName}" and added cards!`);
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
            <Check className="w-3.5 h-3.5 text-emerald-500" />
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
        <div className="absolute right-0 bottom-full mb-2 w-56 bg-card border border-border rounded-2xl shadow-popover overflow-hidden z-[100] backdrop-blur-xl p-1.5 flex flex-col gap-0.5">
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
            + Create "{defaultName.slice(0, 16)}..."
          </button>
        </div>
      )}
    </div>
  );
}

export interface ChatSession {
  id: string;
  title: string;
  messages: any[];
  createdAt: string;
}

const EMPTY_ARRAY: any[] = [];

export default function AskClient() {
  const { branch, semester } = useAcademicStore();
  const [subjects, setSubjects] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'chat' | 'flashcards' | 'quiz'>('chat');

  const searchParams = useSearchParams();

  // Grounded Document Chat States
  const [resources, setResources] = useState<any[]>([]);
  const [selectedResourceId, setSelectedResourceId] = useState<string>('all');

  // Speech Recognition States
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Chat History / Sessions States
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Chat refs & state
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);

  // Focus dropdown state
  const [isFocusDropdownOpen, setIsFocusDropdownOpen] = useState(false);
  const focusDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (focusDropdownRef.current && !focusDropdownRef.current.contains(event.target as Node)) {
        setIsFocusDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Flashcard state
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

  // Fetch subjects for context
  useEffect(() => {
    const q = query(
      collection(db, 'subjects'),
      where('branch', '==', branch),
      where('semester', '==', semester)
    );
    getDocs(q).then((snapshot) => {
      const data = snapshot.docs.map(doc => ({ name: doc.data().name as string }));
      setSubjects(data.map((s: { name: string }) => s.name).filter((n: string) => n.toUpperCase() !== 'SYLLABUS'));
    }).catch(err => console.error("Error loading subjects in AskAI:", err));
  }, [branch, semester]);

  // Fetch resources for grounded chat selector
  useEffect(() => {
    fetch(`/api/resources/list?branch=${branch}&semester=${semester}`)
      .then(res => res.json())
      .then(data => {
        if (data.resources) setResources(data.resources);
      })
      .catch(err => console.error('Error loading resources for Ask AI:', err));
  }, [branch, semester]);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = 'en-US';

        rec.onstart = () => setIsListening(true);
        rec.onend = () => setIsListening(false);
        rec.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          if (transcript) {
            setInput(prev => (prev ? prev + ' ' : '') + transcript);
            toast.success("Voice transcribed successfully!");
          }
        };
        rec.onerror = (e: any) => {
          console.error("Speech recognition error", e);
          setIsListening(false);
        };
        recognitionRef.current = rec;
      }
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      toast.error("Web Speech API is not supported in this browser.");
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
      branch, 
      semester, 
      subjects, 
      resourceId: selectedResourceId !== 'all' ? selectedResourceId : undefined 
    },
  }), [branch, semester, subjects, selectedResourceId]);

  const activeSession = useMemo(() => {
    return sessions.find(s => s.id === activeSessionId);
  }, [sessions, activeSessionId]);

  const chatSessionKey = useMemo(() => {
    return activeSessionId ? `${activeSessionId}-${selectedResourceId}-${branch}-${semester}` : undefined;
  }, [activeSessionId, selectedResourceId, branch, semester]);

  const initialMessages = useMemo(() => {
    if (!activeSessionId) return EMPTY_ARRAY;
    const session = sessions.find(s => s.id === activeSessionId);
    return session ? session.messages : EMPTY_ARRAY;
  }, [chatSessionKey, sessionsLoaded]);

  const chatHelpers = (useChat as any)({
    api: '/api/chat',
    id: chatSessionKey,
    initialMessages,
    body: chatBody,
  });

  const { 
    messages = [], 
    sendMessage,
    regenerate,
    status,
    setMessages,
  } = chatHelpers;

  console.log('AskClient Render:', {
    activeSessionId,
    chatSessionKey,
    sessionsLoaded,
    initialMessagesLength: initialMessages.length,
    messagesLength: messages.length,
    messagesRef: messages,
    initialMessagesRef: initialMessages,
  });

  const [input, setInput] = useState('');
  const isLoading = status === 'submitted' || status === 'streaming';

  // Load chat sessions on mount
  useEffect(() => {
    const saved = localStorage.getItem('utility_chat_sessions');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSessions(parsed);
        if (parsed.length > 0) {
          setActiveSessionId(parsed[0].id);
        } else {
          const initialId = Math.random().toString(36).slice(2, 11);
          const initialSession = {
            id: initialId,
            title: 'New Chat',
            messages: [],
            createdAt: new Date().toISOString()
          };
          setSessions([initialSession]);
          setActiveSessionId(initialId);
        }
      } catch (e) {
        console.error('Failed to parse chat sessions', e);
      }
    } else {
      const initialId = Math.random().toString(36).slice(2, 11);
      const initialSession = {
        id: initialId,
        title: 'New Chat',
        messages: [],
        createdAt: new Date().toISOString()
      };
      setSessions([initialSession]);
      setActiveSessionId(initialId);
    }
    setSessionsLoaded(true);
  }, []);

  const sessionsRef = useRef(sessions);
  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  // Load active session messages into useChat on mount or session switch
  useEffect(() => {
    if (!sessionsLoaded || !activeSessionId) return;
    const session = sessionsRef.current.find(s => s.id === activeSessionId);
    if (session) {
      setMessages(session.messages);
    }
  }, [activeSessionId, sessionsLoaded, setMessages]);

  // Save sessions helper
  const saveSessions = (updated: ChatSession[]) => {
    setSessions(updated);
    localStorage.setItem('utility_chat_sessions', JSON.stringify(updated));
  };

  // Sync current messages back to active session
  useEffect(() => {
    if (!activeSessionId) return;
    if (status !== 'ready' && status !== 'error') return; // Only sync when ready or error
    console.log('Sync Effect Fired:', {
      messagesLength: messages.length,
      activeSessionId,
      status,
    });
    
    setSessions(prevSessions => {
      const session = prevSessions.find(s => s.id === activeSessionId);
      if (!session) return prevSessions;
 
      const isDiff = JSON.stringify(session.messages) !== JSON.stringify(messages);
      console.log('Compare Messages:', {
        sessionMsgLength: session.messages.length,
        chatMsgLength: messages.length,
        isDiff,
      });

      if (isDiff) {
        const updated = prevSessions.map(s => {
          if (s.id === activeSessionId) {
            let title = s.title;
            if (title === 'New Chat' && messages.length > 0) {
              const firstUserMsg = messages.find((m: any) => m.role === 'user');
              if (firstUserMsg) {
                const content = getMessageContent(firstUserMsg);
                if (content) {
                  title = content.slice(0, 30) + (content.length > 30 ? '...' : '');
                }
              }
            }
            return { ...s, messages, title };
          }
          return s;
        });
        localStorage.setItem('utility_chat_sessions', JSON.stringify(updated));
        return updated;
      }
      return prevSessions;
    });
  }, [messages, activeSessionId, status]);

  const handleNewChat = () => {
    const newId = Math.random().toString(36).slice(2, 11);
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
        const newId = Math.random().toString(36).slice(2, 11);
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
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setActiveSessionId(sessionId);
    }
  };

  useEffect(() => {
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
  }, [searchParams]);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!(input || '').trim() || isLoading) return;

    sendMessage({ 
      role: 'user',
      content: input,
    });
    logActivity('ai_prompt', 1);
    setInput('');
  };

  // Auto-scroll to bottom for chat
  useEffect(() => {
    if (messagesEndRef.current && activeTab === 'chat') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  // Track scroll position for chat
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || activeTab !== 'chat') return;
    const handleScroll = () => {
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
      setShowScrollDown(!isNearBottom && messages.length > 0);
    };
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [messages.length, activeTab]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

  const [randomPrompts, setRandomPrompts] = useState<string[]>([]);
  useEffect(() => {
    const shuffled = [...SUGGESTED_PROMPTS].sort(() => Math.random() - 0.5);
    setRandomPrompts(shuffled.slice(0, 4));
  }, []);

  // Generate Flashcards API Call
  const handleGenerateFlashcards = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flashcardTopic.trim() || isGeneratingFlashcards) return;
    setIsGeneratingFlashcards(true);
    setFlashcards([]);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setKnownCards({});

    try {
      const res = await fetch('/api/study', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'flashcards',
          topic: flashcardTopic,
          context: { branch, semester, subjects }
        }),
      });
      const data = await res.json();
      if (data.flashcards) {
        setFlashcards(data.flashcards);
        logActivity('flashcard_generated', data.flashcards.length);
      }
    } catch (err) {
      console.error('Failed to generate flashcards:', err);
      toast.error('Failed to generate flashcards. Please try again.');
    } finally {
      setIsGeneratingFlashcards(false);
    }
  };

  const handlePublishDeck = async () => {
    if (flashcards.length === 0 || isPublishingDeck) return;
    setIsPublishingDeck(true);
    try {
      const user = auth.currentUser;
      const authorName = user?.email ? user.email.split('@')[0] : 'Anonymous Scholar';

      const newDeckRef = doc(collection(db, 'community_decks'));
      await setDoc(newDeckRef, {
        title: flashcardTopic || 'Academic Flashcards',
        branch,
        semester,
        author_name: authorName,
        flashcards: flashcards,
        upvotes: 0,
        created_at: new Date().toISOString()
      });

      setPublishedDeck(true);
      logActivity('community_deck_published', 1);
      toast.success('Deck published to Community Vault!');
      setTimeout(() => setPublishedDeck(false), 3000);
    } catch (err) {
      console.warn('Publish deck error:', err);
      toast.error('Failed to publish deck.');
    } finally {
      setIsPublishingDeck(false);
    }
  };

  // Generate Quiz API Call
  const handleGenerateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quizTopic.trim() || isGeneratingQuiz) return;
    setIsGeneratingQuiz(true);
    setQuizQuestions([]);
    setSelectedAnswers({});
    setQuizSubmitted(false);

    try {
      const res = await fetch('/api/study', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'quiz',
          topic: quizTopic,
          context: { branch, semester, subjects }
        }),
      });
      const data = await res.json();
      if (data.quiz) {
        setQuizQuestions(data.quiz);
        logActivity('quiz_generated', data.quiz.length);
      }
    } catch (err) {
      console.error('Failed to generate quiz:', err);
      toast.error('Failed to generate quiz. Please try again.');
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const calculateQuizScore = () => {
    let correct = 0;
    quizQuestions.forEach((q) => {
      if (selectedAnswers[q.id] === q.correctIndex) correct++;
    });
    return correct;
  };

  return (
    <div className="flex-1 w-full flex flex-col md:h-screen h-[calc(100vh-3.5rem)] px-4 sm:px-6">
      {/* Top Navigation Tabs */}
      <div className="border-b border-border bg-background px-4 sm:px-6 py-3 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-1.5 p-1 bg-surface border border-border rounded-xl shadow-xs">
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'chat'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted hover:text-foreground'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Chat Assistant
          </button>
          <button
            onClick={() => setActiveTab('flashcards')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'flashcards'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted hover:text-foreground'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Flashcards
          </button>
          <button
            onClick={() => setActiveTab('quiz')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'quiz'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted hover:text-foreground'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Practice Quiz
          </button>
        </div>

        <span className="text-[11px] font-semibold text-muted bg-surface px-2.5 py-1 rounded-md border border-border">
          {branch} · Sem {semester}
        </span>
      </div>

      {/* Tab 1: Chat Assistant */}
      {activeTab === 'chat' && (
        <div className="flex-1 flex overflow-hidden w-full relative">
          
          {/* Chat Sessions Collapsible Sidebar */}
          {sidebarOpen && (
            <div className="w-64 border-r border-border bg-surface flex flex-col shrink-0">
              <div className="p-3.5 border-b border-border flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-muted tracking-wider">Chat History</span>
                <button
                  onClick={handleNewChat}
                  className="p-1 rounded-lg border border-border bg-card hover:bg-surface-hover text-muted hover:text-foreground transition-all flex items-center justify-center"
                  title="New Chat"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {sessions.map(s => {
                  const isActive = s.id === activeSessionId;
                  return (
                    <div
                      key={s.id}
                      onClick={() => handleSwitchSession(s.id)}
                      className={`group/session w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors border ${
                        isActive 
                          ? 'bg-surface border-border-strong text-foreground shadow-sm' 
                          : 'border-transparent text-muted hover:text-foreground hover:bg-surface-hover'
                      }`}
                    >
                      <span className="truncate max-w-[130px]">{s.title}</span>
                      <div className="flex items-center gap-1.5 opacity-0 group-hover/session:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={(e) => handleRenameSession(s.id, s.title, e)}
                          className={`p-1 rounded-md transition-colors ${isActive ? 'text-foreground/75 hover:bg-surface-hover hover:text-foreground' : 'hover:bg-surface-hover text-muted hover:text-foreground'}`}
                          title="Rename Chat"
                        >
                          <Plus className="w-3 h-3 rotate-45" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteSession(s.id, e)}
                          className={`p-1 rounded-md transition-colors ${isActive ? 'text-foreground/75 hover:bg-surface-hover hover:text-red-400' : 'hover:bg-surface-hover text-muted hover:text-red-500'}`}
                          title="Delete Chat"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Main Chat Area */}
          <div className="flex-1 flex flex-col overflow-hidden bg-background">
            
            {/* Top Toolbar: Sidebar toggle & grounded document selector */}
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5 bg-surface/30 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="p-1.5 rounded-lg border border-border bg-card hover:bg-surface text-muted hover:text-foreground transition-all flex items-center justify-center"
                  title={sidebarOpen ? "Hide chat history" : "Show chat history"}
                >
                  <ChevronLeft className={`w-3.5 h-3.5 transition-transform ${sidebarOpen ? '' : 'rotate-180'}`} />
                </button>
                
                <div className="h-4 w-px bg-border mx-1" />

                {/* Grounded Document Selector */}
                <div className="flex items-center gap-2 relative" ref={focusDropdownRef}>
                  <span className="text-[10px] uppercase font-bold text-muted select-none">AI Focus:</span>
                  <button
                    onClick={() => setIsFocusDropdownOpen(!isFocusDropdownOpen)}
                    className="flex items-center justify-between gap-2 text-xs font-semibold bg-card border border-border rounded-xl px-3 py-1.5 text-foreground outline-none cursor-pointer w-[240px] hover:border-border-strong transition-colors shadow-xs"
                  >
                    <span className="truncate">
                      {selectedResourceId === 'all' 
                        ? '🌐 Entire Library (RAG)' 
                        : `📄 ${resources.find(r => r.id === selectedResourceId)?.title || 'Unknown'}`}
                    </span>
                    <ChevronLeft className={`w-3.5 h-3.5 text-muted shrink-0 transition-transform ${isFocusDropdownOpen ? 'rotate-90' : '-rotate-90'}`} />
                  </button>
                  
                  {isFocusDropdownOpen && (
                    <div className="absolute top-full right-0 mt-1.5 w-[280px] bg-card border border-border rounded-xl shadow-popover overflow-hidden z-50 flex flex-col max-h-[300px]">
                      <div className="overflow-y-auto p-1.5 flex flex-col gap-0.5">
                        <button
                          onClick={() => { setSelectedResourceId('all'); setIsFocusDropdownOpen(false); }}
                          className={`w-full flex items-center gap-2 text-left px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${selectedResourceId === 'all' ? 'bg-surface text-foreground' : 'text-muted hover:bg-surface-hover hover:text-foreground'}`}
                        >
                          <span className="shrink-0">🌐</span>
                          <span className="truncate">Entire Library (RAG Search)</span>
                        </button>
                        {resources.length > 0 && (
                          <div className="px-3 py-1.5 mt-1 border-t border-border/40">
                            <span className="text-[9px] uppercase font-bold tracking-wider text-muted">Specific Documents</span>
                          </div>
                        )}
                        {resources.map((res) => (
                          <button
                            key={res.id}
                            onClick={() => { setSelectedResourceId(res.id); setIsFocusDropdownOpen(false); }}
                            className={`w-full flex items-center gap-2 text-left px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${selectedResourceId === res.id ? 'bg-surface text-foreground' : 'text-muted hover:bg-surface-hover hover:text-foreground'}`}
                            title={res.title}
                          >
                            <span className="shrink-0">📄</span>
                            <span className="truncate">{res.title}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {selectedResourceId !== 'all' && (
                <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Grounded Chat Mode
                </span>
              )}
            </div>

            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 relative">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-4">
                  <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center mb-6 shadow-sm">
                    <Brain className="w-8 h-8 text-foreground" />
                  </div>
                  <h1 className="text-2xl font-bold text-foreground mb-10 tracking-tight">Academic AI Assistant</h1>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                    {randomPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => handleSuggestion(prompt)}
                        className="text-left px-3.5 py-2.5 rounded-xl border border-border bg-card hover:bg-surface text-sm text-muted hover:text-foreground transition-colors leading-snug shadow-xs"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {messages.map((m: any) => (
                    <div
                      key={m.id}
                      className={`flex gap-3 group ${m.role === 'user' ? 'justify-end' : ''}`}
                    >
                      {m.role === 'assistant' && (
                        <div className="w-7 h-7 rounded-lg bg-surface border border-border flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                          <Bot className="w-3.5 h-3.5 text-foreground" />
                        </div>
                      )}

                      <div
                        className={`max-w-[85%] ${
                          m.role === 'user'
                            ? 'bg-foreground text-background rounded-2xl rounded-br-md px-4 py-2.5 shadow-sm'
                            : 'flex-1 min-w-0'
                        }`}
                      >
                        {m.role === 'user' ? (
                          <p className="text-sm whitespace-pre-wrap">{getMessageContent(m)}</p>
                        ) : (
                          <div className="relative">
                            <MessageContent 
                              content={getMessageContent(m)} 
                              showCursor={isLoading && m.id === messages[messages.length - 1].id}
                            />
                            <div className="mt-2">
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

                  <div ref={messagesEndRef} />
                </div>
              )}

              {showScrollDown && (
                <button
                  onClick={scrollToBottom}
                  className="fixed bottom-24 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-card border border-border shadow-popover flex items-center justify-center text-muted hover:text-foreground transition-colors z-10"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="border-t border-border bg-background px-4 sm:px-6 py-4 shrink-0">
              {messages.length > 0 && (
                <div className="flex items-center gap-4 mb-2">
                  <button
                    onClick={() => regenerate()}
                    className="inline-flex items-center gap-1.5 text-[11px] text-muted hover:text-foreground transition-colors"
                  >
                    <RotateCw className="w-3 h-3" />
                    Regenerate
                  </button>
                  <button
                    onClick={() => setMessages([])}
                    className="inline-flex items-center gap-1.5 text-[11px] text-muted hover:text-foreground transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    Clear chat
                  </button>
                </div>
              )}

              <form id="chat-form" onSubmit={handleSubmit} className="relative group">
                <div className="flex items-end gap-2 bg-surface border border-border rounded-2xl p-1.5 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all shadow-sm group-hover:border-border-strong">
                  <textarea
                    ref={inputRef}
                    value={input || ''}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    onInput={handleTextareaInput}
                    placeholder={selectedResourceId !== 'all' ? "Ask about this document..." : "Type your question..."}
                    rows={1}
                    className="flex-1 bg-transparent border-0 rounded-xl pl-3 pr-2 py-2.5 text-sm outline-none text-foreground placeholder:text-muted resize-none overflow-hidden font-medium"
                    disabled={isLoading}
                  />
                  
                  <div className="flex items-center gap-1.5 flex-shrink-0 mb-0.5 mr-0.5">
                    {/* Speech to Text Microphone button */}
                    <button
                      type="button"
                      onClick={toggleListening}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                        isListening
                          ? 'bg-red-500 text-white animate-pulse'
                          : 'bg-card text-muted hover:text-foreground border border-border hover:bg-surface'
                      }`}
                      title={isListening ? "Listening... click to stop" : "Start Voice Query"}
                    >
                      <Mic className="w-4 h-4" />
                    </button>

                    <button
                      type="submit"
                      disabled={isLoading || !(input || '').trim()}
                      className="w-9 h-9 rounded-xl bg-foreground text-background flex items-center justify-center disabled:opacity-30 hover:opacity-90 transition-all shadow-sm"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </form>

              <p className="text-[10px] text-muted mt-2 text-center flex items-center justify-center gap-1.5 flex-wrap">
                <span>Powered by Groq · Llama 3.3 70B — Responses may not always be accurate</span>
                <span className="text-muted/40">•</span>
                <span>Crafted by <a href="https://www.aryandani.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-muted hover:text-foreground hover:underline transition-all">Aryan Dani</a></span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Flashcards */}
      {activeTab === 'flashcards' && (
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 flex flex-col items-center">
          <div className="w-full max-w-2xl mb-8">
            <form onSubmit={handleGenerateFlashcards} className="flex gap-2">
              <input
                type="text"
                placeholder="Enter a topic (e.g. DBMS Normalization, CPU Scheduling, Binary Trees)..."
                value={flashcardTopic}
                onChange={(e) => setFlashcardTopic(e.target.value)}
                disabled={isGeneratingFlashcards}
                className="flex-1 bg-surface border border-border rounded-xl px-4 py-3 text-sm outline-none text-foreground placeholder:text-muted focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
              />
              <button
                type="submit"
                disabled={isGeneratingFlashcards || !flashcardTopic.trim()}
                className="px-6 py-3 bg-foreground text-background rounded-xl text-sm font-semibold disabled:opacity-30 hover:opacity-90 transition-all shadow-sm flex items-center gap-2 shrink-0"
              >
                {isGeneratingFlashcards ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Layers className="w-4 h-4" />
                    Generate
                  </>
                )}
              </button>
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

              {/* The Flashcard */}
              <div
                onClick={() => setIsFlipped(!isFlipped)}
                className="w-full min-h-[280px] bg-card border border-border rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:border-border-strong transition-all shadow-md relative group select-none"
              >
                <div className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-wider text-muted bg-surface px-2.5 py-1 rounded-md border border-border shadow-xs">
                  {isFlipped ? 'Answer' : 'Question'}
                </div>

                <div className="absolute top-4 left-4 text-muted group-hover:text-foreground transition-colors">
                  <RotateCw className="w-4 h-4" />
                </div>

                <p className="text-lg sm:text-xl font-bold text-foreground max-w-md leading-snug px-4">
                  {isFlipped 
                    ? flashcards[currentCardIndex].answer 
                    : flashcards[currentCardIndex].question}
                </p>

                <p className="absolute bottom-4 text-[11px] font-medium text-muted">
                  Click anywhere to flip
                </p>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between w-full mt-6 gap-4">
                <button
                  onClick={() => {
                    setIsFlipped(false);
                    setCurrentCardIndex((prev) => (prev - 1 + flashcards.length) % flashcards.length);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-surface border border-border rounded-xl text-xs font-semibold text-foreground hover:bg-surface-hover transition-colors shadow-xs"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Prev
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setKnownCards((prev) => ({ ...prev, [currentCardIndex]: false }));
                      setIsFlipped(false);
                      setCurrentCardIndex((prev) => (prev + 1) % flashcards.length);
                    }}
                    className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all shadow-xs ${
                      knownCards[currentCardIndex] === false
                        ? 'bg-destructive text-destructive-foreground border-destructive'
                        : 'bg-surface border-border text-muted hover:text-foreground'
                    }`}
                  >
                    <XCircle className="w-4 h-4" />
                    Review
                  </button>

                  <button
                    onClick={() => {
                      setKnownCards((prev) => ({ ...prev, [currentCardIndex]: true }));
                      setIsFlipped(false);
                      setCurrentCardIndex((prev) => (prev + 1) % flashcards.length);
                    }}
                    className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all shadow-xs ${
                      knownCards[currentCardIndex] === true
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-surface border-border text-muted hover:text-foreground'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Got it
                  </button>
                </div>

                <button
                  onClick={() => {
                    setIsFlipped(false);
                    setCurrentCardIndex((prev) => (prev + 1) % flashcards.length);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-surface border border-border rounded-xl text-xs font-semibold text-foreground hover:bg-surface-hover transition-colors shadow-xs"
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
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
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
              <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center mb-6 shadow-sm">
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
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 flex flex-col items-center">
          <div className="w-full max-w-2xl mb-8">
            <form onSubmit={handleGenerateQuiz} className="flex gap-2">
              <input
                type="text"
                placeholder="Enter a topic for your quiz (e.g. OS Memory Management, Computer Networks)..."
                value={quizTopic}
                onChange={(e) => setQuizTopic(e.target.value)}
                disabled={isGeneratingQuiz}
                className="flex-1 bg-surface border border-border rounded-xl px-4 py-3 text-sm outline-none text-foreground placeholder:text-muted focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
              />
              <button
                type="submit"
                disabled={isGeneratingQuiz || !quizTopic.trim()}
                className="px-6 py-3 bg-foreground text-background rounded-xl text-sm font-semibold disabled:opacity-30 hover:opacity-90 transition-all shadow-sm flex items-center gap-2 shrink-0"
              >
                {isGeneratingQuiz ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <HelpCircle className="w-4 h-4" />
                    Generate
                  </>
                )}
              </button>
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
                <div key={q.id} className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted bg-surface px-2.5 py-1 rounded-md border border-border shadow-xs">
                      Question {qIndex + 1}
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg font-bold text-foreground mb-6 leading-snug">
                    {q.question}
                  </h3>

                  <div className="space-y-3">
                    {q.options.map((opt, optIdx) => {
                      const isSelected = selectedAnswers[q.id] === optIdx;
                      const isCorrect = q.correctIndex === optIdx;

                      let btnStyle = 'bg-surface border-border hover:border-border-strong text-foreground';
                      if (quizSubmitted) {
                        if (isCorrect) {
                          btnStyle = 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400 font-semibold';
                        } else if (isSelected && !isCorrect) {
                          btnStyle = 'bg-destructive/10 border-destructive text-destructive font-semibold';
                        }
                      } else if (isSelected) {
                        btnStyle = 'bg-foreground border-foreground text-background font-semibold shadow-sm';
                      }

                      return (
                        <button
                          key={optIdx}
                          type="button"
                          disabled={quizSubmitted}
                          onClick={() => setSelectedAnswers((prev) => ({ ...prev, [q.id]: optIdx }))}
                          className={`w-full flex items-center justify-between p-4 rounded-xl border text-sm text-left transition-all ${btnStyle}`}
                        >
                          <span>{opt}</span>
                          {quizSubmitted && isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 ml-2" />}
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
                                className="inline-flex items-center gap-1 bg-card px-2.5 py-0.5 border border-border text-[9px] font-bold text-foreground rounded-md shadow-2xs"
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
              <div className="bg-surface border border-border rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
                <div>
                  {quizSubmitted ? (
                    <>
                      <p className="text-lg font-bold text-foreground mb-1">
                        Your Score: {calculateQuizScore()} / {quizQuestions.length}
                      </p>
                      <p className="text-xs text-muted">
                        {calculateQuizScore() === quizQuestions.length ? '🎉 Perfect score! Excellent work.' : 'Keep practicing to master these concepts!'}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-base font-bold text-foreground mb-1">Ready to submit?</p>
                      <p className="text-xs text-muted">Make sure you've answered all questions before submitting.</p>
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
              <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center mb-6 shadow-sm">
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
    </div>
  );
}
