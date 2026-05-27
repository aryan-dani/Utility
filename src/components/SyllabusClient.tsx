'use client';

import { useMemo, useState, useEffect } from 'react';
import { SubjectItem, ResourceItem } from '@/lib/dataFetcher';
import { useAcademicStore } from '@/store/academicStore';
import { 
  BookMarked, 
  Layers, 
  Search, 
  FileText, 
  ArrowRight, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Trophy, 
  Brain, 
  HelpCircle, 
  Sparkles, 
  Clock, 
  BookOpen, 
  Cpu, 
  Database, 
  Activity, 
  CheckCircle2, 
  ChevronRight,
  GraduationCap,
  Compass
} from 'lucide-react';
import { logActivity } from '@/components/ActivityHeatmap';
import { isSubjectMatch } from '@/lib/subjectMatcher';
import { motion, AnimatePresence } from 'framer-motion';

interface SyllabusClientProps {
  subjects: SubjectItem[];
  branch: string;
  semester: number;
  syllabusUrl?: string | null;
  initialResources: ResourceItem[];
}

interface ResourceItemExt extends ResourceItem {
  subject_name: string;
}

const STORAGE_KEY = 'utility_syllabus_progress';

const AIDS_SEM_4_SUBJECTS = [
  {
    id: 'aid30010',
    code: 'AID30010',
    name: 'Data Engineering Techniques',
    type: 'PM',
    credits: 2,
    modules: [
      { title: 'Unit I: Data Engineering Basics & ETL', desc: 'Data Cleaning, Data Integration, ETL processes, Data Reduction, and Sampling techniques.' },
      { title: 'Unit II: Data Warehousing & OLAP', desc: 'Data Warehouse architecture, OLAP operations, Data Lakes, and Metadata management.' },
      { title: 'Unit III: Association Rule Mining', desc: 'Frequent itemsets, Apriori Algorithm, FP Growth, and industry Case Study analysis.' },
      { title: 'Unit IV: Supervised & Unsupervised Learning', desc: 'Decision Trees, Bayesian Classification, Clustering, and k-Means algorithm.' }
    ]
  },
  {
    id: 'aid30020',
    code: 'AID30020',
    name: 'Data Engineering Techniques Lab',
    type: 'PJ',
    credits: 1,
    modules: [
      { title: 'Data Ingestion & ETL Pipelines', desc: 'Hands-on ETL implementation using PowerBI and Python scripting.' },
      { title: 'OLAP & Warehousing Analytics', desc: 'Designing data warehouse schemas and performing multi-dimensional OLAP queries.' },
      { title: 'Advanced Visualization & BI', desc: 'Dashboard creation and interactive data storytelling with Tableau and PowerBI.' },
      { title: 'Big Data & Cloud Tooling', desc: 'Introduction to Databricks for large-scale data engineering and analytics workflows.' }
    ]
  },
  {
    id: 'aid30030',
    code: 'AID30030',
    name: 'Artificial Intelligence & Expert Systems',
    type: 'PM',
    credits: 2,
    modules: [
      { title: 'Introduction & Intelligent Agents', desc: 'Introduction to AI, foundational definitions, history, and Intelligent Agents architecture.' },
      { title: 'Search Techniques', desc: 'Uninformed search (BFS, DFS), Heuristic Search, and A* Algorithm problem solving.' },
      { title: 'Knowledge Representation', desc: 'Predicate Logic, Bayesian Networks, Neural Networks, and Fuzzy Logic systems.' },
      { title: 'Expert Systems & Applications', desc: 'Architecture of Expert Systems, rule-based reasoning, and practical decision frameworks.' }
    ]
  },
  {
    id: 'aid30040',
    code: 'AID30040',
    name: 'Artificial Intelligence & Expert Systems Lab',
    type: 'PJ',
    credits: 1,
    modules: [
      { title: 'Search Algorithms Implementation', desc: 'Coding BFS, DFS, and A* Search for complex graph and pathfinding problem solving.' },
      { title: 'Constraint Satisfaction & Games', desc: 'Implementing solutions for the 8 Puzzle Problem, N-Queens, and Sudoku Solver.' },
      { title: 'Adversarial Search', desc: 'Minimax Algorithm implementation for optimal two-player game AI strategy.' },
      { title: 'Mini Project', desc: 'End-to-end Face Recognition Mini Project implementation, training, and evaluation.' }
    ]
  },
  {
    id: 'aid20060',
    code: 'AID20060',
    name: 'Design & Analysis of Algorithms',
    type: 'PM',
    credits: 3,
    modules: [
      { title: 'Asymptotic Analysis & Divide and Conquer', desc: 'Asymptotic notation, Recurrence Relations, Quick Sort, Merge Sort analysis.' },
      { title: 'Greedy Algorithms & Graph Theory', desc: 'Greedy strategy principles, Prim’s, Kruskal’s, and Dijkstra’s shortest path algorithms.' },
      { title: 'Dynamic Programming', desc: 'Principles of DP, memoization, tabulation, and classic DP problem optimization.' },
      { title: 'Backtracking & Branch and Bound', desc: 'State space trees, N-Queens backtracking, and Knapsack branch & bound optimization.' },
      { title: 'Complexity Theory & Hashing', desc: 'P, NP, NP-Complete, NP-Hard complexity classes, and advanced Hashing Techniques.' }
    ]
  },
  {
    id: 'aid20070',
    code: 'AID20070',
    name: 'Project Based Learning II',
    type: 'PJ',
    credits: 1,
    modules: [
      { title: 'Ideation & Problem Formulation', desc: 'Identifying real-world problem statements, feasibility study, and literature review.' },
      { title: 'System Design & Architecture', desc: 'Architectural blueprinting, technology stack selection, and database schema design.' },
      { title: 'Implementation & Sprint I', desc: 'Core feature development, algorithmic module integration, and initial unit testing.' },
      { title: 'Final Evaluation & Presentation', desc: 'Project deployment, rigorous user testing, technical report writing, and viva voce.' }
    ]
  }
];

function getModulesForSubject(name: string) {
  const upper = name.toUpperCase();
  if (upper.includes('DATA STRUCTURE') || upper.includes('DSA')) {
    return [
      { title: 'Arrays, Strings & Linked Lists', desc: 'Memory allocation, pointer manipulation, singly and doubly linked lists, and basic operations.' },
      { title: 'Stacks & Queues', desc: 'LIFO and FIFO principles, circular queues, priority queues, and application in parsing.' },
      { title: 'Trees & Graphs', desc: 'Binary search trees, AVL trees, graph representations, BFS, DFS, and spanning trees.' },
      { title: 'Sorting & Searching', desc: 'Comparison-based sorting (Quick, Merge, Heap), linear/binary search, and hashing.' },
      { title: 'Advanced Data Structures', desc: 'Tries, B-Trees, Fibonacci heaps, and disjoint set data structures.' }
    ];
  }
  if (upper.includes('DATABASE') || upper.includes('DBMS')) {
    return [
      { title: 'Introduction & ER Modeling', desc: 'Database architecture, entity-relationship diagrams, relational models, and schema design.' },
      { title: 'Relational Algebra & SQL', desc: 'Selection, projection, joins, complex SQL queries, views, and triggers.' },
      { title: 'Normalization & Schema Refinement', desc: 'Functional dependencies, 1NF, 2NF, 3NF, BCNF, and lossless decomposition.' },
      { title: 'Transaction Management & Concurrency', desc: 'ACID properties, serializability, two-phase locking, and deadlock handling.' },
      { title: 'Indexing & Storage', desc: 'B+ trees, hash indexing, query processing, and query optimization techniques.' }
    ];
  }
  if (upper.includes('OPERATING SYSTEM') || upper.includes('OS')) {
    return [
      { title: 'OS Structures & Process Management', desc: 'System calls, process states, PCB, context switching, and inter-process communication.' },
      { title: 'CPU Scheduling & Threads', desc: 'System calls, CPU scheduling (FCFS, SJF, RR, Multilevel), and multithreading.' },
      { title: 'Process Synchronization & Deadlocks', desc: 'Critical section problem, semaphores, mutexes, dining philosophers, and deadlock avoidance.' },
      { title: 'Memory Management & Virtual Memory', desc: 'Paging, segmentation, TLB, demand paging, and page replacement (FIFO, LRU, Optimal).' },
      { title: 'File Systems & I/O Management', desc: 'File allocation, directory structures, disk scheduling, and kernel I/O subsystem.' }
    ];
  }
  if (upper.includes('NETWORK') || upper.includes('CN')) {
    return [
      { title: 'Network Models & Physical Layer', desc: 'OSI and TCP/IP reference models, transmission media, switching, and multiplexing techniques.' },
      { title: 'Data Link Layer & LANs', desc: 'Framing, error detection/correction (CRC), MAC protocols (CSMA/CD, CSMA/CA), and Ethernet.' },
      { title: 'Network Layer & Routing', desc: 'IPv4/IPv6 addressing, subnetting, routing algorithms (Distance Vector, Link State), and ICMP/ARP.' },
      { title: 'Transport Layer Protocols', desc: 'UDP, TCP connection management, flow control, congestion control, and socket programming.' },
      { title: 'Application Layer & Security', desc: 'DNS, HTTP, FTP, SMTP, cryptography basics, SSL/TLS, and network security protocols.' }
    ];
  }
  return [
    { title: 'Unit I: Core Principles & Theoretical Foundations', desc: 'Fundamental definitions, historical context, underlying mathematical models, and primary architectural concepts.' },
    { title: 'Unit II: Operational Workflows & System Mechanisms', desc: 'Detailed structural breakdown, core operational workflows, intermediate theorems, and standard analytical methodologies.' },
    { title: 'Unit III: Advanced Methodologies & Subsystem Design', desc: 'In-depth exploration of complex subsystems, advanced algorithmic approaches, and structural optimization techniques.' },
    { title: 'Unit IV: Industry Implementation & Practical Applications', desc: 'Real-world case studies, contemporary industry tooling, practical project synthesis, and comprehensive performance evaluation.' }
  ];
}

export default function SyllabusClient({ subjects, branch, semester, syllabusUrl, initialResources }: SyllabusClientProps) {
  const { searchQuery } = useAcademicStore();
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);
  const [progressMap, setProgressMap] = useState<Record<string, boolean>>({});
  const [mounted, setMounted] = useState(false);
  const resources = initialResources as ResourceItemExt[];

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setProgressMap(JSON.parse(saved));
      }
    } catch {}
    setMounted(true);
  }, []);

  const getMatchingResources = (
    moduleTitle: string,
    moduleDesc: string,
    subjectName: string
  ) => {
    const subjectResources = resources.filter(
      r => isSubjectMatch(r.subject_name, subjectName)
    );
    
    const pool = subjectResources;
    if (pool.length === 0) return [];
    
    const titleWords = moduleTitle.toLowerCase()
      .replace(/unit\s+[ivx]+/gi, '')
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3);
      
    const descWords = moduleDesc.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3);
      
    const keywords = Array.from(new Set([...titleWords, ...descWords]));
    
    const scored = pool.map(resource => {
      const rTitle = resource.title.toLowerCase();
      let score = 0;
      keywords.forEach(word => {
        if (rTitle.includes(word)) {
          score += 1;
        }
      });
      return { resource, score };
    });
    
    return scored
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(item => item.resource)
      .slice(0, 3);
  };

  const toggleModule = (subjectId: string, moduleIdx: number) => {
    const key = `${subjectId}_${moduleIdx}`;
    setProgressMap((prev) => {
      const nextState = !prev[key];
      const updated = { ...prev, [key]: nextState };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      if (nextState) {
        logActivity('syllabus_module_completed', 1);
      }
      return updated;
    });
  };

  // Merge DB subjects with official syllabus subjects if AIDS Sem 4
  const displaySubjects = useMemo(() => {
    if (branch === 'AIDS' && semester === 4) {
      return AIDS_SEM_4_SUBJECTS.map((officialSub) => {
        const dbSub = subjects.find(s => isSubjectMatch(s.name, officialSub.name));
        return {
          id: dbSub ? dbSub.id : officialSub.id,
          name: officialSub.name,
          branch: 'AIDS',
          semester: 4,
          code: officialSub.code,
          type: officialSub.type,
          credits: officialSub.credits,
          modules: officialSub.modules,
        };
      });
    }

    // For other branches/semesters, use DB subjects but attach realistic modules
    return subjects.map((sub) => {
      const modules = getModulesForSubject(sub.name);
      return {
        ...sub,
        code: `SUB-${sub.id.substring(0, 4).toUpperCase()}`,
        type: 'PM',
        credits: 3,
        modules,
      };
    });
  }, [subjects, branch, semester]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return displaySubjects;
    const q = searchQuery.toLowerCase();
    return displaySubjects.filter(
      (s) => s.name.toLowerCase().includes(q) || 
             s.code.toLowerCase().includes(q) || 
             isSubjectMatch(s.name, searchQuery)
    );
  }, [displaySubjects, searchQuery]);

  // Calculate Overall Progress
  const totalModules = filtered.reduce((acc, sub) => acc + sub.modules.length, 0);
  const completedModules = useMemo(() => {
    if (filtered.length === 0) return 0;
    return filtered.reduce((acc, sub) => {
      const subDone = sub.modules.filter((_, idx) => progressMap[`${sub.id}_${idx}`]).length;
      return acc + subDone;
    }, 0);
  }, [filtered, progressMap]);

  const overallPercentage = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;
  const estimatedHoursLeft = (totalModules - completedModules) * 3;

  const getSubjectIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('artificial intelligence') || n.includes('expert systems') || n.includes('ai')) return Brain;
    if (n.includes('data engineering') || n.includes('database') || n.includes('dbms')) return Database;
    if (n.includes('algorithm') || n.includes('daa') || n.includes('data structure') || n.includes('dsa')) return Cpu;
    if (n.includes('project') || n.includes('pbl') || n.includes('lab')) return Activity;
    if (n.includes('german')) return Compass;
    return BookOpen;
  };

  if (!mounted) {
    return (
      <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-12 flex justify-center items-center h-[50vh]">
        <span className="text-sm font-semibold text-muted">Initializing dashboard...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 min-h-[90vh] relative">
      {/* Decorative ambient blurred spots for premium futuristic feel */}
      <div className="absolute top-[-10%] left-[-20%] w-[600px] h-[600px] rounded-full bg-primary/10 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-500/5 blur-[130px] pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-border/60 pb-6 relative z-10">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-widest bg-primary/5 border border-primary/20 px-3 py-1 rounded-full w-max mb-3">
            <GraduationCap className="w-3.5 h-3.5" />
            Curriculum Navigator
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground bg-clip-text">
            Syllabus Tracker
          </h1>
          <p className="text-muted-foreground text-sm mt-1.5 font-medium">
            {branch} Workspace <span className="mx-1.5 text-border">•</span> Semester {semester} <span className="mx-1.5 text-border">•</span> {filtered.length} Course{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {syllabusUrl && (
            <a
              href={syllabusUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-surface to-surface/80 border border-border/80 text-foreground text-sm font-bold hover:border-border-strong hover:scale-[1.01] transition-all shadow-xs shrink-0 backdrop-blur-md"
            >
              <FileText className="w-4 h-4 text-primary" />
              Download Official PDF
            </a>
          )}
        </div>
      </div>

      {/* Premium Dashboard Metrics Panel */}
      {filtered.length > 0 && (
        <div className="bg-gradient-to-br from-card/85 to-card/60 border border-border/80 rounded-3xl p-6 mb-10 shadow-lg backdrop-blur-xl flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
          <div className="flex flex-wrap items-center gap-6 w-full md:w-auto">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/25 to-primary/5 border border-primary/20 flex items-center justify-center shrink-0 shadow-inner">
              <Trophy className="w-7 h-7 text-primary animate-pulse" />
            </div>
            
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-foreground tracking-tight">Semester Completion</h3>
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground font-semibold">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  {completedModules} / {totalModules} Units Done
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-500" />
                  ~{estimatedHoursLeft} Hours Study Left
                </span>
              </div>
            </div>
          </div>

          <div className="w-full md:w-80 flex flex-col gap-2 shrink-0">
            <div className="flex justify-between items-end text-xs font-bold">
              <span className="text-muted-foreground">Overall Completion</span>
              <span className="text-primary text-sm font-extrabold">{overallPercentage}%</span>
            </div>
            <div className="h-3 w-full bg-surface border border-border/60 rounded-full overflow-hidden p-0.5">
              <div
                className="h-full bg-gradient-to-r from-primary to-primary-strong transition-all duration-700 rounded-full shadow-[0_0_8px_rgba(var(--primary-rgb),0.3)]"
                style={{ width: `${overallPercentage}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Subject Cards List */}
      <div className="space-y-6 relative z-10">
        <AnimatePresence mode="popLayout">
          {filtered.map((subject, i) => {
            const isExpanded = expandedSubject === subject.id;
            const subCompleted = subject.modules.filter((_, idx) => progressMap[`${subject.id}_${idx}`]).length;
            const subPercentage = subject.modules.length > 0 ? Math.round((subCompleted / subject.modules.length) * 100) : 0;
            const SubjectIcon = getSubjectIcon(subject.name);

            return (
              <motion.div
                key={subject.id}
                layout="position"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className={`bg-gradient-to-br from-card/90 to-card/70 border transition-all rounded-3xl overflow-hidden ${
                  isExpanded 
                    ? 'border-primary/45 shadow-[0_4px_24px_rgba(var(--primary-rgb),0.06)]' 
                    : 'border-border/80 hover:border-border-strong hover:shadow-md'
                }`}
              >
                {/* Subject Header */}
                <div
                  onClick={() => setExpandedSubject(isExpanded ? null : subject.id)}
                  className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5 cursor-pointer hover:bg-surface/30 transition-colors"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border transition-colors ${
                      isExpanded 
                        ? 'bg-primary/10 border-primary/25 text-primary' 
                        : 'bg-surface border-border text-foreground'
                    }`}>
                      <SubjectIcon className="w-6 h-6" />
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-bold text-foreground tracking-tight truncate max-w-[280px] sm:max-w-md">
                          {subject.name}
                        </h2>
                        <span className="text-[10px] font-mono font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-lg shrink-0">
                          {subject.code}
                        </span>
                        <span className="text-[10px] font-bold text-muted-foreground bg-surface border border-border px-2 py-0.5 rounded-lg shrink-0">
                          {subject.type} · {subject.credits} CR
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground font-semibold">
                        Syllabus Tracker Core Modules
                      </p>
                    </div>
                  </div>

                  {/* Progress Indicator & Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-t-0 pt-4 sm:pt-0 border-border/40 shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-sm font-extrabold text-foreground block leading-tight">{subPercentage}%</span>
                        <span className="text-[10px] text-muted-foreground font-bold">{subCompleted} / {subject.modules.length} Completed</span>
                      </div>
                      
                      {/* Apple Watch Style SVG Progress Ring */}
                      <div className="relative w-10 h-10 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                          <circle
                            cx="18"
                            cy="18"
                            r="15.915"
                            className="stroke-surface"
                            strokeWidth="3.5"
                            fill="none"
                          />
                          <circle
                            cx="18"
                            cy="18"
                            r="15.915"
                            className="stroke-primary transition-all duration-500"
                            strokeWidth="3.5"
                            strokeDasharray={`${subPercentage}, 100`}
                            strokeLinecap="round"
                            fill="none"
                          />
                        </svg>
                        {subPercentage === 100 && (
                          <Check className="w-4 h-4 text-primary absolute" />
                        )}
                      </div>
                    </div>

                    <div className="w-9 h-9 rounded-xl bg-surface border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-all shrink-0">
                      {isExpanded ? <ChevronUp className="w-4.5 h-4.5" /> : <ChevronDown className="w-4.5 h-4.5" />}
                    </div>
                  </div>
                </div>

                {/* Collapsible Subject Modules */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="border-t border-border/50 bg-surface/10"
                    >
                      <div className="p-6 space-y-4">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                          <Sparkles className="w-3.5 h-3.5 text-primary" />
                          Curriculum Units
                        </div>

                        <div className="space-y-3.5">
                          {subject.modules.map((mod, modIdx) => {
                            const isDone = progressMap[`${subject.id}_${modIdx}`];
                            const matches = getMatchingResources(mod.title, mod.desc, subject.name);

                            return (
                              <div
                                key={modIdx}
                                onClick={() => toggleModule(subject.id, modIdx)}
                                className={`flex flex-col p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
                                  isDone
                                    ? 'bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/25 hover:border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                                    : 'bg-card border-border/80 hover:border-border-strong hover:scale-[1.005] hover:shadow-xs text-foreground'
                                }`}
                              >
                                <div className="flex items-start gap-4 z-10">
                                  <div
                                    className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                                      isDone 
                                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs' 
                                        : 'bg-surface border-border group-hover:border-border-strong'
                                    }`}
                                  >
                                    {isDone && <Check className="w-4 h-4 stroke-[3]" />}
                                  </div>

                                  <div className="min-w-0 flex-1 space-y-1">
                                    <h5 className={`text-base font-bold leading-snug tracking-tight ${isDone ? 'line-through opacity-75' : ''}`}>
                                      {mod.title}
                                    </h5>
                                    <p className={`text-xs leading-relaxed font-medium ${isDone ? 'text-muted-foreground opacity-70' : 'text-muted-foreground'}`}>
                                      {mod.desc}
                                    </p>
                                  </div>
                                </div>

                                {/* Study resources pill cards */}
                                {matches.length > 0 && (
                                  <div 
                                    className="mt-4 flex flex-wrap gap-2 items-center pl-10 z-10" 
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">Vault Files:</span>
                                    {matches.map(file => (
                                      <a
                                        key={file.id}
                                        href={file.file_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 text-xs font-semibold bg-surface hover:bg-surface-hover hover:border-border-strong border border-border/80 px-2.5 py-1 rounded-xl text-foreground transition-all shadow-3xs"
                                      >
                                        <FileText className="w-3.5 h-3.5 text-primary" />
                                        <span className="truncate max-w-[140px] font-bold">{file.title}</span>
                                      </a>
                                    ))}
                                  </div>
                                )}

                                {/* Premium quick launch actions */}
                                <div 
                                  className="mt-4 pt-3.5 border-t border-border/40 flex flex-wrap gap-2 pl-10 z-10" 
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <a
                                    href={`/ask?tab=chat&prompt=${encodeURIComponent(`Create a detailed study guide explaining this syllabus topic: "${subject.name} - ${mod.title}". Focus on: ${mod.desc}`)}`}
                                    className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-primary bg-surface hover:bg-surface-hover border border-border hover:border-primary/30 px-3.5 py-2 rounded-xl transition-all shadow-3xs hover:scale-[1.01]"
                                  >
                                    <Brain className="w-3.5 h-3.5 text-primary shrink-0" />
                                    Study Guide
                                  </a>
                                  <a
                                    href={`/ask?tab=flashcards&topic=${encodeURIComponent(`${subject.name} - ${mod.title}`)}`}
                                    className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-primary bg-surface hover:bg-surface-hover border border-border hover:border-primary/30 px-3.5 py-2 rounded-xl transition-all shadow-3xs hover:scale-[1.01]"
                                  >
                                    <Layers className="w-3.5 h-3.5 text-primary shrink-0" />
                                    Flashcards
                                  </a>
                                  <a
                                    href={`/ask?tab=quiz&topic=${encodeURIComponent(`${subject.name} - ${mod.title}`)}`}
                                    className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-primary bg-surface hover:bg-surface-hover border border-border hover:border-primary/30 px-3.5 py-2 rounded-xl transition-all shadow-3xs hover:scale-[1.01]"
                                  >
                                    <HelpCircle className="w-3.5 h-3.5 text-primary shrink-0" />
                                    Take Quiz
                                  </a>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Subject Card Footer */}
                        <div className="pt-4 flex items-center justify-between border-t border-border/40 mt-6 pl-1">
                          <span className="text-xs text-muted-foreground italic font-medium">Click any unit block to log completion progress.</span>
                          <a
                            href={`/ask?topic=${encodeURIComponent(subject.name)}`}
                            className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline hover:gap-1.5 transition-all"
                          >
                            Query AI on Subject
                            <ChevronRight className="w-4.5 h-4.5" />
                          </a>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Empty states */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center p-20 text-center border-2 border-dashed border-border/80 rounded-3xl bg-card my-12 relative z-10">
          <BookMarked className="w-12 h-12 text-muted-foreground/30 mb-4 animate-bounce" />
          <p className="text-lg font-bold text-foreground mb-1">No matching courses found</p>
          <p className="text-sm text-muted-foreground max-w-sm">
            {searchQuery 
              ? `We couldn't find any subjects matching "${searchQuery}". Please check your search query.`
              : `No curriculum subjects are populated for ${branch} Semester ${semester} in the database.`}
          </p>
        </div>
      )}

      {/* Global Navigation Link to Resource Vault */}
      {filtered.length > 0 && (
        <div className="mt-14 flex justify-center relative z-10">
          <a
            href={`/resources?branch=${branch}&semester=${semester}`}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-surface border border-border/80 hover:border-border-strong hover:bg-surface-hover text-sm font-bold text-muted-foreground hover:text-foreground transition-all group shadow-sm hover:scale-[1.01]"
          >
            <Layers className="w-4 h-4 text-primary" />
            Open Study Resource Vault
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1.5 transition-all" />
          </a>
        </div>
      )}
    </div>
  );
}
