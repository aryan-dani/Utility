'use client';

import { useMemo, useState, useEffect } from 'react';
import { SubjectItem } from '@/lib/dataFetcher';
import { useAcademicStore } from '@/store/academicStore';
import { BookMarked, Layers, Search, FileText, ArrowRight, Check, ChevronDown, ChevronUp, Trophy } from 'lucide-react';
import { logActivity } from '@/components/ActivityHeatmap';

interface SyllabusClientProps {
  subjects: SubjectItem[];
  branch: string;
  semester: number;
  syllabusUrl?: string | null;
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
  },
  {
    id: 'aud20020',
    code: 'AUD20020',
    name: 'German Basic II',
    type: 'UC',
    credits: 2,
    modules: [
      { title: 'Advanced Grammar & Sentence Structure', desc: 'Complex sentence formation, past tenses, separable verbs, and modal verbs.' },
      { title: 'Vocabulary & Daily Communication', desc: 'Vocabulary for professional workplace settings, travel, ordering food, and cultural exchanges.' },
      { title: 'Reading & Comprehension', desc: 'Reading German short texts, articles, dialogues, and practicing comprehension skills.' },
      { title: 'Listening & Oral Dialogue', desc: 'Interactive conversational practice, listening audio exercises, and oral presentations.' }
    ]
  },
  {
    id: 'aud20140',
    code: 'AUD20140',
    name: 'Constitution II',
    type: 'UC',
    credits: 2,
    modules: [
      { title: 'Fundamental Rights & Duties', desc: 'In-depth study of constitutional rights, directive principles of state policy, and citizen duties.' },
      { title: 'Organs of Governance', desc: 'Structure, powers, and functioning of the Legislature, Executive, and Judiciary.' },
      { title: 'Constitutional Amendments & Judgments', desc: 'Key constitutional amendments, judicial review, and landmark Supreme Court cases.' },
      { title: 'Local Self-Government & Elections', desc: 'Panchayati Raj, municipal governance structure, and the Election Commission framework.' }
    ]
  },
  {
    id: 'dec210',
    code: 'DEC210',
    name: 'Co-curricular Activity',
    type: 'CE',
    credits: 0,
    modules: [
      { title: 'Professional Workshops & Seminars', desc: 'Active participation in technical symposiums, coding hackathons, and industry guest lectures.' },
      { title: 'Community & Social Impact', desc: 'Extension activities, NSS involvement, technical club leadership, and societal contributions.' }
    ]
  },
  {
    id: 'uhv200',
    code: 'UHV200',
    name: 'Life Transforming Skills II',
    type: 'UC',
    credits: 2,
    modules: [
      { title: 'Harmony in the Self & Family', desc: 'Understanding human values, self-exploration, and fostering healthy interpersonal relationships.' },
      { title: 'Harmony in Society & Nature', desc: 'Social ethics, universal human order, co-existence with nature, and sustainable development.' },
      { title: 'Professional Ethics & Integrity', desc: 'Ethical conduct in engineering, resolving moral dilemmas, and corporate social responsibility.' }
    ]
  },
  {
    id: 'ues203',
    code: 'UES203',
    name: 'Knowledge Skills for Life',
    type: 'I',
    credits: 1,
    modules: [
      { title: 'Critical Thinking & Problem Solving', desc: 'Frameworks for analytical thinking, identifying cognitive biases, and logical reasoning.' },
      { title: 'Financial Literacy & Management', desc: 'Basics of personal finance, budgeting, investment strategies, and economic awareness.' },
      { title: 'Effective Communication & Leadership', desc: 'Public speaking articulation, negotiation skills, teamwork dynamics, and leadership principles.' }
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
      { title: 'CPU Scheduling & Threads', desc: 'Scheduling algorithms (FCFS, SJF, RR, Multilevel queue), multithreading models, and POSIX threads.' },
      { title: 'Process Synchronization & Deadlocks', desc: 'Critical section problem, semaphores, mutexes, dining philosophers, and deadlock detection/avoidance.' },
      { title: 'Memory Management & Virtual Memory', desc: 'Paging, segmentation, TLB, demand paging, and page replacement algorithms (FIFO, LRU, Optimal).' },
      { title: 'File Systems & I/O Management', desc: 'File allocation methods, directory structures, disk scheduling (FCFS, SSTF, SCAN), and kernel I/O subsystem.' }
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
  // Generic but professional academic fallback for any other subject
  return [
    { title: 'Unit I: Core Principles & Theoretical Foundations', desc: 'Fundamental definitions, historical context, underlying mathematical models, and primary architectural concepts.' },
    { title: 'Unit II: Operational Workflows & System Mechanisms', desc: 'Detailed structural breakdown, core operational workflows, intermediate theorems, and standard analytical methodologies.' },
    { title: 'Unit III: Advanced Methodologies & Subsystem Design', desc: 'In-depth exploration of complex subsystems, advanced algorithmic approaches, and structural optimization techniques.' },
    { title: 'Unit IV: Industry Implementation & Practical Applications', desc: 'Real-world case studies, contemporary industry tooling, practical project synthesis, and comprehensive performance evaluation.' }
  ];
}

export default function SyllabusClient({ subjects, branch, semester, syllabusUrl }: SyllabusClientProps) {
  const { searchQuery } = useAcademicStore();
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);
  const [progressMap, setProgressMap] = useState<Record<string, boolean>>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setProgressMap(JSON.parse(saved));
      }
    } catch {}
    setMounted(true);
  }, []);

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
        const dbSub = subjects.find(s => s.name.toLowerCase() === officialSub.name.toLowerCase() || s.name.toLowerCase().includes(officialSub.name.toLowerCase()));
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
    return displaySubjects.filter((s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q));
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

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 min-h-[80vh]">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Syllabus Tracker</h1>
          <p className="text-muted text-sm mt-1">
            {branch} · Semester {semester} · {filtered.length} subject{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {syllabusUrl && (
            <a
              href={syllabusUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface border border-border text-foreground text-sm font-semibold hover:bg-surface-hover transition-all shadow-xs flex-shrink-0"
            >
              <FileText className="w-4 h-4" />
              Download PDF Syllabus
            </a>
          )}
        </div>
      </div>

      {/* Overall Progress Strip */}
      {filtered.length > 0 && mounted && (
        <div className="bg-card border border-border rounded-2xl p-6 mb-8 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <div className="w-12 h-12 rounded-2xl bg-surface border border-border flex items-center justify-center shrink-0 shadow-xs">
              <Trophy className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground leading-snug">Semester Progress Overview</h3>
              <p className="text-xs text-muted mt-0.5">
                {completedModules} of {totalModules} modules completed ({overallPercentage}%)
              </p>
            </div>
          </div>

          <div className="w-full sm:w-72 flex flex-col gap-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-muted">Completion Rate</span>
              <span className="text-foreground">{overallPercentage}%</span>
            </div>
            <div className="h-2 w-full bg-surface border border-border rounded-full overflow-hidden">
              <div
                className="h-full bg-foreground transition-all duration-500 rounded-full"
                style={{ width: `${overallPercentage}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Subject Grid / List */}
      <div className="space-y-4">
        {filtered.map((subject, i) => {
          const isExpanded = expandedSubject === subject.id;
          const subCompleted = subject.modules.filter((_, idx) => progressMap[`${subject.id}_${idx}`]).length;
          const subPercentage = subject.modules.length > 0 ? Math.round((subCompleted / subject.modules.length) * 100) : 0;

          return (
            <div
              key={subject.id}
              className={`bg-card border transition-all rounded-2xl overflow-hidden shadow-card ${
                isExpanded ? 'border-border-strong ring-1 ring-border-strong' : 'border-border hover:border-muted'
              }`}
            >
              {/* Card Header (Clickable) */}
              <div
                onClick={() => setExpandedSubject(isExpanded ? null : subject.id)}
                className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer bg-card hover:bg-surface/50 transition-colors"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center shrink-0 shadow-xs">
                    <BookMarked className="w-5 h-5 text-foreground" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-bold text-foreground leading-tight">
                        {subject.name}
                      </h2>
                      <span className="text-[10px] font-mono font-semibold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md shrink-0">
                        {subject.code}
                      </span>
                      <span className="text-[10px] font-medium text-muted bg-surface border border-border px-2 py-0.5 rounded-md shrink-0">
                        {subject.type} · {subject.credits} Credit{subject.credits > 1 ? 's' : ''}
                      </span>
                    </div>
                    <p className="text-xs text-muted mt-1">
                      {branch} · Sem {semester}
                    </p>
                  </div>
                </div>

                {/* Progress pill & Chevron */}
                <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-t-0 pt-4 sm:pt-0 border-border">
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-xs font-bold text-foreground block">{subPercentage}%</span>
                      <span className="text-[10px] text-muted">{subCompleted} / {subject.modules.length} Done</span>
                    </div>
                    {/* Mini circular progress */}
                    <div className="relative w-9 h-9 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        <path
                          className="text-surface stroke-current"
                          strokeWidth="3.5"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <path
                          className="text-foreground stroke-current transition-all duration-500"
                          strokeWidth="3.5"
                          strokeDasharray={`${subPercentage}, 100`}
                          strokeLinecap="round"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                      </svg>
                    </div>
                  </div>

                  <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-muted hover:text-foreground transition-colors">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>
              </div>

              {/* Expanded Modules */}
              {isExpanded && (
                <div className="border-t border-border bg-surface/30 p-6 space-y-3 animate-fade-in">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted mb-4">Curriculum Modules</h4>
                  {subject.modules.map((mod, modIdx) => {
                    const isDone = progressMap[`${subject.id}_${modIdx}`];

                    return (
                      <div
                        key={modIdx}
                        onClick={() => toggleModule(subject.id, modIdx)}
                        className={`flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer ${
                          isDone
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                            : 'bg-card border-border hover:border-border-strong text-foreground'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                            isDone ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-surface border-border'
                          }`}
                        >
                          {isDone && <Check className="w-3.5 h-3.5" />}
                        </div>

                        <div className="min-w-0 flex-1">
                          <h5 className={`text-sm font-bold leading-tight ${isDone ? 'line-through opacity-80' : ''}`}>
                            {mod.title}
                          </h5>
                          <p className={`text-xs mt-1 leading-relaxed ${isDone ? 'text-muted opacity-80' : 'text-muted'}`}>
                            {mod.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}

                  <div className="pt-4 flex items-center justify-between border-t border-border mt-6">
                    <span className="text-xs text-muted italic">Click any module to mark it as completed.</span>
                    <a
                      href={`/ask?topic=${encodeURIComponent(subject.name)}`}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                    >
                      Ask AI about this subject
                      <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty states */}
      {filtered.length === 0 && searchQuery && (
        <div className="flex flex-col items-center justify-center p-16 text-center border border-dashed border-border rounded-2xl bg-surface my-12">
          <Search className="w-10 h-10 text-muted/30 mb-3" />
          <p className="text-base font-semibold text-foreground mb-1">No matches for &ldquo;{searchQuery}&rdquo;</p>
          <p className="text-sm text-muted">Try a different search term.</p>
        </div>
      )}

      {filtered.length === 0 && !searchQuery && (
        <div className="flex flex-col items-center justify-center p-16 text-center border border-dashed border-border rounded-2xl bg-surface my-12">
          <BookMarked className="w-10 h-10 text-muted/30 mb-3" />
          <p className="text-base font-semibold text-foreground mb-1">No Subjects Found</p>
          <p className="text-sm text-muted">
            No subjects configured for {branch} Semester {semester}.
          </p>
        </div>
      )}

      {/* Hint to resources */}
      {filtered.length > 0 && (
        <div className="mt-12 flex items-center justify-center">
          <a
            href={`/resources?branch=${branch}&semester=${semester}`}
            className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors group"
          >
            <Layers className="w-4 h-4" />
            View all study materials for these subjects
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </a>
        </div>
      )}
    </div>
  );
}
